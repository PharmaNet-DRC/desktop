/** Public maintenance status (mirrors Nest MaintenancePublicStatus). */
export type MaintenanceStatus = {
  globalEnabled: boolean;
  pharmacyDashboard: boolean;
  patientDashboard: boolean;
  fournisseurDashboard: boolean;
  publicSite: boolean;
  message: string;
  estimatedEndAt: string | null;
  anyActive: boolean;
};

const DEFAULT_MESSAGE =
  'PharmaCd est temporairement en maintenance. Merci de réessayer bientôt.';

export function emptyMaintenanceStatus(): MaintenanceStatus {
  return {
    globalEnabled: false,
    pharmacyDashboard: false,
    patientDashboard: false,
    fournisseurDashboard: false,
    publicSite: false,
    message: DEFAULT_MESSAGE,
    estimatedEndAt: null,
    anyActive: false,
  };
}

export function parseMaintenanceStatus(data: unknown): MaintenanceStatus {
  if (!data || typeof data !== 'object') return emptyMaintenanceStatus();
  const d = data as Record<string, unknown>;
  const globalEnabled = Boolean(d.globalEnabled);
  const pharmacyDashboard = Boolean(d.pharmacyDashboard);
  const patientDashboard = Boolean(d.patientDashboard);
  const fournisseurDashboard = Boolean(d.fournisseurDashboard);
  const publicSite = Boolean(d.publicSite);
  return {
    globalEnabled,
    pharmacyDashboard,
    patientDashboard,
    fournisseurDashboard,
    publicSite,
    message:
      typeof d.message === 'string' && d.message.trim()
        ? d.message.trim()
        : DEFAULT_MESSAGE,
    estimatedEndAt:
      typeof d.estimatedEndAt === 'string' ? d.estimatedEndAt : null,
    anyActive:
      typeof d.anyActive === 'boolean'
        ? d.anyActive
        : globalEnabled ||
          pharmacyDashboard ||
          patientDashboard ||
          fournisseurDashboard ||
          publicSite,
  };
}

/** Online pharmacy features blocked (web + desktop). Offline POS stays available. */
export function isPharmacySurfaceBlocked(status: MaintenanceStatus): boolean {
  return status.globalEnabled || status.pharmacyDashboard;
}
