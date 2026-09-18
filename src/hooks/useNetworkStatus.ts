import { useCallback, useEffect, useRef, useState } from 'react';
import { API_BASE_URL } from '@/lib/brand';

const STABLE_MS = 2500;
const PROBE_MS = 8000;

/**
 * "Online" for this app means the configured API (Next BFF) is reachable.
 * Do NOT fall back to a public CDN — that falsely enables login when localhost is down.
 */
async function probeApiReachable(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return false;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 3500);
  try {
    await fetch(`${API_BASE_URL}/`, {
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-store',
      signal: ctrl.signal,
    });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Online = browser says online AND the PharmaCd API origin answers.
 */
export function useNetworkStatus() {
  const [online, setOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  const [stableOnline, setStableOnline] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const probeTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearStableTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const applyOnline = useCallback((next: boolean) => {
    setOnline(next);
    clearStableTimer();
    if (next) {
      timer.current = setTimeout(() => setStableOnline(true), STABLE_MS);
    } else {
      setStableOnline(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    const ok = await probeApiReachable();
    applyOnline(ok);
  }, [applyOnline]);

  useEffect(() => {
    void refresh();

    const onOnline = () => {
      void refresh();
    };
    const onOffline = () => {
      applyOnline(false);
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    probeTimer.current = setInterval(() => {
      void refresh();
    }, PROBE_MS);

    return () => {
      clearStableTimer();
      if (probeTimer.current) clearInterval(probeTimer.current);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [applyOnline, refresh]);

  return { online, stableOnline, refreshNetwork: refresh };
}
