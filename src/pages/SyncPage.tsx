import { getSyncStats } from '@/data/store';
import { usePagination } from '@/hooks/usePagination';
import { Pagination } from '@/components/Pagination';

type Props = {
  pharmacyId: string;
  refreshKey: number;
  syncing: boolean;
  lastMessage: string | null;
  online: boolean;
  onSyncNow: () => void;
};

export function SyncPage({
  pharmacyId,
  refreshKey,
  syncing,
  lastMessage,
  online,
  onSyncNow,
}: Props) {
  void refreshKey;
  const stats = getSyncStats(pharmacyId);
  const { page, setPage, totalPages, pageItems, total } = usePagination(stats.outbox, 10);

  return (
    <div>
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="label">En attente</div>
          <div className="value">{stats.pending}</div>
        </div>
        <div className="kpi-card">
          <div className="label">Synchronisés</div>
          <div className="value">{stats.synced}</div>
        </div>
        <div className="kpi-card">
          <div className="label">Total file</div>
          <div className="value">{stats.total}</div>
        </div>
        <div className="kpi-card">
          <div className="label">Réseau</div>
          <div className="value" style={{ fontSize: '1rem' }}>
            {online ? 'En ligne' : 'Hors ligne'}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <p className="section-label">Comment ça fonctionne</p>
        <p style={{ color: 'var(--color-text-soft)', fontSize: '0.875rem', marginTop: 0, lineHeight: 1.6 }}>
          À la connexion, le catalogue et les patients sont téléchargés depuis le serveur.
          Hors ligne, vos ventes restent sur cet appareil. Dès qu’Internet est stable, elles
          sont envoyées automatiquement et le stock est rafraîchi.
        </p>
        {syncing ? (
          <p className="badge badge-warning" style={{ justifyContent: 'flex-start' }}>
            Synchronisation en cours…
          </p>
        ) : stats.pending > 0 ? (
          <p className="badge badge-warning" style={{ justifyContent: 'flex-start' }}>
            {stats.pending} modification(s) en attente d’envoi
          </p>
        ) : (
          <p className="badge badge-teal" style={{ justifyContent: 'flex-start' }}>
            Tout est à jour
          </p>
        )}
        {lastMessage && (
          <p style={{ marginTop: '0.75rem', fontSize: '0.875rem' }}>{lastMessage}</p>
        )}
        <button
          type="button"
          className="btn btn-primary"
          style={{ marginTop: '0.85rem' }}
          disabled={!online || syncing}
          onClick={onSyncNow}
        >
          {syncing ? 'Synchronisation…' : 'Synchroniser maintenant'}
        </button>
      </div>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Statut</th>
              <th>Référence</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((o) => (
              <tr key={o.id}>
                <td>{new Date(o.createdAt).toLocaleString('fr-CD')}</td>
                <td>
                  {o.kind === 'SALE'
                    ? 'Vente'
                    : o.kind === 'PRODUCT'
                      ? 'Médicament'
                      : o.kind === 'STOCK'
                        ? 'Stock'
                        : 'Patient'}
                </td>
                <td>
                  <span
                    className={`badge ${
                      o.status === 'synced'
                        ? 'badge-teal'
                        : o.status === 'error'
                          ? 'badge-danger'
                          : 'badge-warning'
                    }`}
                  >
                    {o.status === 'synced'
                      ? 'Envoyé'
                      : o.status === 'error'
                        ? 'Échec'
                        : 'En attente'}
                  </span>
                </td>
                <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.72rem' }}>
                  {o.id}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {stats.outbox.length === 0 && (
          <p className="empty">Aucune opération en file d’attente.</p>
        )}
      </div>
      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={setPage}
        disabled={syncing}
      />
    </div>
  );
}
