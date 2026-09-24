import type { ReactNode } from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Receipt,
  Pill,
  Package,
  Users,
  RefreshCw,
  LogOut,
  Building2,
  Layers,
  Megaphone,
  FileText,
  Wallet,
  ClipboardCheck,
  Truck,
  ClipboardList,
  BarChart3,
  Gift,
  UserCog,
} from 'lucide-react';
import { BRAND } from '@/lib/brand';
import type { StoredSession } from '@/lib/session';
import { PAGE_META, type PageId } from '@/data/types';
import { PharmacySwitcher } from '@/components/PharmacySwitcher';
import { DesktopGraceBanner } from '@/components/DesktopGraceBanner';

type NavItem = { id: PageId; label: string; icon: typeof LayoutDashboard };

type NavSection = { section: string; items: NavItem[] };

/** Full menu — only when connectivity is confirmed. */
const NAV_ONLINE: NavSection[] = [
  {
    section: 'Principal',
    items: [
      { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
      { id: 'profil', label: 'Profil pharmacie', icon: Building2 },
      { id: 'abonnement', label: 'Abonnement', icon: Layers },
      { id: 'parrainage', label: 'Parrainage', icon: Gift },
      { id: 'publicite', label: 'Publicité', icon: Megaphone },
      { id: 'personnel', label: 'Personnel', icon: UserCog },
    ],
  },
  {
    section: 'Ventes',
    items: [
      { id: 'caisse', label: 'Caisse', icon: ShoppingCart },
      { id: 'ventes', label: 'Historique des ventes', icon: Receipt },
      { id: 'factures', label: 'Factures', icon: FileText },
      { id: 'credits', label: 'Crédits clients', icon: Wallet },
    ],
  },
  {
    section: 'Stock',
    items: [
      { id: 'inventaire', label: 'Inventaire', icon: Package },
      { id: 'comptage', label: 'Feuille d’inventaire', icon: ClipboardCheck },
      { id: 'medicaments', label: 'Médicaments', icon: Pill },
      { id: 'fournisseurs', label: 'Fournisseurs', icon: Truck },
      { id: 'commandesFournisseur', label: 'Commander (dépôt)', icon: ShoppingCart },
    ],
  },
  {
    section: 'Clients',
    items: [
      { id: 'commandesPatients', label: 'Commandes patients', icon: ClipboardList },
      { id: 'patients', label: 'Patients', icon: Users },
    ],
  },
  {
    section: 'Rapports',
    items: [{ id: 'analytiques', label: 'Analytiques', icon: BarChart3 }],
  },
  {
    section: 'Système',
    items: [{ id: 'sync', label: 'Synchronisation', icon: RefreshCw }],
  },
];

/**
 * Hors ligne — online-only entries are not rendered at all.
 * (No profil, abonnement, publicité, factures, crédits, commandes, analytiques…)
 */
const NAV_OFFLINE: NavSection[] = [
  {
    section: 'Principal',
    items: [{ id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard }],
  },
  {
    section: 'Ventes',
    items: [
      { id: 'caisse', label: 'Caisse', icon: ShoppingCart },
      { id: 'ventes', label: 'Historique des ventes', icon: Receipt },
    ],
  },
  {
    section: 'Stock',
    items: [
      { id: 'inventaire', label: 'Inventaire', icon: Package },
      { id: 'medicaments', label: 'Médicaments', icon: Pill },
    ],
  },
  {
    section: 'Clients',
    items: [{ id: 'patients', label: 'Patients', icon: Users }],
  },
  {
    section: 'Système',
    items: [{ id: 'sync', label: 'Synchronisation', icon: RefreshCw }],
  },
];

type Props = {
  session: StoredSession;
  page: PageId;
  pendingSync: number;
  online: boolean;
  syncing: boolean;
  onNavigate: (page: PageId) => void;
  onLogout: () => void;
  onForgetDevice?: () => void;
  onSwitchPharmacy?: (
    pharmacyId: string,
    pharmacyName: string,
  ) => Promise<string | null>;
  children: ReactNode;
};

export function DashboardShell({
  session,
  page,
  pendingSync,
  online,
  syncing,
  onNavigate,
  onLogout,
  onForgetDevice,
  onSwitchPharmacy,
  children,
}: Props) {
  const meta = PAGE_META[page];
  const initials = session.displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');

  // Strict: offline never mounts online menu entries.
  const nav = online ? NAV_ONLINE : NAV_OFFLINE;

  return (
    <div className={`app-frame${syncing ? ' is-syncing' : ''}`}>
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark" style={{ marginBottom: 0, width: '2.1rem', height: '2.1rem' }}>
            <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
              <rect x="7" y="2" width="4" height="14" rx="1" fill="white" />
              <rect x="2" y="7" width="14" height="4" rx="1" fill="white" />
            </svg>
          </div>
          <div>
            <strong>{BRAND.name}</strong>
            <span>Desktop · Pro</span>
          </div>
        </div>

        <div className="sidebar-mode">
          <span className={`badge ${online ? 'badge-teal' : 'badge-warning'}`}>
            {online ? 'En ligne' : 'Hors ligne'}
          </span>
          {!online && (
            <span className="sidebar-mode-hint">Menu réduit — caisse & stock uniquement</span>
          )}
        </div>

        {session.role === 'PHARMACY' && onSwitchPharmacy && (
          <PharmacySwitcher
            session={session}
            online={online}
            disabled={syncing}
            onSwitch={onSwitchPharmacy}
          />
        )}

        <p className="sidebar-role">Pharmacien</p>

        {nav.map((group) => (
          <div key={group.section} className="nav-section">
            <div className="nav-section-title">{group.section}</div>
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`nav-item${page === item.id ? ' active' : ''}`}
                  disabled={syncing}
                  onClick={() => onNavigate(item.id)}
                >
                  <Icon size={16} />
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {item.id === 'sync' && pendingSync > 0 && (
                    <span className="badge badge-warning">{pendingSync}</span>
                  )}
                </button>
              );
            })}
          </div>
        ))}

        <div className="sidebar-footer">
          <div className="user-chip">
            <div className="avatar">{initials || 'PH'}</div>
            <div>
              <strong>{session.organizationName}</strong>
              <span>{session.email}</span>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-outline"
            style={{
              width: '100%',
              color: '#e2e8f0',
              borderColor: 'rgba(255,255,255,0.15)',
              background: 'transparent',
            }}
            disabled={syncing}
            onClick={onLogout}
          >
            <LogOut size={14} /> Verrouiller
          </button>
          {onForgetDevice && (
            <button
              type="button"
              className="btn btn-ghost"
              style={{ width: '100%', marginTop: '0.45rem', color: '#fca5a5', fontSize: '0.75rem' }}
              disabled={syncing}
              onClick={onForgetDevice}
            >
              Oublier cet appareil
            </button>
          )}
        </div>
      </aside>

      <div className="main-col">
        <header className="topbar">
          <div>
            <h1>{meta.title}</h1>
            <p>{meta.subtitle}</p>
          </div>
          <div className="topbar-meta">
            <span className={`badge ${online ? 'badge-teal' : 'badge-warning'}`}>
              {online ? 'Réseau OK' : 'Hors ligne'}
            </span>
            <span className="badge badge-teal">{session.planName}</span>
            {pendingSync > 0 ? (
              <span className="badge badge-warning">{pendingSync} en attente</span>
            ) : (
              <span className="badge badge-muted">File à jour</span>
            )}
          </div>
        </header>
        <main className="page">
          <DesktopGraceBanner session={session} />
          {children}
        </main>
      </div>
    </div>
  );
}
