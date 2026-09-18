import { useEffect, useState } from 'react';
import type { StoredSession } from '@/lib/session';
import { fetchAdsOverview, type AdsOverview } from '@/lib/pharmacy-api';

type Props = {
  session: StoredSession;
  online: boolean;
};

function money(value: unknown, currency = 'USD') {
  const n = Number(value);
  if (Number.isNaN(n)) return String(value ?? '—');
  return `${n.toLocaleString('fr-CD')} ${currency}`;
}

export function PublicitePage({ session, online }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AdsOverview | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      if (!online) {
        setError('Publicité disponible uniquement en ligne.');
        setLoading(false);
        return;
      }
      if (session.accessToken === 'demo-token') {
        setError('Mode démo — campagnes publicitaires non disponibles.');
        setLoading(false);
        return;
      }
      const res = await fetchAdsOverview(session);
      if (cancelled) return;
      if (!res.ok) {
        setError(res.message);
        setLoading(false);
        return;
      }
      setData(res.data);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [session, online]);

  if (loading) return <p className="muted">Chargement des campagnes…</p>;
  if (error) return <div className="error-box">{error}</div>;
  if (!data) return null;

  return (
    <div>
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="label">Campagnes</div>
          <div className="value">{data.campaigns.length}</div>
        </div>
        <div className="kpi-card">
          <div className="label">Packs dispo.</div>
          <div className="value">{data.plans.length}</div>
        </div>
        <div className="kpi-card">
          <div className="label">Produits éligibles</div>
          <div className="value">{data.products.length}</div>
        </div>
        <div className="kpi-card">
          <div className="label">Paiement</div>
          <div className="value" style={{ fontSize: '0.95rem' }}>
            {data.hasPendingPayment ? (
              <span className="badge badge-warning">En attente</span>
            ) : (
              <span className="badge badge-teal">OK</span>
            )}
          </div>
        </div>
      </div>

      {data.pendingPayment && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <p className="section-label">Preuve en attente</p>
          <p style={{ margin: 0, color: 'var(--color-text-soft)' }}>
            {money(data.pendingPayment.amountClaimed, data.pendingPayment.currency)} via{' '}
            {data.pendingPayment.paymentMethod} — réf.{' '}
            <code>{data.pendingPayment.reference}</code>
          </p>
        </div>
      )}

      {data.plans.length > 0 && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <p className="section-label">Packs publicitaires</p>
          <div className="table-wrap" style={{ boxShadow: 'none', border: 0 }}>
            <table className="data">
              <thead>
                <tr>
                  <th>Pack</th>
                  <th>Durée</th>
                  <th>Prix</th>
                </tr>
              </thead>
              <tbody>
                {data.plans.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>{p.durationDays} j</td>
                    <td>{money(p.price, p.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Produit</th>
              <th>Pack</th>
              <th>Statut</th>
              <th>Période</th>
              <th>Paiement</th>
            </tr>
          </thead>
          <tbody>
            {data.campaigns.map((c) => (
              <tr key={c.id}>
                <td>{c.productName}</td>
                <td>
                  {c.planName}
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-muted)' }}>
                    {money(c.price, c.currency)} · {c.durationDays} j
                  </div>
                </td>
                <td>
                  <span
                    className={`badge ${
                      c.status === 'ACTIVE'
                        ? 'badge-teal'
                        : c.status === 'PENDING_APPROVAL'
                          ? 'badge-warning'
                          : 'badge-muted'
                    }`}
                  >
                    {c.status}
                  </span>
                </td>
                <td style={{ fontSize: '0.8rem' }}>
                  {c.currentPeriodStart
                    ? new Date(c.currentPeriodStart).toLocaleDateString('fr-CD')
                    : '—'}
                  {' → '}
                  {c.currentPeriodEnd
                    ? new Date(c.currentPeriodEnd).toLocaleDateString('fr-CD')
                    : '—'}
                </td>
                <td>{c.paymentStatus ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.campaigns.length === 0 && (
          <p className="empty">Aucune campagne publicitaire pour cette pharmacie.</p>
        )}
      </div>
      <p className="muted" style={{ marginTop: '0.85rem', fontSize: '0.8125rem' }}>
        Création / preuve de paiement : disponible aussi sur le web. Ici : état live des
        campagnes de la pharmacie active.
      </p>
    </div>
  );
}
