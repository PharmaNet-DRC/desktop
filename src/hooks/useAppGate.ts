import { useCallback, useEffect, useRef, useState } from 'react';
import { evaluateLocalEntitlement } from '@/lib/tauri';
import {
  clearMemorySession,
  getMemorySession,
  setMemorySession,
  type Entitlement,
  type StoredSession,
} from '@/lib/session';
import { loginDesktop } from '@/lib/api';
import { pullBootstrap } from '@/lib/remote-sync';
import { switchPharmacyOnServer } from '@/lib/pharmacy-api';
import {
  vaultClearDevice,
  vaultHasPin,
  vaultHasSession,
  vaultLoadSession,
  vaultSaveSession,
  vaultSetPin,
  vaultVerifyPin,
} from '@/lib/vault';

export type AppGate =
  | { status: 'loading' }
  | { status: 'login'; hasDevice: boolean }
  | { status: 'unlock'; sessionPreview: { email: string; organizationName: string }; requiresPin: boolean }
  | { status: 'setup-pin'; session: StoredSession }
  | { status: 'locked'; reason: string; session: StoredSession | null }
  | { status: 'ready'; session: StoredSession; entitlement: Entitlement };

async function admitSession(session: StoredSession): Promise<AppGate> {
  const entitlement = await evaluateLocalEntitlement({
    expiresAt: session.expiresAt,
    desktopAllowed: session.desktopAllowed,
    graceEndsAt: session.graceEndsAt,
  });
  if (!entitlement.allowed) {
    return {
      status: 'locked',
      reason: entitlement.reason ?? 'Accès bureau refusé.',
      session,
    };
  }
  setMemorySession(session);
  return { status: 'ready', session, entitlement };
}

