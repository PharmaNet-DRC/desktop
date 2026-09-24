import { invoke } from '@tauri-apps/api/core';
import {
  DESKTOP_GRACE_EXPIRED_MESSAGE,
  DESKTOP_PRO_REQUIRED_MESSAGE,
  type Entitlement,
} from './session';

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
  graceEndsAt?: string | null;
}): Promise<Entitlement> {
  try {
    return await invoke<Entitlement>('evaluate_local_entitlement', {
      expiresAtIso: input.expiresAt,
      desktopAllowed: input.desktopAllowed,
      graceEndsAtIso: input.graceEndsAt ?? null,
    });
  } catch {
    // Vite-only preview (no Rust): soft-check in JS — grace = 6 days
    if (!input.desktopAllowed) {
      return {
        allowed: false,
        reason: DESKTOP_PRO_REQUIRED_MESSAGE,
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
    const graceMs = 6 * 24 * 60 * 60 * 1000;
    const cutoff = input.graceEndsAt
      ? Date.parse(input.graceEndsAt)
      : Date.parse(input.expiresAt) + graceMs;
    if (Number.isNaN(cutoff) || Date.now() > cutoff) {
      return {
        allowed: false,
        reason: DESKTOP_GRACE_EXPIRED_MESSAGE,
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
