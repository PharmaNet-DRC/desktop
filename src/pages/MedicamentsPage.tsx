import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Upload, Plus } from 'lucide-react';
import { formatMoney, listAllProducts, upsertProduct } from '@/data/store';
import {
  applyCatalogueRows,
  downloadCatalogueCsv,
  parseCatalogueFile,
  previewCatalogueRows,
  type CatalogueCsvRow,
  type CataloguePreviewLine,
} from '@/data/catalogue-csv';
import type { Product } from '@/data/types';
import { usePagination } from '@/hooks/usePagination';
import { Pagination } from '@/components/Pagination';

type Props = {
  pharmacyId: string;
  refreshKey: number;
  onChanged: () => void;
  locked?: boolean;
};

const emptyForm = {
  nom: '',
  dci: '',
  forme: 'Comprimé',
  dosage: '',
  categorie: '',
  fabricant: '',
  codebar: '',
  prix: '',
  prixAchat: '',
  stock: '',
  minThreshold: '10',
  unit: 'boîte',
  lot: '',
  expiration: '',
};

export function MedicamentsPage({ pharmacyId, refreshKey, onChanged, locked }: Props) {
  void refreshKey;
  const products = listAllProducts(pharmacyId);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkRows, setBulkRows] = useState<CatalogueCsvRow[] | null>(null);
  const [bulkPreview, setBulkPreview] = useState<CataloguePreviewLine[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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

  const { page, setPage, totalPages, pageItems, total } = usePagination(filtered, 10);

  useEffect(() => {
    setPage(1);
  }, [q, products.length, setPage]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError(null);
    setOpen(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setForm({
      nom: p.nom,
      dci: p.dci,
      forme: p.forme,
      dosage: p.dosage,
      categorie: p.categorie,
      fabricant: p.fabricant,
      codebar: p.codebar,
      prix: String(p.prix),
      prixAchat: String(p.prixAchat),
      stock: String(p.stock),
      minThreshold: String(p.minThreshold),
      unit: p.unit,
      lot: p.lot,
      expiration: p.expiration ?? '',
    });
    setError(null);
    setOpen(true);
  }

  function save() {
    const prix = Number(form.prix);
    const prixAchat = Number(form.prixAchat || 0);
    const stock = Number(form.stock || 0);
    const minThreshold = Number(form.minThreshold || 0);
    if (!form.nom.trim() || Number.isNaN(prix) || prix < 0) {
      setError('Nom et prix de vente sont obligatoires.');
      return;
    }
    upsertProduct(pharmacyId, {
      id: editing?.id,
      nom: form.nom.trim(),
      dci: form.dci.trim(),
      forme: form.forme.trim(),
      dosage: form.dosage.trim(),
      categorie: form.categorie.trim() || 'Divers',
      fabricant: form.fabricant.trim(),
      codebar: form.codebar.trim(),
      prix,
      prixAchat,
      stock: editing ? editing.stock : stock,
      minThreshold,
      unit: form.unit.trim() || 'boîte',
      lot: form.lot.trim(),
      expiration: form.expiration || null,
      actif: editing?.actif ?? true,
    });
    setOpen(false);
    onChanged();
  }

  function onExport() {
    setExporting(true);
    try {
      downloadCatalogueCsv(pharmacyId);
    } finally {
      setExporting(false);
    }
  }

  async function onFilePicked(file: File | null) {
    if (!file) return;
    setBulkLoading(true);
    setBulkPreview(null);
    setBulkRows(null);
    try {
      const text = await file.text();
      const rows = parseCatalogueFile(text);
      if (!rows.length) {
        setError('Fichier vide ou sans lignes de données.');
        return;
      }
      setBulkRows(rows);
      setBulkPreview(previewCatalogueRows(pharmacyId, rows));
      setError(null);
    } catch {
      setError('Impossible de lire le fichier. Exportez puis réenregistrez en CSV.');
    } finally {
      setBulkLoading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function applyBulk() {
    if (!bulkRows) return;
    const okRows = bulkRows.filter((_, i) => bulkPreview?.[i]?.ok);
    applyCatalogueRows(pharmacyId, okRows);
    setBulkRows(null);
    setBulkPreview(null);
    onChanged();
  }

  return (
    <div>
      <div className="toolbar">
        <input
          className="input grow"
          placeholder="Rechercher…"
          value={q}
          disabled={locked}
          onChange={(e) => setQ(e.target.value)}
        />
        <button
          type="button"
          className="btn btn-outline"
          disabled={locked || exporting}
          onClick={onExport}
        >
          <Download size={15} /> {exporting ? 'Export…' : 'Exporter CSV'}
        </button>
        <button
          type="button"
          className="btn btn-outline"
          disabled={locked || bulkLoading}
          onClick={() => fileRef.current?.click()}
        >
          <Upload size={15} /> {bulkLoading ? 'Analyse…' : 'Importer CSV'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          hidden
          onChange={(e) => void onFilePicked(e.target.files?.[0] ?? null)}
        />
        <button type="button" className="btn btn-primary" disabled={locked} onClick={openCreate}>
          <Plus size={16} /> Ajouter
        </button>
      </div>

      {error && !open && <p className="error-text" style={{ marginBottom: '0.75rem' }}>{error}</p>}

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Nom</th>
              <th>DCI</th>
              <th>Catégorie</th>
              <th>Prix</th>
              <th>Stock</th>
              <th>Seuil</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((p) => (
              <tr key={p.id}>
                <td>
                  <strong>{p.nom}</strong>
                  <div style={{ color: 'var(--color-muted)', fontSize: '0.72rem' }}>
                    {p.forme} {p.dosage}
                  </div>
                </td>
                <td>{p.dci || '—'}</td>
                <td>{p.categorie}</td>
                <td>{formatMoney(p.prix)}</td>
                <td>{p.stock}</td>
                <td>{p.minThreshold}</td>
                <td>
                  <button
                    type="button"
                    className="btn btn-outline"
                    disabled={locked}
                    onClick={() => openEdit(p)}
                  >
                    Modifier
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="empty">Aucun médicament.</p>}
      </div>
      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={setPage}
        disabled={locked}
      />

      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            style={{ width: 'min(560px, 100%)', maxHeight: '90vh', overflow: 'auto' }}
          >
            <h2>{editing ? 'Modifier le médicament' : 'Nouveau médicament'}</h2>
            <div className="form-stack">
              {(
                [
                  ['nom', 'Nom'],
                  ['dci', 'DCI'],
                  ['forme', 'Forme'],
                  ['dosage', 'Dosage'],
                  ['categorie', 'Catégorie'],
                  ['fabricant', 'Fabricant'],
                  ['codebar', 'Code-barres'],
                  ['prix', 'Prix vente ($)'],
                  ['prixAchat', 'Prix achat ($)'],
                  ...(!editing ? ([['stock', 'Stock initial']] as const) : []),
                  ['minThreshold', 'Seuil min'],
                  ['unit', 'Unité'],
                  ['lot', 'Lot'],
                  ['expiration', 'Expiration (AAAA-MM-JJ)'],
                ] as const
              ).map(([key, label]) => (
                <div className="field" key={key}>
                  <label>{label}</label>
                  <input
                    className="input"
                    value={form[key as keyof typeof form]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  />
                </div>
              ))}
              {error && <p className="error-text">{error}</p>}
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-outline" onClick={() => setOpen(false)}>
                Annuler
              </button>
              <button type="button" className="btn btn-primary" onClick={save}>
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {bulkPreview && bulkRows && (
        <div className="modal-backdrop" onClick={() => { setBulkPreview(null); setBulkRows(null); }}>
          <div
            className="modal"
            style={{ width: 'min(720px, 100%)', maxHeight: '90vh', overflow: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2>Prévisualisation de l’import</h2>
            <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem' }}>
              Seules les fiches catalogue (nom, prix, etc.) sont mises à jour via{' '}
              <code>productId</code>. Le stock n’est pas écrasé — utilisez l’Inventaire.
            </p>
            <div className="table-wrap" style={{ maxHeight: 320 }}>
              <table className="data">
                <thead>
                  <tr>
                    <th>Produit</th>
                    <th>Statut</th>
                    <th>Détail</th>
                  </tr>
                </thead>
                <tbody>
                  {bulkPreview.map((r) => (
                    <tr key={r.productId || r.name}>
                      <td>{r.name || r.productId || '—'}</td>
                      <td>
                        <span className={`badge ${r.ok ? 'badge-teal' : 'badge-danger'}`}>
                          {r.ok ? 'OK' : 'Erreur'}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.75rem' }}>
                        {r.ok ? r.changes.join(', ') : r.errors.join(' ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  setBulkPreview(null);
                  setBulkRows(null);
                }}
              >
                Annuler
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!bulkPreview.some((r) => r.ok)}
                onClick={applyBulk}
              >
                Appliquer les modifications
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
