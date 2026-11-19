import { normalizeDate } from './dates';
import { parseAmount } from './parse';
import type { Activity, AssetType } from './types';

export interface LegacyStorage {
  transactions?: string | null;
  categories?: string | null;
  investments?: string | null;
  livePrices?: string | null;
  budgetItems?: string | null;
  startingBalance?: string | null;
}

export interface LegacyActivityDraft {
  accountName: string;
  date: string;
  action: 'buy' | 'sell';
  symbol: string;
  quantity: number;
  price: number;
  assetType: AssetType;
}

export interface LegacyTxnDraft {
  date: string;
  description: string;
  amount: number;
  category: string;
  cleared: boolean;
}

export interface LegacyBillDraft {
  name: string;
  amount: number;
  dayOfMonth: number;
  kind: 'bill' | 'income';
  category: string;
}

export interface LegacyQuoteDraft {
  symbol: string;
  price: number;
}

export interface LegacyPlan {
  portfolioName: string;
  accounts: string[];
  activities: LegacyActivityDraft[];
  checkingName: string;
  openingBalance: number;
  openingDate: string;
  transactions: LegacyTxnDraft[];
  bills: LegacyBillDraft[];
  quotes: LegacyQuoteDraft[];
}

const KEYS = ['transactions', 'categories', 'investments', 'livePrices', 'budgetItems'] as const;

export function hasLegacyData(storage: LegacyStorage): boolean {
  return KEYS.some((key) => {
    const value = storage[key];
    if (!value) return false;
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) return parsed.length > 0;
      if (parsed && typeof parsed === 'object') return Object.keys(parsed).length > 0;
      return true;
    } catch {
      return true;
    }
  }) || (storage.startingBalance != null && storage.startingBalance !== '' && storage.startingBalance !== '0');
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function signedTransaction(row: Record<string, unknown>): number | null {
  const raw = parseAmount(row.amount as string | number | null);
  if (raw == null) return null;
  const type = String(row.type ?? '').toLowerCase();
  if (type === 'income') return Math.abs(raw);
  if (type === 'expense') return -Math.abs(raw);
  return raw;
}

export function planLegacyImport(storage: LegacyStorage, today: string): LegacyPlan | null {
  if (!hasLegacyData(storage)) return null;
  const investments = parseArray(storage.investments);
  const transactions = parseArray(storage.transactions);
  const budgets = parseArray(storage.budgetItems);
  const prices = parseObject(storage.livePrices);

  const activities: LegacyActivityDraft[] = [];
  for (const item of investments) {
    const row = asRecord(item);
    if (!row) continue;
    const date = normalizeDate(String(row.date ?? ''));
    const symbol = String(row.ticker ?? row.symbol ?? '').trim().toUpperCase();
    const quantity = Number(row.shares ?? row.quantity);
    const price = Number(row.price);
    const kind = String(row.transactionType ?? row.action ?? 'BUY').toUpperCase();
    if (!date || !symbol || !Number.isFinite(quantity) || !Number.isFinite(price)) continue;
    activities.push({
      accountName: String(row.account ?? 'Imported').trim() || 'Imported',
      date,
      action: kind === 'SELL' ? 'sell' : 'buy',
      symbol,
      quantity: Math.abs(quantity),
      price: Math.abs(price),
      assetType: 'stock_etf',
    });
  }

  const txns: LegacyTxnDraft[] = [];
  for (const item of transactions) {
    const row = asRecord(item);
    if (!row) continue;
    const date = normalizeDate(String(row.date ?? ''));
    const amount = signedTransaction(row);
    if (!date || amount == null) continue;
    txns.push({
      date,
      description: String(row.description ?? 'Imported'),
      amount,
      category: String(row.category ?? 'Uncategorized') || 'Uncategorized',
      cleared: Boolean(row.isArchived || row.cleared),
    });
  }

  const bills: LegacyBillDraft[] = [];
  for (const item of budgets) {
    const row = asRecord(item);
    if (!row) continue;
    const amount = parseAmount(row.amount as string | number | null);
    const day = Number(row.day);
    if (amount == null || !Number.isFinite(day)) continue;
    bills.push({
      name: String(row.description ?? row.category ?? 'Recurring'),
      amount: Math.abs(amount),
      dayOfMonth: Math.min(31, Math.max(1, Math.round(day))),
      kind: amount < 0 ? 'bill' : 'income',
      category: String(row.category ?? 'Uncategorized'),
    });
  }

  const quotes: LegacyQuoteDraft[] = [];
  for (const [symbol, price] of Object.entries(prices)) {
    const value = Number(price);
    if (symbol && Number.isFinite(value) && value > 0) {
      quotes.push({ symbol: symbol.toUpperCase(), price: value });
    }
  }

  const dates = [...activities.map((row) => row.date), ...txns.map((row) => row.date)].sort();
  const opening = parseAmount(storage.startingBalance);
  const accounts = [...new Set(activities.map((row) => row.accountName))];

  return {
    portfolioName: 'Imported',
    accounts,
    activities,
    checkingName: 'Checking',
    openingBalance: opening ?? 0,
    openingDate: dates[0] ?? today,
    transactions: txns,
    bills,
    quotes,
  };
}

export function legacyActivitiesToRows(plan: LegacyPlan, accountIds: Record<string, string>): Activity[] {
  return plan.activities.map((row) => ({
    id: crypto.randomUUID(),
    accountId: accountIds[row.accountName],
    transferAccountId: null,
    date: row.date,
    action: row.action,
    assetType: row.assetType,
    symbol: row.symbol,
    quantity: row.quantity,
    price: row.price,
    fees: 0,
    amount: null,
    multiplier: 1,
    ratio: null,
    deltaQuantity: null,
    deltaCostBasis: null,
    deltaCash: null,
    underlying: null,
    expiry: null,
    strike: null,
    optionRight: null,
    note: 'Imported from this browser',
    createdAt: null,
  }));
}

function parseArray(raw: string | null | undefined): unknown[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw) as unknown;
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function parseObject(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const value = JSON.parse(raw) as unknown;
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
