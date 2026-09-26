import { useState, type FormEvent } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import type { StoredSession } from '@/lib/session';

type Props = {
  session: StoredSession;
  onSave: (pin: string) => Promise<string | null>;
  onSkip: () => void;
};

export function SetupPinScreen({ session, onSave, onSkip }: Props) {
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (pin !== confirm) {
      setError('Les deux codes PIN ne correspondent pas.');
      return;
    }
    setBusy(true);
    setError(null);
    const message = await onSave(pin);
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
        <h1>Protéger cet appareil</h1>
        <p className="auth-sub">
          {session.organizationName} · {session.email}
        </p>
        <p className="auth-note">
          Votre session Pro est enregistrée de façon chiffrée. Définissez un{' '}
          <strong>PIN local</strong> (4–12 chiffres) pour ouvrir l’app hors ligne sans
          retaper le mot de passe. Vous pourrez passer cette étape.
        </p>

        <form onSubmit={handleSubmit} className="form-stack">
          <div className="field">
            <label htmlFor="pin1">Code PIN</label>
            <div className="password-wrap">
              <input
                id="pin1"
                type={showPin ? 'text' : 'password'}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={12}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                required
                placeholder="••••"
                autoFocus
                autoComplete="new-password"
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
          <div className="field">
            <label htmlFor="pin2">Confirmer le PIN</label>
            <div className="password-wrap">
              <input
                id="pin2"
                type={showPin ? 'text' : 'password'}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={12}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value.replace(/\D/g, ''))}
                required
                placeholder="••••"
                autoComplete="new-password"
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
          {error && <p className="error-text">{error}</p>}
          <button
            type="submit"
            className="btn btn-primary"
            disabled={busy || pin.length < 4}
          >
            {busy ? 'Enregistrement…' : 'Enregistrer le PIN'}
          </button>
        </form>

        <button
          type="button"
          className="btn btn-outline"
          style={{ width: '100%', marginTop: '0.75rem' }}
          onClick={onSkip}
        >
          Continuer sans PIN
        </button>
      </div>
    </div>
  );
}
