import { API_BASE_URL } from './brand';
import { getMemorySession, setMemorySession, type StoredSession } from './session';
import { vaultLoadSession, vaultSaveSession } from './vault';

type NestInit = RequestInit & {
  token?: string;
  /** Skip refresh-on-401 (used by the refresh call itself). */
  skipRefresh?: boolean;
};

type NestResult = {
  ok: boolean;
  status: number;
  data: any;
};

let refreshInFlight: Promise<string | null> | null = null;

async function rawFetch(
  path: string,
  init: RequestInit & { token?: string } = {},
): Promise<NestResult> {
  const { token, headers, ...rest } = init;
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: {
      Accept: 'application/json',
      ...(rest.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

/**
 * Seed / merge React session into memory without clobbering fresher JWTs
 * that nestFetch may have already rotated.
 */
export function hydrateMemorySession(session: StoredSession): StoredSession {
  const mem = getMemorySession();
  if (!mem) {
    setMemorySession(session);
    return session;
  }
  const merged: StoredSession = {
    ...session,
    // Always keep the newest tokens already in memory
    accessToken: mem.accessToken || session.accessToken,
    refreshToken: mem.refreshToken || session.refreshToken,
  };
  setMemorySession(merged);
  return merged;
}

/**
 * Rotate refresh token, persist to memory + vault, return new access token.
 */
export async function rotateDesktopRefresh(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    let session = getMemorySession();

    // Memory may be empty (e.g. after HMR) — recover refresh from vault.
    if (!session?.refreshToken || session.accessToken === 'demo-token') {
      try {
        const vault = await vaultLoadSession();
        if (vault?.refreshToken && vault.accessToken !== 'demo-token') {
          session = { ...(session ?? vault), ...vault, refreshToken: vault.refreshToken };
          setMemorySession(session);
        }
      } catch {
        /* ignore */
      }
    }

    if (!session?.refreshToken || session.accessToken === 'demo-token') {
      return null;
    }

    const { ok, data } = await rawFetch('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: session.refreshToken }),
    });

    if (!ok || !data?.accessToken || !data?.refreshToken) {
      return null;
    }

    const next: StoredSession = {
      ...session,
      accessToken: String(data.accessToken),
      refreshToken: String(data.refreshToken),
    };
    setMemorySession(next);
    try {
      await vaultSaveSession(next);
    } catch {
      /* vault write best-effort */
    }
    return next.accessToken;
  })().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

/**
 * Nest API call with Bearer JWT.
 * Prefers in-memory access token over caller-supplied tokens so a React
 * prop holding an expired JWT cannot override a freshly rotated one.
 * On 401, rotates refresh once and retries.
 */
export async function nestFetch(
  path: string,
  init: NestInit = {},
): Promise<NestResult> {
  const { skipRefresh = false, token: explicitToken, ...rest } = init;

  // Memory wins — it is updated by rotateDesktopRefresh / login / switch.
  const memToken = getMemorySession()?.accessToken;
  let token =
    memToken && memToken !== 'demo-token'
      ? memToken
      : explicitToken ?? memToken;

  // If caller has a token but memory is empty, seed so refresh can work later.
  if (explicitToken && !getMemorySession() && explicitToken !== 'demo-token') {
    /* leave memory empty until we know the full session; token still used below */
  }

  let result = await rawFetch(path, { ...rest, token });

  if (result.status !== 401 || skipRefresh || !token || token === 'demo-token') {
    return result;
  }

  const refreshed = await rotateDesktopRefresh();
  if (!refreshed) {
    return result;
  }

  return rawFetch(path, { ...rest, token: refreshed });
}
