import { describe, expect, it } from 'vitest';
import { occurrencesInRange, projectAccount } from './recurrence';
import type { CheckingAccount, RecurringItem } from './types';

function item(partial: Partial<RecurringItem>): RecurringItem {
  return {
    id: 'rent',
    accountId: 'chk',
    name: 'Rent',
    kind: 'bill',
    amount: 800,
    cadence: 'monthly',
    dayOfMonth: 5,
    intervalWeeks: null,
    anchorDate: null,
    monthOfYear: null,
    autopay: true,
    active: true,
    category: 'Home',
    ...partial,
  };
}

const account: CheckingAccount = {
  id: 'chk',
  name: 'Operating',
  openingBalance: 1000,
  openingDate: '2024-01-01',
  lowBalanceFloor: 100,
  sortOrder: 0,
};

describe('recurrence', () => {
  it('clamps monthly day 31 and steps weekly, yearly, and one-time dates', () => {
    expect(occurrencesInRange(item({ dayOfMonth: 31 }), '2025-01-01', '2025-03-31')).toEqual([
      '2025-01-31',
      '2025-02-28',
      '2025-03-31',
    ]);
    expect(
      occurrencesInRange(item({ cadence: 'yearly', monthOfYear: 2, dayOfMonth: 31 }), '2024-01-01', '2024-12-31'),
    ).toEqual(['2024-02-29']);
    expect(
      occurrencesInRange(
        item({ cadence: 'weekly', intervalWeeks: 2, anchorDate: '2024-01-01', dayOfMonth: null }),
        '2024-01-01',
        '2024-02-01',
      ),
    ).toEqual(['2024-01-01', '2024-01-15', '2024-01-29']);
    expect(
      occurrencesInRange(item({ cadence: 'once', anchorDate: '2024-04-02', dayOfMonth: null }), '2024-04-01', '2024-04-30'),
    ).toEqual(['2024-04-02']);
    expect(occurrencesInRange(item({ active: false }), '2025-01-01', '2025-02-01')).toEqual([]);
  });

  it('warns when a projection crosses the floor or cannot cover autopay', () => {
    const low = projectAccount({
      account: { ...account, lowBalanceFloor: 500 },
      txns: [],
      items: [item({})],
      marks: [],
      today: '2024-06-01',
      days: 10,
    });
    expect(low.points.find((point) => point.date === '2024-06-05')?.balance).toBeCloseTo(200);
    expect(low.warnings.some((warning) => warning.code === 'below_floor')).toBe(true);

    const shortfall = projectAccount({
      account,
      txns: [],
      items: [item({ amount: 1200 })],
      marks: [],
      today: '2024-06-01',
      days: 10,
    });
    expect(shortfall.warnings.some((warning) => warning.code === 'autopay_shortfall')).toBe(true);
    expect(shortfall.warnings.some((warning) => warning.code === 'below_zero')).toBe(true);
  });

  it('does not count a paid occurrence twice and warns before a later autopay', () => {
    const paid = projectAccount({
      account,
      txns: [
        {
          id: 't',
          accountId: 'chk',
          date: '2024-06-05',
          description: 'Rent',
          amount: -800,
          category: 'Home',
          cleared: true,
          recurringItemId: 'rent',
          createdAt: '2024-06-05T00:00:00.000Z',
        },
      ],
      items: [item({})],
      marks: [{ recurringItemId: 'rent', occurrenceDate: '2024-06-05', status: 'paid' }],
      today: '2024-06-01',
      days: 10,
    });
    expect(paid.points.find((point) => point.date === '2024-06-05')?.balance).toBeCloseTo(200);

    const early = projectAccount({
      account: { ...account, openingBalance: 100, lowBalanceFloor: null },
      txns: [
        {
          id: 't2',
          accountId: 'chk',
          date: '2024-06-03',
          description: 'Transfer',
          amount: -150,
          category: 'Transfer',
          cleared: true,
          recurringItemId: null,
          createdAt: null,
        },
      ],
      items: [item({ amount: 50, dayOfMonth: 5 })],
      marks: [],
      today: '2024-06-01',
      days: 10,
    });
    expect(early.warnings.some((warning) => warning.message.includes('before autopay'))).toBe(true);
  });
});
