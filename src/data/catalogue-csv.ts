import {
  escapeCsvCell,
  parseBool,
  parseCsv,
  parseOptionalNumber,
  rowsFromCsvMatrix,
} from '@/lib/parse-csv';
import type { Product } from './types';
import { listAllProducts, upsertProduct } from './store';

export const CATALOGUE_HEADERS = [
  'productId',
  'name',
  'dci',
  'forme',
  'dosage',
  'categorie',
  'fabricant',
  'codebar',
  'price',
  'unit',
  'minThreshold',
  'actif',
  'currentStock',
] as const;

export type CatalogueCsvRow = {
  productId: string;
  name?: string;
  dci?: string;
  forme?: string;
  dosage?: string;
  categorie?: string;
  fabricant?: string;
  codebar?: string;
  price?: number;
  unit?: string;
  minThreshold?: number;
  actif?: boolean;
  /** Informative only — never applied as stock overwrite */
  currentStock?: number;
};

export type CataloguePreviewLine = {
  productId: string;
  name: string;
  ok: boolean;
  changes: string[];
  errors: string[];
};

export function buildCatalogueCsv(products: Product[]): string {
  const lines = [
    CATALOGUE_HEADERS.join(','),
    ...products.map((p) =>
      [
        p.id,
        p.nom,
        p.dci,
        p.forme,
        p.dosage,
        p.categorie,
        p.fabricant,
        p.codebar,
        p.prix,
        p.unit,
        p.minThreshold,
        p.actif,
        p.stock,
      ]
        .map(escapeCsvCell)
        .join(','),
    ),
  ];
  return `\uFEFF${lines.join('\n')}`;
}

export function downloadCatalogueCsv(pharmacyId: string) {
  const csv = buildCatalogueCsv(listAllProducts(pharmacyId));
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `catalogue-medicaments-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function parseCatalogueFile(text: string): CatalogueCsvRow[] {
  const matrix = parseCsv(text);
  const raw = rowsFromCsvMatrix(matrix);
  return raw.map((r) => ({
    productId: r.productId || r.id || '',
    name: r.name || r.nom || undefined,
    dci: r.dci,
    forme: r.forme,
    dosage: r.dosage,
    categorie: r.categorie,
    fabricant: r.fabricant,
    codebar: r.codebar,
    price: parseOptionalNumber(r.price ?? r.prix),
    unit: r.unit || undefined,
    minThreshold: parseOptionalNumber(r.minThreshold ?? r.seuil),
    actif: parseBool(r.actif ?? r.statut),
    currentStock: parseOptionalNumber(r.currentStock ?? r.stock),
  }));
}

export function previewCatalogueRows(
  pharmacyId: string,
  rows: CatalogueCsvRow[],
): CataloguePreviewLine[] {
  const byId = new Map(listAllProducts(pharmacyId).map((p) => [p.id, p]));
  return rows.map((row) => {
    const productId = row.productId?.trim() ?? '';
    if (!productId) {
      return {
        productId: '',
        name: row.name ?? '',
        ok: false,
        changes: [],
        errors: ['Identifiant produit manquant — ne pas supprimer la colonne productId.'],
      };
    }
    const current = byId.get(productId);
    if (!current) {
      return {
        productId,
        name: row.name ?? '',
        ok: false,
        changes: [],
        errors: ['Produit introuvable dans le catalogue local.'],
      };
    }
    const changes: string[] = [];
    if (row.name != null && row.name !== '' && row.name !== current.nom) {
      changes.push(`nom: ${current.nom} → ${row.name}`);
    }
    if (row.dci != null && row.dci !== current.dci) changes.push('dci');
    if (row.forme != null && row.forme !== current.forme) changes.push('forme');
    if (row.dosage != null && row.dosage !== current.dosage) changes.push('dosage');
    if (row.categorie != null && row.categorie !== current.categorie) changes.push('catégorie');
    if (row.fabricant != null && row.fabricant !== current.fabricant) changes.push('fabricant');
    if (row.codebar != null && row.codebar !== current.codebar) changes.push('code-barres');
    if (row.price != null && row.price !== current.prix) {
      changes.push(`prix: ${current.prix} → ${row.price}`);
    }
    if (row.unit != null && row.unit !== current.unit) changes.push('unité');
    if (row.minThreshold != null && row.minThreshold !== current.minThreshold) {
      changes.push(`seuil: ${current.minThreshold} → ${row.minThreshold}`);
    }
    if (row.actif != null && row.actif !== current.actif) {
      changes.push(`actif: ${current.actif} → ${row.actif}`);
    }
    return {
      productId,
      name: current.nom,
      ok: true,
      changes: changes.length ? changes : ['Aucun changement'],
      errors: [],
    };
  });
}

/** Apply catalogue fields only — stock is never overwritten from CSV. */
export function applyCatalogueRows(pharmacyId: string, rows: CatalogueCsvRow[]): number {
  const byId = new Map(listAllProducts(pharmacyId).map((p) => [p.id, p]));
  let applied = 0;
  for (const row of rows) {
    const current = byId.get(row.productId?.trim() ?? '');
    if (!current) continue;
    upsertProduct(pharmacyId, {
      id: current.id,
      nom: row.name?.trim() || current.nom,
      dci: row.dci ?? current.dci,
      forme: row.forme ?? current.forme,
      dosage: row.dosage ?? current.dosage,
      categorie: row.categorie ?? current.categorie,
      fabricant: row.fabricant ?? current.fabricant,
      codebar: row.codebar ?? current.codebar,
      prix: row.price ?? current.prix,
      prixAchat: current.prixAchat,
      stock: current.stock,
      minThreshold: row.minThreshold ?? current.minThreshold,
      unit: row.unit ?? current.unit,
      lot: current.lot,
      expiration: current.expiration,
      actif: row.actif ?? current.actif,
    });
    applied += 1;
  }
  return applied;
}
