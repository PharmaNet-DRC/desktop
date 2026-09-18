import { invoke } from '@tauri-apps/api/core';
import type { Entitlement } from './session';

export type AppInfo = {
  name: string;
  version: string;
  platform: string;
};

export async function getAppInfo(): Promise<AppInfo> {
  try {
    return await invoke<AppInfo>('get_app_info');
  } catch {
    return { name: 'PharmaCd Desktop', version: '0.1.0', platform: 'web' };
  }
}

export async function evaluateLocalEntitlement(input: {
  expiresAt: string | null;
  desktopAllowed: boolean;
}): Promise<Entitlement> {
  try {
    return await invoke<Entitlement>('evaluate_local_entitlement', {
      expiresAtIso: input.expiresAt,
      desktopAllowed: input.desktopAllowed,
    });
  } catch {
    // Vite-only preview (no Rust): soft-check in JS
    if (!input.desktopAllowed) {
      return {
        allowed: false,
        reason:
          "L'application bureau est réservée aux abonnements Pro (pas le plan gratuit).",
        expiresAt: input.expiresAt,
        planName: null,
        role: null,
      };
    }
    if (!input.expiresAt) {
      return {
        allowed: false,
        reason: 'Abonnement introuvable. Connectez-vous en ligne.',
        expiresAt: null,
        planName: null,
        role: null,
      };
    }
    const exp = Date.parse(input.expiresAt);
    const grace = 3 * 24 * 60 * 60 * 1000;
    if (Number.isNaN(exp) || Date.now() > exp + grace) {
      return {
        allowed: false,
        reason:
          'Votre abonnement a expiré. Réabonnez-vous sur pharmacd.org pour continuer.',
        expiresAt: input.expiresAt,
        planName: null,
        role: null,
      };
    }
    return {
      allowed: true,
      reason: null,
      expiresAt: input.expiresAt,
      planName: null,
      role: null,
    };
  }
}
