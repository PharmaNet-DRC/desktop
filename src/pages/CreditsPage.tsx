import { useMemo, useState } from 'react';
import type { StoredSession } from '@/lib/session';
import { nestFetch } from '@/lib/nest';
import { nestErrorMessage } from '@/lib/pharmacy-api';
import { formatMoney } from '@/data/store';
import { useNestList, asList } from '@/hooks/useNestList';
import { usePagination } from '@/hooks/usePagination';
import { Pagination } from '@/components/Pagination';

type Credit = {
  id: string;
  recordId: string;
  patient: string;
  caissier: string;
  items: { nom: string; qte: number; prix: number }[];
  paiement: string;
  statut: string;
  date: string;
  heure: string;
  overdue: boolean;
  amountReceived: number | null;
  amountCredited: number;
  creditCustomerName: string | null;
  creditCustomerPhone: string | null;
  creditDueDate: string | null;
  notes: string | null;
};

type Props = {
  session: StoredSession;
  online: boolean;
  locked?: boolean;
};

export function CreditsPage({ session, online, locked }: Props) {
  const [search, setSearch] = useState('');
  const [payingId, setPayingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const qs = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';

  const { rows, loading, error, reload } = useNestList<Credit>({
    session,
    online,
    path: `/pharmacies/${session.organizationId}/sales/credits${qs}`,
    pick: (data) => asList<Credit>(data, 'credits'),
    deps: [search, session.organizationId],
  });

  const totalDue = useMemo(
    () => rows.reduce((s, c) => s + (c.amountCredited || 0), 0),
    [rows],
  );
  const overdueCount = useMemo(() => rows.filter((c) => c.overdue).length, [rows]);

  const { page, setPage, totalPages, pageItems, total } = usePagination(rows, 10);

  const markPaid = async (credit: Credit) => {
    const name = credit.creditCustomerName ?? credit.patient;
    if (!window.confirm(`Marquer le crédit de ${name} comme entièrement payé ?`)) return;
    setPayingId(credit.recordId);
    setActionError(null);
    const { ok, data } = await nestFetch(
      `/pharmacies/${session.organizationId}/sales/${credit.recordId}/pay-credit`,
      { method: 'PATCH' },
    );
    setPayingId(null);
    if (!ok) {
      setActionError(nestErrorMessage(data, 'Impossible de marquer comme payé.'));
      return;
    }
    await reload();
  };

  if (loading) return <p className="muted">Chargement des crédits…</p>;
  if (error) return <div className="error-box">{error}</div>;

  return (
    <div>
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="label">Créances ouvertes</div>
          <div className="value">{rows.length}</div>
        </div>
        <div className="kpi-card">
          <div className="label">Total dû</div>
          <div className="value">{formatMoney(totalDue)}</div>
        </div>
        <div className="kpi-card">
          <div className="label">En retard</div>
          <div className="value">{overdueCount}</div>
        </div>
      </div>

      <div className="toolbar" style={{ marginBottom: '0.75rem' }}>
        <input
          className="input"
          placeholder="Rechercher patient…"
          value={search}
          disabled={locked}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {actionError && <div className="error-box">{actionError}</div>}

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Client</th>
              <th>Articles</th>
              <th>Montant</th>
              <th>Échéance</th>
              <th>Statut</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {pageItems.map((c) => (
              <tr key={c.id}>
                <td>
                  <strong>{c.creditCustomerName ?? c.patient}</strong>
                  <div style={{ color: 'var(--color-muted)', fontSize: '0.72rem' }}>
                    {c.creditCustomerPhone || '—'} · {c.date} {c.heure}
                  </div>
                </td>
                <td>
                  {(c.items ?? []).slice(0, 3).map((i, idx) => (
                    <div key={`${c.id}-${idx}`}>
                      {i.nom} × {i.qte}
                    </div>
                  ))}
                </td>
                <td>{formatMoney(c.amountCredited)}</td>
                <td>{c.creditDueDate || '—'}</td>
                <td>
                  <span className={`badge ${c.overdue ? 'badge-warning' : 'badge-teal'}`}>
                    {c.overdue ? 'En retard' : c.statut || 'Ouvert'}
                  </span>
                </td>
                <td>
                  <button
                    type="button"
                    className="btn btn-outline"
                    disabled={locked || payingId === c.recordId}
                    onClick={() => void markPaid(c)}
                  >
                    {payingId === c.recordId ? '…' : 'Encaisser'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="empty">Aucun crédit ouvert.</p>}
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
