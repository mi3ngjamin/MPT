import { describe, expect, it } from 'vitest';
import { collectQuotes, type SymbolHttpResult } from './finnhub';

describe('Finnhub batches', () => {
  it('keeps going when one symbol in the batch is 403', async () => {
    const seen: string[] = [];
    const saved: string[] = [];
    const result = await collectQuotes(
      ['AAPL', 'SWTSX', 'MSFT', 'VBTIX', 'TGDIX'],
      async (symbol): Promise<SymbolHttpResult> => {
        seen.push(symbol);
        if (symbol === 'SWTSX' || symbol === 'VBTIX') return { status: 403 };
        if (symbol === 'TGDIX') return { status: 200, body: { c: 0 } };
        if (symbol === 'MSFT') return { status: 200, body: { c: 400, pc: 390 } };
        return { status: 200, body: { c: 100, pc: 99 } };
      },
      { onQuote: (quote) => { saved.push(quote.symbol); } },
    );

    expect(seen).toEqual(['AAPL', 'SWTSX', 'MSFT', 'VBTIX', 'TGDIX']);
    expect(saved).toEqual(['AAPL', 'MSFT']);
    expect(result.quotes.map((quote) => quote.symbol)).toEqual(['AAPL', 'MSFT']);
    expect(result.quotes.find((quote) => quote.symbol === 'MSFT')?.previousClose).toBe(390);
    expect(result.unsupported).toEqual(['SWTSX', 'VBTIX']);
    expect(result.missing).toEqual(['SWTSX', 'VBTIX', 'TGDIX']);
    expect(result.stopped).toBeNull();
  });

  it('stops later batches on 429 and keeps quotes already collected', async () => {
    const seen: string[] = [];
    const result = await collectQuotes(['AAPL', 'MSFT', 'NVDA', 'AMZN', 'META'], async (symbol) => {
      seen.push(symbol);
      if (symbol === 'NVDA') return { status: 429 };
      return { status: 200, body: { c: 10 } };
    });
    expect(seen).toEqual(['AAPL', 'MSFT', 'NVDA', 'AMZN']);
    expect(result.stopped).toBe('rate_limit');
    expect(result.quotes.map((quote) => quote.symbol)).toEqual(['AAPL', 'MSFT', 'AMZN']);
  });

  it('treats a network error as missing and continues', async () => {
    const result = await collectQuotes(['AAPL', 'BROKEN'], async (symbol) => {
      if (symbol === 'BROKEN') throw new Error('offline');
      return { status: 200, body: { c: 12 } };
    });
    expect(result.quotes.map((quote) => quote.symbol)).toEqual(['AAPL']);
    expect(result.missing).toEqual(['BROKEN']);
    expect(result.stopped).toBeNull();
  });
});
