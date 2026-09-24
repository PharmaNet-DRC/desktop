import { nestFetch, hydrateMemorySession } from './nest';
import {
  setMemorySession,
  getMemorySession,
  type StoredSession,
  type StoredPharmacy,
} from './session';
import { vaultSaveSession } from './vault';

export function nestErrorMessage(data: unknown, fallback: string): string {
  if (!data || typeof data !== 'object') return fallback;
  const body = data as Record<string, unknown>;
  if (typeof body.message === 'string') return body.message;
  if (Array.isArray(body.message) && body.message.length > 0) {
    const first = body.message[0];
    if (typeof first === 'string') return first;
    if (first && typeof first === 'object') {
      const constraints = (first as { constraints?: Record<string, string> })
        .constraints;
      if (constraints) {
        const v = Object.values(constraints)[0];
        if (v) return v;
      }
    }
  }
  return fallback;
}

export type PharmacyOption = StoredPharmacy;

export type MinePharmacies = {
  pharmacies: PharmacyOption[];
  activePharmacyId: string | null;
  ownedCount: number;
  maxBranches: number;
  canAddPharmacy: boolean;
};

function mapPharmacy(raw: Record<string, any>): PharmacyOption {
  return {
    id: String(raw.id),
    name: String(raw.name ?? 'Pharmacie'),
    email: String(raw.email ?? ''),
    phone: (raw.phone as string | null) ?? null,
    city: (raw.city as string | null) ?? null,
    isOwner: Boolean(raw.isOwner),
    isActive: raw.isActive === false ? false : true,
  };
}

/** Merge /pharmacies/mine into a session (for vault + offline switch). */
export function withMinePharmacies(
  session: StoredSession,
  mine: MinePharmacies,
): StoredSession {
  return {
    ...session,
    pharmacies: mine.pharmacies,
    canAddPharmacy: mine.canAddPharmacy,
    maxBranches: mine.maxBranches,
    ownedCount: mine.ownedCount,
  };
}

export async function fetchMinePharmacies(
  session: StoredSession,
): Promise<MinePharmacies | null> {
  if (session.accessToken === 'demo-token') {
    return {
      pharmacies: [
        {
          id: session.organizationId,
          name: session.organizationName,
          email: session.email,
          phone: null,
          city: null,
          isOwner: true,
        },
      ],
      activePharmacyId: session.organizationId,
      ownedCount: 1,
      maxBranches: 1,
      canAddPharmacy: false,
    };
  }
  hydrateMemorySession(session);
  const { ok, data } = await nestFetch('/pharmacies/mine');
  if (!ok) return null;

  const listRaw = Array.isArray(data)
    ? data
    : Array.isArray(data?.pharmacies)
      ? data.pharmacies
      : Array.isArray(data?.data)
        ? data.data
        : [];

  return {
    pharmacies: listRaw.map((p: Record<string, any>) => mapPharmacy(p)),
    activePharmacyId: (data?.activePharmacyId as string | null) ?? null,
    ownedCount: Number(data?.ownedCount ?? listRaw.length),
    maxBranches: Number(data?.maxBranches ?? 1),
    canAddPharmacy: Boolean(data?.canAddPharmacy),
  };
}

/** Fetch mine and persist on the current session (memory + vault). */
export async function refreshMinePharmacies(
  session: StoredSession,
): Promise<StoredSession> {
  hydrateMemorySession(session);
  const mine = await fetchMinePharmacies(session);
  // Always merge onto memory (may hold fresher JWTs after nestFetch refresh).
  const base = getMemorySession() ?? session;
  if (!mine) return base;
  const next = withMinePharmacies(base, mine);
  setMemorySession(next);
  try {
    await vaultSaveSession(next);
  } catch {
    /* best-effort */
  }
  return next;
}

export type CreatePharmacyInput = {
  name: string;
  email: string;
  phone?: string;
  country?: string;
  province?: string;
  ville: string;
  quartier: string;
  rue?: string;
};

export async function createPharmacyOnServer(
  session: StoredSession,
  input: CreatePharmacyInput,
): Promise<
  | { ok: true; pharmacyId: string; pharmacyName: string }
  | { ok: false; message: string }
> {
  hydrateMemorySession(session);
  const { ok, data } = await nestFetch('/pharmacies/create', {
    method: 'POST',
    body: JSON.stringify({
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      phone: input.phone?.trim() || undefined,
      country: input.country || 'CD',
      province: input.province?.trim() || undefined,
      ville: input.ville.trim(),
      quartier: input.quartier.trim(),
      rue: input.rue?.trim() || undefined,
      address: input.rue?.trim() || undefined,
    }),
  });
  if (!ok) {
    return {
      ok: false,
      message: nestErrorMessage(data, 'Création de pharmacie impossible.'),
    };
  }
  const pharmacy = data?.pharmacy ?? data;
  const pharmacyId = String(pharmacy?.id ?? '');
  const pharmacyName = String(pharmacy?.name ?? input.name);
  if (!pharmacyId) {
    return { ok: false, message: 'Pharmacie créée mais identifiant manquant.' };
  }
  return { ok: true, pharmacyId, pharmacyName };
}

export type PharmacyProfile = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  profileImageUrls: string[];
  plannedBranchCount: number | null;
  isActive: boolean;
  address: {
    line1: string;
    line2: string | null;
    city: string;
    state: string | null;
    country: string;
    latitude: number | null;
    longitude: number | null;
  } | null;
};

