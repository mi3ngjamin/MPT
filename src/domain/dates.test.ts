import { describe, expect, it } from 'vitest';
import { addDays, formatLocalDate, normalizeDate, parseLocalDate } from './dates';

describe('local dates', () => {
  it('keeps a YYYY-MM-DD on that calendar day', () => {
    const date = parseLocalDate('2024-01-15');
    expect(date.getFullYear()).toBe(2024);
    expect(date.getMonth()).toBe(0);
    expect(date.getDate()).toBe(15);
    expect(date.getHours()).toBe(0);
    expect(formatLocalDate(date)).toBe('2024-01-15');
    if (new Date('2024-01-15').getTimezoneOffset() > 0) {
      expect(new Date('2024-01-15').getDate()).not.toBe(15);
    }
  });

  it('normalizes ISO and slash dates without shifting the day', () => {
    expect(normalizeDate('2024-03-02')).toBe('2024-03-02');
    expect(normalizeDate('2024-03-02T15:00:00.000Z')).toBe('2024-03-02');
    expect(normalizeDate('3/2/2024')).toBe('2024-03-02');
    expect(normalizeDate('nope')).toBeNull();
  });

  it('adds calendar days', () => {
    expect(addDays('2024-01-31', 1)).toBe('2024-02-01');
    expect(addDays('2024-03-10', 1)).toBe('2024-03-11');
  });
});
