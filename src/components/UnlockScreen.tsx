import { useState, type FormEvent } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { BRAND } from '@/lib/brand';

type Props = {
  email: string;
  organizationName: string;
  requiresPin: boolean;
  onUnlock: (pin: string) => Promise<string | null>;
  onContinueWithoutPin?: () => Promise<string | null>;
  onPasswordLogin: () => void;
  onForgetDevice: () => Promise<void>;
};

export function UnlockScreen({
  email,
  organizationName,
  requiresPin,
  onUnlock,
  onContinueWithoutPin,
  onPasswordLogin,
  onForgetDevice,
}: Props) {
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const message = requiresPin
      ? await onUnlock(pin)
      : (await onContinueWithoutPin?.()) ?? null;
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
        <h1>Déverrouiller</h1>
        <p className="auth-sub">{organizationName}</p>
        <p className="auth-note">
          Session enregistrée pour <strong>{email}</strong>.{' '}
          {requiresPin
            ? 'Entrez votre code PIN local — aucun Internet requis.'
            : 'Cet appareil est déjà enregistré. Continuez hors ligne sans mot de passe.'}{' '}
          Le mot de passe PharmaCd n’est jamais stocké ici.
        </p>

        <form onSubmit={handleSubmit} className="form-stack">
          {requiresPin && (
            <div className="field">
              <label htmlFor="pin">Code PIN</label>
              <div className="password-wrap">
                <input
                  id="pin"
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  autoComplete="current-password"
                  pattern="[0-9]*"
                  maxLength={12}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  required
                  placeholder="••••"
                  autoFocus
                />
                <button
                  type="button"
                  className="password-toggle"
                  aria-label={showPin ? 'Masquer le PIN' : 'Afficher le PIN'}
                  onClick={() => setShowPin((v) => !v)}
                >
                  {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          )}
          {error && <p className="error-text">{error}</p>}
          <button
            type="submit"
            className="btn btn-primary"
            disabled={busy || (requiresPin && pin.length < 4)}
          >
            {busy ? 'Vérification…' : 'Ouvrir l’application'}
          </button>
        </form>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
          <button type="button" className="btn btn-outline" onClick={onPasswordLogin}>
            Connexion avec mot de passe (Internet)
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ color: 'var(--color-danger)' }}
            onClick={() => void onForgetDevice()}
          >
            Oublier cet appareil
          </button>
        </div>
        <p className="demo-hint">{BRAND.name} Desktop · coffre local chiffré</p>
      </div>
    </div>
  );
}
