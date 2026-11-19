import type { AssetType, PriceMode, Quote } from './types';
import type { Position } from './engine';
import { r8 } from './round';

/** Live quotes older than this are still used, but flagged. */
export const STALE_MS = 36 * 60 * 60 * 1000;

export interface ResolvedPrice {
  price: number | null;
  previousClose: number | null;
  source: 'what_if' | 'live' | 'manual' | 'last_known' | 'missing';
  stale: boolean;
  fallback: boolean;
  missing: boolean;
}

export function isStale(fetchedAt: string | null | undefined, now = Date.now()): boolean {
  if (!fetchedAt) return true;
  const time = Date.parse(fetchedAt);
  if (!Number.isFinite(time)) return true;
  return now - time > STALE_MS;
}

/**
 * Live market data wins for stocks and ETFs.
 * Manual prices are explicit current prices (options, crypto, or a stock when the feed is empty).
 * Trade and opening prices are only a last-known fallback and are always flagged.
 * Missing stays null — never zero.
 */
export function resolvePrice(input: {
  assetType: AssetType;
  mode: PriceMode;
  whatIf?: number | null;
  live?: Quote | null;
  manual?: Quote | null;
  lastKnown?: number | null;
  now?: number;
}): ResolvedPrice {
  const now = input.now ?? Date.now();
  if (input.mode === 'what_if' && input.whatIf != null && input.whatIf > 0) {
    return {
      price: input.whatIf,
      previousClose: null,
      source: 'what_if',
      stale: false,
      fallback: false,
      missing: false,
    };
  }
  if (input.assetType === 'stock_etf' && input.live && input.live.price > 0 && input.live.source === 'finnhub') {
    return {
      price: input.live.price,
      previousClose: input.live.previousClose,
      source: 'live',
      stale: isStale(input.live.fetchedAt, now),
      fallback: false,
      missing: false,
    };
  }
  if (input.manual && input.manual.price > 0 && input.manual.source === 'manual') {
    return {
      price: input.manual.price,
      previousClose: null,
      source: 'manual',
      stale: isStale(input.manual.fetchedAt, now),
      fallback: false,
      missing: false,
    };
  }
  if (input.lastKnown != null && input.lastKnown > 0) {
    return {
      price: input.lastKnown,
      previousClose: null,
      source: 'last_known',
      stale: true,
      fallback: true,
      missing: false,
    };
  }
  return {
    price: null,
    previousClose: null,
    source: 'missing',
    stale: false,
    fallback: false,
    missing: true,
  };
}

export function valuePosition(position: Position, resolved: ResolvedPrice) {
  const marketValue =
    resolved.price == null ? null : r8(position.quantity * resolved.price * position.multiplier);
  const unrealized = marketValue == null ? null : r8(marketValue - position.costBasis);
  const unrealizedPct =
    unrealized == null || Math.abs(position.costBasis) < 1e-8 ? null : unrealized / Math.abs(position.costBasis);
  const dayChange =
    resolved.source === 'live' && resolved.price != null && resolved.previousClose != null
      ? r8((resolved.price - resolved.previousClose) * position.quantity * position.multiplier)
      : null;
  return { marketValue, unrealized, unrealizedPct, dayChange };
}
