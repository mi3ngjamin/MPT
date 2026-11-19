import { describe, expect, it } from 'vitest';
import { createId } from './ids';
import { readFileSync } from 'node:fs';
import { parseAmount } from './parse';

describe('amount parsing', () => {
  it('removes every comma and currency symbol', () => {
    expect(parseAmount('1,234.56')).toBe(1234.56);
    expect(parseAmount('1,234,567.89')).toBe(1234567.89);
    expect(parseAmount('$1,234,567.89')).toBe(1234567.89);
    expect(parseAmount('(1,234.50)')).toBe(-1234.5);
    expect(parseAmount('  -12.50 ')).toBe(-12.5);
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
  });
});

describe('ids', () => {
  it('uses random UUIDs', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => createId()));
    expect(ids.size).toBe(1000);
    expect([...ids][0]).toMatch(/^[0-9a-f-]{36}$/);
    const source = readFileSync(new URL('./ids.ts', import.meta.url), 'utf8');
    expect(source.includes('Date.now')).toBe(false);
  });
});
