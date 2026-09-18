export const BRAND = {
  name: 'PharmaCd',
  short: 'PharmaCd',
  product: 'PharmaCd Desktop',
  tagline: 'Caisse & gestion hors ligne — pharmacies & fournisseurs',
  webUrl: 'https://pharmacd.org',
} as const;

/** Nest API origin — override with VITE_API_BASE_URL (no Next.js required) */
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') || 'http://localhost:3002';
