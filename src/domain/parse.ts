/**
 * Parse a money string. Every comma is removed (not just the first).
 * Parentheses and a leading minus are negative. Returns null when empty or not a number.
 */
export function parseAmount(input: string | number | null | undefined): number | null {
  if (typeof input === 'number') return Number.isFinite(input) ? input : null;
  if (input == null) return null;
  const raw = String(input).trim();
  if (!raw) return null;
  const negative = /^\(.*\)$/.test(raw) || raw.startsWith('-');
  const cleaned = raw.replace(/[()$£€,\s]/g, '').replace(/^\+/, '').replace(/^-/, '');
  if (!cleaned || !/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  return negative ? -value : value;
}
