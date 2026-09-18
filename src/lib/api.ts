import { nestFetch } from './nest';
import type { DesktopRole, StoredSession } from './session';
import { pullBootstrap } from './remote-sync';
import { API_BASE_URL } from './brand';

export type LoginResult =
  | { ok: true; session: StoredSession }
  | { ok: false; message: string };

const DESKTOP_ROLES = new Set(['PHARMACIEN', 'PHARMACY_ADMIN', 'FOURNISSEUR']);

function demoSession(email: string, role: DesktopRole): StoredSession {
  const expires = new Date();
  expires.setDate(expires.getDate() + 30);
  const now = new Date().toISOString();
  return {
    accessToken: 'demo-token',
    email,
    displayName: role === 'PHARMACY' ? 'Pharmacie Démo' : 'Fournisseur Démo',
    role,
    organizationId: 'demo-org',
    organizationName: role === 'PHARMACY' ? 'Pharmacie Démo' : 'Dépôt Démo',
    desktopAllowed: true,
    planName: 'Pro',
    expiresAt: expires.toISOString(),
    licenseCheckedAt: now,
    enrolledAt: now,
  };
}

async function resolveDesktopEntitlement(
  user: Record<string, any>,
  accessToken: string,
): Promise<{
  desktopAllowed: boolean;
  planName: string;
  expiresAt: string | null;
  organizationName: string;
  organizationId: string;
}> {
  const organizationId = String(user.pharmacyId || user.id);
  let organizationName =
    user.role === 'FOURNISSEUR' ? 'Fournisseur' : 'Pharmacie';
  let desktopAllowed = false;
  let planName = 'Gratuit';
  let expiresAt: string | null = null;

  if (user.role === 'FOURNISSEUR') {
    return {
      desktopAllowed: true,
      planName: 'Fournisseur',
      expiresAt: null,
      organizationName,
      organizationId,
    };
  }

  if (user.pharmacyId) {
    const sub = await nestFetch(`/pharmacies/${user.pharmacyId}/subscription`, {
      token: accessToken,
    });
    if (sub.ok && sub.data) {
      const subscription = sub.data.subscription ?? sub.data;
      const isPaid = Boolean(subscription?.isPaid);
      desktopAllowed = isPaid;
      planName = subscription?.planName || (isPaid ? 'Pro' : 'Gratuit');
      expiresAt = subscription?.currentPeriodEnd
        ? new Date(subscription.currentPeriodEnd).toISOString()
        : null;
    }

    const mine = await nestFetch('/pharmacies/mine', { token: accessToken });
    if (mine.ok) {
      const list = Array.isArray(mine.data)
        ? mine.data
        : mine.data?.data ?? mine.data?.pharmacies ?? [];
      const match =
        list.find((p: { id?: string }) => p.id === user.pharmacyId) ?? list[0];
      if (match?.name) organizationName = String(match.name);
    }
  }

  return {
    desktopAllowed,
    planName,
    expiresAt,
    organizationName,
    organizationId,
  };
}

/**
 * Password login — Nest API only (no Next.js dependency).
 */
export async function loginDesktop(
  emailRaw: string,
  passwordRaw: string,
  online: boolean,
): Promise<LoginResult> {
  if (!online) {
    return {
      ok: false,
      message:
        'La première connexion (ou une reconnexion avec mot de passe) nécessite le backend en ligne. Si cet appareil a déjà été enregistré, utilisez votre code PIN hors ligne.',
    };
  }

  const email = emailRaw.trim().toLowerCase();
  const password = passwordRaw.trim();

  const isDemoMailbox = email.endsWith('@demo.pharmacd') || email === 'demo';
  if (isDemoMailbox && password === 'pro') {
    const role: DesktopRole = email.startsWith('fournisseur')
      ? 'FOURNISSEUR'
      : 'PHARMACY';
    return {
      ok: true,
      session: demoSession(email === 'demo' ? 'pharmacie@demo.pharmacd' : email, role),
    };
  }

  if (isDemoMailbox && password === 'free') {
    return {
      ok: false,
      message:
        'Le plan gratuit n’a pas accès à l’application bureau. Passez en Pro sur pharmacd.org.',
    };
  }

  try {
    const { ok, data } = await nestFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: email, password }),
    });

    if (!ok) {
      return {
        ok: false,
        message:
          (typeof data.message === 'string' && data.message) ||
          'Connexion impossible. Vérifiez vos identifiants ou votre réseau.',
      };
    }

    const user = data.user;
    const accessToken = data.accessToken as string | undefined;
    const refreshToken = data.refreshToken as string | undefined;

    if (!user || !accessToken || !refreshToken) {
      return { ok: false, message: 'Réponse d’authentification invalide.' };
    }

    if (!DESKTOP_ROLES.has(String(user.role))) {
      return {
        ok: false,
        message:
          'L’application bureau est réservée aux pharmacies et fournisseurs.',
      };
    }

    const entitlement = await resolveDesktopEntitlement(user, accessToken);
    if (!entitlement.desktopAllowed) {
      return {
        ok: false,
        message:
          'L’application bureau est réservée aux abonnements Pro. Passez en Pro sur pharmacd.org.',
      };
    }

    const role: DesktopRole =
      user.role === 'FOURNISSEUR' ? 'FOURNISSEUR' : 'PHARMACY';
    const now = new Date().toISOString();
    const session: StoredSession = {
      accessToken,
      refreshToken,
      email: user.email || email,
      displayName:
        [user.firstName, user.lastName].filter(Boolean).join(' ') ||
        entitlement.organizationName,
      role,
      organizationId: entitlement.organizationId,
      organizationName: entitlement.organizationName,
      desktopAllowed: true,
      planName: entitlement.planName,
      expiresAt: entitlement.expiresAt,
      licenseCheckedAt: now,
      enrolledAt: now,
    };

    const boot = await pullBootstrap(session);
    if (!boot.ok) {
      return {
        ok: false,
        message:
          boot.message ||
          'Connecté, mais le téléchargement du catalogue a échoué. Réessayez.',
      };
    }

    return { ok: true, session };
  } catch (err) {
    const detail = err instanceof Error ? err.message : '';
    const localHint = /localhost|127\.0\.0\.1/i.test(API_BASE_URL)
      ? ' Démarrez le backend Nest (port 3002), puis réessayez.'
      : '';
    return {
      ok: false,
      message: `Impossible de joindre ${API_BASE_URL}.${localHint}${
        detail ? ` (${detail})` : ''
      }`,
    };
  }
}
