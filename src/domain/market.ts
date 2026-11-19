import type { Activity, Quote } from './types';

/** Refresh when the newest needed Finnhub quote is older than this. */
export const QUOTE_MAX_AGE_MS = 15 * 60 * 1000;
export const QUOTE_POLL_MS = 5 * 60 * 1000;

export function stockSymbols(activities: Pick<Activity, 'assetType' | 'symbol'>[]): string[] {
  return [
    ...new Set(
      activities
        .filter((row) => row.assetType === 'stock_etf' && row.symbol)
        .map((row) => (row.symbol as string).toUpperCase()),
    ),
  ];
}

/** True when any needed symbol has no Finnhub quote from the last 15 minutes. */
export function quotesNeedRefresh(quotes: Quote[], symbols: string[], now = Date.now()): boolean {
  if (!symbols.length) return false;
  const fresh = new Set(
    quotes
      .filter((quote) => quote.source === 'finnhub' && now - Date.parse(quote.fetchedAt) <= QUOTE_MAX_AGE_MS)
      .map((quote) => quote.symbol.toUpperCase()),
  );
  return symbols.some((symbol) => !fresh.has(symbol.toUpperCase()));
}

/** Weekdays 9:30–16:00 America/New_York. */
export function isUsMarketOpen(now = new Date()): boolean {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const weekday = parts.find((part) => part.type === 'weekday')?.value ?? '';
  if (weekday === 'Sat' || weekday === 'Sun') return false;
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? '0');
  const mins = hour * 60 + minute;
  return mins >= 9 * 60 + 30 && mins < 16 * 60;
}
