import { createSeedDb } from './seed';
import type {
  Patient,
  PaymentMethod,
  PharmacyDb,
  Product,
  Sale,
  SaleItem,
  StockMovement,
  SyncOutboxItem,
} from './types';

const keyFor = (pharmacyId: string) => `pharmacd.desktop.db.${pharmacyId}`;

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

function loadRaw(pharmacyId: string): PharmacyDb | null {
  try {
    const raw = localStorage.getItem(keyFor(pharmacyId));
    if (!raw) return null;
    return JSON.parse(raw) as PharmacyDb;
  } catch {
    return null;
  }
}

function save(db: PharmacyDb) {
  localStorage.setItem(keyFor(db.pharmacyId), JSON.stringify(db));
}

export function loadPharmacyDb(pharmacyId: string): PharmacyDb {
  const existing = loadRaw(pharmacyId);
  if (existing?.version === 1) return existing;
  // Real pharmacies start empty until bootstrap; demo-org keeps sample seed.
  if (pharmacyId === 'demo-org') {
    const seeded = createSeedDb(pharmacyId);
    save(seeded);
    return seeded;
  }
  const empty: PharmacyDb = {
    version: 1,
    pharmacyId,
    products: [],
    patients: [],
    sales: [],
    movements: [],
    outbox: [],
  };
  save(empty);
  return empty;
}

export type PendingSalePayload = Sale;

export function getPendingOutbox(pharmacyId: string): SyncOutboxItem[] {
  return loadPharmacyDb(pharmacyId).outbox.filter((o) => o.status === 'pending');
}

export function markOutboxItem(
  pharmacyId: string,
  outboxId: string,
  status: SyncOutboxItem['status'],
  saleId?: string,
) {
  const db = loadPharmacyDb(pharmacyId);
  const item = db.outbox.find((o) => o.id === outboxId);
  if (item) item.status = status;
  if (saleId && status === 'synced') {
    const sale = db.sales.find((s) => s.id === saleId);
    if (sale) sale.synced = true;
  }
  if (status === 'synced' && item?.kind === 'STOCK') {
    // no-op
  }
  save(db);
}

/** Replace catalogue/patients from server without wiping local sales/outbox history. */
export function applyServerSnapshot(
  pharmacyId: string,
  input: {
    products: Array<Record<string, unknown>>;
    patients: Array<Record<string, unknown>>;
  },
) {
  const db = loadPharmacyDb(pharmacyId);
  const now = new Date().toISOString();

  db.products = input.products.map((p) => {
    const id = String(p.id ?? p.productId ?? uid('prod'));
    return {
      id,
      nom: String(p.nom ?? p.name ?? 'Sans nom'),
      dci: String(p.dci ?? ''),
      forme: String(p.forme ?? ''),
      dosage: String(p.dosage ?? ''),
      categorie: String(p.categorie ?? 'Divers'),
      fabricant: String(p.fabricant ?? ''),
      codebar: String(p.codebar ?? ''),
      prix: Number(p.prix ?? p.price ?? 0),
      prixAchat: Number(p.prixAchat ?? p.purchasePrice ?? 0),
      stock: Number(p.stock ?? p.currentStock ?? 0),
      minThreshold: Number(p.minThreshold ?? 0),
      unit: String(p.unit ?? 'boîte'),
      lot: String(p.lot ?? ''),
      expiration: (p.expiration as string | null) ?? null,
      actif: p.actif !== false,
      updatedAt: now,
    } satisfies Product;
  });

  db.patients = input.patients.map((p) => ({
    id: String(p.id ?? uid('pat')),
    nom: String(p.nom ?? p.name ?? 'Patient'),
    phone: String(p.telephone ?? p.phone ?? ''),
    createdAt: String(p.createdAt ?? now),
  }));

  save(db);
}


function pushOutbox(db: PharmacyDb, kind: SyncOutboxItem['kind'], payload: unknown) {
  db.outbox.unshift({
    id: uid('obx'),
    kind,
    payload,
    createdAt: new Date().toISOString(),
    status: 'pending',
  });
}

export function listProducts(pharmacyId: string): Product[] {
  return loadPharmacyDb(pharmacyId).products.filter((p) => p.actif);
}

export function listAllProducts(pharmacyId: string): Product[] {
  return loadPharmacyDb(pharmacyId).products;
}

export function upsertProduct(
  pharmacyId: string,
  input: Omit<Product, 'updatedAt' | 'id'> & { id?: string },
): Product {
  const db = loadPharmacyDb(pharmacyId);
  const updatedAt = new Date().toISOString();
  if (input.id) {
    const idx = db.products.findIndex((p) => p.id === input.id);
    if (idx >= 0) {
      db.products[idx] = { ...db.products[idx], ...input, id: input.id, updatedAt };
      pushOutbox(db, 'PRODUCT', db.products[idx]);
      save(db);
      return db.products[idx];
    }
  }
  const product: Product = {
    ...input,
    id: input.id ?? uid('prod'),
    updatedAt,
  };
  db.products.unshift(product);
  pushOutbox(db, 'PRODUCT', product);
  save(db);
  return product;
}

