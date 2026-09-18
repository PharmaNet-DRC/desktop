import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, Wifi, WifiOff } from 'lucide-react';
import { API_BASE_URL, BRAND } from '@/lib/brand';

type Props = {
  online: boolean;
  hasDevice: boolean;
  onSubmit: (email: string, password: string) => Promise<string | null>;
  onGoUnlock?: () => void;
};

export function LoginScreen({ online, hasDevice, onSubmit, onGoUnlock }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const message = await onSubmit(email, password);
    if (message) setError(message);
    setBusy(false);
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="brand-mark" aria-hidden>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <rect x="7" y="2" width="4" height="14" rx="1" fill="white" />
            <rect x="2" y="7" width="14" height="4" rx="1" fill="white" />
          </svg>
        </div>
        <h1>{BRAND.product}</h1>
        <p className="auth-sub">{BRAND.tagline}</p>

        <div className={`auth-net ${online ? 'ok' : 'off'}`}>
          {online ? <Wifi size={14} /> : <WifiOff size={14} />}
          {online
            ? 'API joignable — connexion autorisée'
            : 'API injoignable — première connexion impossible'}
        </div>

        <p className="auth-note">
          La <strong>première connexion</strong> passe par le serveur (
          <code style={{ fontSize: '0.78em' }}>{API_BASE_URL}</code>
          ). Ensuite, cet appareil pourra s’ouvrir hors ligne via la session enregistrée
          (et un code PIN optionnel). Le mot de passe n’est jamais stocké.
        </p>

        {!online && (
          <div className="error-box" style={{ marginBottom: '1rem' }}>
            Impossible d’atteindre {API_BASE_URL}. En local : lancez le backend Nest
            (port 3002), puis redémarrez l’app bureau. Si l’appareil est déjà enregistré,
            utilisez le déverrouillage PIN.
          </div>
        )}

        <form onSubmit={handleSubmit} className="form-stack">
          <div className="field">
            <label htmlFor="email">E-mail</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={!online}
              placeholder="vous@pharmacie.cd"
            />
          </div>

          <div className="field">
            <label htmlFor="password">Mot de passe</label>
            <div className="password-wrap">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={!online}
                placeholder="••••••••"
              />
              <button
                type="button"
                className="password-toggle"
                aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && <p className="error-text">{error}</p>}

          <button type="submit" className="btn btn-primary" disabled={busy || !online}>
            {busy ? 'Connexion…' : 'Se connecter en ligne'}
          </button>
        </form>

        {hasDevice && onGoUnlock && (
          <button
            type="button"
            className="btn btn-outline"
            style={{ width: '100%', marginTop: '0.75rem' }}
            onClick={onGoUnlock}
          >
            Déverrouiller cet appareil (PIN / session)
          </button>
        )}

        <p className="demo-hint">
          Compte Pro réel (même e-mail / mot de passe que le web). Plan gratuit refusé.
          <br />
          Démo locale sans serveur : <code>demo</code> / <code>pro</code>
        </p>
      </div>
    </div>
  );
}
