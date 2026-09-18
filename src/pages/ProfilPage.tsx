import { useEffect, useState, type FormEvent } from 'react';
import type { StoredSession } from '@/lib/session';
import {
  fetchPharmacyProfile,
  updatePharmacyProfile,
  type PharmacyProfile,
} from '@/lib/pharmacy-api';

type Props = {
  session: StoredSession;
  online: boolean;
  locked?: boolean;
  onProfileSaved?: (name: string) => void;
};

export function ProfilPage({ session, online, locked, onProfileSaved }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    line1: '',
    line2: '',
    city: '',
    state: '',
    country: 'CD',
    latitude: '',
    longitude: '',
  });
  const [meta, setMeta] = useState<Pick<
    PharmacyProfile,
    'isActive' | 'profileImageUrls' | 'plannedBranchCount'
  > | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      if (!online || session.accessToken === 'demo-token') {
        setForm((f) => ({
          ...f,
          name: session.organizationName,
          email: session.email,
        }));
        setLoading(false);
        if (session.accessToken === 'demo-token') {
          setError('Mode démo — profil serveur non disponible.');
        }
        return;
      }
      const res = await fetchPharmacyProfile(session);
      if (cancelled) return;
      if (!res.ok) {
        setError(res.message);
        setLoading(false);
        return;
      }
      const p = res.profile;
      setMeta({
        isActive: p.isActive,
        profileImageUrls: p.profileImageUrls ?? [],
        plannedBranchCount: p.plannedBranchCount,
      });
      setForm({
        name: p.name ?? '',
        email: p.email ?? '',
        phone: p.phone ?? '',
        line1: p.address?.line1 ?? '',
        line2: p.address?.line2 ?? '',
        city: p.address?.city ?? '',
        state: p.address?.state ?? '',
        country: p.address?.country ?? 'CD',
        latitude:
          p.address?.latitude != null ? String(p.address.latitude) : '',
        longitude:
          p.address?.longitude != null ? String(p.address.longitude) : '',
      });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [session, online]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (locked || session.accessToken === 'demo-token') return;
    setSaving(true);
    setError(null);
    setOkMsg(null);
    const body: Record<string, unknown> = {
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim() || undefined,
      line1: form.line1.trim(),
      line2: form.line2.trim() || undefined,
      city: form.city.trim(),
      state: form.state.trim() || undefined,
      country: form.country.trim() || 'CD',
    };
    if (form.latitude.trim()) body.latitude = Number(form.latitude);
    if (form.longitude.trim()) body.longitude = Number(form.longitude);

    const res = await updatePharmacyProfile(session, body);
    setSaving(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setOkMsg('Profil mis à jour.');
    onProfileSaved?.(res.profile.name);
  }

  if (loading) {
    return <p className="muted">Chargement du profil…</p>;
  }

  return (
    <div>
      <div className="kpi-grid" style={{ marginBottom: '1rem' }}>
        <div className="kpi-card">
          <div className="label">Statut</div>
          <div className="value" style={{ fontSize: '1rem' }}>
            {meta?.isActive === false ? 'Inactive' : 'Active'}
          </div>
        </div>
        <div className="kpi-card">
          <div className="label">Photos</div>
          <div className="value">{meta?.profileImageUrls?.length ?? 0}</div>
        </div>
        <div className="kpi-card">
          <div className="label">Plan</div>
          <div className="value" style={{ fontSize: '1rem' }}>
            {session.planName}
          </div>
        </div>
      </div>

      <form className="card form-stack" onSubmit={onSubmit}>
        <p className="section-label">Identité de la pharmacie</p>
        <div className="field">
          <label htmlFor="name">Nom</label>
          <input
            id="name"
            value={form.name}
            disabled={locked || saving}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="email">E-mail public</label>
          <input
            id="email"
            type="email"
            value={form.email}
            disabled={locked || saving}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="phone">Téléphone</label>
          <input
            id="phone"
            value={form.phone}
            disabled={locked || saving}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          />
        </div>

        <p className="section-label">Adresse</p>
        <div className="field">
          <label htmlFor="line1">Adresse</label>
          <input
            id="line1"
            value={form.line1}
            disabled={locked || saving}
            onChange={(e) => setForm((f) => ({ ...f, line1: e.target.value }))}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="line2">Complément</label>
          <input
            id="line2"
            value={form.line2}
            disabled={locked || saving}
            onChange={(e) => setForm((f) => ({ ...f, line2: e.target.value }))}
          />
        </div>
        <div className="field">
          <label htmlFor="city">Ville</label>
          <input
            id="city"
            value={form.city}
            disabled={locked || saving}
            onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="state">Province</label>
          <input
            id="state"
            value={form.state}
            disabled={locked || saving}
            onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
          />
        </div>
        <div className="field">
          <label htmlFor="country">Pays</label>
          <input
            id="country"
            value={form.country}
            disabled={locked || saving}
            onChange={(e) =>
              setForm((f) => ({ ...f, country: e.target.value }))
            }
          />
        </div>
        <div className="field">
          <label htmlFor="lat">Latitude</label>
          <input
            id="lat"
            value={form.latitude}
            disabled={locked || saving}
            onChange={(e) =>
              setForm((f) => ({ ...f, latitude: e.target.value }))
            }
          />
        </div>
        <div className="field">
          <label htmlFor="lng">Longitude</label>
          <input
            id="lng"
            value={form.longitude}
            disabled={locked || saving}
            onChange={(e) =>
              setForm((f) => ({ ...f, longitude: e.target.value }))
            }
          />
        </div>

        {error && <p className="error-text">{error}</p>}
        {okMsg && <p className="badge badge-teal">{okMsg}</p>}

        <button
          type="submit"
          className="btn btn-primary"
          disabled={locked || saving || !online || session.accessToken === 'demo-token'}
        >
          {saving ? 'Enregistrement…' : 'Enregistrer le profil'}
        </button>
      </form>
    </div>
  );
}
