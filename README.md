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

## Run locally

```bash
# Terminal 1 — API
cd backend && npm run start:dev

# Terminal 2 — Desktop
cd desktop && npm run tauri:dev
```

Restart Tauri after changing `.env`. Chat/support still expects some web-only routes; core caisse + sync do not.

## Next

1. Wire chat/messaging to Nest (or disable until then)
2. SQLite (rusqlite) instead of localStorage for larger DBs
3. Fournisseur modules
4. Receipt printing
