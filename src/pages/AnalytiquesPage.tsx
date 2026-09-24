import { useEffect, useState } from 'react';
import type { StoredSession } from '@/lib/session';
import { nestFetch } from '@/lib/nest';
import { nestErrorMessage } from '@/lib/pharmacy-api';
import { formatMoney } from '@/data/store';
import { usePagination } from '@/hooks/usePagination';
import { Pagination } from '@/components/Pagination';

type Analytics = {
  pharmacyName: string;
  kpis: {
    ventesDuJour: { value: number; delta: number | null; deltaLabel: string };
    ordonnancesTraitees: { value: number; delta: number | null; deltaLabel: string };
    articlesEnRupture: { value: number; delta: number | null; deltaLabel: string };
    livraisonsEnCours: {
      value: number;
      delta: number | null;
      deltaLabel: string;
      enRetard: number;
    };
  };
  lowStock: Array<{ nom: string; stock: number; seuil: number; unite: string }>;
  salesByDay: Array<{ date: string; label: string; ventes: number; count: number }>;
  statusSplit: Array<{ mode: string; value: number; pct: number; key: string }>;
  totals: {
    ca7j: number;
    ventes7j: number;
    produitsActifs: number;
    creditsOuverts: number;
  };
};

type Props = {
  session: StoredSession;
  online: boolean;
  locked?: boolean;
};

export function AnalytiquesPage({ session, online, locked }: Props) {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!online) {
        setError('Disponible uniquement en ligne.');
        setLoading(false);
        return;
      }
      if (session.accessToken === 'demo-token') {
        setError('Mode démo — analytiques non disponibles.');
        setLoading(false);
        return;
      }
      setLoading(true);
      const { ok, data: body } = await nestFetch(
        `/pharmacies/${session.organizationId}/analytics`,
      );
      if (cancelled) return;
      if (!ok || body?.success === false) {
        setError(nestErrorMessage(body, 'Impossible de charger les analytiques.'));
        setLoading(false);
        return;
      }
      // Nest returns analytics payload; web BFF wraps as `{ success, analytics }`.
      setData((body?.analytics ?? body) as Analytics);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [online, session.accessToken, session.organizationId]);

  const lowStockPage = usePagination(data?.lowStock ?? [], 8);
  const salesPage = usePagination(data?.salesByDay ?? [], 10);

  if (loading) return <p className="muted">Chargement des analytiques…</p>;
  if (error) return <div className="error-box">{error}</div>;
  if (!data) return null;

  return (
    <div>
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="label">Ventes du jour</div>
          <div className="value">{formatMoney(data.kpis.ventesDuJour.value)}</div>
        </div>
        <div className="kpi-card">
          <div className="label">CA 7 jours</div>
          <div className="value">{formatMoney(data.totals.ca7j)}</div>
        </div>
        <div className="kpi-card">
          <div className="label">Ruptures</div>
          <div className="value">{data.kpis.articlesEnRupture.value}</div>
        </div>
        <div className="kpi-card">
          <div className="label">Crédits ouverts</div>
          <div className="value">{data.totals.creditsOuverts}</div>
        </div>
      </div>

      <div className="kpi-grid" style={{ marginBottom: '1rem' }}>
        <div className="kpi-card">
          <div className="label">Ordonnances</div>
          <div className="value">{data.kpis.ordonnancesTraitees.value}</div>
        </div>
        <div className="kpi-card">
          <div className="label">Livraisons en cours</div>
          <div className="value">{data.kpis.livraisonsEnCours.value}</div>
        </div>
        <div className="kpi-card">
          <div className="label">Produits actifs</div>
          <div className="value">{data.totals.produitsActifs}</div>
        </div>
        <div className="kpi-card">
          <div className="label">Ventes 7 j</div>
          <div className="value">{data.totals.ventes7j}</div>
        </div>
      </div>

      <p className="section-label">Répartition des paiements</p>
      <div className="table-wrap" style={{ marginBottom: '1rem' }}>
        <table className="data">
          <thead>
            <tr>
              <th>Mode</th>
              <th>Montant</th>
              <th>%</th>
            </tr>
          </thead>
          <tbody>
            {(data.statusSplit ?? []).map((s) => (
              <tr key={s.key || s.mode}>
                <td>{s.mode}</td>
                <td>{formatMoney(s.value)}</td>
                <td>{s.pct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="section-label">Ventes par jour</p>
      <div className="table-wrap" style={{ marginBottom: '1rem' }}>
        <table className="data">
          <thead>
            <tr>
              <th>Jour</th>
              <th>Tickets</th>
              <th>CA</th>
            </tr>
          </thead>
          <tbody>
            {salesPage.pageItems.map((d) => (
              <tr key={d.date}>
                <td>{d.label || d.date}</td>
                <td>{d.count}</td>
                <td>{formatMoney(d.ventes)}</td>
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

      <p className="section-label" style={{ marginTop: '1rem' }}>
        Stock bas
      </p>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Produit</th>
              <th>Stock</th>
              <th>Seuil</th>
              <th>Unité</th>
            </tr>
          </thead>
          <tbody>
            {lowStockPage.pageItems.map((p) => (
              <tr key={p.nom}>
                <td>
                  <strong>{p.nom}</strong>
                </td>
                <td>{p.stock}</td>
                <td>{p.seuil}</td>
                <td>{p.unite}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {(data.lowStock ?? []).length === 0 && (
          <p className="empty">Aucun produit sous seuil.</p>
        )}
      </div>
      <Pagination
        page={lowStockPage.page}
        totalPages={lowStockPage.totalPages}
        total={lowStockPage.total}
        onPageChange={lowStockPage.setPage}
        disabled={locked}
      />
    </div>
  );
}
