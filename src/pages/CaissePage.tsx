import { useMemo, useState } from 'react';
import {
  createSale,
  formatMoney,
  listProducts,
  paymentLabel,
} from '@/data/store';
import type { PaymentMethod, SaleItem } from '@/data/types';

type Props = {
  pharmacyId: string;
  refreshKey: number;
  onChanged: () => void;
  locked?: boolean;
};

type CartLine = SaleItem;

export function CaissePage({ pharmacyId, refreshKey, onChanged, locked }: Props) {
  void refreshKey;
  const products = listProducts(pharmacyId);
  const [q, setQ] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [patientName, setPatientName] = useState('');
  const [ordo, setOrdo] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('ESPECES');
  const [received, setReceived] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return products;
    return products.filter(
      (p) =>
        p.nom.toLowerCase().includes(s) ||
        p.dci.toLowerCase().includes(s) ||
        p.categorie.toLowerCase().includes(s),
    );
  }, [products, q]);

  const total = cart.reduce((sum, i) => sum + i.prix * i.qte, 0);

  function addToCart(productId: string) {
    const p = products.find((x) => x.id === productId);
    if (!p || p.stock <= 0) return;
    setCart((prev) => {
      const existing = prev.find((l) => l.productId === productId);
      if (existing) {
        if (existing.qte >= p.stock) return prev;
        return prev.map((l) =>
          l.productId === productId ? { ...l, qte: l.qte + 1 } : l,
        );
      }
      return [...prev, { productId: p.id, nom: p.nom, prix: p.prix, qte: 1 }];
    });
    setError(null);
  }

  function setQty(productId: string, qte: number) {
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    const next = Math.max(0, Math.min(qte, p.stock));
    setCart((prev) =>
      next === 0
        ? prev.filter((l) => l.productId !== productId)
        : prev.map((l) => (l.productId === productId ? { ...l, qte: next } : l)),
    );
  }

  function checkout() {
    setError(null);
    if (cart.length === 0) {
      setError('Panier vide.');
      return;
    }
    const amountReceived =
      payMethod === 'CREDIT' ? 0 : Number(received || total);
    if (payMethod !== 'CREDIT' && (Number.isNaN(amountReceived) || amountReceived < total)) {
      setError('Montant reçu insuffisant.');
      return;
    }
    try {
      const sale = createSale(pharmacyId, {
        items: cart,
        paymentMethod: payMethod,
        amountReceived,
        patientName,
        prescriptionReference: ordo,
      });
      setReceipt(
        `${sale.reference} · ${formatMoney(sale.total)} · ${paymentLabel(sale.paymentMethod)}`,
      );
      setCart([]);
      setPatientName('');
      setOrdo('');
      setReceived('');
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Échec de la vente');
    }
  }

  return (
    <div className="caisse-layout">
      <div>
        <div className="toolbar">
          <input
            className="input grow"
            placeholder="Rechercher un médicament…"
            value={q}
            disabled={locked}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="product-grid">
          {filtered.map((p) => (
            <button
              key={p.id}
              type="button"
              className="product-tile"
              disabled={locked || p.stock <= 0}
              onClick={() => addToCart(p.id)}
            >
              <strong>{p.nom}</strong>
              <div className="meta">
                {p.forme} · stock {p.stock}
              </div>
              <div className="price">{formatMoney(p.prix)}</div>
            </button>
          ))}
        </div>
        {filtered.length === 0 && <p className="empty">Aucun produit.</p>}
      </div>

      <aside className="cart-panel">
        <p className="section-label">Panier</p>
        {cart.length === 0 ? (
          <p className="empty" style={{ padding: '1rem 0' }}>
            Ajoutez des produits
          </p>
        ) : (
          cart.map((l) => (
            <div key={l.productId} className="cart-line">
              <div>
                <strong>{l.nom}</strong>
                <div style={{ color: 'var(--color-muted)' }}>{formatMoney(l.prix)}</div>
              </div>
              <div className="qty-ctrl">
                <button type="button" onClick={() => setQty(l.productId, l.qte - 1)}>
                  −
                </button>
                <span>{l.qte}</span>
                <button type="button" onClick={() => setQty(l.productId, l.qte + 1)}>
                  +
                </button>
              </div>
            </div>
          ))
        )}

        <div className="cart-total">
          <span>Total</span>
          <span>{formatMoney(total)}</span>
        </div>

        <div className="form-stack">
          <div className="field">
            <label>Patient (optionnel)</label>
            <input className="input" value={patientName} onChange={(e) => setPatientName(e.target.value)} />
          </div>
          <div className="field">
            <label>Ordonnance</label>
            <input className="input" value={ordo} onChange={(e) => setOrdo(e.target.value)} />
          </div>
          <div className="field">
            <label>Paiement</label>
            <select
              className="select"
              value={payMethod}
              onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
            >
              <option value="ESPECES">Espèces</option>
              <option value="MOBILE_MONEY">Mobile Money</option>
              <option value="CARTE">Carte</option>
              <option value="CREDIT">Crédit</option>
            </select>
          </div>
          {payMethod !== 'CREDIT' && (
            <div className="field">
              <label>Montant reçu</label>
              <input
                className="input"
                type="number"
                min={0}
                step="0.01"
                placeholder={String(total.toFixed(2))}
                value={received}
                onChange={(e) => setReceived(e.target.value)}
              />
            </div>
          )}
          {error && <p className="error-text">{error}</p>}
          {receipt && (
            <p className="badge badge-teal" style={{ justifyContent: 'flex-start' }}>
              Ticket : {receipt}
            </p>
          )}
          <button
            type="button"
            className="btn btn-primary"
            disabled={locked}
            onClick={checkout}
          >
            Encaisser
          </button>
        </div>
      </aside>
    </div>
  );
}
