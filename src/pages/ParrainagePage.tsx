import { useEffect, useMemo, useState } from 'react';
import type { StoredSession } from '@/lib/session';
import { nestFetch } from '@/lib/nest';
import { nestErrorMessage } from '@/lib/pharmacy-api';
import { BRAND } from '@/lib/brand';
import { usePagination } from '@/hooks/usePagination';
import { Pagination } from '@/components/Pagination';

type LedgerRow = {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  summary: string;
  createdAt: string;
};

type Overview = {
  enabled: boolean;
  code: string;
  balance: number;
  pointsPerSuccessfulReferral: number;
  pointsPerProMonth: number;
  attributionCount: number;
  rewardedCount: number;
  ledger: LedgerRow[];
};

const TYPE_LABEL: Record<string, string> = {
  EARN_REFERRAL: 'Gain parrainage',
  REDEEM_SUBSCRIPTION: 'Échange abonnement',
  ADJUST: 'Ajustement',
};

type Props = {
  session: StoredSession;
  online: boolean;
  locked?: boolean;
};

export function ParrainagePage({ session, online, locked }: Props) {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!online) {
        setError('Disponible uniquement en ligne.');
        setLoading(false);
        return;
      }
      if (session.accessToken === 'demo-token') {
        setError('Mode démo — parrainage non disponible.');
        setLoading(false);
        return;
      }
      setLoading(true);
      const { ok, data: body } = await nestFetch(
        `/pharmacies/${session.organizationId}/referral-points`,
      );
      if (cancelled) return;
      if (!ok || body?.success === false) {
        setError(nestErrorMessage(body, 'Impossible de charger le parrainage.'));
        setLoading(false);
        return;
      }
      setData(body as Overview);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [online, session.accessToken, session.organizationId]);

  const referralUrl = useMemo(() => {
    if (!data?.code) return '';
    return `${BRAND.webUrl}/register/pharmacie?ref=${encodeURIComponent(data.code)}`;
  }, [data?.code]);

  const ledgerPage = usePagination(data?.ledger ?? [], 10);

  const copyLink = async () => {
    if (!referralUrl) return;
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Impossible de copier le lien.');
    }
  };

  if (loading) return <p className="muted">Chargement du parrainage…</p>;
  if (error) return <div className="error-box">{error}</div>;
  if (!data) return null;

  if (!data.enabled) {
    return (
      <div className="card">
        <p style={{ margin: 0 }}>Le programme de parrainage n’est pas activé pour le moment.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="label">Solde points</div>
          <div className="value">{data.balance}</div>
        </div>
        <div className="kpi-card">
          <div className="label">Parrainages</div>
          <div className="value">{data.attributionCount}</div>
        </div>
        <div className="kpi-card">
          <div className="label">Récompensés</div>
          <div className="value">{data.rewardedCount}</div>
        </div>
        <div className="kpi-card">
          <div className="label">Pts / filleul</div>
          <div className="value">{data.pointsPerSuccessfulReferral}</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <p className="section-label">Votre code</p>
        <p style={{ margin: '0 0 0.5rem', fontFamily: 'monospace', fontSize: '1.1rem' }}>
          {data.code}
        </p>
        <p style={{ margin: '0 0 0.75rem', color: 'var(--color-muted)', fontSize: '0.85rem', wordBreak: 'break-all' }}>
          {referralUrl}
        </p>
        <button type="button" className="btn btn-outline" disabled={locked} onClick={() => void copyLink()}>
          {copied ? 'Copié' : 'Copier le lien'}
        </button>
        <p style={{ margin: '0.75rem 0 0', color: 'var(--color-muted)', fontSize: '0.8rem' }}>
          {data.pointsPerProMonth} points ≈ 1 mois Pro
        </p>
      </div>

      <p className="section-label">Historique</p>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Points</th>
              <th>Solde</th>
              <th>Détail</th>
            </tr>
          </thead>
          <tbody>
            {ledgerPage.pageItems.map((row) => (
              <tr key={row.id}>
                <td>{new Date(row.createdAt).toLocaleString('fr-CD')}</td>
                <td>{TYPE_LABEL[row.type] ?? row.type}</td>
                <td>{row.amount > 0 ? `+${row.amount}` : row.amount}</td>
                <td>{row.balanceAfter}</td>
                <td>{row.summary}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {(data.ledger ?? []).length === 0 && <p className="empty">Aucun mouvement.</p>}
      </div>
      <Pagination
        page={ledgerPage.page}
        totalPages={ledgerPage.totalPages}
        total={ledgerPage.total}
        onPageChange={ledgerPage.setPage}
        disabled={locked}
      />
    </div>
  );
}