export async function fetchPharmacyProfile(
  session: StoredSession,
): Promise<{ ok: true; profile: PharmacyProfile } | { ok: false; message: string }> {
  hydrateMemorySession(session);
  const pharmacyId =
    getMemorySession()?.organizationId ?? session.organizationId;
  const { ok, data } = await nestFetch(`/pharmacies/${pharmacyId}/profile`);
  if (!ok) {
    return {
      ok: false,
      message: nestErrorMessage(data, 'Impossible de charger le profil.'),
    };
  }
  return { ok: true, profile: data as PharmacyProfile };
}

export async function updatePharmacyProfile(
  session: StoredSession,
  body: Record<string, unknown>,
): Promise<{ ok: true; profile: PharmacyProfile } | { ok: false; message: string }> {
  hydrateMemorySession(session);
  const pharmacyId =
    getMemorySession()?.organizationId ?? session.organizationId;
  const { ok, data } = await nestFetch(`/pharmacies/${pharmacyId}/profile`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  if (!ok) {
    return {
      ok: false,
      message: nestErrorMessage(data, 'Enregistrement impossible.'),
    };
  }
  return { ok: true, profile: data as PharmacyProfile };
}

export type SubscriptionStatus = {
  freeProductLimit: number;
  productLimit: {
    maxProducts: number | null;
    used: number;
    planName: string | null;
    isPaid?: boolean;
    isUnlimited?: boolean;
  };
  subscription: {
    id: string;
    status: string;
    planName: string;
    price: unknown;
    currency: string;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    isPaid: boolean;
    plan?: { name: string; durationMonths?: number };
  } | null;
  pendingPayment: {
    id: string;
    amountClaimed: unknown;
    currency: string;
    paymentMethod: string;
    reference: string;
    status: string;
    planName: string;
    createdAt: string;
  } | null;
  plans: Array<{
    id: string;
    name: string;
    price: unknown;
    currency: string;
    durationMonths: number;
    maxProducts: number | null;
    maxBranches?: number;
  }>;
  paymentInstructions?: Record<string, unknown>;
};

export async function fetchSubscription(
  session: StoredSession,
): Promise<
  { ok: true; data: SubscriptionStatus } | { ok: false; message: string }
> {
  hydrateMemorySession(session);
  const pharmacyId =
    getMemorySession()?.organizationId ?? session.organizationId;
  const { ok, data } = await nestFetch(
    `/pharmacies/${pharmacyId}/subscription`,
  );
  if (!ok) {
    return {
      ok: false,
      message: nestErrorMessage(data, 'Impossible de charger l’abonnement.'),
    };
  }
  return { ok: true, data: data as SubscriptionStatus };
}

export type AdsOverview = {
  plans: Array<{
    id: string;
    name: string;
    price: unknown;
    currency: string;
    durationDays: number;
  }>;
  products: Array<{ id: string; name: string; price: unknown }>;
  campaigns: Array<{
    id: string;
    status: string;
    productName: string;
    planName: string;
    price: unknown;
    currency: string;
    durationDays: number;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    paymentStatus: string | null;
  }>;
  hasPendingPayment: boolean;
  pendingPayment: {
    id: string;
    amountClaimed: unknown;
    currency: string;
    paymentMethod: string;
    reference: string;
    createdAt: string;
  } | null;
  paymentInstructions?: Record<string, unknown>;
};

export async function fetchAdsOverview(
  session: StoredSession,
): Promise<{ ok: true; data: AdsOverview } | { ok: false; message: string }> {
  hydrateMemorySession(session);
  const pharmacyId =
    getMemorySession()?.organizationId ?? session.organizationId;
  const { ok, data } = await nestFetch(`/pharmacies/${pharmacyId}/ads`);
  if (!ok) {
    return {
      ok: false,
      message: nestErrorMessage(data, 'Impossible de charger la publicité.'),
    };
  }
  return { ok: true, data: data as AdsOverview };
}

export async function switchPharmacyOnServer(
  session: StoredSession,
  pharmacyId: string,
): Promise<
  | {
      ok: true;
      accessToken: string;
      refreshToken: string;
      pharmacyId: string;
      pharmacyName?: string;
    }
  | { ok: false; message: string }
> {
  hydrateMemorySession(session);
  const { ok, data } = await nestFetch('/auth/switch-pharmacy', {
    method: 'POST',
    body: JSON.stringify({ pharmacyId }),
  });
  if (!ok || !data.accessToken || !data.refreshToken) {
    return {
      ok: false,
      message: nestErrorMessage(data, 'Changement de pharmacie impossible.'),
    };
  }
  const activeId = String(data.user?.pharmacyId ?? pharmacyId);
  // Persist new tokens immediately so subsequent calls don't use a stale JWT.
  const mem = getMemorySession() ?? session;
  const next = {
    ...mem,
    accessToken: String(data.accessToken),
    refreshToken: String(data.refreshToken),
    organizationId: activeId,
  };
  setMemorySession(next);
  try {
    await vaultSaveSession(next);
  } catch {
    /* best-effort */
  }
  return {
    ok: true,
    accessToken: data.accessToken as string,
    refreshToken: data.refreshToken as string,
    pharmacyId: activeId,
  };
}
