import { useEffect, useMemo, useState } from 'react';
import { useAppGate } from '@/hooks/useAppGate';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useAutoSync } from '@/hooks/useAutoSync';
import { LoginScreen } from '@/components/LoginScreen';
import { UnlockScreen } from '@/components/UnlockScreen';
import { SetupPinScreen } from '@/components/SetupPinScreen';
import { LockedScreen } from '@/components/LockedScreen';
import { DashboardShell } from '@/components/DashboardShell';
import { SyncBlockingOverlay } from '@/components/SyncBlockingOverlay';
import { OnlineFeaturePage } from '@/components/OnlineFeaturePage';
import { DesktopChatWidget } from '@/components/DesktopChatWidget';
import { DashboardPage } from '@/pages/DashboardPage';
import { CaissePage } from '@/pages/CaissePage';
import { VentesPage } from '@/pages/VentesPage';
import { MedicamentsPage } from '@/pages/MedicamentsPage';
import { InventairePage } from '@/pages/InventairePage';
import { PatientsPage } from '@/pages/PatientsPage';
import { SyncPage } from '@/pages/SyncPage';
import { ProfilPage } from '@/pages/ProfilPage';
import { AbonnementPage } from '@/pages/AbonnementPage';
import { PublicitePage } from '@/pages/PublicitePage';
import { getSyncStats } from '@/data/store';
import { isOfflinePage, PAGE_META, type PageId } from '@/data/types';

export default function App() {
  const { online, stableOnline } = useNetworkStatus();
  const {
    gate,
    login,
    unlockWithPin,
    continueSavedSession,
    setupPin,
    skipPin,
    lock,
    goToPasswordLogin,
    goToUnlock,
    logoutDevice,
    switchPharmacy,
    updateOrganizationName,
  } = useAppGate(online);
  const [page, setPage] = useState<PageId>('dashboard');
  const [refreshKey, setRefreshKey] = useState(0);
  const bump = () => setRefreshKey((k) => k + 1);

  const pharmacyId =
    gate.status === 'ready' ? gate.session.organizationId : 'demo-org';

  const { syncing, lastMessage, runSync } = useAutoSync({
    session: gate.status === 'ready' ? gate.session : null,
    pharmacyId,
    enabled: gate.status === 'ready',
    stableOnline,
    refreshKey,
    onDone: bump,
  });

  useEffect(() => {
    if (!online && !isOfflinePage(page)) {
      setPage('dashboard');
    }
  }, [online, page]);

  const pendingSync = useMemo(() => {
    if (gate.status !== 'ready') return 0;
    return getSyncStats(pharmacyId).pending;
  }, [gate.status, pharmacyId, refreshKey]);

  if (gate.status === 'loading') {
    return (
      <div className="auth-shell">
        <p style={{ color: 'var(--color-muted)' }}>Chargement…</p>
      </div>
    );
  }

  if (gate.status === 'login') {
    return (
      <LoginScreen
        online={online}
        hasDevice={gate.hasDevice}
        onSubmit={login}
        onGoUnlock={gate.hasDevice ? () => void goToUnlock() : undefined}
      />
    );
  }

  if (gate.status === 'unlock') {
    return (
      <UnlockScreen
        email={gate.sessionPreview.email}
        organizationName={gate.sessionPreview.organizationName}
        requiresPin={gate.requiresPin}
        onUnlock={unlockWithPin}
        onContinueWithoutPin={continueSavedSession}
        onPasswordLogin={() => void goToPasswordLogin()}
        onForgetDevice={logoutDevice}
      />
    );
  }

  if (gate.status === 'setup-pin') {
    return (
      <SetupPinScreen
        session={gate.session}
        onSave={(pin) => setupPin(pin, gate.session)}
        onSkip={() => void skipPin(gate.session)}
      />
    );
  }

  if (gate.status === 'locked') {
    return (
      <LockedScreen
        reason={gate.reason}
        session={gate.session}
        onLogout={() => void logoutDevice()}
      />
    );
  }

  const lockedUi = syncing;

  const content = (() => {
    switch (page) {
      case 'dashboard':
        return (
          <DashboardPage
            pharmacyId={pharmacyId}
            refreshKey={refreshKey}
            onNavigate={setPage}
            locked={lockedUi}
          />
        );
      case 'caisse':
        return (
          <CaissePage
            pharmacyId={pharmacyId}
            refreshKey={refreshKey}
            onChanged={bump}
            locked={lockedUi}
          />
        );
      case 'ventes':
        return (
          <VentesPage pharmacyId={pharmacyId} refreshKey={refreshKey} locked={lockedUi} />
        );
      case 'medicaments':
        return (
          <MedicamentsPage
            pharmacyId={pharmacyId}
            refreshKey={refreshKey}
            onChanged={bump}
            locked={lockedUi}
          />
        );
      case 'inventaire':
        return (
          <InventairePage
            pharmacyId={pharmacyId}
            refreshKey={refreshKey}
            onChanged={bump}
            locked={lockedUi}
          />
        );
      case 'patients':
        return (
          <PatientsPage
            pharmacyId={pharmacyId}
            refreshKey={refreshKey}
            onChanged={bump}
            locked={lockedUi}
          />
        );
      case 'sync':
        return (
          <SyncPage
            pharmacyId={pharmacyId}
            refreshKey={refreshKey}
            syncing={syncing}
            lastMessage={lastMessage}
            online={online}
            onSyncNow={() => void runSync()}
          />
        );
      case 'profil':
        return (
          <ProfilPage
            session={gate.session}
            online={online}
            locked={lockedUi}
            onProfileSaved={(name) => void updateOrganizationName(name)}
          />
        );
      case 'abonnement':
        return <AbonnementPage session={gate.session} online={online} />;
      case 'publicite':
        return <PublicitePage session={gate.session} online={online} />;
      case 'factures':
      case 'credits':
      case 'comptage':
      case 'fournisseurs':
      case 'commandesFournisseur':
      case 'commandesPatients':
      case 'analytiques':
        return (
          <OnlineFeaturePage
            title={PAGE_META[page].title}
            description={PAGE_META[page].subtitle}
          />
        );
      default:
        return null;
    }
  })();

  return (
    <>
      <SyncBlockingOverlay visible={syncing} />
      <DashboardShell
        session={gate.session}
        page={page}
        pendingSync={pendingSync}
        online={online}
        syncing={syncing}
        onNavigate={setPage}
        onLogout={() => void lock()}
        onForgetDevice={() => void logoutDevice()}
        onSwitchPharmacy={switchPharmacy}
      >
        {content}
      </DashboardShell>
      <DesktopChatWidget
        stableOnline={stableOnline}
        online={online}
        session={gate.session}
        disabled={syncing}
      />
    </>
  );
}
