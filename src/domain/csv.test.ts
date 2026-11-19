import { describe, expect, it } from 'vitest';
import { parseTransactionCsv } from './csv';

describe('csv import', () => {
  it('keeps the first data row and parses every comma', () => {
    const csv = [
      'Date,Category,Description,Amount,Balance',
      '2024-01-02,Groceries,Market,"1,234.50",100',
      '2024-01-03,Pay,Payroll,"2,000.00",2100',
    ].join('\n');
    const result = parseTransactionCsv(csv);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({
      date: '2024-01-02',
      category: 'Groceries',
      description: 'Market',
      amount: 1234.5,
    });
    expect(result.rows[1].amount).toBe(2000);
  });
});
