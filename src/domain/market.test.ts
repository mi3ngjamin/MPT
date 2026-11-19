import { describe, expect, it } from 'vitest';
import { isUsMarketOpen, quotesNeedRefresh } from './market';
import type { Quote } from './types';

function quote(symbol: string, fetchedAt: string): Quote {
  return { symbol, price: 1, previousClose: null, source: 'finnhub', fetchedAt };
}

describe('US market hours', () => {
  it('is open on a weekday from 9:30 to 16:00 Eastern', () => {
    expect(isUsMarketOpen(new Date('2026-11-19T14:30:00Z'))).toBe(true);
    expect(isUsMarketOpen(new Date('2026-11-19T20:59:00Z'))).toBe(true);
    expect(isUsMarketOpen(new Date('2026-11-19T14:29:00Z'))).toBe(false);
    expect(isUsMarketOpen(new Date('2026-11-19T21:00:00Z'))).toBe(false);
    expect(isUsMarketOpen(new Date('2026-11-21T15:00:00Z'))).toBe(false);
  });
});

describe('quote freshness', () => {
  const now = Date.parse('2026-11-19T15:00:00Z');

  it('refreshes when a symbol has no recent Finnhub quote', () => {
    expect(quotesNeedRefresh([], ['VTI'], now)).toBe(true);
    expect(quotesNeedRefresh([quote('VTI', '2026-11-19T14:50:00Z')], ['VTI', 'AAPL'], now)).toBe(true);
  });

  it('skips a refresh when every symbol was quoted within 15 minutes', () => {
    expect(
      quotesNeedRefresh([quote('VTI', '2026-11-19T14:50:00Z'), quote('AAPL', '2026-11-19T14:50:00Z')], ['VTI', 'AAPL'], now),
    ).toBe(false);
  });

  it('refreshes when the newest needed quote is older than 15 minutes', () => {
    expect(quotesNeedRefresh([quote('VTI', '2026-11-19T14:40:00Z')], ['VTI'], now)).toBe(true);
  });
});
