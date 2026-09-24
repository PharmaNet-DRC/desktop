import { useCallback, useEffect, useMemo, useState } from 'react';
import type { StoredSession } from '@/lib/session';
import { nestFetch } from '@/lib/nest';
import { nestErrorMessage } from '@/lib/pharmacy-api';
import { formatMoney } from '@/data/store';
import { Pagination } from '@/components/Pagination';

type CatalogueItem = {
  id: string;
  name: string;
  price: number | string;
  unit: string;
  stock: number;
  categorie: string | null;
  owner: { firstName: string; lastName: string; email: string };
};

type Props = {
  session: StoredSession;
  online: boolean;
  locked?: boolean;
};

export function CommandesFournisseurPage({ session, online, locked }: Props) {
  const [items, setItems] = useState<CatalogueItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [qty, setQty] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!online) {
      setError('Disponible uniquement en ligne.');
      setLoading(false);
      return;
    }
    if (session.accessToken === 'demo-token') {
      setError('Mode démo — catalogue non disponible.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(page), limit: '10' });
    if (search.trim()) params.set('search', search.trim());
    const { ok, data } = await nestFetch(`/catalogue/fournisseurs?${params}`);
    if (!ok || data?.success === false) {
      setError(nestErrorMessage(data, 'Impossible de charger le catalogue.'));
      setItems([]);
      setLoading(false);
      return;
    }
    const list = Array.isArray(data?.data)
      ? (data.data as CatalogueItem[])
      : Array.isArray(data)
        ? (data as CatalogueItem[])
        : [];
    setItems(list);
    setTotalPages(Number(data?.meta?.totalPages) || 1);
    setTotal(Number(data?.meta?.total) || list.length);
    setLoading(false);
  }, [online, page, search, session.accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedLines = useMemo(
    () =>
      Object.entries(qty)
        .filter(([, q]) => q > 0)
        .map(([catalogueItemId, quantity]) => ({ catalogueItemId, quantity })),
    [qty],
  );

  const submit = async () => {
    if (selectedLines.length === 0) return;
    setSubmitting(true);
    setMessage(null);
    setError(null);
    const { ok, data } = await nestFetch(
      `/pharmacies/${session.organizationId}/catalogue-orders`,
      {
        method: 'POST',
        body: JSON.stringify({ items: selectedLines }),
      },
    );
    setSubmitting(false);
    if (!ok) {
      setError(nestErrorMessage(data, 'Erreur lors de la commande.'));
      return;
    }
    setMessage(`Commande ${data?.order?.reference ?? data?.reference ?? ''} créée.`);
    setQty({});
  };

  if (loading) return <p className="muted">Chargement du catalogue dépôts…</p>;
  if (error && items.length === 0) return <div className="error-box">{error}</div>;

  return (
    <div>
      <div
        className="toolbar"
        style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}
      >
        <input
          className="input"
          placeholder="Rechercher…"
          value={search}
          disabled={locked}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          type="button"
          className="btn btn-outline"
          disabled={locked}
          onClick={() => {
            setPage(1);
            void load();
          }}
        >
          Filtrer
        </button>
        <button
          type="button"
          className="btn btn-outline"
          disabled={locked || submitting || selectedLines.length === 0}
          onClick={() => void submit()}
        >
          Commander ({selectedLines.length})
        </button>
      </div>

      {message && (
        <div className="card" style={{ marginBottom: '0.75rem' }}>
          <p style={{ margin: 0 }}>{message}</p>
        </div>
      )}
      {error && <div className="error-box">{error}</div>}

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Produit</th>
              <th>Dépôt</th>
              <th>Stock</th>
              <th>Prix</th>
              <th>Qté</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>
                  <strong>{item.name}</strong>
                  <div style={{ color: 'var(--color-muted)', fontSize: '0.72rem' }}>
                    {item.categorie || item.unit || '—'}
                  </div>
                </td>
                <td>
                  {[item.owner?.firstName, item.owner?.lastName].filter(Boolean).join(' ') ||
                    item.owner?.email ||
                    '—'}
                </td>
                <td>{item.stock}</td>
                <td>{formatMoney(Number(item.price))}</td>
                <td>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    style={{ width: '5rem' }}
                    value={qty[item.id] ?? 0}
                    disabled={locked}
                    onChange={(e) =>
                      setQty((prev) => ({
                        ...prev,
                        [item.id]: Math.max(0, Number(e.target.value) || 0),
                      }))
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && <p className="empty">Aucun article catalogue.</p>}
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
