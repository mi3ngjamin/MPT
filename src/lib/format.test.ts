import { describe, expect, it } from 'vitest';
import { money, moneyTight } from './format';

describe('tight money', () => {
  it('keeps smaller balances in full currency', () => {
    expect(moneyTight(70170.17)).toBe(money(70170.17));
  });

  it('compacts millions so a phone card can hold them', () => {
    expect(moneyTight(2_310_000)).toBe('$2.31M');
    expect(moneyTight(1_700_000)).toBe('$1.70M');
    expect(moneyTight(-2_310_000, true)).toBe('−$2.31M');
    expect(moneyTight(2_310_000, true)).toBe('+$2.31M');
  });
});
