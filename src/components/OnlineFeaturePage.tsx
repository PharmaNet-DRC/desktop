import { Wifi } from 'lucide-react';

type Props = {
  title: string;
  description: string;
};

/** Placeholder for modules not yet ported to desktop. */
export function OnlineFeaturePage({ title, description }: Props) {
  return (
    <div className="card online-feature">
      <div className="online-feature-icon">
        <Wifi size={22} />
      </div>
      <h2>{title}</h2>
      <p>{description}</p>
      <p className="muted" style={{ fontSize: '0.8125rem' }}>
        Module encore en cours d’intégration sur l’app bureau. Utilisez le tableau de
        bord web pour cette section, ou revenez après une prochaine mise à jour. Hors
        ligne, seuls la caisse, le stock, les ventes locales et les patients restent
        disponibles.
      </p>
    </div>
  );
}
