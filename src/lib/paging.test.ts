import { describe, expect, it } from 'vitest';
import { collectPages } from './paging';

describe('collectPages', () => {
  it('walks past the 1000-row PostgREST cap', async () => {
    const rows = Array.from({ length: 2300 }, (_, index) => index);
    const calls: Array<[number, number]> = [];
    const fetched = await collectPages(async (from, to) => {
      calls.push([from, to]);
      return rows.slice(from, to + 1);
    }, 1000);
    expect(fetched).toEqual(rows);
    expect(calls).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
    expect(fetched).toHaveLength(2300);
  });
});
