import { useCallback, useEffect, useState } from 'react';
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
    const session = await vaultLoadSession();
    if (!session) return 'Session introuvable. Reconnectez-vous en ligne.';
    if (online && session.accessToken !== 'demo-token') {
      await pullBootstrap(session);
    }
    setGate(await admitSession(session));
    return null;
  }, [online]);

  const continueSavedSession = useCallback(async () => {
    const session = await vaultLoadSession();
    if (!session) return 'Session introuvable. Reconnectez-vous en ligne.';
    if (online && session.accessToken !== 'demo-token') {
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
      if (!online) return 'Connexion requise pour changer de pharmacie.';

      const res = await switchPharmacyOnServer(current, pharmacyId);
      if (!res.ok) return res.message;

      const next: StoredSession = {
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
        const sub = await nestFetch(`/pharmacies/${next.organizationId}/subscription`, {
          token: next.accessToken,
        });
        if (sub.ok && sub.data?.subscription) {
          next.planName =
            sub.data.subscription.planName ||
            (sub.data.subscription.isPaid ? 'Pro' : 'Gratuit');
          next.desktopAllowed = Boolean(sub.data.subscription.isPaid);
          next.expiresAt = sub.data.subscription.currentPeriodEnd
            ? new Date(sub.data.subscription.currentPeriodEnd).toISOString()
            : null;
        }
      } catch {
        /* keep previous plan fields */
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
