import Papa from 'papaparse';
import { normalizeDate } from './dates';
import { parseAmount } from './parse';

export interface ParsedCsvTxn {
  date: string;
  category: string;
  description: string;
  amount: number;
}

export interface CsvParseResult {
  rows: ParsedCsvTxn[];
  errors: string[];
}

/**
 * Header-aware CSV import. Every data row is kept — the header is not a data row,
 * so nothing slices off the first transaction.
 */
export function parseTransactionCsv(text: string): CsvParseResult {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (header) => header.trim().toLowerCase(),
  });
  const errors: string[] = [];
  if (parsed.errors.length) {
    for (const error of parsed.errors) {
      if (error.message) errors.push(error.message);
    }
  }
  const rows: ParsedCsvTxn[] = [];
  parsed.data.forEach((row, index) => {
    const date = normalizeDate(row.date ?? row.transactiondate ?? '');
    const amount = parseAmount(row.amount ?? '');
    if (!date || amount == null) {
      const empty = Object.values(row).every((value) => !String(value ?? '').trim());
      if (!empty) errors.push(`Row ${index + 1} is missing a date or amount.`);
      return;
    }
    rows.push({
      date,
      category: (row.category || 'Uncategorized').trim() || 'Uncategorized',
      description: (row.description || 'Imported').trim() || 'Imported',
      amount,
    });
  });
  return { rows, errors };
}
