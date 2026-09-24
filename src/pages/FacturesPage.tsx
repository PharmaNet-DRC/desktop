import { useMemo, useState } from 'react';
import type { StoredSession } from '@/lib/session';
import { nestFetch } from '@/lib/nest';
import { nestErrorMessage } from '@/lib/pharmacy-api';
import { formatMoney } from '@/data/store';
import { useNestList, asList } from '@/hooks/useNestList';
import { usePagination } from '@/hooks/usePagination';
import { Pagination } from '@/components/Pagination';

type Facture = {
  id: string;
  client: string;
  contact: string;
  articles: number;
  montant: number;
  statut: string;
  date: string;
  echeance: string;
  type: string;
  createdBy?: string;
};

const STATUT_LABEL: Record<string, string> = {
  payée: 'Payée',
  en_attente: 'En attente',
  en_retard: 'En retard',
  annulée: 'Annulée',
};

type Props = {
  session: StoredSession;
  online: boolean;
  locked?: boolean;
};

export function FacturesPage({ session, online, locked }: Props) {
  const [search, setSearch] = useState('');
  const [statutFilter, setStatutFilter] = useState('tous');
  const [payingId, setPayingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const qs = new URLSearchParams();
  if (search.trim()) qs.set('search', search.trim());
  if (statutFilter !== 'tous') qs.set('statut', statutFilter);
  const q = qs.toString();

  const { rows, loading, error, reload } = useNestList<Facture>({
    session,
    online,
    path: `/pharmacies/${session.organizationId}/invoices${q ? `?${q}` : ''}`,
    pick: (data) => asList<Facture>(data, 'invoices'),
    deps: [search, statutFilter, session.organizationId],
  });

  const totalPaye = useMemo(
    () => rows.filter((f) => f.statut === 'payée').reduce((s, f) => s + f.montant, 0),
    [rows],
  );
  const totalAttente = useMemo(
    () =>
      rows.filter((f) => f.statut === 'en_attente').reduce((s, f) => s + f.montant, 0),
    [rows],
  );
  const totalRetard = useMemo(
    () =>
      rows.filter((f) => f.statut === 'en_retard').reduce((s, f) => s + f.montant, 0),
    [rows],
  );

  const { page, setPage, totalPages, pageItems, total } = usePagination(rows, 10);

  const markPaid = async (facture: Facture) => {
    if (!window.confirm(`Marquer la facture de ${facture.client} comme payée ?`)) return;
    setPayingId(facture.id);
    setActionError(null);
    const { ok, data } = await nestFetch(
      `/pharmacies/${session.organizationId}/invoices/${facture.id}/pay`,
      { method: 'PATCH' },
    );
    setPayingId(null);
    if (!ok) {
      setActionError(nestErrorMessage(data, 'Impossible de marquer comme payée.'));
      return;
    }
    await reload();
  };

  if (loading) return <p className="muted">Chargement des factures…</p>;
  if (error) return <div className="error-box">{error}</div>;

  return (
    <div>
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="label">Encaissé</div>
          <div className="value">{formatMoney(totalPaye)}</div>
        </div>
        <div className="kpi-card">
          <div className="label">En attente</div>
          <div className="value">{formatMoney(totalAttente)}</div>
        </div>
        <div className="kpi-card">
          <div className="label">En retard</div>
          <div className="value">{formatMoney(totalRetard)}</div>
        </div>
        <div className="kpi-card">
          <div className="label">Factures</div>
          <div className="value">{rows.length}</div>
        </div>
      </div>

      <div className="toolbar" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
        <input
          className="input"
          placeholder="Rechercher client…"
          value={search}
          disabled={locked}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <select
          className="input"
          value={statutFilter}
          disabled={locked}
          onChange={(e) => {
            setStatutFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="tous">Tous les statuts</option>
          <option value="payée">Payée</option>
          <option value="en_attente">En attente</option>
          <option value="en_retard">En retard</option>
          <option value="annulée">Annulée</option>
        </select>
      </div>

      {actionError && <div className="error-box">{actionError}</div>}

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Client</th>
              <th>Type</th>
              <th>Articles</th>
              <th>Montant</th>
              <th>Échéance</th>
              <th>Statut</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {pageItems.map((f) => (
              <tr key={f.id}>
                <td>
                  <strong>{f.client}</strong>
                  <div style={{ color: 'var(--color-muted)', fontSize: '0.72rem' }}>
                    {f.contact || '—'} · {f.date}
                  </div>
                </td>
                <td>{f.type || '—'}</td>
                <td>{f.articles}</td>
                <td>{formatMoney(f.montant)}</td>
                <td>{f.echeance || '—'}</td>
                <td>
                  <span
                    className={`badge ${
                      f.statut === 'payée'
                        ? 'badge-teal'
                        : f.statut === 'en_retard'
                          ? 'badge-warning'
                          : 'badge-warning'
                    }`}
                  >
                    {STATUT_LABEL[f.statut] ?? f.statut}
                  </span>
                </td>
                <td>
                  {f.statut !== 'payée' && f.statut !== 'annulée' && (
                    <button
                      type="button"
                      className="btn btn-outline"
                      disabled={locked || payingId === f.id}
                      onClick={() => void markPaid(f)}
                    >
                      {payingId === f.id ? '…' : 'Payer'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="empty">Aucune facture.</p>}
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