export function useAppGate(online: boolean) {
  const [gate, setGate] = useState<AppGate>({ status: 'loading' });

  const bootstrap = useCallback(async () => {
    const mem = getMemorySession();
    if (mem) {
      if (online && mem.accessToken !== 'demo-token') {
        void pullBootstrap(mem);
        // Re-check Pro / grace with the server so desktop locks after grace ends.
        try {
          const { nestFetch } = await import('@/lib/nest');
          const { computeGraceEndsAt } = await import('@/lib/session');
          const sub = await nestFetch(
            `/pharmacies/${mem.organizationId}/subscription`,
          );
          if (sub.ok && sub.data) {
            const subscription = sub.data.subscription;
            const isPaid = Boolean(subscription?.isPaid);
            const expiresAt = subscription?.currentPeriodEnd
              ? new Date(subscription.currentPeriodEnd).toISOString()
              : null;
            const pl = sub.data.productLimit;
            // Merge onto memory so we never write back a revoked refresh token.
            const fresh = getMemorySession() ?? mem;
            const next = {
              ...fresh,
              desktopAllowed: isPaid,
              planName:
                subscription?.planName ||
                (isPaid ? 'Pro' : 'Gratuit'),
              expiresAt,
              grace: pl?.grace ?? null,
              graceEndsAt: pl?.grace?.graceEndsAt ?? computeGraceEndsAt(expiresAt),
              licenseCheckedAt: new Date().toISOString(),
            };
            await vaultSaveSession(next);
            setGate(await admitSession(next));
            return;
          }
        } catch {
          /* keep local session */
        }
      }
      setGate(await admitSession(mem));
      return;
    }

    const has = await vaultHasSession();
    if (!has) {
      setGate({ status: 'login', hasDevice: false });
      return;
    }

    const session = await vaultLoadSession();
    if (!session) {
      setGate({ status: 'login', hasDevice: false });
      return;
    }

    const pin = await vaultHasPin();
    if (pin) {
      setGate({
        status: 'unlock',
        requiresPin: true,
        sessionPreview: {
          email: session.email,
          organizationName: session.organizationName,
        },
      });
      return;
    }

    setGate(await admitSession(session));
  }, [online]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const wasOnlineRef = useRef(online);
  useEffect(() => {
    const becameOnline = !wasOnlineRef.current && online;
    wasOnlineRef.current = online;
    if (!becameOnline || gate.status !== 'ready') return;
    if (gate.session.accessToken === 'demo-token') return;
    let cancelled = false;
    (async () => {
      try {
        setMemorySession(gate.session);
        const aligned = await switchPharmacyOnServer(
          gate.session,
          gate.session.organizationId,
        );
        if (cancelled) return;
        let next = gate.session;
        if (aligned.ok) {
          next = {
            ...next,
            accessToken: aligned.accessToken,
            refreshToken: aligned.refreshToken,
            organizationId: aligned.pharmacyId,
          };
        }
        const { refreshMinePharmacies } = await import('@/lib/pharmacy-api');
        next = await refreshMinePharmacies(next);
        if (cancelled) return;
        await vaultSaveSession(next);
        setGate(await admitSession(next));
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [online, gate]);

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await loginDesktop(email, password, online);
      if (!result.ok) return result.message;

      await vaultSaveSession(result.session);
      const pin = await vaultHasPin();
      if (!pin) {
        setGate({ status: 'setup-pin', session: result.session });
        return null;
      }
      setGate(await admitSession(result.session));
      return null;
    },
    [online],
  );

  const unlockWithPin = useCallback(async (pin: string) => {
    const ok = await vaultVerifyPin(pin);
    if (!ok) return 'Code PIN incorrect.';
    let session = await vaultLoadSession();
    if (!session) return 'Session introuvable. Reconnectez-vous en ligne.';
    if (online && session.accessToken !== 'demo-token') {
      const { rotateDesktopRefresh } = await import('@/lib/nest');
      setMemorySession(session);
      const refreshed = await rotateDesktopRefresh();
      if (refreshed) {
        session = getMemorySession() ?? session;
      }
      // Align JWT with the pharmacy chosen hors ligne, then refresh site list.
      try {
        const aligned = await switchPharmacyOnServer(session, session.organizationId);
        if (aligned.ok) {
          session = {
            ...session,
            accessToken: aligned.accessToken,
            refreshToken: aligned.refreshToken,
            organizationId: aligned.pharmacyId,
          };
          setMemorySession(session);
        }
        const { refreshMinePharmacies } = await import('@/lib/pharmacy-api');
        session = await refreshMinePharmacies(session);
      } catch {
        /* best-effort */
      }
      await pullBootstrap(session);
    }
    setGate(await admitSession(session));
    return null;
  }, [online]);

  const continueSavedSession = useCallback(async () => {
    let session = await vaultLoadSession();
    if (!session) return 'Session introuvable. Reconnectez-vous en ligne.';
    if (online && session.accessToken !== 'demo-token') {
      const { rotateDesktopRefresh } = await import('@/lib/nest');
      setMemorySession(session);
      const refreshed = await rotateDesktopRefresh();
      if (refreshed) {
        session = getMemorySession() ?? session;
      }
      try {
        const aligned = await switchPharmacyOnServer(session, session.organizationId);
        if (aligned.ok) {
          session = {
            ...session,
            accessToken: aligned.accessToken,
            refreshToken: aligned.refreshToken,
            organizationId: aligned.pharmacyId,
          };
          setMemorySession(session);
        }
        const { refreshMinePharmacies } = await import('@/lib/pharmacy-api');
        session = await refreshMinePharmacies(session);
      } catch {
        /* best-effort */
      }
      await pullBootstrap(session);
    }
    setGate(await admitSession(session));
    return null;
  }, [online]);

  const setupPin = useCallback(async (pin: string, session: StoredSession) => {
    try {
      await vaultSetPin(pin);
    } catch (e) {
      return e instanceof Error ? e.message : 'Impossible d’enregistrer le PIN.';
    }
    setGate(await admitSession(session));
    return null;
  }, []);

  const skipPin = useCallback(async (session: StoredSession) => {
    setGate(await admitSession(session));
  }, []);

  /** Lock app UI but keep vault (asks PIN next time if configured). */
  const lock = useCallback(async () => {
    clearMemorySession();
    const has = await vaultHasSession();
    if (!has) {
      setGate({ status: 'login', hasDevice: false });
      return;
    }
    const session = await vaultLoadSession();
    const pin = await vaultHasPin();
    if (pin && session) {
      setGate({
        status: 'unlock',
        requiresPin: true,
        sessionPreview: {
          email: session.email,
          organizationName: session.organizationName,
        },
      });
      return;
    }
    if (session) {
      setGate({
        status: 'unlock',
        requiresPin: false,
        sessionPreview: {
          email: session.email,
          organizationName: session.organizationName,
        },
      });
      return;
    }
    setGate({ status: 'login', hasDevice: false });
  }, []);

  const goToPasswordLogin = useCallback(async () => {
    clearMemorySession();
    const has = await vaultHasSession();
    setGate({ status: 'login', hasDevice: has });
  }, []);

  const goToUnlock = useCallback(async () => {
    const session = await vaultLoadSession();
    const pin = await vaultHasPin();
    if (session && pin) {
      setGate({
        status: 'unlock',
        requiresPin: true,
        sessionPreview: {
          email: session.email,
          organizationName: session.organizationName,
        },
      });
      return;
    }
    if (session) {
      setGate({
        status: 'unlock',
        requiresPin: false,
        sessionPreview: {
          email: session.email,
          organizationName: session.organizationName,
        },
      });
      return;
    }
    setGate({ status: 'login', hasDevice: false });
  }, []);

  /** Remove device enrollment — next login must be online with password. */
  const logoutDevice = useCallback(async () => {
    clearMemorySession();
    await vaultClearDevice();
    setGate({ status: 'login', hasDevice: false });
  }, []);

  const switchPharmacy = useCallback(
    async (pharmacyId: string, pharmacyName: string) => {
      const current = getMemorySession();
      if (!current) return 'Session introuvable.';
      if (current.accessToken === 'demo-token') {
        return 'Changement de pharmacie indisponible en mode démo.';
      }

      const known = current.pharmacies ?? [];
      const target =
        known.find((p) => p.id === pharmacyId) ??
        ({
          id: pharmacyId,
          name: pharmacyName,
          email: current.email,
          phone: null,
          city: null,
          isOwner: true,
          isActive: true,
        } as const);

      if (target.isActive === false) {
        return 'Cette pharmacie est désactivée (limite du forfait).';
      }

      // Hors ligne : bascule locale sur le catalogue déjà synchronisé pour ce site.
      if (!online) {
        if (known.length <= 1 && pharmacyId !== current.organizationId) {
          return 'Aucune autre pharmacie synchronisée sur cet appareil. Connectez-vous une fois en ligne.';
        }
        if (!known.some((p) => p.id === pharmacyId)) {
          return 'Cette pharmacie n’est pas disponible hors ligne sur cet appareil.';
        }
        const next: StoredSession = {
          ...current,
          organizationId: pharmacyId,
          organizationName: pharmacyName || target.name || current.organizationName,
        };
        await vaultSaveSession(next);
        setGate(await admitSession(next));
        return null;
      }

      const res = await switchPharmacyOnServer(current, pharmacyId);
      if (!res.ok) return res.message;

      let next: StoredSession = {
        ...current,
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
        organizationId: res.pharmacyId,
        organizationName: pharmacyName || current.organizationName,
        licenseCheckedAt: new Date().toISOString(),
      };

      // Refresh plan for the newly active pharmacy
      try {
        const { nestFetch } = await import('@/lib/nest');
        const sub = await nestFetch(
          `/pharmacies/${next.organizationId}/subscription`,
        );
        if (sub.ok && sub.data?.subscription) {
          const fresh = getMemorySession() ?? next;
          next = {
            ...fresh,
            organizationId: next.organizationId,
            organizationName: next.organizationName,
            accessToken: next.accessToken,
            refreshToken: next.refreshToken,
            planName:
              sub.data.subscription.planName ||
              (sub.data.subscription.isPaid ? 'Pro' : 'Gratuit'),
            desktopAllowed: Boolean(sub.data.subscription.isPaid),
            expiresAt: sub.data.subscription.currentPeriodEnd
              ? new Date(sub.data.subscription.currentPeriodEnd).toISOString()
              : null,
            licenseCheckedAt: new Date().toISOString(),
          };
          const pl = sub.data.productLimit;
          if (pl?.grace) {
            next.grace = pl.grace;
            next.graceEndsAt = pl.grace.graceEndsAt ?? null;
          } else {
            const { computeGraceEndsAt } = await import('@/lib/session');
            next.grace = null;
            next.graceEndsAt = computeGraceEndsAt(next.expiresAt);
          }
        }
      } catch {
        /* keep previous plan fields */
      }

      try {
        const { refreshMinePharmacies } = await import('@/lib/pharmacy-api');
        next = await refreshMinePharmacies(next);
      } catch {
        /* keep previous pharmacy list */
      }

      await vaultSaveSession(next);
      await pullBootstrap(next);
      setGate(await admitSession(next));
      return null;
    },
    [online],
  );

  const updateOrganizationName = useCallback(async (name: string) => {
    const current = getMemorySession();
    if (!current) return;
    const next = { ...current, organizationName: name };
    await vaultSaveSession(next);
    setGate(await admitSession(next));
  }, []);

  return {
    gate,
    login,
    unlockWithPin,
    continueSavedSession,
    setupPin,
    skipPin,
    lock,
    goToPasswordLogin,
    goToUnlock,
    logoutDevice,
    switchPharmacy,
    updateOrganizationName,
    refresh: bootstrap,
  };
}
