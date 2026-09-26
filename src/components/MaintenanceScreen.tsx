type Props = {
  message: string;
  estimatedEndAt: string | null;
  /** When true, only online modules are paused (offline caisse still works). */
  onlineOnly?: boolean;
  onRetry?: () => void;
  onGoOffline?: () => void;
};

function formatEta(iso: string | null) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return null;
  }
}

/** Soft gate for online features during platform maintenance. */
export function MaintenanceScreen({
  message,
  estimatedEndAt,
  onlineOnly = true,
  onRetry,
  onGoOffline,
}: Props) {
  const eta = formatEta(estimatedEndAt);

  return (
    <div className="card online-feature">
      <h2>Maintenance en cours</h2>
      <p>{message}</p>
      {eta ? (
        <p className="muted" style={{ fontSize: '0.8125rem', marginTop: '0.5rem' }}>
          Fin estimée : {eta}
        </p>
      ) : null}
      {onlineOnly ? (
        <p className="muted" style={{ fontSize: '0.8125rem', marginTop: '0.75rem' }}>
          Les fonctions en ligne (sync, abonnement, commandes…) sont en pause. La
          caisse, le stock et les ventes locales restent disponibles hors ligne.
        </p>
      ) : null}
      <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', marginTop: '1rem' }}>
        {onRetry ? (
          <button type="button" className="btn btn-primary" onClick={onRetry}>
            Réessayer
          </button>
        ) : null}
        {onGoOffline ? (
          <button type="button" className="btn btn-outline" onClick={onGoOffline}>
            Continuer hors ligne
          </button>
        ) : null}
      </div>
    </div>
  );
}
