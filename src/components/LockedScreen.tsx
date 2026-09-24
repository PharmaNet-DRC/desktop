import { BRAND } from '@/lib/brand';
import type { StoredSession } from '@/lib/session';

type Props = {
  reason: string;
  session: StoredSession | null;
  onLogout: () => void;
};

export function LockedScreen({ reason, session, onLogout }: Props) {
  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="brand-mark" aria-hidden>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <rect x="7" y="2" width="4" height="14" rx="1" fill="white" />
            <rect x="2" y="7" width="14" height="4" rx="1" fill="white" />
          </svg>
        </div>
        <h1>Abonnement Pro requis</h1>
        <p className="auth-sub">L’application bureau (mode hors ligne) est verrouillée</p>
        <div className="error-box" style={{ marginTop: '1rem' }}>
          {reason}
        </div>
        <p className="auth-note" style={{ marginTop: '0.75rem' }}>
          L’offre gratuite (limite de produits du plan gratuit) reste disponible
          sur le site web en mode en ligne. Pour continuer hors ligne, souscrivez
          un abonnement Pro.
        </p>
        {session && (
          <p className="auth-note">
            Compte : {session.email}
            {session.graceEndsAt
              ? ` · fin de grâce ${new Date(session.graceEndsAt).toLocaleDateString('fr-FR')}`
              : session.expiresAt
                ? ` · échéance ${new Date(session.expiresAt).toLocaleDateString('fr-FR')}`
                : null}
          </p>
        )}
        <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', marginTop: '1rem' }}>
          <a className="btn btn-primary" href={BRAND.webUrl} target="_blank" rel="noreferrer">
            Réabonner sur pharmacd.org
          </a>
          <button type="button" className="btn btn-outline" onClick={onLogout}>
            Changer de compte
          </button>
        </div>
      </div>
    </div>
  );
}
