# PharmaCd Desktop

Tauri 2 + React + TypeScript — **Pro only** (pharmacies & fournisseurs). Offline-first local store with sync outbox.

## Features (pharmacy MVP)

- Login with show/hide password · Pro gate · expiry lock
- Dashboard (KPIs, alertes stock, ventes récentes)
- **Caisse** POS (panier, paiements, tickets locaux)
- Historique des ventes
- Médicaments (CRUD catalogue)
- Inventaire (entrées / sorties + mouvements)
- Patients
- Synchronisation (file d’attente locale — API Nest à brancher)

## Prerequisites

1. Node.js 20+
2. Rust ([rustup](https://rustup.rs/)) — then `source "$HOME/.cargo/env"`
3. Linux deps (Ubuntu/Debian):

```bash
sudo apt update
sudo apt install -y libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
```

## Run

```bash
cd desktop
npm install
npm run tauri:dev
# or UI only: npm run dev → http://localhost:1420
```

**Démo :** `pharmacie@demo.pharmacd` / `pro` (ou `demo` / `pro`)

## Config

Desktop talks to **Nest only** (not the Next.js web app) for login / catalogue / sales sync.

| Variable | Purpose |
|----------|---------|
| `VITE_API_BASE_URL` | Nest origin (`http://localhost:3002` local) |
| `VITE_SOCKET_URL` | Socket origin (same Nest host) |

```bash
# Terminal 1 — API
cd backend && npm run start:dev

# Terminal 2 — Desktop
cd desktop && npm run tauri:dev
```

Restart Tauri after changing `.env`.

---

## Publish installers (GitHub Releases)

Installers are built by CI and attached to a [GitHub Release](https://github.com/PharmaNet-DRC/desktop/releases). The web **Abonnement** page links to those assets.

### 1. One-time GitHub setup

1. Open https://github.com/PharmaNet-DRC/desktop → **Settings → Secrets and variables → Actions**
2. Add repository secrets (optional but recommended):

| Secret | Example | Purpose |
|--------|---------|---------|
| `DESKTOP_API_BASE_URL` | `https://pharmacd.org/nest` | Nest origin baked into the installer |
| `DESKTOP_SOCKET_URL` | `https://pharmacd.org` | Socket.io (already on main domain) |

> Nest stays on Docker localhost (`127.0.0.1:13101`). Host nginx exposes it at **`https://pharmacd.org/nest/`** — no extra subdomain.

3. **Public downloads:** for Abonnement links to work without GitHub login, either:
   - make this repo **public**, or
   - keep it private and host copies elsewhere later  
   Private release assets are not downloadable anonymously.

### 2. Bump version (keep in sync)

Update both:

- `package.json` → `"version": "0.1.0"`
- `src-tauri/tauri.conf.json` → `"version": "0.1.0"`
- `src-tauri/Cargo.toml` → `version = "0.1.0"`

### 3. Ship a release

```bash
cd desktop
git add -A && git commit -m "chore: prepare desktop v0.1.0"
git push origin main

git tag v0.1.0
git push origin v0.1.0
```

Or: **Actions → Release Desktop → Run workflow** → tag `v0.1.0`.

Wait for the workflow (macOS + Windows + Linux). Open:

https://github.com/PharmaNet-DRC/desktop/releases/tag/v0.1.0

### 4. Wire the web Abonnement buttons

On the **web** Hostinger `.env` (then rebuild frontend):

```bash
NEXT_PUBLIC_DESKTOP_DOWNLOAD_MAC=https://github.com/PharmaNet-DRC/desktop/releases/download/v0.1.0/<exact-dmg-filename>
NEXT_PUBLIC_DESKTOP_DOWNLOAD_WINDOWS=https://github.com/PharmaNet-DRC/desktop/releases/download/v0.1.0/<exact-msi-filename>
NEXT_PUBLIC_DESKTOP_DOWNLOAD_LINUX=https://github.com/PharmaNet-DRC/desktop/releases/download/v0.1.0/<exact-appimage-filename>
```

Copy exact filenames from the release assets list (they include arch / version).

### 5. Next releases

```bash
# bump to 0.1.1 in the three version files, commit, then:
git tag v0.1.1
git push origin v0.1.1
```

Update the three `NEXT_PUBLIC_DESKTOP_DOWNLOAD_*` URLs to the new tag/assets.

### Notes

- First macOS/Windows opens may show “unidentified developer” until you add Apple/Windows code signing later.
- Do **not** upload installers to the Hostinger VPS — GitHub Releases is the CDN.

## Next

1. Expose Nest on `api.pharmacd.org` for production desktop builds
2. Apple / Windows code signing
3. SQLite instead of localStorage for larger DBs
4. Fournisseur modules
5. Receipt printing
