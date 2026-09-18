import { RefreshCw } from 'lucide-react';

type Props = { visible: boolean };

export function SyncBlockingOverlay({ visible }: Props) {
  if (!visible) return null;
  return (
    <div className="sync-overlay" role="alertdialog" aria-busy="true" aria-live="assertive">
      <div className="sync-overlay-card">
        <RefreshCw className="sync-spin" size={28} />
        <h2>Synchronisation en cours</h2>
        <p>
          Vos données hors ligne sont en train d’être mises à jour. Les actions sont
          temporairement désactivées — veuillez patienter jusqu’à la fin.
        </p>
      </div>
    </div>
  );
}
