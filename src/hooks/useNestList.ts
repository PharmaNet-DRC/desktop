import { useCallback, useEffect, useState } from 'react';
import { nestFetch, hydrateMemorySession } from '@/lib/nest';
import { nestErrorMessage } from '@/lib/pharmacy-api';
import type { StoredSession } from '@/lib/session';

/** Nest often returns a bare array; the web BFF wraps it as `{ success, key: [...] }`. */
export function asList<T>(data: unknown, key?: string): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object' && key) {
    const nested = (data as Record<string, unknown>)[key];
    if (Array.isArray(nested)) return nested as T[];
  }
  return [];
}

type Options<T> = {
  session: StoredSession;
  online: boolean;
  path: string | null;
  pick: (data: any) => T[];
  validate?: (data: any) => string | null;
  deps?: unknown[];
};

export function useNestList<T>({
  session,
  online,
  path,
  pick,
  validate,
  deps = [],
}: Options<T>) {
  const [rows, setRows] = useState<T[]>([]);
  const [raw, setRaw] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!online) {
      setError('Disponible uniquement en ligne.');
      setLoading(false);
      setRows([]);
      return;
    }
    if (session.accessToken === 'demo-token') {
      setError('Mode démo — données serveur non disponibles.');
      setLoading(false);
      setRows([]);
      return;
    }
    if (!path) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    hydrateMemorySession(session);
    const { ok, data } = await nestFetch(path);
    if (!ok || data?.success === false) {
      setError(nestErrorMessage(data, 'Impossible de charger les données.'));
      setRows([]);
      setRaw(null);
      setLoading(false);
      return;
    }
    const msg = validate?.(data) ?? null;
    if (msg) {
      setError(msg);
      setRows([]);
      setRaw(data);
      setLoading(false);
      return;
    }
    setRaw(data);
    setRows(pick(data));
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps passed by caller
  }, [online, path, session, ...deps]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { rows, raw, loading, error, reload, setRows };
}
