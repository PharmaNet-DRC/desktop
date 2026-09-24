use serde::{Deserialize, Serialize};

mod vault;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DesktopEntitlement {
  pub allowed: bool,
  pub reason: Option<String>,
  pub expires_at: Option<String>,
  pub plan_name: Option<String>,
  pub role: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
  pub name: String,
  pub version: String,
  pub platform: String,
}

#[tauri::command]
fn get_app_info() -> AppInfo {
  AppInfo {
    name: "PharmaCd Desktop".into(),
    version: env!("CARGO_PKG_VERSION").into(),
    platform: std::env::consts::OS.into(),
  }
}

#[tauri::command]
fn evaluate_local_entitlement(
  expires_at_iso: Option<String>,
  desktop_allowed: bool,
  grace_ends_at_iso: Option<String>,
) -> DesktopEntitlement {
  if !desktop_allowed {
    return DesktopEntitlement {
      allowed: false,
      reason: Some(
        "L'application bureau (mode hors ligne) nécessite un abonnement Pro actif. L'offre gratuite reste disponible uniquement sur pharmacd.org en mode en ligne."
          .into(),
      ),
      expires_at: expires_at_iso,
      plan_name: None,
      role: None,
    };
  }

  let Some(expires_at) = expires_at_iso.clone() else {
    return DesktopEntitlement {
      allowed: false,
      reason: Some(
        "Abonnement introuvable. Connectez-vous en ligne pour synchroniser.".into(),
      ),
      expires_at: None,
      plan_name: None,
      role: None,
    };
  };

  let now_ms = std::time::SystemTime::now()
    .duration_since(std::time::UNIX_EPOCH)
    .map(|d| d.as_millis() as i64)
    .unwrap_or(0);
  // Align with backend SUBSCRIPTION_GRACE_PERIOD_DAYS = 6
  const GRACE_MS: i64 = 6 * 24 * 60 * 60 * 1000;

  let expired = if let Some(grace_iso) = grace_ends_at_iso.as_ref() {
    match chrono_lite_parse(grace_iso) {
      Some(grace_ms) => now_ms > grace_ms,
      None => true,
    }
  } else {
    match chrono_lite_parse(&expires_at) {
      Some(exp_ms) => now_ms > exp_ms + GRACE_MS,
      None => true,
    }
  };

  if expired {
    DesktopEntitlement {
      allowed: false,
      reason: Some(
        "La période de grâce de 6 jours est terminée. L'application bureau est verrouillée. Réabonnez-vous sur pharmacd.org pour l'offline, ou utilisez l'offre gratuite sur le site web."
          .into(),
      ),
      expires_at: Some(expires_at),
      plan_name: None,
      role: None,
    }
  } else {
    DesktopEntitlement {
      allowed: true,
      reason: None,
      expires_at: Some(expires_at),
      plan_name: None,
      role: None,
    }
  }
}

fn chrono_lite_parse(iso: &str) -> Option<i64> {
  let trimmed = iso.trim();
  if trimmed.len() < 19 {
    return None;
  }
  let date = &trimmed[0..10];
  let time = &trimmed[11..19];
  let (y, mo, d) = (
    date[0..4].parse::<i64>().ok()?,
    date[5..7].parse::<i64>().ok()?,
    date[8..10].parse::<i64>().ok()?,
  );
  let (h, mi, s) = (
    time[0..2].parse::<i64>().ok()?,
    time[3..5].parse::<i64>().ok()?,
    time[6..8].parse::<i64>().ok()?,
  );
  let y = if mo <= 2 { y - 1 } else { y };
  let era = if y >= 0 { y } else { y - 399 } / 400;
  let yoe = y - era * 400;
  let mp = if mo > 2 { mo - 3 } else { mo + 9 };
  let doy = (153 * mp + 2) / 5 + d - 1;
  let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
  let days = era * 146097 + doe - 719468;
  Some((days * 86400 + h * 3600 + mi * 60 + s) * 1000)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_store::Builder::new().build())
    .invoke_handler(tauri::generate_handler![
      get_app_info,
      evaluate_local_entitlement,
      vault::vault_has_session,
      vault::vault_save_session,
      vault::vault_load_session,
      vault::vault_clear_session,
      vault::vault_has_pin,
      vault::vault_set_pin,
      vault::vault_verify_pin,
      vault::vault_clear_pin,
      vault::vault_clear_device
    ])
    .setup(|app| {
      // Force the PharmaCd logo-mark as the live window / taskbar icon.
      // Bundle icons alone are not always applied during `tauri dev` on Linux.
      use tauri::Manager;
      let icon = tauri::image::Image::from_bytes(include_bytes!("../icons/icon.png"))
        .expect("PharmaCd window icon (icons/icon.png) missing or invalid");
      if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_icon(icon);
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running PharmaCd Desktop");
}
