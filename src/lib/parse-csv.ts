/** Minimal CSV parser (comma or semicolon). Handles quoted fields. */

export function parseCsv(text: string): string[][] {
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n').filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  const delim = lines[0].includes(';') && !lines[0].includes(',') ? ';' : ',';
  return lines.map((line) => parseCsvLine(line, delim));
}

function parseCsvLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === delim && !inQuotes) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

export function rowsFromCsvMatrix(matrix: string[][]): Record<string, string>[] {
  if (matrix.length < 2) return [];
  const headers = matrix[0].map((h) => h.trim());
  return matrix.slice(1).map((cells) => {
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = cells[i] ?? '';
    });
    return row;
  });
}

export function parseBool(raw: string | undefined): boolean | undefined {
  if (raw == null || raw.trim() === '') return undefined;
  const v = raw.trim().toLowerCase();
  if (['1', 'true', 'oui', 'yes', 'actif'].includes(v)) return true;
  if (['0', 'false', 'non', 'no', 'inactif'].includes(v)) return false;
  return undefined;
}

export function parseOptionalNumber(raw: string | undefined): number | undefined {
  if (raw == null || raw.trim() === '') return undefined;
  const n = Number(String(raw).replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
}

export function escapeCsvCell(v: string | number | boolean): string {
  const s = String(v ?? '');
  if (/[",;\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
