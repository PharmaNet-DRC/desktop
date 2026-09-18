export type DesktopRole = 'PHARMACY' | 'FOURNISSEUR';

export type Product = {
  id: string;
  nom: string;
  dci: string;
  forme: string;
  dosage: string;
  categorie: string;
  fabricant: string;
  codebar: string;
  prix: number;
  prixAchat: number;
  stock: number;
  minThreshold: number;
  unit: string;
  lot: string;
  expiration: string | null;
  actif: boolean;
  updatedAt: string;
};

export type Patient = {
  id: string;
  nom: string;
  phone: string;
  createdAt: string;
};

export type PaymentMethod = 'ESPECES' | 'MOBILE_MONEY' | 'CARTE' | 'CREDIT';

export type SaleItem = {
  productId: string;
  nom: string;
  qte: number;
  prix: number;
};

export type Sale = {
  id: string;
  reference: string;
  items: SaleItem[];
  total: number;
  paymentMethod: PaymentMethod;
  amountReceived: number;
  patientName: string;
  prescriptionReference: string;
  status: 'PAYEE' | 'CREDIT' | 'ANNULEE';
  createdAt: string;
  synced: boolean;
};

export type StockMovement = {
  id: string;
  productId: string;
  productName: string;
  type: 'ENTREE' | 'SORTIE' | 'AJUSTEMENT' | 'VENTE';
  qte: number;
  motif: string;
  createdAt: string;
  synced: boolean;
};

export type SyncOutboxItem = {
  id: string;
  kind: 'SALE' | 'PRODUCT' | 'STOCK' | 'PATIENT';
  payload: unknown;
  createdAt: string;
  status: 'pending' | 'synced' | 'error';
};

export type PharmacyDb = {
  version: 1;
  pharmacyId: string;
  products: Product[];
  patients: Patient[];
  sales: Sale[];
  movements: StockMovement[];
  outbox: SyncOutboxItem[];
};

/** Modules usable without network */
export const OFFLINE_PAGES = [
  'dashboard',
  'caisse',
  'ventes',
  'medicaments',
  'inventaire',
  'patients',
  'sync',
] as const;

export type OfflinePageId = (typeof OFFLINE_PAGES)[number];

export type OnlineOnlyPageId =
  | 'profil'
  | 'abonnement'
  | 'publicite'
  | 'factures'
  | 'credits'
  | 'comptage'
  | 'fournisseurs'
  | 'commandesFournisseur'
  | 'commandesPatients'
  | 'analytiques';

export type PageId = OfflinePageId | OnlineOnlyPageId;

export function isOfflinePage(page: PageId): page is OfflinePageId {
  return (OFFLINE_PAGES as readonly string[]).includes(page);
}

export const PAGE_META: Record<PageId, { title: string; subtitle: string }> = {
  dashboard: {
    title: 'Tableau de bord',
    subtitle: 'Vue d’ensemble de votre pharmacie',
  },
  caisse: {
    title: 'Caisse',
    subtitle: 'Encaissement local — synchronisé dès que le réseau revient',
  },
  ventes: {
    title: 'Historique des ventes',
    subtitle: 'Tickets enregistrés sur cet appareil',
  },
  medicaments: {
    title: 'Médicaments',
    subtitle: 'Catalogue, prix et import / export CSV',
  },
  inventaire: {
    title: 'Inventaire',
    subtitle: 'État du stock et mouvements',
  },
  patients: {
    title: 'Patients',
    subtitle: 'Fiches clients de la pharmacie',
  },
  sync: {
    title: 'Synchronisation',
    subtitle: 'État de la file d’attente et dernière mise à jour',
  },
  profil: {
    title: 'Profil pharmacie',
    subtitle: 'Identité et coordonnées de votre établissement',
  },
  abonnement: {
    title: 'Abonnement',
    subtitle: 'Offres Pro et renouvellement',
  },
  publicite: {
    title: 'Publicité',
    subtitle: 'Mise en avant de produits sur le réseau',
  },
  factures: {
    title: 'Factures',
    subtitle: 'Facturation clients professionnels',
  },
  credits: {
    title: 'Crédits clients',
    subtitle: 'Suivi des créances et rappels',
  },
  comptage: {
    title: 'Feuille d’inventaire',
    subtitle: 'Comptage physique du stock',
  },
  fournisseurs: {
    title: 'Fournisseurs',
    subtitle: 'Partenaires et dépôts',
  },
  commandesFournisseur: {
    title: 'Commander (dépôt)',
    subtitle: 'Commandes vers les fournisseurs',
  },
  commandesPatients: {
    title: 'Commandes patients',
    subtitle: 'Commandes en ligne reçues via PharmaCd',
  },
  analytiques: {
    title: 'Analytiques',
    subtitle: 'Rapports et tendances',
  },
};
