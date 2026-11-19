import type { Quote } from './types';

export interface FinnhubResult {
  quotes: Quote[];
  missing: string[];
  unsupported: string[];
  stopped: null | 'unauthorized' | 'rate_limit';
}

export interface SymbolHttpResult {
  status: number;
  body?: { c?: number; pc?: number };
}

/**
 * One symbol at a time within each small batch. A 401 or 429 stops later batches.
 * Any other failure, including 403 and c <= 0, is recorded and the batch continues.
 */
export async function collectQuotes(
  symbols: string[],
  fetchQuote: (symbol: string) => Promise<SymbolHttpResult>,
  options?: { onQuote?: (quote: Quote) => void | Promise<void>; now?: () => string },
): Promise<FinnhubResult> {
  const unique = [...new Set(symbols.map((symbol) => symbol.toUpperCase()))];
  const quotes: Quote[] = [];
  const missing: string[] = [];
  const unsupported: string[] = [];
  const now = options?.now ?? (() => new Date().toISOString());

  for (let index = 0; index < unique.length; index += 4) {
    const batch = unique.slice(index, index + 4);
    const results = await Promise.all(
      batch.map(async (symbol) => {
        try {
          return { symbol, result: await fetchQuote(symbol) };
        } catch {
          return { symbol, result: { status: 0 } satisfies SymbolHttpResult };
        }
      }),
    );
    let stopped: FinnhubResult['stopped'] = null;
    for (const { symbol, result } of results) {
      if (result.status === 401) {
        stopped = 'unauthorized';
        continue;
      }
      if (result.status === 429) {
        stopped = 'rate_limit';
        continue;
      }
      if (result.status === 403) {
        unsupported.push(symbol);
        missing.push(symbol);
        continue;
      }
      const price = result.body?.c;
      if (result.status !== 200 || typeof price !== 'number' || price <= 0) {
        missing.push(symbol);
        continue;
      }
      const previous = result.body?.pc;
      const quote: Quote = {
        symbol,
        price,
        previousClose: typeof previous === 'number' && previous > 0 ? previous : null,
        source: 'finnhub',
        fetchedAt: now(),
      };
      quotes.push(quote);
      await options?.onQuote?.(quote);
    }
    if (stopped) return { quotes, missing, unsupported, stopped };
  }

  return { quotes, missing, unsupported, stopped: null };
}
