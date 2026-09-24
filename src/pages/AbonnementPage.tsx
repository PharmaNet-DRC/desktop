import { useEffect, useState } from 'react';
import type { StoredSession } from '@/lib/session';
import {
  fetchSubscription,
  type SubscriptionStatus,
} from '@/lib/pharmacy-api';

type Props = {
  session: StoredSession;
  online: boolean;
};

function money(value: unknown, currency = 'USD') {
  const n = Number(value);
  if (Number.isNaN(n)) return String(value ?? '—');
  return `${n.toLocaleString('fr-CD')} ${currency}`;
}

export function AbonnementPage({ session, online }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SubscriptionStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      if (!online) {
        setError('Abonnement disponible uniquement en ligne.');
        setLoading(false);
        return;
      }
      if (session.accessToken === 'demo-token') {
        setData({
          freeProductLimit: 50,
          productLimit: {
            maxProducts: null,
            used: 0,
            planName: 'Pro (démo)',
            isUnlimited: true,
          },
          subscription: {
            id: 'demo',
            status: 'ACTIVE',
            planName: 'Pro',
            price: 0,
            currency: 'USD',
            currentPeriodStart: null,
            currentPeriodEnd: session.expiresAt,
            isPaid: true,
          },
          pendingPayment: null,
          plans: [],
        });
        setLoading(false);
        return;
      }
      const res = await fetchSubscription(session);
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

  if (loading) return <p className="muted">Chargement de l’abonnement…</p>;
  if (error) return <div className="error-box">{error}</div>;
  if (!data) return null;

  const sub = data.subscription;
  const limit = data.productLimit;

  return (
    <div>
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="label">Plan actuel</div>
          <div className="value" style={{ fontSize: '1.05rem' }}>
            {sub?.planName ?? limit?.planName ?? session.planName}
          </div>
        </div>
        <div className="kpi-card">
          <div className="label">Statut</div>
          <div className="value" style={{ fontSize: '1rem' }}>
            {sub ? (
              <span className={`badge ${sub.isPaid ? 'badge-teal' : 'badge-warning'}`}>
                {sub.status}
                {sub.isPaid ? ' · Payant' : ' · Gratuit'}
              </span>
            ) : (
              <span className="badge badge-warning">Aucun abonnement actif</span>
            )}
          </div>
        </div>
        <div className="kpi-card">
          <div className="label">Produits</div>
          <div className="value" style={{ fontSize: '1rem' }}>
            {limit?.used ?? 0}
            {limit?.maxProducts == null ? ' / ∞' : ` / ${limit.maxProducts}`}
          </div>
        </div>
        <div className="kpi-card">
          <div className="label">Fin de période</div>
          <div className="value" style={{ fontSize: '0.95rem' }}>
            {sub?.currentPeriodEnd
              ? new Date(sub.currentPeriodEnd).toLocaleDateString('fr-CD')
              : '—'}
          </div>
        </div>
      </div>

      {data.pendingPayment && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <p className="section-label">Paiement en attente</p>
          <p style={{ margin: 0, color: 'var(--color-text-soft)' }}>
            {data.pendingPayment.planName} —{' '}
            {money(data.pendingPayment.amountClaimed, data.pendingPayment.currency)}{' '}
            via {data.pendingPayment.paymentMethod}. Réf.{' '}
            <code>{data.pendingPayment.reference}</code>
          </p>
        </div>
      )}

      <div className="card" style={{ marginBottom: '1rem' }}>
        <p className="section-label">Détail</p>
        <p style={{ marginTop: 0, color: 'var(--color-text-soft)', lineHeight: 1.6 }}>
          {sub?.isPaid
            ? 'Votre pharmacie dispose d’un abonnement Pro actif — l’app bureau (offline) est autorisée.'
            : 'Sans abonnement Pro, l’app bureau est verrouillée. L’offre gratuite (limite de produits) reste disponible uniquement sur le site web en mode en ligne.'}
        </p>
        {sub && (
          <p style={{ fontSize: '0.875rem', color: 'var(--color-muted)' }}>
            Tarif plan : {money(sub.price, sub.currency)}
          </p>
        )}
      </div>

      {data.plans.length > 0 && (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Offre</th>
                <th>Durée</th>
                <th>Produits</th>
                <th>Prix</th>
              </tr>
            </thead>
            <tbody>
              {data.plans.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{p.durationMonths} mois</td>
                  <td>{p.maxProducts ?? 'Illimité'}</td>
                  <td>{money(p.price, p.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted" style={{ marginTop: '0.85rem', fontSize: '0.8125rem' }}>
        Pour souscrire ou envoyer une preuve de paiement, utilisez aussi le tableau de bord web
        si besoin. Ici vous consultez l’état réel depuis le serveur.
      </p>
    </div>
  );
}
