import { useCallback, useEffect, useRef, useState } from 'react';
import { getSyncStats } from '@/data/store';
import { runFullSync } from '@/lib/remote-sync';
import type { StoredSession } from '@/lib/session';

type Options = {
  session: StoredSession | null;
  pharmacyId: string;
  enabled: boolean;
  stableOnline: boolean;
  refreshKey: number;
  onDone: () => void;
};

/**
 * When the network is stable, push outbox to the server then refresh catalogue.
 */
export function useAutoSync({
  session,
  pharmacyId,
  enabled,
  stableOnline,
  refreshKey,
  onDone,
}: Options) {
  const [syncing, setSyncing] = useState(false);
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const inFlight = useRef(false);

  const runSync = useCallback(async () => {
    if (!enabled || !session || inFlight.current) return;
    const pending = getSyncStats(pharmacyId).pending;
    // Also pull when coming online even if outbox empty (refresh stock)
    if (pending === 0 && session.accessToken === 'demo-token') return;

    inFlight.current = true;
    setSyncing(true);
    setLastMessage(null);
    try {
      if (!navigator.onLine) {
        setLastMessage(
          'Connexion perdue pendant la synchronisation. Nouvelle tentative dès que le réseau sera stable.',
        );
        return;
      }
      const result = await runFullSync(session);
      setLastMessage(result.message);
      onDone();
    } catch {
      setLastMessage('Échec de la synchronisation. Nouvelle tentative plus tard.');
    } finally {
      setSyncing(false);
      inFlight.current = false;
    }
  }, [enabled, onDone, pharmacyId, session]);

  useEffect(() => {
    if (!enabled || !stableOnline || syncing || !session) return;
    const pending = getSyncStats(pharmacyId).pending;
    if (pending === 0 && session.accessToken === 'demo-token') return;
    if (pending === 0) {
      // Light pull only — avoid blocking UI every time; only when outbox has work OR first online after offline
      // For pending === 0 on real accounts, skip auto full sync to avoid constant lock.
      return;
    }
    void runSync();
  }, [enabled, stableOnline, pharmacyId, syncing, runSync, refreshKey, session]);

  return { syncing, lastMessage, runSync };
}
