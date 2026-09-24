import { useEffect, useId, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { Building2, ChevronDown, Plus, X } from 'lucide-react';
import type { StoredSession } from '@/lib/session';
import {
  createPharmacyOnServer,
  fetchMinePharmacies,
  refreshMinePharmacies,
  type PharmacyOption,
} from '@/lib/pharmacy-api';
import {
  AddressFields,
  emptyAddressValue,
  type AddressValue,
} from '@/components/AddressFields';

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
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pharmacies, setPharmacies] = useState<PharmacyOption[]>(
    () => session.pharmacies ?? [],
  );
  const [activeId, setActiveId] = useState(session.organizationId);
  const [ownedCount, setOwnedCount] = useState(session.ownedCount ?? 0);
  const [maxBranches, setMaxBranches] = useState(session.maxBranches ?? 1);
  const [canAdd, setCanAdd] = useState(Boolean(session.canAddPharmacy));
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addForm, setAddForm] = useState({
    name: '',
    email: '',
    phone: '',
  });
  const [address, setAddress] = useState<AddressValue>(emptyAddressValue);

  useEffect(() => {
    setActiveId(session.organizationId);
  }, [session.organizationId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);

      if (!online || session.accessToken === 'demo-token') {
        const cached = session.pharmacies?.length
          ? session.pharmacies
          : [
              {
                id: session.organizationId,
                name: session.organizationName,
                email: session.email,
                phone: null,
                city: null,
                isOwner: true,
              },
            ];
        if (!cancelled) {
          setPharmacies(cached);
          setActiveId(session.organizationId);
          setOwnedCount(session.ownedCount ?? cached.length);
          setMaxBranches(session.maxBranches ?? 1);
          setCanAdd(false);
          setLoading(false);
        }
        return;
      }

      const mine = await fetchMinePharmacies(session);
      if (cancelled) return;
      if (!mine) {
        if (session.pharmacies?.length) {
          setPharmacies(session.pharmacies);
          setOwnedCount(session.ownedCount ?? session.pharmacies.length);
          setMaxBranches(session.maxBranches ?? 1);
          setCanAdd(Boolean(session.canAddPharmacy));
          setError(null);
        } else {
          setError('Impossible de charger vos pharmacies.');
        }
        setLoading(false);
        return;
      }
      setPharmacies(mine.pharmacies);
      setActiveId(mine.activePharmacyId ?? session.organizationId);
      setOwnedCount(mine.ownedCount);
      setMaxBranches(mine.maxBranches);
      setCanAdd(mine.canAddPharmacy);
      await refreshMinePharmacies(session);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [session, online]);

  useEffect(() => {
    if (!showAdd) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowAdd(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showAdd]);

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
    if (pharmacy.isActive === false) {
      setError('Cette pharmacie est désactivée (limite du forfait).');
      return;
    }
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

  const openAddModal = () => {
    setError(null);
    setOpen(false);
    setAddress(emptyAddressValue());
    setShowAdd(true);
  };

  const onAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!online) {
      setError('Ajout de pharmacie disponible uniquement en ligne.');
      return;
    }
    if (!addForm.name.trim() || !addForm.email.trim()) {
      setError('Nom et e-mail sont obligatoires.');
      return;
    }
    if (
      !address.country.trim() ||
      !address.province.trim() ||
      !address.city.trim() ||
      !address.quartier.trim()
    ) {
      setError('Pays, province, ville et quartier sont obligatoires.');
      return;
    }
    setAdding(true);
    setError(null);
    const created = await createPharmacyOnServer(session, {
      name: addForm.name,
      email: addForm.email,
      phone: addForm.phone || undefined,
      country: address.country || 'CD',
      province: address.province,
      ville: address.city,
      quartier: address.quartier,
      rue: address.rue || undefined,
    });
    if (!created.ok) {
      setError(created.message);
      setAdding(false);
      return;
    }
    setShowAdd(false);
    setAddForm({ name: '', email: '', phone: '' });
    setAddress(emptyAddressValue());
    setAdding(false);
    await onSwitch(created.pharmacyId, created.pharmacyName);
  };

  if (!loading && pharmacies.length <= 1 && !canAdd && !online) {
    return (
      <div className="pharmacy-switcher">
        <div className="pharmacy-switcher-trigger" style={{ cursor: 'default' }}>
          <Building2 size={14} />
          <div className="pharmacy-switcher-text">
            <strong>{active.name}</strong>
            <span>Hors ligne</span>
          </div>
        </div>
      </div>
    );
  }

  const addModal =
    showAdd &&
    online &&
    createPortal(
      <div
        className="pharmacy-add-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) setShowAdd(false);
        }}
      >
        <form
          className="pharmacy-add-card"
          onSubmit={(e) => void onAdd(e)}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="pharmacy-add-header">
            <h3 id={titleId}>Nouvelle pharmacie</h3>
            <button
              type="button"
              className="pharmacy-add-close"
              aria-label="Fermer"
              onClick={() => setShowAdd(false)}
            >
              <X size={16} />
            </button>
          </div>
          <p className="muted" style={{ margin: 0, fontSize: '0.8rem' }}>
            Disponible en ligne sous votre abonnement multi-sites ({ownedCount}/
            {maxBranches}).
          </p>
          {error && <div className="error-box">{error}</div>}

          <label className="pharmacy-add-label">
            Nom *
            <input
              className="input"
              required
              autoFocus
              placeholder="Pharmacie…"
              value={addForm.name}
              onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
            />
          </label>
          <label className="pharmacy-add-label">
            E-mail *
            <input
              className="input"
              required
              type="email"
              placeholder="contact@…"
              value={addForm.email}
              onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
            />
          </label>
          <label className="pharmacy-add-label">
            Téléphone
            <input
              className="input"
              type="tel"
              placeholder="+243…"
              value={addForm.phone}
              onChange={(e) => setAddForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </label>

          <p className="pharmacy-add-section">Adresse</p>
          <AddressFields
            value={address}
            onChange={setAddress}
            required
            disabled={adding}
          />

          <div className="pharmacy-add-actions">
            <button
              type="button"
              className="btn btn-outline"
              disabled={adding}
              onClick={() => setShowAdd(false)}
            >
              Annuler
            </button>
            <button type="submit" className="btn btn-primary" disabled={adding}>
              {adding ? 'Création…' : 'Créer'}
            </button>
          </div>
        </form>
      </div>,
      document.body,
    );

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
            {pharmacies.length > 0
              ? `${pharmacies.length} site(s)${maxBranches > 1 ? ` · max ${maxBranches}` : ''}${
                  !online ? ' · hors ligne' : ''
                }`
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
              disabled={switching || disabled || p.isActive === false}
              onClick={() => void switchTo(p)}
            >
              <strong>{p.name}</strong>
              <span>
                {p.isActive === false
                  ? 'Désactivée (limite forfait)'
                  : [p.city, p.isOwner ? 'Propriétaire' : 'Équipe']
                      .filter(Boolean)
                      .join(' · ')}
              </span>
            </button>
          ))}

          {online && canAdd && (
            <button
              type="button"
              className="pharmacy-switcher-add"
              disabled={disabled || switching}
              onClick={openAddModal}
            >
              <Plus size={14} />
              Ajouter une pharmacie
            </button>
          )}

          {online && !canAdd && ownedCount > 0 && pharmacies.some((p) => p.isOwner) && (
            <p className="pharmacy-switcher-hint">
              Limite de sites atteinte ({ownedCount}/{maxBranches}) — passez en Pro multi-sites
              pour en ajouter.
            </p>
          )}

          {!online && pharmacies.length > 1 && (
            <p className="pharmacy-switcher-hint">
              Hors ligne : bascule entre les sites déjà synchronisés sur cet appareil.
            </p>
          )}

          {online && pharmacies.length > 1 && !canAdd && (
            <p className="pharmacy-switcher-hint">
              Changer de pharmacie recharge le catalogue local.
            </p>
          )}
        </div>
      )}

      {addModal}

      {error && !showAdd && (
        <p className="error-text" style={{ marginTop: '0.4rem' }}>
          {error}
        </p>
      )}
    </div>
  );
}
