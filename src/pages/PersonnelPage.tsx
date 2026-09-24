import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { StoredSession } from '@/lib/session';
import { nestFetch } from '@/lib/nest';
import { nestErrorMessage } from '@/lib/pharmacy-api';
import { usePagination } from '@/hooks/usePagination';
import { Pagination } from '@/components/Pagination';

type CatalogItem = { key: string; label: string };

type StaffRow = {
  id: string;
  role: string;
  status: string;
  sidebarKeys: string[];
  createdAt: string;
  user: {
    id: string;
    email: string | null;
    firstName: string;
    lastName: string;
    phone: string;
    firstLogin: boolean;
  };
};

const ROLE_OPTIONS = [
  { value: 'CASHIER', label: 'Caissier' },
  { value: 'PHARMACIST_STAFF', label: 'Pharmacien (staff)' },
  { value: 'MANAGER', label: 'Manager' },
  { value: 'DELIVERY', label: 'Livreur' },
];

const ROLE_LABEL: Record<string, string> = Object.fromEntries(
  ROLE_OPTIONS.map((r) => [r.value, r.label]),
);

type Props = {
  session: StoredSession;
  online: boolean;
  locked?: boolean;
};

export function PersonnelPage({ session, online, locked }: Props) {
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [maxStaff, setMaxStaff] = useState(2);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    role: 'CASHIER',
    sidebarKeys: [] as string[],
  });

  const load = useCallback(async () => {
    if (!online) {
      setError('Disponible uniquement en ligne.');
      setLoading(false);
      return;
    }
    if (session.accessToken === 'demo-token') {
      setError('Mode démo — personnel non disponible.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { ok, data } = await nestFetch(`/pharmacies/${session.organizationId}/staff`);
    if (!ok || data?.success === false) {
      setError(nestErrorMessage(data, 'Impossible de charger le personnel.'));
      setLoading(false);
      return;
    }
    setMaxStaff(Number(data.maxStaff ?? 2));
    setCatalog(Array.isArray(data.catalog) ? data.catalog : []);
    setStaff(Array.isArray(data.staff) ? data.staff : []);
    setLoading(false);
  }, [online, session.accessToken, session.organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const { page, setPage, totalPages, pageItems, total } = usePagination(staff, 10);

  const toggleKey = (key: string) => {
    setForm((prev) => ({
      ...prev,
      sidebarKeys: prev.sidebarKeys.includes(key)
        ? prev.sidebarKeys.filter((k) => k !== key)
        : [...prev.sidebarKeys, key],
    }));
  };

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setTempPassword(null);
    const { ok, data } = await nestFetch(`/pharmacies/${session.organizationId}/staff`, {
      method: 'POST',
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (!ok || data?.success === false) {
      setError(nestErrorMessage(data, 'Création impossible.'));
      return;
    }
    if (data.temporaryPassword) setTempPassword(String(data.temporaryPassword));
    setShowForm(false);
    setForm({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      password: '',
      role: 'CASHIER',
      sidebarKeys: [],
    });
    await load();
  };

  const onDelete = async (row: StaffRow) => {
    const name = `${row.user.firstName} ${row.user.lastName}`.trim();
    if (!window.confirm(`Retirer ${name || row.user.email} du personnel ?`)) return;
    const { ok, data } = await nestFetch(
      `/pharmacies/${session.organizationId}/staff/${row.id}`,
      { method: 'DELETE' },
    );
    if (!ok || data?.success === false) {
      setError(nestErrorMessage(data, 'Suppression impossible.'));
      return;
    }
    await load();
  };

  if (loading) return <p className="muted">Chargement du personnel…</p>;

  return (
    <div>
      {error && <div className="error-box">{error}</div>}
      {tempPassword && (
        <div className="card" style={{ marginBottom: '0.75rem' }}>
          <p style={{ margin: 0 }}>
            Mot de passe temporaire : <code>{tempPassword}</code> — à communiquer au
            collaborateur (changement à la première connexion).
          </p>
        </div>
      )}

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.75rem',
          gap: '0.5rem',
          flexWrap: 'wrap',
        }}
      >
        <p style={{ margin: 0, color: 'var(--color-muted)' }}>
          {staff.length} / {maxStaff} collaborateurs
        </p>
        <button
          type="button"
          className="btn btn-outline"
          disabled={locked || staff.length >= maxStaff}
          onClick={() => setShowForm((v) => !v)}
        >
          {showForm ? 'Fermer' : 'Ajouter'}
        </button>
      </div>

      {showForm && (
        <form className="card" style={{ marginBottom: '1rem' }} onSubmit={(e) => void onCreate(e)}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '0.5rem',
              marginBottom: '0.5rem',
            }}
          >
            <input
              className="input"
              placeholder="Prénom"
              required
              value={form.firstName}
              onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
            />
            <input
              className="input"
              placeholder="Nom"
              required
              value={form.lastName}
              onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
            />
            <input
              className="input"
              type="email"
              placeholder="Email"
              required
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
            <input
              className="input"
              placeholder="Téléphone"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
            <input
              className="input"
              type="password"
              placeholder="Mot de passe temporaire"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            />
            <select
              className="input"
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          {catalog.length > 0 && (
            <div style={{ marginBottom: '0.75rem' }}>
              <p className="section-label">Accès menu</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {catalog.map((c) => (
                  <label key={c.key} style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      checked={form.sidebarKeys.includes(c.key)}
                      onChange={() => toggleKey(c.key)}
                    />
                    <span style={{ fontSize: '0.85rem' }}>{c.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <button type="submit" className="btn btn-outline" disabled={locked || saving}>
            {saving ? 'Enregistrement…' : 'Créer le compte'}
          </button>
        </form>
      )}

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Collaborateur</th>
              <th>Rôle</th>
              <th>Statut</th>
              <th>Accès</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {pageItems.map((row) => (
              <tr key={row.id}>
                <td>
                  <strong>
                    {row.user.firstName} {row.user.lastName}
                  </strong>
                  <div style={{ color: 'var(--color-muted)', fontSize: '0.72rem' }}>
                    {row.user.email || row.user.phone || '—'}
                    {row.user.firstLogin ? ' · 1ʳᵉ connexion' : ''}
                  </div>
                </td>
                <td>{ROLE_LABEL[row.role] ?? row.role}</td>
                <td>
                  <span className="badge badge-teal">{row.status}</span>
                </td>
                <td>{row.sidebarKeys?.length ?? 0} modules</td>
                <td>
                  <button
                    type="button"
                    className="btn btn-outline"
                    disabled={locked}
                    onClick={() => void onDelete(row)}
                  >
                    Retirer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {staff.length === 0 && <p className="empty">Aucun collaborateur.</p>}
      </div>
      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={setPage}
        disabled={locked}
      />
    </div>
  );
}
