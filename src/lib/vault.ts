import { invoke } from '@tauri-apps/api/core';
import type { StoredSession } from './session';

const LS_SESSION = 'pharmacd.desktop.vault.session';
const LS_PIN = 'pharmacd.desktop.vault.pin';

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/** Web/Vite fallback — not as safe as the Rust AES vault; for UI preview only. */
const webVault = {
  async hasSession() {
    return !!localStorage.getItem(LS_SESSION);
  },
  async saveSession(session: StoredSession) {
    localStorage.setItem(LS_SESSION, JSON.stringify(session));
  },
  async loadSession(): Promise<StoredSession | null> {
    const raw = localStorage.getItem(LS_SESSION);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as StoredSession;
    } catch {
      return null;
    }
  },
  async clearSession() {
    localStorage.removeItem(LS_SESSION);
  },
  async hasPin() {
    return !!localStorage.getItem(LS_PIN);
  },
  async setPin(pin: string) {
    if (!/^\d{4,12}$/.test(pin)) throw new Error('Le code PIN doit contenir 4 à 12 chiffres.');
    // Lightweight hash for preview only
    const enc = btoa(`pharmacd:${pin}`);
    localStorage.setItem(LS_PIN, enc);
  },
  async verifyPin(pin: string) {
    return localStorage.getItem(LS_PIN) === btoa(`pharmacd:${pin}`);
  },
  async clearPin() {
    localStorage.removeItem(LS_PIN);
  },
  async clearDevice() {
    localStorage.removeItem(LS_SESSION);
    localStorage.removeItem(LS_PIN);
  },
};

export async function vaultHasSession(): Promise<boolean> {
  if (!isTauri()) return webVault.hasSession();
  return invoke<boolean>('vault_has_session');
}

export async function vaultSaveSession(session: StoredSession): Promise<void> {
  if (!isTauri()) {
    await webVault.saveSession(session);
    return;
  }
  await invoke('vault_save_session', { payload: JSON.stringify(session) });
}

export async function vaultLoadSession(): Promise<StoredSession | null> {
  if (!isTauri()) return webVault.loadSession();
  const raw = await invoke<string | null>('vault_load_session');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

export async function vaultClearSession(): Promise<void> {
  if (!isTauri()) {
    await webVault.clearSession();
    return;
  }
  await invoke('vault_clear_session');
}

export async function vaultHasPin(): Promise<boolean> {
  if (!isTauri()) return webVault.hasPin();
  return invoke<boolean>('vault_has_pin');
}

export async function vaultSetPin(pin: string): Promise<void> {
  if (!isTauri()) {
    await webVault.setPin(pin);
    return;
  }
  await invoke('vault_set_pin', { pin });
}

export async function vaultVerifyPin(pin: string): Promise<boolean> {
  if (!isTauri()) return webVault.verifyPin(pin);
  return invoke<boolean>('vault_verify_pin', { pin });
}

export async function vaultClearDevice(): Promise<void> {
  if (!isTauri()) {
    await webVault.clearDevice();
    return;
  }
  await invoke('vault_clear_device');
}