export function adjustStock(
  pharmacyId: string,
  productId: string,
  delta: number,
  type: StockMovement['type'],
  motif: string,
): Product | null {
  const db = loadPharmacyDb(pharmacyId);
  const product = db.products.find((p) => p.id === productId);
  if (!product) return null;
  const next = Math.max(0, product.stock + delta);
  product.stock = next;
  product.updatedAt = new Date().toISOString();
  const movement: StockMovement = {
    id: uid('mvt'),
    productId,
    productName: product.nom,
    type,
    qte: Math.abs(delta),
    motif,
    createdAt: new Date().toISOString(),
    synced: false,
  };
  db.movements.unshift(movement);
  pushOutbox(db, 'STOCK', movement);
  save(db);
  return product;
}

export function createSale(
  pharmacyId: string,
  input: {
    items: SaleItem[];
    paymentMethod: PaymentMethod;
    amountReceived: number;
    patientName: string;
    prescriptionReference: string;
  },
): Sale {
  const db = loadPharmacyDb(pharmacyId);
  for (const item of input.items) {
    const product = db.products.find((p) => p.id === item.productId);
    if (!product || product.stock < item.qte) {
      throw new Error(`Stock insuffisant pour ${item.nom}`);
    }
  }

  for (const item of input.items) {
    const product = db.products.find((p) => p.id === item.productId)!;
    product.stock -= item.qte;
    product.updatedAt = new Date().toISOString();
    db.movements.unshift({
      id: uid('mvt'),
      productId: product.id,
      productName: product.nom,
      type: 'VENTE',
      qte: item.qte,
      motif: 'Vente caisse',
      createdAt: new Date().toISOString(),
      synced: false,
    });
  }

  const total = input.items.reduce((s, i) => s + i.prix * i.qte, 0);
  const sale: Sale = {
    id: uid('sale'),
    reference: `VD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(db.sales.length + 1).padStart(4, '0')}`,
    items: input.items,
    total,
    paymentMethod: input.paymentMethod,
    amountReceived: input.amountReceived,
    patientName: input.patientName,
    prescriptionReference: input.prescriptionReference,
    status: input.paymentMethod === 'CREDIT' ? 'CREDIT' : 'PAYEE',
    createdAt: new Date().toISOString(),
    synced: false,
  };
  db.sales.unshift(sale);
  pushOutbox(db, 'SALE', sale);
  save(db);
  return sale;
}

export function listSales(pharmacyId: string): Sale[] {
  return loadPharmacyDb(pharmacyId).sales;
}

export function listMovements(pharmacyId: string): StockMovement[] {
  return loadPharmacyDb(pharmacyId).movements;
}

export function listPatients(pharmacyId: string): Patient[] {
  return loadPharmacyDb(pharmacyId).patients;
}

export function addPatient(
  pharmacyId: string,
  nom: string,
  phone: string,
): Patient {
  const db = loadPharmacyDb(pharmacyId);
  const patient: Patient = {
    id: uid('pat'),
    nom: nom.trim(),
    phone: phone.trim(),
    createdAt: new Date().toISOString(),
  };
  db.patients.unshift(patient);
  pushOutbox(db, 'PATIENT', patient);
  save(db);
  return patient;
}

export function getSyncStats(pharmacyId: string) {
  const db = loadPharmacyDb(pharmacyId);
  const pending = db.outbox.filter((o) => o.status === 'pending').length;
  const synced = db.outbox.filter((o) => o.status === 'synced').length;
  return { pending, synced, total: db.outbox.length, outbox: db.outbox };
}

/** Simulate sync when online — marks pending as synced (API hook later). */
export function markOutboxSynced(pharmacyId: string): number {
  const db = loadPharmacyDb(pharmacyId);
  let n = 0;
  for (const item of db.outbox) {
    if (item.status === 'pending') {
      item.status = 'synced';
      n += 1;
    }
  }
  for (const s of db.sales) s.synced = true;
  for (const m of db.movements) m.synced = true;
  save(db);
  return n;
}

export function getDashboardStats(pharmacyId: string) {
  const db = loadPharmacyDb(pharmacyId);
  const today = new Date().toISOString().slice(0, 10);
  const salesToday = db.sales.filter((s) => s.createdAt.startsWith(today) && s.status !== 'ANNULEE');
  const revenueToday = salesToday.reduce((s, x) => s + x.total, 0);
  const lowStock = db.products.filter((p) => p.actif && p.stock > 0 && p.stock <= p.minThreshold);
  const rupture = db.products.filter((p) => p.actif && p.stock === 0);
  const pendingSync = db.outbox.filter((o) => o.status === 'pending').length;
  return {
    salesTodayCount: salesToday.length,
    revenueToday,
    lowStockCount: lowStock.length,
    ruptureCount: rupture.length,
    pendingSync,
    recentSales: db.sales.slice(0, 8),
    lowStockProducts: [...rupture, ...lowStock].slice(0, 8),
  };
}

export function formatMoney(n: number) {
  return `${n.toFixed(2)} $`;
}

export function paymentLabel(m: PaymentMethod) {
  switch (m) {
    case 'ESPECES':
      return 'Espèces';
    case 'MOBILE_MONEY':
      return 'Mobile Money';
    case 'CARTE':
      return 'Carte';
    case 'CREDIT':
      return 'Crédit';
  }
}

export function stockStatus(p: Product): 'rupture' | 'critique' | 'faible' | 'normal' {
  if (p.stock <= 0) return 'rupture';
  if (p.stock <= Math.ceil(p.minThreshold / 2)) return 'critique';
  if (p.stock <= p.minThreshold) return 'faible';
  return 'normal';
}
