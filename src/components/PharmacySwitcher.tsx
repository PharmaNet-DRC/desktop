import { useEffect, useState } from 'react';
import { Building2, ChevronDown } from 'lucide-react';
import type { StoredSession } from '@/lib/session';
import {
  fetchMinePharmacies,
  type PharmacyOption,
} from '@/lib/pharmacy-api';

type Props = {
  session: StoredSession;
  online: boolean;
  disabled?: boolean;
  onSwitch: (pharmacyId: string, pharmacyName: string) => Promise<string | null>;
};

export function PharmacySwitcher({
  session,
  online,
  disabled,
  onSwitch,
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pharmacies, setPharmacies] = useState<PharmacyOption[]>([]);
  const [activeId, setActiveId] = useState(session.organizationId);
  const [ownedCount, setOwnedCount] = useState(0);
  const [maxBranches, setMaxBranches] = useState(1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      if (!online || session.accessToken === 'demo-token') {
        setPharmacies([
          {
            id: session.organizationId,
            name: session.organizationName,
            email: session.email,
            phone: null,
            city: null,
            isOwner: true,
          },
        ]);
        setActiveId(session.organizationId);
        setOwnedCount(1);
        setMaxBranches(1);
        setLoading(false);
        return;
      }
      const mine = await fetchMinePharmacies(session);
      if (cancelled) return;
      if (!mine) {
        setError('Impossible de charger vos pharmacies.');
        setLoading(false);
        return;
      }
      setPharmacies(mine.pharmacies);
      setActiveId(mine.activePharmacyId ?? session.organizationId);
      setOwnedCount(mine.ownedCount);
      setMaxBranches(mine.maxBranches);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [session, online]);

  const active =
    pharmacies.find((p) => p.id === activeId) ??
    pharmacies[0] ?? {
      id: session.organizationId,
      name: session.organizationName,
      email: session.email,
      phone: null,
      city: null,
      isOwner: true,
    };

  const switchTo = async (pharmacy: PharmacyOption) => {
    if (pharmacy.id === activeId || switching || disabled) return;
    setSwitching(true);
    setError(null);
    const message = await onSwitch(pharmacy.id, pharmacy.name);
    if (message) {
      setError(message);
      setSwitching(false);
      return;
    }
    setActiveId(pharmacy.id);
    setOpen(false);
    setSwitching(false);
  };

  return (
    <div className="pharmacy-switcher">
      <button
        type="button"
        className="pharmacy-switcher-trigger"
        disabled={disabled || loading || switching}
        onClick={() => setOpen((v) => !v)}
      >
        <Building2 size={14} />
        <div className="pharmacy-switcher-text">
          <strong>{loading ? 'Chargement…' : active.name}</strong>
          <span>
            {ownedCount > 0
              ? `${pharmacies.length} site(s) · max ${maxBranches}`
              : session.planName}
          </span>
        </div>
        <ChevronDown size={14} />
      </button>

      {open && (
        <div className="pharmacy-switcher-menu">
          {pharmacies.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`pharmacy-switcher-item${p.id === activeId ? ' active' : ''}`}
              disabled={switching || disabled}
              onClick={() => void switchTo(p)}
            >
              <strong>{p.name}</strong>
              <span>
                {[p.city, p.isOwner ? 'Propriétaire' : 'Équipe']
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </button>
          ))}
          {pharmacies.length > 1 && (
            <p className="pharmacy-switcher-hint">
              Changer de pharmacie recharge le catalogue local.
            </p>
          )}
        </div>
      )}
      {error && <p className="error-text" style={{ marginTop: '0.4rem' }}>{error}</p>}
    </div>
  );
}
