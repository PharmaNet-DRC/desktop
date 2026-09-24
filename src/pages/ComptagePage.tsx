import { useCallback, useEffect, useState } from 'react';
import type { StoredSession } from '@/lib/session';
import { nestFetch } from '@/lib/nest';
import { nestErrorMessage } from '@/lib/pharmacy-api';
import { usePagination } from '@/hooks/usePagination';
import { Pagination } from '@/components/Pagination';

type CountLine = {
  id: string;
  productId: string;
  nom: string;
  stockActuel: number;
  stockCompte: number | null;
  nouvelleArrivee: number;
  notes: string | null;
  stockFinal: number;
};

type CountSession = {
  id: string;
  title: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  lines: CountLine[];
};

const STATUS_LABEL: Record<string, string> = {
  BROUILLON: 'Brouillon',
  EN_COURS: 'En cours',
  TERMINE: 'Terminé',
  ANNULE: 'Annulé',
};

type Props = {
  session: StoredSession;
  online: boolean;
  locked?: boolean;
};

export function ComptagePage({ session, online, locked }: Props) {
  const [sessionData, setSessionData] = useState<CountSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!online) {
      setError('Disponible uniquement en ligne.');
      setLoading(false);
      return;
    }
    if (session.accessToken === 'demo-token') {
      setError('Mode démo — comptage non disponible.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { ok, data } = await nestFetch(
      `/pharmacies/${session.organizationId}/inventory/counts/active`,
    );
    if (!ok || data?.success === false) {
      setError(nestErrorMessage(data, 'Impossible de charger le comptage.'));
      setLoading(false);
      return;
    }
    // Nest returns the session object; web BFF wraps as `{ success, session }`.
    const sessionPayload =
      data?.session && typeof data.session === 'object'
        ? (data.session as CountSession)
        : data?.id && Array.isArray(data?.lines)
          ? (data as CountSession)
          : null;
    setSessionData(sessionPayload);
    setLoading(false);
  }, [online, session.accessToken, session.organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const startCount = async () => {
    setCreating(true);
    setError(null);
    const { ok, data } = await nestFetch(
      `/pharmacies/${session.organizationId}/inventory/counts`,
      {
        method: 'POST',
        body: JSON.stringify({}),
      },
    );
    setCreating(false);
    if (!ok || data?.success === false) {
      setError(nestErrorMessage(data, 'Impossible de démarrer le comptage.'));
      return;
    }
    await load();
  };

  const lines = sessionData?.lines ?? [];
  const { page, setPage, totalPages, pageItems, total } = usePagination(lines, 15);

  if (loading) return <p className="muted">Chargement de la feuille d’inventaire…</p>;
  if (error && !sessionData) return <div className="error-box">{error}</div>;

  if (!sessionData) {
    return (
      <div>
        {error && <div className="error-box">{error}</div>}
        <div className="card">
          <p style={{ marginTop: 0 }}>
            Aucune feuille d’inventaire en cours. Démarrez un comptage physique pour
            comparer le stock théorique et le stock réel.
          </p>
          <button
            type="button"
            className="btn btn-outline"
            disabled={locked || creating}
            onClick={() => void startCount()}
          >
            {creating ? 'Création…' : 'Démarrer un comptage'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {error && <div className="error-box">{error}</div>}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="label">Session</div>
          <div className="value" style={{ fontSize: '1rem' }}>
            {sessionData.title || 'Comptage'}
          </div>
        </div>
        <div className="kpi-card">
          <div className="label">Statut</div>
          <div className="value" style={{ fontSize: '1rem' }}>
            <span className="badge badge-teal">
              {STATUS_LABEL[sessionData.status] ?? sessionData.status}
            </span>
          </div>
        </div>
        <div className="kpi-card">
          <div className="label">Lignes</div>
          <div className="value">{lines.length}</div>
        </div>
        <div className="kpi-card">
          <div className="label">Ouverte le</div>
          <div className="value" style={{ fontSize: '0.9rem' }}>
            {new Date(sessionData.createdAt).toLocaleString('fr-CD')}
          </div>
        </div>
      </div>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Produit</th>
              <th>Stock théorique</th>
              <th>Compté</th>
              <th>Nouv. arrivée</th>
              <th>Stock final</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((line) => (
              <tr key={line.id}>
                <td>
                  <strong>{line.nom}</strong>
                </td>
                <td>{line.stockActuel}</td>
                <td>{line.stockCompte ?? '—'}</td>
                <td>{line.nouvelleArrivee}</td>
                <td>{line.stockFinal}</td>
                <td>{line.notes || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {lines.length === 0 && <p className="empty">Aucune ligne de comptage.</p>}
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
