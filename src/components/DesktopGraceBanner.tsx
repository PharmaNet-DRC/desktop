import { BRAND } from '@/lib/brand';
import type { SessionGrace, StoredSession } from '@/lib/session';
import { computeGraceEndsAt, DESKTOP_GRACE_PERIOD_DAYS } from '@/lib/session';

type Props = {
  session: StoredSession;
};

function formatDateFr(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function deriveGrace(session: StoredSession): SessionGrace | null {
  if (session.grace) return session.grace;
  if (!session.expiresAt) return null;
  const periodEnd = Date.parse(session.expiresAt);
  if (Number.isNaN(periodEnd)) return null;
  const graceEndsAt =
    session.graceEndsAt ?? computeGraceEndsAt(session.expiresAt);
  if (!graceEndsAt) return null;
  const graceEnd = Date.parse(graceEndsAt);
  const now = Date.now();
  const warnFrom = periodEnd - 7 * 24 * 60 * 60 * 1000;
  if (now < warnFrom || now >= graceEnd) return null;
  const inGrace = now >= periodEnd;
  const target = inGrace ? graceEnd : periodEnd;
  const daysRemaining = Math.max(
    1,
    Math.ceil((target - now) / (24 * 60 * 60 * 1000)),
  );
  return {
    phase: inGrace ? 'grace' : 'upcoming',
    periodEnd: session.expiresAt,
    graceEndsAt,
    freeMaxProducts: 50,
    daysRemaining,
  };
}

/** Desktop grace / expiry banner (6 days), French copy. */
export function DesktopGraceBanner({ session }: Props) {
  const grace = deriveGrace(session);
  if (!grace) return null;

  const isGrace = grace.phase === 'grace';

  return (
    <div
      className="card"
      style={{
        marginBottom: '1rem',
        borderColor: 'rgba(217, 119, 6, 0.45)',
        background: 'rgba(251, 191, 36, 0.12)',
      }}
    >
      <p
        style={{
          margin: 0,
          fontWeight: 700,
          color: 'var(--color-navy, #0f2744)',
        }}
      >
        {isGrace
          ? `Période de grâce — ${grace.daysRemaining} jour${grace.daysRemaining > 1 ? 's' : ''} restant${grace.daysRemaining > 1 ? 's' : ''}`
          : `Abonnement bientôt expiré — dans ${grace.daysRemaining} jour${grace.daysRemaining > 1 ? 's' : ''}`}
      </p>
      <p
        style={{
          margin: '0.5rem 0 0',
          fontSize: '0.875rem',
          lineHeight: 1.55,
          color: 'var(--color-text-soft)',
        }}
      >
        {isGrace ? (
          <>
            Votre période payante s’est terminée le{' '}
            <strong>{formatDateFr(grace.periodEnd)}</strong>. L’app bureau reste
            utilisable jusqu’au{' '}
            <strong>{formatDateFr(grace.graceEndsAt)}</strong> ({DESKTOP_GRACE_PERIOD_DAYS}{' '}
            jours de grâce). Ensuite elle sera verrouillée. L’offre gratuite
            restera accessible uniquement sur le site web.
          </>
        ) : (
          <>
            Votre abonnement expire le{' '}
            <strong>{formatDateFr(grace.periodEnd)}</strong>. Une période de
            grâce de {DESKTOP_GRACE_PERIOD_DAYS} jours suit jusqu’au{' '}
            <strong>{formatDateFr(grace.graceEndsAt)}</strong>. Passé ce délai,
            le bureau (offline) sera verrouillé ; l’offre gratuite restera sur
            pharmacd.org.
          </>
        )}
      </p>
      <a
        className="btn btn-primary"
        href={BRAND.webUrl}
        target="_blank"
        rel="noreferrer"
        style={{ marginTop: '0.75rem', display: 'inline-flex' }}
      >
        Renouveler sur pharmacd.org
      </a>
    </div>
  );
}
