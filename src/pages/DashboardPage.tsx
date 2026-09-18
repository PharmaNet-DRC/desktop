import { formatMoney, getDashboardStats, paymentLabel } from '@/data/store';
import type { PageId } from '@/data/types';
import { usePagination } from '@/hooks/usePagination';
import { Pagination } from '@/components/Pagination';

type Props = {
  pharmacyId: string;
  refreshKey: number;
  onNavigate: (page: PageId) => void;
  locked?: boolean;
};

export function DashboardPage({ pharmacyId, refreshKey, onNavigate, locked }: Props) {
  void refreshKey;
  const stats = getDashboardStats(pharmacyId);
  const salesPage = usePagination(stats.recentSales, 5);
  const stockPage = usePagination(stats.lowStockProducts, 5);

  return (
    <div>
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="label">Ventes du jour</div>
          <div className="value">{stats.salesTodayCount}</div>
        </div>
        <div className="kpi-card">
          <div className="label">Recettes du jour</div>
          <div className="value">{formatMoney(stats.revenueToday)}</div>
        </div>
        <div className="kpi-card">
          <div className="label">Stock faible</div>
          <div className="value">{stats.lowStockCount}</div>
        </div>
        <div className="kpi-card">
          <div className="label">Ruptures</div>
          <div className="value">{stats.ruptureCount}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.65rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn btn-primary"
          disabled={locked}
          onClick={() => onNavigate('caisse')}
        >
          Ouvrir la caisse
        </button>
        <button
          type="button"
          className="btn btn-outline"
          disabled={locked}
          onClick={() => onNavigate('inventaire')}
        >
          Voir l’inventaire
        </button>
        <button
          type="button"
          className="btn btn-outline"
          disabled={locked}
          onClick={() => onNavigate('sync')}
        >
          Sync ({stats.pendingSync})
        </button>
      </div>

      <div className="grid-2">
        <section className="card">
          <p className="section-label">Ventes récentes</p>
          {stats.recentSales.length === 0 ? (
            <p className="empty">Aucune vente pour l’instant.</p>
          ) : (
            <>
              <div className="table-wrap" style={{ border: 'none' }}>
                <table className="data">
                  <thead>
                    <tr>
                      <th>Réf.</th>
                      <th>Total</th>
                      <th>Paiement</th>
                      <th>Sync</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesPage.pageItems.map((s) => (
                      <tr key={s.id}>
                        <td>
                          <strong>{s.reference}</strong>
                          <div style={{ color: 'var(--color-muted)', fontSize: '0.72rem' }}>
                            {new Date(s.createdAt).toLocaleString('fr-CD')}
                          </div>
                        </td>
                        <td>{formatMoney(s.total)}</td>
                        <td>{paymentLabel(s.paymentMethod)}</td>
                        <td>
                          <span className={`badge ${s.synced ? 'badge-teal' : 'badge-warning'}`}>
                            {s.synced ? 'OK' : 'Local'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={salesPage.page}
                totalPages={salesPage.totalPages}
                total={salesPage.total}
                onPageChange={salesPage.setPage}
                disabled={locked}
              />
            </>
          )}
        </section>

        <section className="card">
          <p className="section-label">Alertes stock</p>
          {stats.lowStockProducts.length === 0 ? (
            <p className="empty">Stock sain.</p>
          ) : (
            <>
              <div className="table-wrap" style={{ border: 'none' }}>
                <table className="data">
                  <thead>
                    <tr>
                      <th>Produit</th>
                      <th>Stock</th>
                      <th>Seuil</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockPage.pageItems.map((p) => (
                      <tr key={p.id}>
                        <td>{p.nom}</td>
                        <td>
                          <span
                            className={`badge ${p.stock === 0 ? 'badge-danger' : 'badge-warning'}`}
                          >
                            {p.stock}
                          </span>
                        </td>
                        <td>{p.minThreshold}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={stockPage.page}
                totalPages={stockPage.totalPages}
                total={stockPage.total}
                onPageChange={stockPage.setPage}
                disabled={locked}
              />
            </>
          )}
        </section>
      </div>
    </div>
  );
}
