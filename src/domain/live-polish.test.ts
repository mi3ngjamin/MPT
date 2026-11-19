import { describe, expect, it } from 'vitest';
import { assembleBooks } from './assemble';
import type { Activity } from './types';

function activity(partial: Partial<Activity> & Pick<Activity, 'id' | 'accountId' | 'action' | 'date'>): Activity {
  return {
    transferAccountId: null,
    assetType: 'stock_etf',
    symbol: null,
    quantity: null,
    price: null,
    fees: 0,
    amount: null,
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
    ...partial,
  };
}

describe('live-data polish', () => {
  it('rolls brokerage, bank, and checking cash into one total', () => {
    const books = assembleBooks({
      portfolios: [{ id: 'p', name: 'Mine', includeInNetWorth: true, sortOrder: 0 }],
      accounts: [
        { id: 'brok', portfolioId: 'p', name: 'Brokerage', accountType: 'brokerage', taxTreatment: 'taxable', sortOrder: 0 },
        { id: 'bank', portfolioId: 'p', name: 'Savings', accountType: 'other', taxTreatment: 'taxable', sortOrder: 1 },
      ],
      activities: [
        activity({ id: '1', accountId: 'brok', date: '2024-01-01', action: 'opening_cash', assetType: 'cash', amount: 0.75 }),
        activity({ id: '2', accountId: 'bank', date: '2024-01-01', action: 'opening_cash', assetType: 'cash', amount: 234000 }),
      ],
      quotes: [],
      whatIfs: [],
      mode: 'live',
      liabilities: [],
      checkingAccounts: [
        { id: 'chk', name: 'Operating', openingBalance: 1000, openingDate: '2024-01-01', lowBalanceFloor: null, sortOrder: 0 },
      ],
      checkingTxns: [],
      recurring: [],
      occurrences: [],
      today: '2026-11-19',
    });
    expect(books.brokerageCash).toBeCloseTo(0.75);
    expect(books.otherCash).toBeCloseTo(234000);
    expect(books.liquidCash).toBeCloseTo(235000.75);
    expect(books.accounts.map((account) => account.account.name).sort()).toEqual(['Brokerage', 'Savings']);
  });

  it('counts IRA and Roth cash with investment accounts, not only brokerage', () => {
    const books = assembleBooks({
      portfolios: [
        { id: 'p', name: 'Mine', includeInNetWorth: true, sortOrder: 0 },
        { id: 'family', name: 'Family', includeInNetWorth: false, sortOrder: 1 },
      ],
      accounts: [
        { id: 'brok', portfolioId: 'p', name: 'Brokerage', accountType: 'brokerage', taxTreatment: 'taxable', sortOrder: 0 },
        { id: 'ira', portfolioId: 'p', name: 'Traditional IRA', accountType: 'retirement', taxTreatment: 'tax_deferred', sortOrder: 1 },
        { id: 'roth', portfolioId: 'p', name: 'Roth IRA', accountType: 'retirement', taxTreatment: 'tax_free', sortOrder: 2 },
        { id: 'bank', portfolioId: 'p', name: 'Savings', accountType: 'other', taxTreatment: 'taxable', sortOrder: 3 },
        { id: 'fam', portfolioId: 'family', name: 'Family IRA', accountType: 'retirement', taxTreatment: 'tax_deferred', sortOrder: 0 },
      ],
      activities: [
        activity({ id: '1', accountId: 'brok', date: '2024-01-01', action: 'opening_cash', assetType: 'cash', amount: 0.75 }),
        activity({ id: '2', accountId: 'ira', date: '2024-01-01', action: 'opening_cash', assetType: 'cash', amount: 224000 }),
        activity({ id: '3', accountId: 'roth', date: '2024-01-01', action: 'opening_cash', assetType: 'cash', amount: 1500 }),
        activity({ id: '4', accountId: 'bank', date: '2024-01-01', action: 'opening_cash', assetType: 'cash', amount: 234000 }),
        activity({ id: '5', accountId: 'fam', date: '2024-01-01', action: 'opening_cash', assetType: 'cash', amount: 99999 }),
      ],
      quotes: [],
      whatIfs: [],
      mode: 'live',
      liabilities: [],
      checkingAccounts: [],
      checkingTxns: [],
      recurring: [],
      occurrences: [],
      today: '2026-11-19',
    });
    expect(books.portfolioCash).toBeCloseTo(0.75 + 224000 + 1500 + 234000);
    expect(books.brokerageCash).toBeCloseTo(books.portfolioCash - books.otherCash);
    expect(books.brokerageCash).toBeCloseTo(225500.75);
    expect(books.otherCash).toBeCloseTo(234000);
    expect(books.accounts.map((account) => account.account.name)).toEqual(
      expect.arrayContaining(['Traditional IRA', 'Roth IRA', 'Family IRA']),
    );
  });

  it('collapses repeated last-known prices and keeps bill warnings first', () => {
    const books = assembleBooks({
      portfolios: [{ id: 'p', name: 'Mine', includeInNetWorth: true, sortOrder: 0 }],
      accounts: [
        { id: 'a', portfolioId: 'p', name: 'A', accountType: 'brokerage', taxTreatment: 'taxable', sortOrder: 0 },
        { id: 'b', portfolioId: 'p', name: 'B', accountType: 'brokerage', taxTreatment: 'taxable', sortOrder: 1 },
      ],
      activities: [
        activity({ id: '1', accountId: 'a', date: '2024-01-01', action: 'opening_position', symbol: 'VTI', quantity: 1, amount: 10, price: 10 }),
        activity({ id: '2', accountId: 'b', date: '2024-01-01', action: 'opening_position', symbol: 'VTI', quantity: 1, amount: 10, price: 10 }),
        activity({ id: '3', accountId: 'a', date: '2024-01-02', action: 'opening_position', symbol: 'AAPL', quantity: 1, amount: 5, price: 5 }),
      ],
      quotes: [],
      whatIfs: [],
      mode: 'live',
      liabilities: [{ id: 'tax', name: 'Estimated tax', liabilityType: 'tax', balance: 100, asOf: '2026-01-01', includeInNetWorth: true, unresolved: true, note: null }],
      checkingAccounts: [
        { id: 'chk', name: 'Operating', openingBalance: 100, openingDate: '2024-01-01', lowBalanceFloor: 500, sortOrder: 0 },
      ],
      checkingTxns: [],
      recurring: [],
      occurrences: [],
      today: '2026-11-19',
    });
    const lastKnown = books.warnings.find((warning) => warning.id === 'last-known-prices');
    expect(lastKnown?.message).toBe('3 holdings are using last-known prices');
    expect(lastKnown?.symbols).toEqual(['AAPL', 'VTI']);
    expect(books.warnings.some((warning) => warning.id === 'unresolved')).toBe(false);
    expect(books.warnings[0]?.id).toBe('checking-floor-chk');
    expect(books.warnings[0]?.rank).toBeLessThan(lastKnown?.rank ?? 0);
  });
});
