import { describe, expect, it } from 'vitest';
import { hasLegacyData, planLegacyImport } from './legacy';

describe('legacy localStorage import', () => {
  it('maps trades, signed transactions, the saved starting balance, and monthly items', () => {
    const plan = planLegacyImport(
      {
        investments: JSON.stringify([
          { account: 'PCRA (SCHWAB)', ticker: 'vti', shares: 10, price: 250, date: '2024-01-15', transactionType: 'BUY' },
          { account: 'PCRA (SCHWAB)', ticker: 'VTI', shares: 2, price: 260, date: '2024-02-01', transactionType: 'SELL' },
        ]),
        transactions: JSON.stringify([
          { date: '2024-01-15', category: 'Food', description: 'Market', amount: '1,234.50', type: 'expense' },
        ]),
        categories: JSON.stringify(['Food']),
        livePrices: JSON.stringify({ vti: 295.4 }),
        budgetItems: JSON.stringify([{ description: 'Rent', category: 'Home', amount: -1800, day: 31 }]),
        startingBalance: '2500',
      },
      '2026-01-01',
    );
    expect(plan).not.toBeNull();
    expect(plan!.activities).toHaveLength(2);
    expect(plan!.activities[0]).toMatchObject({ date: '2024-01-15', action: 'buy', symbol: 'VTI', price: 250 });
    expect(plan!.activities[1].action).toBe('sell');
    expect(plan!.openingBalance).toBe(2500);
    expect(plan!.transactions[0].amount).toBe(-1234.5);
    expect(plan!.bills[0]).toMatchObject({ name: 'Rent', amount: 1800, dayOfMonth: 31, kind: 'bill' });
    expect(plan!.quotes[0]).toEqual({ symbol: 'VTI', price: 295.4 });
  });

  it('ignores empty storage', () => {
    expect(hasLegacyData({})).toBe(false);
    expect(planLegacyImport({}, '2026-01-01')).toBeNull();
  });
});
