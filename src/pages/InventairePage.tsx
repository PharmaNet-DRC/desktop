import { useEffect, useMemo, useState } from 'react';
import {
  adjustStock,
  formatMoney,
  listAllProducts,
  listMovements,
  stockStatus,
} from '@/data/store';
import { usePagination } from '@/hooks/usePagination';
import { Pagination } from '@/components/Pagination';

type Props = {
  pharmacyId: string;
  refreshKey: number;
  onChanged: () => void;
  locked?: boolean;
};

export function InventairePage({ pharmacyId, refreshKey, onChanged, locked }: Props) {
  void refreshKey;
  const products = listAllProducts(pharmacyId);
  const movements = listMovements(pharmacyId);
  const [tab, setTab] = useState<'stock' | 'mouvements'>('stock');
  const [q, setQ] = useState('');
  const [modal, setModal] = useState<{
    productId: string;
    mode: 'ENTREE' | 'AJUSTEMENT';
  } | null>(null);
  const [qty, setQty] = useState('');
  const [motif, setMotif] = useState('');
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return products;
    return products.filter((p) => p.nom.toLowerCase().includes(s));
  }, [products, q]);

  const stockPage = usePagination(filtered, 10);
  const mvtPage = usePagination(movements, 10);

  useEffect(() => {
    stockPage.setPage(1);
  }, [q, products.length]); // eslint-disable-line react-hooks/exhaustive-deps

  function apply() {
    if (!modal) return;
    const n = Number(qty);
    if (!n || n <= 0) {
      setError('Quantité invalide');
      return;
    }
    const delta = modal.mode === 'ENTREE' ? n : -n;
    adjustStock(
      pharmacyId,
      modal.productId,
      delta,
      modal.mode,
      motif.trim() || (modal.mode === 'ENTREE' ? 'Entrée de stock' : 'Ajustement'),
    );
    setModal(null);
    setQty('');
    setMotif('');
    setError(null);
    onChanged();
  }

  return (
    <div>
      <div className="toolbar">
        <button
          type="button"
          className={`btn ${tab === 'stock' ? 'btn-primary' : 'btn-outline'}`}
          disabled={locked}
          onClick={() => setTab('stock')}
        >
          État du stock
        </button>
        <button
          type="button"
          className={`btn ${tab === 'mouvements' ? 'btn-primary' : 'btn-outline'}`}
          disabled={locked}
          onClick={() => setTab('mouvements')}
        >
          Mouvements
        </button>
        <input
          className="input grow"
          placeholder="Filtrer…"
          value={q}
          disabled={locked}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {tab === 'stock' ? (
        <>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Produit</th>
                  <th>Stock</th>
                  <th>Seuil</th>
                  <th>P.U. vente</th>
                  <th>Lot</th>
                  <th>Statut</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {stockPage.pageItems.map((p) => {
                  const st = stockStatus(p);
                  return (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.nom}</strong>
                        <div style={{ color: 'var(--color-muted)', fontSize: '0.72rem' }}>
                          {p.categorie}
                        </div>
                      </td>
                      <td>{p.stock}</td>
                      <td>{p.minThreshold}</td>
                      <td>{formatMoney(p.prix)}</td>
                      <td>{p.lot || '—'}</td>
                      <td>
                        <span
                          className={`badge ${
                            st === 'rupture' || st === 'critique'
                              ? 'badge-danger'
                              : st === 'faible'
                                ? 'badge-warning'
                                : 'badge-teal'
                          }`}
                        >
                          {st}
                        </span>
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            type="button"
                            className="btn btn-outline"
                            disabled={locked}
                            onClick={() => setModal({ productId: p.id, mode: 'ENTREE' })}
                          >
                            Entrée
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline"
                            disabled={locked}
                            onClick={() => setModal({ productId: p.id, mode: 'AJUSTEMENT' })}
                          >
                            Sortie
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
      ) : (
        <>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Produit</th>
                  <th>Type</th>
                  <th>Qté</th>
                  <th>Motif</th>
                </tr>
              </thead>
              <tbody>
                {mvtPage.pageItems.map((m) => (
                  <tr key={m.id}>
                    <td>{new Date(m.createdAt).toLocaleString('fr-CD')}</td>
                    <td>{m.productName}</td>
                    <td>{m.type}</td>
                    <td>{m.qte}</td>
                    <td>{m.motif}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {movements.length === 0 && <p className="empty">Aucun mouvement.</p>}
          </div>
          <Pagination
            page={mvtPage.page}
            totalPages={mvtPage.totalPages}
            total={mvtPage.total}
            onPageChange={mvtPage.setPage}
            disabled={locked}
          />
        </>
      )}

      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{modal.mode === 'ENTREE' ? 'Entrée de stock' : 'Sortie / ajustement'}</h2>
            <div className="form-stack">
              <div className="field">
                <label>Quantité</label>
                <input
                  className="input"
                  type="number"
                  min={1}
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                />
              </div>
              <div className="field">
                <label>Motif</label>
                <input
                  className="input"
                  value={motif}
                  onChange={(e) => setMotif(e.target.value)}
                />
              </div>
              {error && <p className="error-text">{error}</p>}
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-outline" onClick={() => setModal(null)}>
                Annuler
              </button>
              <button type="button" className="btn btn-primary" onClick={apply}>
                Valider
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
