import { describe, expect, it } from 'vitest';
import { contractLabel } from './labels';

describe('contract labels', () => {
  it('turns an OCC symbol into a short option label', () => {
    expect(contractLabel({ symbol: 'AAPL261218C00200000' })).toBe("AAPL Dec 18 '26 $200 C");
  });

  it('prefers stored option terms over the raw symbol', () => {
    expect(
      contractLabel({
        symbol: 'AAPL261218C00200000',
        underlying: 'AAPL',
        expiry: '2026-12-18',
        strike: 200,
        optionRight: 'C',
      }),
    ).toBe("AAPL Dec 18 '26 $200 C");
  });

  it('leaves stock tickers unchanged', () => {
    expect(contractLabel({ symbol: 'VTI' })).toBe('VTI');
  });

  it('formats a fractional put strike', () => {
    expect(contractLabel({ symbol: 'XYZ260117P00045500' })).toBe("XYZ Jan 17 '26 $45.50 P");
  });
});
