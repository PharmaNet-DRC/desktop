export type DesktopRole = 'PHARMACY' | 'FOURNISSEUR';

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
  /** ISO-8601 expiry of paid subscription */
  expiresAt: string | null;
  /** Last successful online license refresh */
  licenseCheckedAt: string;
  /** First online enrollment timestamp */
  enrolledAt?: string;
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
