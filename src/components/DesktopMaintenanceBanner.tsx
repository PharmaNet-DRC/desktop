type Props = {
  message: string;
};

/** Compact banner when pharmacy online surface is under maintenance. */
export function DesktopMaintenanceBanner({ message }: Props) {
  return (
    <div
      className="card"
      style={{
        marginBottom: '1rem',
        borderColor: 'rgba(15, 92, 76, 0.35)',
        background: 'rgba(15, 92, 76, 0.08)',
      }}
    >
      <p
        style={{
          margin: 0,
          fontWeight: 700,
          color: 'var(--color-navy, #0f2744)',
        }}
      >
        Maintenance plateforme
      </p>
      <p
        style={{
          margin: '0.5rem 0 0',
          fontSize: '0.875rem',
          lineHeight: 1.55,
          color: 'var(--color-text-soft)',
        }}
      >
        {message} Les modules en ligne sont temporairement indisponibles ; la
        caisse et le stock locaux restent utilisables.
      </p>
    </div>
  );
}
