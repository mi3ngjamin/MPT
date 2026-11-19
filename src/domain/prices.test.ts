import { describe, expect, it } from 'vitest';
import { processLedger } from './engine';
import { resolvePrice, valuePosition } from './prices';
import { assembleBooks } from './assemble';
import type { Activity, Quote } from './types';

const now = Date.parse('2026-06-01T15:00:00.000Z');
const fresh = '2026-06-01T14:00:00.000Z';
const old = '2026-05-01T14:00:00.000Z';

function quote(partial: Partial<Quote> & Pick<Quote, 'price'>): Quote {
  return {
    symbol: 'VTI',
    previousClose: null,
    fetchedAt: fresh,
    source: 'finnhub',
    ...partial,
  };
}

describe('price resolution', () => {
  it('lets a live quote beat manual and opening prices', () => {
    const resolved = resolvePrice({
      assetType: 'stock_etf',
      mode: 'live',
      live: quote({ price: 150, previousClose: 148 }),
      manual: quote({ price: 999, source: 'manual' }),
      lastKnown: 100,
      now,
    });
    expect(resolved.price).toBe(150);
    expect(resolved.source).toBe('live');
    expect(resolved.fallback).toBe(false);
  });

  it('keeps using a stale live quote and flags it', () => {
    const resolved = resolvePrice({
      assetType: 'stock_etf',
      mode: 'live',
      live: quote({ price: 150, fetchedAt: old }),
      manual: quote({ price: 140, source: 'manual' }),
      lastKnown: 100,
      now,
    });
    expect(resolved.price).toBe(150);
    expect(resolved.stale).toBe(true);
  });

  it('uses an explicit manual price only when there is no live quote', () => {
    const resolved = resolvePrice({
      assetType: 'option',
      mode: 'live',
      live: quote({ price: 9 }),
      manual: quote({ price: 1.25, source: 'manual' }),
      lastKnown: 2,
      now,
    });
    expect(resolved.source).toBe('manual');
    expect(resolved.price).toBe(1.25);
  });

  it('falls back to the last trade and never substitutes zero', () => {
    const fallback = resolvePrice({
      assetType: 'stock_etf',
      mode: 'live',
      lastKnown: 100,
      now,
    });
    expect(fallback.price).toBe(100);
    expect(fallback.source).toBe('last_known');
    expect(fallback.fallback).toBe(true);

    const missing = resolvePrice({ assetType: 'stock_etf', mode: 'live', now });
    expect(missing.price).toBeNull();
    expect(missing.missing).toBe(true);
  });

  it('applies what-if prices only in what-if mode', () => {
    expect(
      resolvePrice({ assetType: 'stock_etf', mode: 'what_if', whatIf: 180, live: quote({ price: 150 }), now }).price,
    ).toBe(180);
    expect(
      resolvePrice({ assetType: 'stock_etf', mode: 'live', whatIf: 180, live: quote({ price: 150 }), now }).price,
    ).toBe(150);
  });

  it('values a holding from the live price, not the opening price', () => {
    const activity: Activity = {
      id: '1',
      accountId: 'A',
      transferAccountId: null,
      date: '2024-01-01',
      action: 'opening_position',
      assetType: 'stock_etf',
      symbol: 'VTI',
      quantity: 10,
      price: 100,
      fees: 0,
      amount: 1000,
      multiplier: 1,
      ratio: null,
      deltaQuantity: null,
      deltaCostBasis: null,
      deltaCash: null,
      underlying: null,
      expiry: null,
      strike: null,
      optionRight: null,
      note: null,
      createdAt: null,
    };
    const position = processLedger([activity], ['A']).accounts.A.positions[0];
    const live = resolvePrice({
      assetType: 'stock_etf',
      mode: 'live',
      live: quote({ price: 150, previousClose: 148 }),
      lastKnown: position.lastTradePrice,
      now,
    });
    const valued = valuePosition(position, live);
    expect(valued.marketValue).toBeCloseTo(1500);
    expect(valued.unrealized).toBeCloseTo(500);
    expect(valued.dayChange).toBeCloseTo(20);

    const books = assembleBooks({
      portfolios: [{ id: 'P', name: 'Own', includeInNetWorth: true, sortOrder: 0 }],
      accounts: [{ id: 'A', portfolioId: 'P', name: 'Brokerage', accountType: 'brokerage', taxTreatment: 'taxable', sortOrder: 0 }],
      activities: [activity],
      quotes: [],
      whatIfs: [],
      mode: 'live',
      liabilities: [],
      checkingAccounts: [],
      checkingTxns: [],
      recurring: [],
      occurrences: [],
      today: '2026-06-01',
      nowMs: now,
    });
    const holding = books.accounts[0].holdings[0];
    expect(holding.price).toBe(100);
    expect(holding.fallback).toBe(true);
    expect(holding.marketValue).toBeCloseTo(1000);
    expect(holding.avgCostLabel).toMatch(/not tax lot basis/);
    expect(books.warnings.some((warning) => warning.id.startsWith('fallback'))).toBe(true);
  });

  it('leaves market value empty when no price exists', () => {
    const activity: Activity = {
      id: '1',
      accountId: 'A',
      transferAccountId: null,
      date: '2024-01-01',
      action: 'opening_position',
      assetType: 'crypto',
      symbol: 'BTC',
      quantity: 2,
      price: null,
      fees: 0,
      amount: 80_000,
      multiplier: 1,
      ratio: null,
      deltaQuantity: null,
      deltaCostBasis: null,
      deltaCash: null,
      underlying: null,
      expiry: null,
      strike: null,
      optionRight: null,
      note: null,
      createdAt: null,
    };
    const books = assembleBooks({
      portfolios: [{ id: 'P', name: 'Own', includeInNetWorth: true, sortOrder: 0 }],
      accounts: [{ id: 'A', portfolioId: 'P', name: 'Crypto', accountType: 'crypto', taxTreatment: 'taxable', sortOrder: 0 }],
      activities: [activity],
      quotes: [],
      whatIfs: [],
      mode: 'live',
      liabilities: [],
      checkingAccounts: [],
      checkingTxns: [],
      recurring: [],
      occurrences: [],
      today: '2026-06-01',
    });
    expect(books.accounts[0].holdings[0].marketValue).toBeNull();
    expect(books.accounts[0].total).toBeNull();
    expect(books.invested).toBe(0);
    expect(books.investedPartial).toBe(true);
  });
});
