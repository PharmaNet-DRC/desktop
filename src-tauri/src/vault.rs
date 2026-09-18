//! Encrypted local vault for desktop session/license (never stores passwords).

use aes_gcm::{
  aead::{Aead, KeyInit},
  Aes256Gcm, Nonce,
};
use base64::{engine::general_purpose::STANDARD as B64, Engine};
use rand::RngCore;
use sha2::{Digest, Sha256};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

const SESSION_FILE: &str = "session.vault";
const PIN_FILE: &str = "pin.vault";
const KEY_FILE: &str = "device.key";

fn data_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
  app
    .path()
    .app_data_dir()
    .map_err(|e| format!("app data dir: {e}"))
}

fn ensure_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
  let dir = data_dir(app)?;
  fs::create_dir_all(&dir).map_err(|e| format!("mkdir: {e}"))?;
  Ok(dir)
}

fn device_key(app: &tauri::AppHandle) -> Result<[u8; 32], String> {
  let dir = ensure_dir(app)?;
  let path = dir.join(KEY_FILE);
  if path.exists() {
    let raw = fs::read(&path).map_err(|e| format!("read key: {e}"))?;
    if raw.len() == 32 {
      let mut key = [0u8; 32];
      key.copy_from_slice(&raw);
      return Ok(key);
    }
  }
  let mut key = [0u8; 32];
  rand::thread_rng().fill_bytes(&mut key);
  fs::write(&path, key).map_err(|e| format!("write key: {e}"))?;
  Ok(key)
}

fn encrypt_blob(app: &tauri::AppHandle, plaintext: &[u8]) -> Result<String, String> {
  let key = device_key(app)?;
  let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| e.to_string())?;
  let mut nonce_bytes = [0u8; 12];
  rand::thread_rng().fill_bytes(&mut nonce_bytes);
  let nonce = Nonce::from_slice(&nonce_bytes);
  let ciphertext = cipher
    .encrypt(nonce, plaintext)
    .map_err(|_| "chiffrement impossible".to_string())?;
  let mut out = Vec::with_capacity(12 + ciphertext.len());
  out.extend_from_slice(&nonce_bytes);
  out.extend_from_slice(&ciphertext);
  Ok(B64.encode(out))
}

fn decrypt_blob(app: &tauri::AppHandle, encoded: &str) -> Result<Vec<u8>, String> {
  let key = device_key(app)?;
  let raw = B64
    .decode(encoded.trim())
    .map_err(|_| "coffre illisible".to_string())?;
  if raw.len() < 13 {
    return Err("coffre corrompu".into());
  }
  let (nonce_bytes, ciphertext) = raw.split_at(12);
  let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| e.to_string())?;
  let nonce = Nonce::from_slice(nonce_bytes);
  cipher
    .decrypt(nonce, ciphertext)
    .map_err(|_| "déchiffrement impossible".to_string())
}

fn hash_pin(pin: &str, salt: &[u8]) -> String {
  let mut hasher = Sha256::new();
  hasher.update(b"pharmacd-desktop-pin-v1");
  hasher.update(salt);
  hasher.update(pin.as_bytes());
  hex::encode(hasher.finalize())
}

#[tauri::command]
pub fn vault_has_session(app: tauri::AppHandle) -> bool {
  data_dir(&app)
    .map(|d| d.join(SESSION_FILE).exists())
    .unwrap_or(false)
}

#[tauri::command]
pub fn vault_save_session(app: tauri::AppHandle, payload: String) -> Result<(), String> {
  let dir = ensure_dir(&app)?;
  let enc = encrypt_blob(&app, payload.as_bytes())?;
  fs::write(dir.join(SESSION_FILE), enc).map_err(|e| format!("save session: {e}"))
}

#[tauri::command]
pub fn vault_load_session(app: tauri::AppHandle) -> Result<Option<String>, String> {
  let path = data_dir(&app)?.join(SESSION_FILE);
  if !path.exists() {
    return Ok(None);
  }
  let enc = fs::read_to_string(&path).map_err(|e| format!("read session: {e}"))?;
  let plain = decrypt_blob(&app, &enc)?;
  let s = String::from_utf8(plain).map_err(|_| "session invalide".to_string())?;
  Ok(Some(s))
}

#[tauri::command]
pub fn vault_clear_session(app: tauri::AppHandle) -> Result<(), String> {
  let path = data_dir(&app)?.join(SESSION_FILE);
  if path.exists() {
    fs::remove_file(&path).map_err(|e| format!("clear session: {e}"))?;
  }
  Ok(())
}

#[tauri::command]
pub fn vault_has_pin(app: tauri::AppHandle) -> bool {
  data_dir(&app)
    .map(|d| d.join(PIN_FILE).exists())
    .unwrap_or(false)
}

#[tauri::command]
pub fn vault_set_pin(app: tauri::AppHandle, pin: String) -> Result<(), String> {
  let pin = pin.trim();
  if pin.len() < 4 || pin.len() > 12 || !pin.chars().all(|c| c.is_ascii_digit()) {
    return Err("Le code PIN doit contenir 4 à 12 chiffres.".into());
  }
  let mut salt = [0u8; 16];
  rand::thread_rng().fill_bytes(&mut salt);
  let hash = hash_pin(pin, &salt);
  let body = format!("{}:{}", hex::encode(salt), hash);
  let dir = ensure_dir(&app)?;
  let enc = encrypt_blob(&app, body.as_bytes())?;
  fs::write(dir.join(PIN_FILE), enc).map_err(|e| format!("save pin: {e}"))
}

#[tauri::command]
pub fn vault_verify_pin(app: tauri::AppHandle, pin: String) -> Result<bool, String> {
  let path = data_dir(&app)?.join(PIN_FILE);
  if !path.exists() {
    return Ok(false);
  }
  let enc = fs::read_to_string(&path).map_err(|e| format!("read pin: {e}"))?;
  let plain = decrypt_blob(&app, &enc)?;
  let body = String::from_utf8(plain).map_err(|_| "pin invalide".to_string())?;
  let (salt_hex, expected) = body
    .split_once(':')
    .ok_or_else(|| "pin corrompu".to_string())?;
  let salt = hex::decode(salt_hex).map_err(|_| "pin corrompu".to_string())?;
  Ok(hash_pin(pin.trim(), &salt) == expected)
}

#[tauri::command]
pub fn vault_clear_pin(app: tauri::AppHandle) -> Result<(), String> {
  let path = data_dir(&app)?.join(PIN_FILE);
  if path.exists() {
    fs::remove_file(&path).map_err(|e| format!("clear pin: {e}"))?;
  }
  Ok(())
}

#[tauri::command]
pub fn vault_clear_device(app: tauri::AppHandle) -> Result<(), String> {
  vault_clear_session(app.clone())?;
  vault_clear_pin(app)?;
  Ok(())
}
