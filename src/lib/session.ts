export type DesktopRole = 'PHARMACY' | 'FOURNISSEUR';

/** Shared copy: free plan = web only; desktop = Pro (offline). */
export const DESKTOP_PRO_REQUIRED_MESSAGE =
  'L’application bureau (mode hors ligne) nécessite un abonnement Pro actif. L’offre gratuite (limite de produits du plan gratuit) reste disponible uniquement sur le site web pharmacd.org en mode en ligne. Souscrivez pour continuer hors ligne.';

export const DESKTOP_GRACE_EXPIRED_MESSAGE =
  'La période de grâce de 6 jours est terminée. L’application bureau est verrouillée. Réabonnez-vous sur pharmacd.org pour l’offline, ou utilisez l’offre gratuite sur le site web.';

export type SessionGrace = {
  phase: 'upcoming' | 'grace';
  periodEnd: string;
  graceEndsAt: string;
  freeMaxProducts: number;
  daysRemaining: number;
};

export type StoredPharmacy = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  city: string | null;
  isOwner: boolean;
  isActive?: boolean;
};

export type StoredSession = {
  accessToken: string;
  refreshToken?: string;
  email: string;
  displayName: string;
  role: DesktopRole;
  organizationId: string;
  organizationName: string;
  /** Free plan → desktopAllowed false */
  desktopAllowed: boolean;
  planName: string;
  /** ISO-8601 end of paid period */
  expiresAt: string | null;
  /** ISO-8601 end of grace (periodEnd + 6 days). After this, desktop locks. */
  graceEndsAt: string | null;
  /** Last known grace banner payload from server (optional). */
  grace: SessionGrace | null;
  /** Last successful online license refresh */
  licenseCheckedAt: string;
  /** First online enrollment timestamp */
  enrolledAt?: string;
  /**
   * Pharmacies known on this device (from last online /pharmacies/mine).
   * Enables hors-ligne switching between sites.
   */
  pharmacies?: StoredPharmacy[];
  canAddPharmacy?: boolean;
  maxBranches?: number;
  ownedCount?: number;
};

export type Entitlement = {
  allowed: boolean;
  reason: string | null;
  expiresAt: string | null;
  planName: string | null;
  role: string | null;
};

/** In-memory only for the current app run (never the password). */
let memorySession: StoredSession | null = null;

export function getMemorySession(): StoredSession | null {
  return memorySession;
}

export function setMemorySession(session: StoredSession | null): void {
  memorySession = session;
}

export function clearMemorySession(): void {
  memorySession = null;
}

/** Grace days must match backend SUBSCRIPTION_GRACE_PERIOD_DAYS. */
export const DESKTOP_GRACE_PERIOD_DAYS = 6;

export function computeGraceEndsAt(periodEndIso: string | null): string | null {
  if (!periodEndIso) return null;
  const t = Date.parse(periodEndIso);
  if (Number.isNaN(t)) return null;
  const end = new Date(t);
  end.setDate(end.getDate() + DESKTOP_GRACE_PERIOD_DAYS);
  return end.toISOString();
}
