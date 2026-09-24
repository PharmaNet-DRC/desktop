import { useCallback, useEffect, useState } from 'react';
import type { StoredSession } from '@/lib/session';
import { nestFetch } from '@/lib/nest';
import { nestErrorMessage } from '@/lib/pharmacy-api';
import { formatMoney } from '@/data/store';
import { Pagination } from '@/components/Pagination';

type OrderItem = {
  id: string;
  quantity: number;
  unitPrice: string | number;
  product?: { name: string } | null;
};

type OrderUser = {
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  email?: string | null;
};

type Order = {
  id: string;
  reference: string;
  status: string;
  totalAmount: string | number;
  deliveryAddress: string | null;
  notes: string | null;
  createdAt: string;
  user?: OrderUser | null;
  items?: OrderItem[];
};

const STATUS_LABEL: Record<string, string> = {
  EN_ATTENTE: 'En attente',
  CONFIRMEE: 'Confirmée',
  PRETE: 'Prête',
  LIVREE: 'Livrée',
  ANNULEE: 'Annulée',
};

const NEXT_STATUS: Record<string, { value: string; label: string }[]> = {
  EN_ATTENTE: [
    { value: 'CONFIRMEE', label: 'Confirmer' },
    { value: 'ANNULEE', label: 'Annuler' },
  ],
  CONFIRMEE: [
    { value: 'PRETE', label: 'Marquer prête' },
    { value: 'ANNULEE', label: 'Annuler' },
  ],
  PRETE: [
    { value: 'LIVREE', label: 'Marquer livrée' },
    { value: 'ANNULEE', label: 'Annuler' },
  ],
  LIVREE: [],
  ANNULEE: [],
};

function patientName(user?: OrderUser | null) {
  if (!user) return '—';
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return name || user.email || user.phone || 'Patient';
}

type Props = {
  session: StoredSession;
  online: boolean;
  locked?: boolean;
};

export function CommandesPatientsPage({ session, online, locked }: Props) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!online) {
      setError('Disponible uniquement en ligne.');
      setLoading(false);
      return;
    }
    if (session.accessToken === 'demo-token') {
      setError('Mode démo — commandes non disponibles.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams({ page: String(page), limit: '20' });
    if (statusFilter) qs.set('status', statusFilter);
    const { ok, data } = await nestFetch(
      `/pharmacies/${session.organizationId}/orders?${qs}`,
    );
    if (!ok || data?.success === false) {
      setError(nestErrorMessage(data, 'Impossible de charger les commandes.'));
      setOrders([]);
      setLoading(false);
      return;
    }
    const list = Array.isArray(data?.data)
      ? (data.data as Order[])
      : Array.isArray(data)
        ? (data as Order[])
        : [];
    setOrders(list);
    setTotal(Number(data?.meta?.total) || list.length);
    setTotalPages(Number(data?.meta?.totalPages) || 1);
    setLoading(false);
  }, [online, page, session.accessToken, session.organizationId, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateStatus = async (orderId: string, status: string) => {
    setUpdatingId(orderId);
    const { ok, data } = await nestFetch(`/orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    setUpdatingId(null);
    if (!ok) {
      setError(nestErrorMessage(data, 'Mise à jour impossible.'));
      return;
    }
    await load();
  };

  if (loading) return <p className="muted">Chargement des commandes patients…</p>;
  if (error) return <div className="error-box">{error}</div>;

  return (
    <div>
      <div className="toolbar" style={{ marginBottom: '0.75rem' }}>
        <select
          className="input"
          value={statusFilter}
          disabled={locked}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Tous les statuts</option>
          {Object.entries(STATUS_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Référence</th>
              <th>Patient</th>
              <th>Articles</th>
              <th>Total</th>
              <th>Statut</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td>
                  <strong>{o.reference}</strong>
                  <div style={{ color: 'var(--color-muted)', fontSize: '0.72rem' }}>
                    {new Date(o.createdAt).toLocaleString('fr-CD')}
                  </div>
                </td>
                <td>{patientName(o.user)}</td>
                <td>
                  {(o.items ?? []).slice(0, 3).map((i) => (
                    <div key={i.id}>
                      {i.product?.name ?? 'Article'} × {i.quantity}
                    </div>
                  ))}
                </td>
                <td>{formatMoney(Number(o.totalAmount))}</td>
                <td>
                  <span className="badge badge-teal">
                    {STATUS_LABEL[o.status] ?? o.status}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                    {(NEXT_STATUS[o.status] ?? []).map((a) => (
                      <button
                        key={a.value}
                        type="button"
                        className="btn btn-outline"
                        disabled={locked || updatingId === o.id}
                        onClick={() => void updateStatus(o.id, a.value)}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {orders.length === 0 && <p className="empty">Aucune commande patient.</p>}
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
