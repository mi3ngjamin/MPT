const STORAGE_KEY = 'mpt-finnhub-unsupported';
const DAY_MS = 24 * 60 * 60 * 1000;

type Stored = Record<string, number>;

function readMap(now: number): Stored {
  if (typeof localStorage === 'undefined') return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Stored;
    const live: Stored = {};
    for (const [symbol, expires] of Object.entries(parsed)) {
      if (typeof expires === 'number' && expires > now) live[symbol.toUpperCase()] = expires;
    }
    return live;
  } catch {
    return {};
  }
}

function writeMap(map: Stored) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function readUnsupportedSymbols(now = Date.now()): string[] {
  return Object.keys(readMap(now)).sort();
}

export function rememberUnsupportedSymbols(symbols: string[], now = Date.now()) {
  if (!symbols.length) return;
  const map = readMap(now);
  const expires = now + DAY_MS;
  for (const symbol of symbols) map[symbol.toUpperCase()] = expires;
  writeMap(map);
}
