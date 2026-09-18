import { useMemo } from 'react';
import { formatMoney, listSales, paymentLabel } from '@/data/store';
import { usePagination } from '@/hooks/usePagination';
import { Pagination } from '@/components/Pagination';

type Props = { pharmacyId: string; refreshKey: number; locked?: boolean };

export function VentesPage({ pharmacyId, refreshKey, locked }: Props) {
  void refreshKey;
  const sales = listSales(pharmacyId);
  const today = new Date().toISOString().slice(0, 10);
  const todaySales = useMemo(
    () => sales.filter((s) => s.createdAt.startsWith(today)),
    [sales, today],
  );
  const revenue = todaySales.reduce((s, x) => s + x.total, 0);
  const { page, setPage, totalPages, pageItems, total } = usePagination(sales, 10);

  return (
    <div>
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="label">Ventes (total)</div>
          <div className="value">{sales.length}</div>
        </div>
        <div className="kpi-card">
          <div className="label">Aujourd’hui</div>
          <div className="value">{todaySales.length}</div>
        </div>
        <div className="kpi-card">
          <div className="label">Recettes du jour</div>
          <div className="value">{formatMoney(revenue)}</div>
        </div>
        <div className="kpi-card">
          <div className="label">Non synchronisées</div>
          <div className="value">{sales.filter((s) => !s.synced).length}</div>
        </div>
      </div>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Référence</th>
              <th>Patient</th>
              <th>Articles</th>
              <th>Paiement</th>
              <th>Total</th>
              <th>Statut</th>
              <th>Sync</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((s) => (
              <tr key={s.id}>
                <td>
                  <strong>{s.reference}</strong>
                  <div style={{ color: 'var(--color-muted)', fontSize: '0.72rem' }}>
                    {new Date(s.createdAt).toLocaleString('fr-CD')}
                  </div>
                </td>
                <td>{s.patientName || '—'}</td>
                <td>
                  {s.items.map((i) => (
                    <div key={`${s.id}-${i.productId}`}>
                      {i.nom} × {i.qte}
                    </div>
                  ))}
                </td>
                <td>{paymentLabel(s.paymentMethod)}</td>
                <td>{formatMoney(s.total)}</td>
                <td>
                  <span className="badge badge-teal">{s.status}</span>
                </td>
                <td>
                  <span className={`badge ${s.synced ? 'badge-teal' : 'badge-warning'}`}>
                    {s.synced ? 'OK' : 'Local'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sales.length === 0 && <p className="empty">Aucune vente enregistrée.</p>}
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
