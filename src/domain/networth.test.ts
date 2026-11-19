import { describe, expect, it } from 'vitest';
import { computeNetWorth } from './networth';

describe('net worth', () => {
  it('subtracts included liabilities and labels unresolved ones out', () => {
    const result = computeNetWorth({
      invested: 50_000,
      portfolioCash: 5_000,
      brokerageCash: 4_000,
      checking: 8_000,
      liabilities: [
        { balance: 8600, includeInNetWorth: true, unresolved: false },
        { balance: 4200, includeInNetWorth: true, unresolved: true },
        { balance: 100, includeInNetWorth: false, unresolved: false },
      ],
    });
    expect(result.assets).toBe(63_000);
    expect(result.liabilitiesApplied).toBe(8600);
    expect(result.unresolvedLiabilities).toBe(4200);
    expect(result.netWorth).toBe(54_400);
    expect(result.label).toBe('Net worth before unresolved taxes/liabilities');
  });

  it('uses a plain label when every liability is resolved', () => {
    const result = computeNetWorth({
      invested: 10,
      portfolioCash: 0,
      brokerageCash: 0,
      checking: 0,
      liabilities: [{ balance: 4, includeInNetWorth: true, unresolved: false }],
    });
    expect(result.netWorth).toBe(6);
    expect(result.label).toBe('Net worth');
  });
});
