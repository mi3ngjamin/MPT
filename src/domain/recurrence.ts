import type { CheckingAccount, CheckingTxn, RecurringItem } from './types';
import { addDays, clampDay, daysBetween, monthOf, startOfMonth, yearOf } from './dates';
import { r8 } from './round';

export interface PaidMark {
  recurringItemId: string;
  occurrenceDate: string;
  status: 'paid' | 'skipped';
}

export interface OccurrenceView {
  itemId: string;
  name: string;
  date: string;
  amount: number;
  signedAmount: number;
  kind: RecurringItem['kind'];
  autopay: boolean;
  paid: boolean;
  skipped: boolean;
  category: string;
  accountId: string;
}

export interface ProjectionPoint {
  date: string;
  balance: number;
}

export interface ProjectionWarning {
  code: 'below_zero' | 'below_floor' | 'autopay_shortfall';
  date: string;
  message: string;
}

export interface Projection {
  points: ProjectionPoint[];
  minBalance: number;
  minDate: string;
  warnings: ProjectionWarning[];
  occurrences: OccurrenceView[];
}

export function occurrencesInRange(item: RecurringItem, start: string, end: string): string[] {
  if (!item.active || start > end) return [];
  if (item.cadence === 'once') {
    return item.anchorDate && item.anchorDate >= start && item.anchorDate <= end ? [item.anchorDate] : [];
  }
  if (item.cadence === 'weekly') {
    if (!item.anchorDate || !(item.intervalWeeks && item.intervalWeeks > 0)) return [];
    const step = item.intervalWeeks * 7;
    let cursor = item.anchorDate;
    if (cursor < start) {
      const jumps = Math.floor(daysBetween(item.anchorDate, start) / step);
      cursor = addDays(item.anchorDate, jumps * step);
      if (cursor < start) cursor = addDays(cursor, step);
    }
    const dates: string[] = [];
    while (cursor <= end) {
      if (cursor >= start) dates.push(cursor);
      cursor = addDays(cursor, step);
    }
    return dates;
  }
  if (item.cadence === 'monthly') {
    const day = item.dayOfMonth ?? 1;
    const dates: string[] = [];
    let cursor = startOfMonth(start);
    const lastMonth = startOfMonth(end);
    while (cursor <= lastMonth) {
      const occ = clampDay(yearOf(cursor), monthOf(cursor), day);
      if (occ >= start && occ <= end) dates.push(occ);
      const next = new Date(yearOf(cursor), monthOf(cursor), 1);
      cursor = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01`;
    }
    return dates;
  }
  const month = item.monthOfYear ?? (item.anchorDate ? monthOf(item.anchorDate) : null);
  const day = item.dayOfMonth ?? (item.anchorDate ? Number(item.anchorDate.slice(8, 10)) : null);
  if (!month || !day) return [];
  const dates: string[] = [];
  for (let year = yearOf(start); year <= yearOf(end); year += 1) {
    const occ = clampDay(year, month, day);
    if (occ >= start && occ <= end) dates.push(occ);
  }
  return dates;
}

export function signedRecurringAmount(item: RecurringItem): number {
  const amount = Math.abs(item.amount);
  return item.kind === 'income' ? amount : -amount;
}

export function checkingBalance(
  account: CheckingAccount,
  txns: CheckingTxn[],
  asOf: string,
): number {
  let balance = account.openingDate <= asOf ? account.openingBalance : 0;
  for (const txn of txns) {
    if (txn.accountId === account.id && txn.date <= asOf) balance += txn.amount;
  }
  return r8(balance);
}

export function runningBalances(account: CheckingAccount, txns: CheckingTxn[]): Map<string, number> {
  const mine = txns
    .filter((txn) => txn.accountId === account.id)
    .slice()
    .sort((a, b) => (a.date === b.date ? (a.createdAt ?? '').localeCompare(b.createdAt ?? '') || a.id.localeCompare(b.id) : a.date < b.date ? -1 : 1));
  let balance = 0;
  let applied = false;
  const out = new Map<string, number>();
  for (const txn of mine) {
    if (!applied && account.openingDate <= txn.date) {
      balance += account.openingBalance;
      applied = true;
    }
    balance = r8(balance + txn.amount);
    out.set(txn.id, balance);
  }
  return out;
}

function describe(item: RecurringItem, date: string, marks: PaidMark[]): OccurrenceView {
  const mark = marks.find((row) => row.recurringItemId === item.id && row.occurrenceDate === date);
  return {
    itemId: item.id,
    name: item.name,
    date,
    amount: Math.abs(item.amount),
    signedAmount: signedRecurringAmount(item),
    kind: item.kind,
    autopay: item.autopay,
    paid: mark?.status === 'paid',
    skipped: mark?.status === 'skipped',
    category: item.category,
    accountId: item.accountId,
  };
}

export function projectAccount(input: {
  account: CheckingAccount;
  txns: CheckingTxn[];
  items: RecurringItem[];
  marks: PaidMark[];
  today: string;
  days: number;
}): Projection {
  const end = addDays(input.today, input.days);
  const items = input.items.filter((item) => item.accountId === input.account.id);
  const occurrences = items
    .flatMap((item) => occurrencesInRange(item, input.today, end).map((date) => describe(item, date, input.marks)))
    .sort((a, b) => (a.date === b.date ? a.name.localeCompare(b.name) : a.date < b.date ? -1 : 1));

  const txnsByDate = new Map<string, CheckingTxn[]>();
  for (const txn of input.txns) {
    if (txn.accountId !== input.account.id || txn.date <= input.today || txn.date > end) continue;
    const list = txnsByDate.get(txn.date) ?? [];
    list.push(txn);
    txnsByDate.set(txn.date, list);
  }
  const occByDate = new Map<string, OccurrenceView[]>();
  for (const occ of occurrences) {
    const list = occByDate.get(occ.date) ?? [];
    list.push(occ);
    occByDate.set(occ.date, list);
  }

  let balance = checkingBalance(input.account, input.txns, input.today);
  const points: ProjectionPoint[] = [];
  const warnings: ProjectionWarning[] = [];
  let minBalance = balance;
  let minDate = input.today;
  const seen = new Set<string>();
  const push = (warning: ProjectionWarning) => {
    if (seen.has(warning.code)) return;
    seen.add(warning.code);
    warnings.push(warning);
  };

  for (let cursor = input.today; cursor <= end; cursor = addDays(cursor, 1)) {
    const dayTxns = cursor === input.today ? [] : (txnsByDate.get(cursor) ?? []);
    const dayOcc = (occByDate.get(cursor) ?? []).filter((occ) => !occ.paid && !occ.skipped);
    for (const txn of dayTxns) balance = r8(balance + txn.amount);
    for (const occ of dayOcc) {
      const before = balance;
      if (occ.autopay && occ.kind === 'bill') {
        if (input.account.lowBalanceFloor != null && before < input.account.lowBalanceFloor) {
          push({
            code: 'below_floor',
            date: cursor,
            message: `Balance ${money(before)} before autopay ${occ.name} on ${cursor} is below the ${money(input.account.lowBalanceFloor)} floor.`,
          });
        }
        if (before < occ.amount || before < 0) {
          push({
            code: 'autopay_shortfall',
            date: cursor,
            message: `Autopay ${occ.name} on ${cursor} is ${money(occ.amount)} and the balance before it is ${money(before)}.`,
          });
        }
      }
      balance = r8(balance + occ.signedAmount);
    }
    points.push({ date: cursor, balance });
    if (balance < minBalance) {
      minBalance = balance;
      minDate = cursor;
    }
    const laterAutopay = occurrences.find((occ) => occ.autopay && occ.kind === 'bill' && !occ.paid && !occ.skipped && occ.date > cursor);
    if (balance < 0) {
      push({
        code: 'below_zero',
        date: cursor,
        message: laterAutopay
          ? `Projected balance is negative on ${cursor}, before autopay ${laterAutopay.name} on ${laterAutopay.date}.`
          : `Projected balance is negative on ${cursor}.`,
      });
    }
    if (input.account.lowBalanceFloor != null && balance < input.account.lowBalanceFloor) {
      push({
        code: 'below_floor',
        date: cursor,
        message: laterAutopay
          ? `Projected balance falls below the ${money(input.account.lowBalanceFloor)} floor on ${cursor}, before autopay ${laterAutopay.name} on ${laterAutopay.date}.`
          : `Projected balance falls below the ${money(input.account.lowBalanceFloor)} floor on ${cursor}.`,
      });
    }
  }

  return { points, minBalance, minDate, warnings, occurrences };
}

function money(value: number): string {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}
