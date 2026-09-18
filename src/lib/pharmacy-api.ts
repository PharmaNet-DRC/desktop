import { nestFetch } from './nest';
import type { StoredSession } from './session';

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

export type PharmacyOption = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  city: string | null;
  isOwner: boolean;
};

export type MinePharmacies = {
  pharmacies: PharmacyOption[];
  activePharmacyId: string | null;
  ownedCount: number;
  maxBranches: number;
  canAddPharmacy: boolean;
};

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
  const { ok, data } = await nestFetch('/pharmacies/mine', {
    token: session.accessToken,
  });
  if (!ok) return null;
  return {
    pharmacies: (data.pharmacies ?? []) as PharmacyOption[],
    activePharmacyId: (data.activePharmacyId as string | null) ?? null,
    ownedCount: Number(data.ownedCount ?? 0),
    maxBranches: Number(data.maxBranches ?? 1),
    canAddPharmacy: Boolean(data.canAddPharmacy),
  };
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
  const { ok, data } = await nestFetch(
    `/pharmacies/${session.organizationId}/profile`,
    { token: session.accessToken },
  );
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
  const { ok, data } = await nestFetch(
    `/pharmacies/${session.organizationId}/profile`,
    {
      method: 'PATCH',
      token: session.accessToken,
      body: JSON.stringify(body),
    },
  );
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
  const { ok, data } = await nestFetch(
    `/pharmacies/${session.organizationId}/subscription`,
    { token: session.accessToken },
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
  const { ok, data } = await nestFetch(
    `/pharmacies/${session.organizationId}/ads`,
    { token: session.accessToken },
  );
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
  const { ok, data } = await nestFetch('/auth/switch-pharmacy', {
    method: 'POST',
    token: session.accessToken,
    body: JSON.stringify({ pharmacyId }),
  });
  if (!ok || !data.accessToken || !data.refreshToken) {
    return {
      ok: false,
      message: nestErrorMessage(data, 'Changement de pharmacie impossible.'),
    };
  }
  const activeId = String(data.user?.pharmacyId ?? pharmacyId);
  return {
    ok: true,
    accessToken: data.accessToken as string,
    refreshToken: data.refreshToken as string,
    pharmacyId: activeId,
  };
}
