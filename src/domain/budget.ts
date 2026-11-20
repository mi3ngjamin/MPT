import { addMonths, daysBetween, endOfMonth, startOfMonth } from './dates';
import { r8 } from './round';
import type {
  BudgetCategory,
  BudgetEntry,
  BudgetSettings,
  BudgetTarget,
  CardAccount,
  CardTxn,
  CheckingAccount,
  CheckingTxn,
  FlowType,
} from './types';
import { DEFAULT_BUDGET_SETTINGS } from './types';

export const FLOW_TYPES: FlowType[] = [
  'income',
  'core_spending',
  'taxes',
  'debt_payment',
  'investment',
  'savings',
  'dependent_savings',
  'transfer_internal',
  'needs_review',
  'card_payment',
  'adjustment',
];

export const FLOW_LABELS: Record<FlowType, string> = {
  income: 'Income',
  core_spending: 'Core spending',
  taxes: 'Taxes',
  debt_payment: 'Debt payment',
  investment: 'Investment',
  savings: 'Savings',
  dependent_savings: 'Dependent savings',
  transfer_internal: 'Transfer',
  needs_review: 'Needs review',
  card_payment: 'Card payment',
  adjustment: 'Adjustment',
};

export const CARD_SPENDING_LABEL = 'Card spending (unitemized)';

export const SAVINGS_RATE_NOTE =
  'Take-home savings rate is savings plus investments, divided by income. Payroll contributions such as a biweekly 401k deposit never appear in checking. Add one below to include it. Dependent savings is left out of this rate.';

const ALIASES: Record<string, string> = {
  'life insurance': 'Life Insurance',
  paycheck: 'Income',
  pay: 'Income',
  salary: 'Income',
  wages: 'Income',
  groceries: 'Food & Groceries',
  food: 'Food & Groceries',
  rent: 'Monthly Bills',
  home: 'Monthly Bills',
  utilities: 'Monthly Bills',
  transport: 'Auto',
  fuel: 'Auto',
  'credit card': 'Credit Card',
  'credit cards': 'Credit Card',
  uncategorized: 'Uncategorized',
};

interface CategorySeed {
  name: string;
  flowType: FlowType;
  groupName: string;
  budgetMonthly: number | null;
  color: string;
}

const CATEGORY_SEEDS: CategorySeed[] = [
  { name: 'Income', flowType: 'income', groupName: 'income', budgetMonthly: null, color: '#34d399' },
  { name: 'Interest', flowType: 'income', groupName: 'income', budgetMonthly: null, color: '#6ee7b7' },
  { name: 'Monthly Bills', flowType: 'core_spending', groupName: 'bills', budgetMonthly: null, color: '#38bdf8' },
  { name: 'Auto', flowType: 'core_spending', groupName: 'bills', budgetMonthly: null, color: '#22d3ee' },
  { name: 'Life Insurance', flowType: 'core_spending', groupName: 'bills', budgetMonthly: null, color: '#818cf8' },
  { name: 'Insurance', flowType: 'core_spending', groupName: 'bills', budgetMonthly: null, color: '#a78bfa' },
  { name: 'Childcare', flowType: 'core_spending', groupName: 'dependents', budgetMonthly: null, color: '#f0abfc' },
  { name: 'Cash', flowType: 'core_spending', groupName: 'lifestyle', budgetMonthly: null, color: '#f5c16c' },
  { name: 'Withdrawal', flowType: 'core_spending', groupName: 'lifestyle', budgetMonthly: null, color: '#fdba74' },
  { name: 'Gym', flowType: 'core_spending', groupName: 'lifestyle', budgetMonthly: null, color: '#fb7185' },
  { name: 'Health', flowType: 'core_spending', groupName: 'lifestyle', budgetMonthly: null, color: '#fda4af' },
  { name: 'Shopping', flowType: 'core_spending', groupName: 'lifestyle', budgetMonthly: 1000, color: '#e879f9' },
  { name: 'Food & Groceries', flowType: 'core_spending', groupName: 'lifestyle', budgetMonthly: 1100, color: '#2dd4bf' },
  { name: 'Gift', flowType: 'core_spending', groupName: 'lifestyle', budgetMonthly: null, color: '#f9a8d4' },
  { name: 'Petcare', flowType: 'core_spending', groupName: 'lifestyle', budgetMonthly: null, color: '#99f6e4' },
  { name: 'Fee', flowType: 'core_spending', groupName: 'other', budgetMonthly: null, color: '#94a3b8' },
  { name: 'Taxes', flowType: 'taxes', groupName: 'taxes', budgetMonthly: null, color: '#f87171' },
  { name: 'Loan', flowType: 'debt_payment', groupName: 'debt', budgetMonthly: null, color: '#fb923c' },
  { name: 'Investments', flowType: 'investment', groupName: 'investments', budgetMonthly: null, color: '#67e8f9' },
  { name: 'Investment Property', flowType: 'investment', groupName: 'investments', budgetMonthly: null, color: '#7dd3fc' },
  { name: 'Savings', flowType: 'savings', groupName: 'savings', budgetMonthly: null, color: '#5eead4' },
  { name: 'Emmy', flowType: 'needs_review', groupName: 'dependents', budgetMonthly: null, color: '#c4b5fd' },
  { name: 'Transfer', flowType: 'transfer_internal', groupName: 'transfers', budgetMonthly: null, color: '#cbd5e1' },
  { name: 'Credit Card', flowType: 'card_payment', groupName: 'cards', budgetMonthly: null, color: '#f472b6' },
  { name: 'Check', flowType: 'needs_review', groupName: 'review', budgetMonthly: null, color: '#a8a29e' },
  { name: 'Adjustment', flowType: 'adjustment', groupName: 'ignored', budgetMonthly: null, color: '#64748b' },
  { name: 'Uncategorized', flowType: 'needs_review', groupName: 'review', budgetMonthly: null, color: '#94a3b8' },
];

const TARGET_SEEDS: Omit<BudgetTarget, 'id'>[] = [
  { label: 'Rent', monthlyAmount: 2050, categoryName: 'Monthly Bills', payee: 'Rent' },
  { label: 'Cell Phone', monthlyAmount: 201, categoryName: null, payee: null },
  { label: 'Electricity', monthlyAmount: 270, categoryName: 'Monthly Bills', payee: 'SCE' },
  { label: 'Gas', monthlyAmount: 40, categoryName: 'Monthly Bills', payee: 'Socal Gas' },
  { label: 'Renter Insurance', monthlyAmount: 27.09, categoryName: 'Insurance', payee: 'Renter' },
  { label: 'Internet', monthlyAmount: 110, categoryName: 'Monthly Bills', payee: 'Internet' },
  { label: 'Car Insurance', monthlyAmount: 156, categoryName: 'Insurance', payee: 'Car Insurance' },
  { label: 'Food & Groceries', monthlyAmount: 1100, categoryName: 'Food & Groceries', payee: null },
  { label: 'Shopping', monthlyAmount: 1000, categoryName: 'Shopping', payee: null },
  { label: 'Golf', monthlyAmount: 300, categoryName: null, payee: null },
  { label: 'Tennis', monthlyAmount: 100, categoryName: null, payee: null },
  { label: "Tutoring/Emmy's Activities", monthlyAmount: 150, categoryName: null, payee: null },
  { label: 'Entertainment', monthlyAmount: 100, categoryName: null, payee: null },
  { label: "Emmy's Savings", monthlyAmount: 500, categoryName: 'Emmy', payee: "Emmy's Savings" },
  { label: 'Subscriptions', monthlyAmount: 180, categoryName: null, payee: null },
];

export function builtinCategories(): BudgetCategory[] {
  return CATEGORY_SEEDS.map((row, index) => ({
    id: `builtin-${index}`,
    name: row.name,
    flowType: row.flowType,
    groupName: row.groupName,
    budgetMonthly: row.budgetMonthly,
    color: row.color,
    hidden: false,
    sortOrder: index,
  }));
}

export function builtinTargets(): BudgetTarget[] {
  return TARGET_SEEDS.map((row, index) => ({ id: `target-${index}`, ...row }));
}

export function canonicalCategory(name: string | null | undefined): string {
  const trimmed = (name ?? '').trim().replace(/\s+/g, ' ');
  const key = trimmed.toLowerCase();
  if (!key) return 'Uncategorized';
  if (ALIASES[key]) return ALIASES[key];
  const known = CATEGORY_SEEDS.find((row) => row.name.toLowerCase() === key);
  return known ? known.name : trimmed;
}

export type BudgetPeriod = 'month' | 'quarter' | 'ytd' | 'trailing12' | 'all';
export type ChartSpan = '24m' | 'all';

export interface BudgetLine {
  id: string;
  origin: 'checking' | 'history' | 'card';
  accountId: string | null;
  cardAccountId: string | null;
  accountName: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  groupName: string;
  flow: FlowType;
  flowOverride: FlowType | null;
  hidden: boolean;
  matchedTransfer: boolean;
  countsInBalance: boolean;
  beforeOpening: boolean;
  reportLabel: string;
}

export interface BudgetTotals {
  income: number;
  coreSpending: number;
  taxes: number;
  debtPayments: number;
  loanProceeds: number;
  investment: number;
  savings: number;
  dependentSavings: number;
  cardSpending: number;
  needsReviewNet: number;
  needsReviewCount: number;
  net: number;
  payroll: number;
  savingsRate: number | null;
}

export interface TargetRow {
  id: string;
  label: string;
  budget: number;
  actual: number | null;
  untracked: boolean;
}

export interface MonthPoint {
  month: string;
  income: number;
  coreSpending: number;
  taxes: number;
  debtPayments: number;
  cardSpending: number;
  net: number;
  savingsRate: number | null;
  incomeMa: number | null;
  coreSpendingMa: number | null;
  netMa: number | null;
  savingsRateMa: number | null;
}

export interface FlowSlice {
  label: string;
  value: number;
  color: string;
}

export interface BalancePoint {
  month: string;
  balance: number;
}

export interface AccountBalanceSeries {
  accountId: string;
  accountName: string;
  points: BalancePoint[];
}

export function isFlowType(value: string): value is FlowType {
  return (FLOW_TYPES as string[]).includes(value);
}

export function movingAverage(values: (number | null)[], window = 3): (number | null)[] {
  return values.map((_, index) => {
    if (index < window - 1) return null;
    let sum = 0;
    for (let cursor = 0; cursor < window; cursor += 1) {
      const value = values[index - cursor];
      if (value == null) return null;
      sum += value;
    }
    return r8(sum / window);
  });
}

export function monthsBetween(start: string, end: string): string[] {
  if (!start || !end || end < start) return [];
  const months: string[] = [];
  let cursor = start.slice(0, 7);
  const last = end.slice(0, 7);
  while (cursor <= last && months.length < 600) {
    months.push(cursor);
    const year = Number(cursor.slice(0, 4));
    const month = Number(cursor.slice(5, 7));
    const nextYear = month === 12 ? year + 1 : year;
    const nextMonth = month === 12 ? 1 : month + 1;
    cursor = `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
  }
  return months;
}

export function periodBounds(kind: BudgetPeriod, today: string, month: string): { start: string; end: string } {
  if (kind === 'month') {
    const start = `${month}-01`;
    return { start, end: endOfMonth(start) };
  }
  if (kind === 'quarter') {
    const monthNumber = Number(month.slice(5, 7));
    const quarterStart = Math.floor((monthNumber - 1) / 3) * 3 + 1;
    const start = `${month.slice(0, 4)}-${String(quarterStart).padStart(2, '0')}-01`;
    return { start, end: endOfMonth(addMonths(start, 2)) };
  }
  if (kind === 'ytd') return { start: `${today.slice(0, 4)}-01-01`, end: today };
  if (kind === 'trailing12') return { start: addMonths(startOfMonth(today), -11), end: today };
  return { start: '0001-01-01', end: today };
}

const CHART_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function chartMonthLabel(month: string): string {
  const index = Number(month.slice(5, 7)) - 1;
  const name = CHART_MONTHS[index] ?? month;
  return `${name} '${month.slice(2, 4)}`;
}

export function chartBounds(span: ChartSpan, today: string, earliest: string | null): { start: string; end: string } {
  if (span === 'all' && earliest) return { start: startOfMonth(earliest), end: today };
  return { start: addMonths(startOfMonth(today), -23), end: today };
}

export function payrollForRange(settings: BudgetSettings, start: string, end: string): number {
  if (settings.payrollCadence === 'none' || settings.payrollAmount <= 0 || end < start) return 0;
  if (settings.payrollCadence === 'monthly') {
    return r8(settings.payrollAmount * Math.max(monthsBetween(start, end).length, 1));
  }
  const days = daysBetween(start, end) + 1;
  return r8(settings.payrollAmount * (days / 14));
}

export interface PrepareInput {
  accounts: CheckingAccount[];
  checkingTxns: CheckingTxn[];
  entries: BudgetEntry[];
  categories: BudgetCategory[];
  cards: CardAccount[];
  cardTxns: CardTxn[];
}

export function prepareBudget(input: PrepareInput): BudgetLine[] {
  const categories = input.categories.length ? input.categories : builtinCategories();
  const lines: BudgetLine[] = [];
  const seen = new Set<string>();

  for (const txn of input.checkingTxns) {
    const account = input.accounts.find((row) => row.id === txn.accountId) ?? null;
    const override = txn.flowOverride ?? null;
    const classified = classify(txn.category, txn.description, override, categories);
    const line = lineFrom({
      id: txn.id,
      origin: 'checking',
      accountId: txn.accountId,
      cardAccountId: null,
      accountName: account?.name ?? 'Checking',
      date: txn.date,
      description: txn.description,
      amount: txn.amount,
      classified,
      flowOverride: override,
      countsInBalance: true,
      beforeOpening: account ? txn.date < account.openingDate : false,
    });
    lines.push(line);
    if (account) seen.add(dedupeKey(account.id, txn.date, txn.amount, txn.description));
  }

  for (const entry of input.entries) {
    const account = resolveAccount(entry.accountName, input.accounts);
    if (account && seen.has(dedupeKey(account.id, entry.date, entry.amount, entry.description))) continue;
    const classified = classify(entry.category, entry.description, entry.flowOverride, categories);
    lines.push(
      lineFrom({
        id: entry.id,
        origin: 'history',
        accountId: account?.id ?? null,
        cardAccountId: null,
        accountName: account?.name ?? entry.accountName,
        date: entry.date,
        description: entry.description,
        amount: entry.amount,
        classified,
        flowOverride: entry.flowOverride,
        countsInBalance: false,
        beforeOpening: account ? entry.date < account.openingDate : true,
      }),
    );
  }

  const itemized = new Set(input.cardTxns.map((txn) => cardMonthKey(txn.cardAccountId, txn.statementMonth || txn.date.slice(0, 7))));
  for (const line of lines) {
    if (line.origin !== 'checking' || line.flowOverride || line.flow !== 'card_payment') continue;
    const card = matchingCard(line.description, input.cards);
    if (!card) continue;
    line.cardAccountId = card.id;
    if (itemized.has(cardMonthKey(card.id, line.date.slice(0, 7)))) {
      line.flow = 'transfer_internal';
      line.groupName = 'transfers';
      line.reportLabel = line.category;
    }
  }

  for (const txn of input.cardTxns) {
    const card = input.cards.find((row) => row.id === txn.cardAccountId);
    const payment = isStatementPayment(txn);
    const classified = payment
      ? { category: canonicalCategory(txn.category), flow: 'transfer_internal' as FlowType, groupName: 'transfers', hidden: false }
      : classify(txn.category, txn.description, txn.flowOverride, categories);
    if (txn.flowOverride && !payment) {
      classified.flow = txn.flowOverride;
    }
    if (payment && txn.flowOverride) {
      classified.flow = txn.flowOverride;
      classified.groupName = groupForFlow(txn.flowOverride);
    }
    lines.push(
      lineFrom({
        id: txn.id,
        origin: 'card',
        accountId: null,
        cardAccountId: txn.cardAccountId,
        accountName: card?.name ?? 'Card',
        date: txn.date,
        description: txn.description,
        amount: txn.amount,
        classified: { ...classified, flow: txn.flowOverride ?? classified.flow },
        flowOverride: txn.flowOverride,
        countsInBalance: false,
        beforeOpening: false,
      }),
    );
  }

  matchTransfers(lines);
  for (const line of lines) {
    if (line.flow === 'card_payment') line.reportLabel = CARD_SPENDING_LABEL;
  }
  return lines;
}

export function filterLines(lines: BudgetLine[], accountFilter: string): BudgetLine[] {
  if (accountFilter === 'all') return lines;
  if (accountFilter.startsWith('card:')) {
    const id = accountFilter.slice(5);
    return lines.filter((line) => line.cardAccountId === id);
  }
  return lines.filter((line) => line.accountId === accountFilter);
}

export function summarize(
  lines: BudgetLine[],
  settings: BudgetSettings,
  start: string,
  end: string,
  household: boolean,
): BudgetTotals {
  const totals = emptyTotals();
  for (const line of lines) {
    if (line.date < start || line.date > end) continue;
    if (skipLine(line, household)) continue;
    addLine(totals, line);
  }
  totals.income = r8(totals.income);
  totals.coreSpending = r8(totals.coreSpending);
  totals.taxes = r8(totals.taxes);
  totals.debtPayments = r8(totals.debtPayments);
  totals.loanProceeds = r8(totals.loanProceeds);
  totals.investment = r8(totals.investment);
  totals.savings = r8(totals.savings);
  totals.dependentSavings = r8(totals.dependentSavings);
  totals.cardSpending = r8(totals.cardSpending);
  totals.needsReviewNet = r8(totals.needsReviewNet);
  totals.net = r8(totals.net);
  totals.payroll = household ? payrollForRange(settings, start, end) : 0;
  const saved = totals.savings + totals.investment + totals.payroll;
  totals.savingsRate = totals.income > 0 ? r8(saved / totals.income) : null;
  return totals;
}

export function targetRows(lines: BudgetLine[], targets: BudgetTarget[], start: string, end: string): TargetRow[] {
  const factor = Math.max(monthsBetween(start, end).length, 1);
  const inRange = lines.filter((line) => line.date >= start && line.date <= end && line.flow !== 'adjustment' && !line.matchedTransfer);
  return targets.map((target) => {
    const matches = inRange.filter((line) => targetHit(line, target));
    if (!matches.length) {
      return { id: target.id, label: target.label, budget: r8(target.monthlyAmount * factor), actual: null, untracked: true };
    }
    const actual = r8(-matches.reduce((sum, line) => sum + line.amount, 0));
    return { id: target.id, label: target.label, budget: r8(target.monthlyAmount * factor), actual, untracked: false };
  });
}

export function monthlySeries(
  lines: BudgetLine[],
  settings: BudgetSettings,
  start: string,
  end: string,
  household: boolean,
): MonthPoint[] {
  const months = monthsBetween(start, end);
  const points = months.map((month) => {
    const monthStart = `${month}-01`;
    const monthEnd = endOfMonth(monthStart) < end ? endOfMonth(monthStart) : end;
    const totals = summarize(lines, DEFAULT_BUDGET_SETTINGS, monthStart, monthEnd < monthStart ? monthStart : monthEnd, household);
    const payroll = household ? payrollForRange(settings, monthStart, monthEnd < monthStart ? monthStart : monthEnd) : 0;
    const saved = totals.savings + totals.investment + payroll;
    return {
      month,
      income: totals.income,
      coreSpending: totals.coreSpending,
      taxes: totals.taxes,
      debtPayments: totals.debtPayments,
      cardSpending: totals.cardSpending,
      net: totals.net,
      savingsRate: totals.income > 0 ? r8(saved / totals.income) : null,
      incomeMa: null,
      coreSpendingMa: null,
      netMa: null,
      savingsRateMa: null,
    };
  });
  const incomeMa = movingAverage(points.map((point) => point.income));
  const spendingMa = movingAverage(points.map((point) => point.coreSpending));
  const netMa = movingAverage(points.map((point) => point.net));
  const rateMa = movingAverage(points.map((point) => point.savingsRate));
  return points.map((point, index) => ({
    ...point,
    incomeMa: incomeMa[index],
    coreSpendingMa: spendingMa[index],
    netMa: netMa[index],
    savingsRateMa: rateMa[index],
  }));
}

export function categorySeries(lines: BudgetLine[], labels: string[], start: string, end: string): { month: string; values: Record<string, number> }[] {
  const months = monthsBetween(start, end);
  return months.map((month) => {
    const values: Record<string, number> = {};
    for (const label of labels) values[label] = 0;
    for (const line of lines) {
      if (line.date.slice(0, 7) !== month || line.hidden || line.flow === 'adjustment' || line.matchedTransfer) continue;
      if (!labels.includes(line.reportLabel)) continue;
      const signed = line.flow === 'income' ? line.amount : -line.amount;
      values[line.reportLabel] = r8((values[line.reportLabel] ?? 0) + signed);
    }
    return { month, values };
  });
}

export function flowSlices(lines: BudgetLine[], start: string, end: string, household: boolean): FlowSlice[] {
  const buckets = new Map<string, { value: number; color: string }>();
  const colors: Record<string, string> = {
    Bills: '#38bdf8',
    'Card spending': '#f472b6',
    Savings: '#5eead4',
    'Dependent savings': '#c4b5fd',
    Investments: '#67e8f9',
    Taxes: '#f87171',
    'Debt payments': '#fb923c',
    Other: '#94a3b8',
    'Needs review': '#f5c16c',
  };
  for (const line of lines) {
    if (line.date < start || line.date > end || skipLine(line, household)) continue;
    const label = sliceLabel(line);
    if (!label) continue;
    const current = buckets.get(label) ?? { value: 0, color: colors[label] ?? '#94a3b8' };
    current.value = r8(current.value - line.amount);
    buckets.set(label, current);
  }
  return [...buckets.entries()]
    .map(([label, row]) => ({ label, value: row.value, color: row.color }))
    .filter((row) => row.value > 0);
}

export function balanceSeries(
  accounts: CheckingAccount[],
  txns: CheckingTxn[],
  entries: BudgetEntry[],
  end: string,
): AccountBalanceSeries[] {
  return accounts.map((account) => {
    const prior = entries
      .filter((entry) => {
        const resolved = resolveAccount(entry.accountName, [account]);
        return resolved?.id === account.id && entry.date < account.openingDate;
      })
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date) || a.sourceRow - b.sourceRow);
    const events: { date: string; amount: number; balanceAfter?: number }[] = prior.map((entry) => ({
      date: entry.date,
      amount: entry.amount,
    }));
    const opening = account.openingDate;
    const later = txns
      .filter((txn) => txn.accountId === account.id && txn.date >= opening && txn.date <= end)
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
    const sumPrior = prior.reduce((sum, entry) => sum + entry.amount, 0);
    let balance = account.openingBalance - sumPrior;
    const dated: { date: string; balance: number }[] = [];
    for (const event of events) {
      balance = r8(balance + event.amount);
      dated.push({ date: event.date, balance });
    }
    balance = account.openingDate <= end ? account.openingBalance : balance;
    if (account.openingDate <= end) dated.push({ date: account.openingDate, balance: account.openingBalance });
    for (const txn of later) {
      balance = r8(balance + txn.amount);
      dated.push({ date: txn.date, balance });
    }
    const start = dated[0]?.date ?? (account.openingDate <= end ? account.openingDate : end);
    const months = monthsBetween(start, end);
    let cursor = 0;
    const points = months.map((month) => {
      const monthEnd = endOfMonth(`${month}-01`);
      while (cursor < dated.length && dated[cursor].date <= monthEnd) cursor += 1;
      const balanceAt = cursor === 0 ? (account.openingDate <= monthEnd ? account.openingBalance : 0) : dated[cursor - 1].balance;
      return { month, balance: balanceAt };
    });
    return { accountId: account.id, accountName: account.name, points };
  });
}

export function signedCardAmount(amount: number, purchasesPositive: boolean): number {
  return purchasesPositive ? -amount : amount;
}

function emptyTotals(): BudgetTotals {
  return {
    income: 0,
    coreSpending: 0,
    taxes: 0,
    debtPayments: 0,
    loanProceeds: 0,
    investment: 0,
    savings: 0,
    dependentSavings: 0,
    cardSpending: 0,
    needsReviewNet: 0,
    needsReviewCount: 0,
    net: 0,
    payroll: 0,
    savingsRate: null,
  };
}

function addLine(totals: BudgetTotals, line: BudgetLine) {
  totals.net += line.amount;
  switch (line.flow) {
    case 'income':
      totals.income += line.amount;
      break;
    case 'core_spending':
      totals.coreSpending += -line.amount;
      break;
    case 'taxes':
      totals.taxes += -line.amount;
      break;
    case 'debt_payment':
      if (line.amount < 0) totals.debtPayments += -line.amount;
      else totals.loanProceeds += line.amount;
      break;
    case 'investment':
      totals.investment += -line.amount;
      break;
    case 'savings':
      totals.savings += -line.amount;
      break;
    case 'dependent_savings':
      totals.dependentSavings += -line.amount;
      break;
    case 'card_payment':
      totals.cardSpending += -line.amount;
      break;
    case 'needs_review':
      totals.needsReviewNet += line.amount;
      totals.needsReviewCount += 1;
      break;
    default:
      break;
  }
}

function skipLine(line: BudgetLine, household: boolean): boolean {
  if (line.hidden || line.flow === 'adjustment') return true;
  if (household && line.matchedTransfer) return true;
  return false;
}

function sliceLabel(line: BudgetLine): string | null {
  if (line.flow === 'income' || line.flow === 'transfer_internal' || line.flow === 'adjustment') return null;
  if (line.flow === 'card_payment') return 'Card spending';
  if (line.flow === 'taxes') return 'Taxes';
  if (line.flow === 'debt_payment') return line.amount < 0 ? 'Debt payments' : null;
  if (line.flow === 'savings') return 'Savings';
  if (line.flow === 'dependent_savings') return 'Dependent savings';
  if (line.flow === 'investment') return 'Investments';
  if (line.flow === 'needs_review') return 'Needs review';
  if (line.groupName === 'bills' || line.groupName === 'dependents') return 'Bills';
  return 'Other';
}

function targetHit(line: BudgetLine, target: BudgetTarget): boolean {
  const description = line.description.toLowerCase();
  if (target.payee) {
    const needle = target.payee.toLowerCase();
    if (needle.includes('emmy') && needle.includes('saving')) return description.includes('emmy') && description.includes('sav');
    return description.includes(needle);
  }
  if (target.categoryName) return line.category.toLowerCase() === canonicalCategory(target.categoryName).toLowerCase();
  return false;
}

interface Classified {
  category: string;
  flow: FlowType;
  groupName: string;
  hidden: boolean;
}

function classify(category: string, description: string, override: FlowType | null, categories: BudgetCategory[]): Classified {
  const canonical = canonicalCategory(category);
  const found = categories.find((row) => row.name.toLowerCase() === canonical.toLowerCase());
  const base: Classified = {
    category: found?.name ?? canonical,
    flow: found?.flowType ?? 'needs_review',
    groupName: found?.groupName ?? 'review',
    hidden: found?.hidden ?? false,
  };
  if (override) {
    return { ...base, flow: override, groupName: groupForFlow(override) };
  }
  const text = description.toLowerCase();
  if (/\bvenmo\b/.test(text)) return { ...base, flow: 'needs_review', groupName: 'review' };
  if (/emmy'?s?\s+sav/.test(text)) return { ...base, flow: 'dependent_savings', groupName: 'dependents' };
  return base;
}

function groupForFlow(flow: FlowType): string {
  switch (flow) {
    case 'income':
      return 'income';
    case 'core_spending':
      return 'other';
    case 'taxes':
      return 'taxes';
    case 'debt_payment':
      return 'debt';
    case 'investment':
      return 'investments';
    case 'savings':
      return 'savings';
    case 'dependent_savings':
      return 'dependents';
    case 'transfer_internal':
      return 'transfers';
    case 'card_payment':
      return 'cards';
    case 'adjustment':
      return 'ignored';
    default:
      return 'review';
  }
}

function lineFrom(input: {
  id: string;
  origin: BudgetLine['origin'];
  accountId: string | null;
  cardAccountId: string | null;
  accountName: string;
  date: string;
  description: string;
  amount: number;
  classified: Classified;
  flowOverride: FlowType | null;
  countsInBalance: boolean;
  beforeOpening: boolean;
}): BudgetLine {
  return {
    id: input.id,
    origin: input.origin,
    accountId: input.accountId,
    cardAccountId: input.cardAccountId,
    accountName: input.accountName,
    date: input.date,
    description: input.description,
    amount: input.amount,
    category: input.classified.category,
    groupName: input.classified.groupName,
    flow: input.classified.flow,
    flowOverride: input.flowOverride,
    hidden: input.classified.hidden,
    matchedTransfer: false,
    countsInBalance: input.countsInBalance,
    beforeOpening: input.beforeOpening,
    reportLabel: input.classified.category,
  };
}

function resolveAccount(name: string, accounts: CheckingAccount[]): CheckingAccount | null {
  const key = name.trim().toLowerCase();
  if (!key) return null;
  const exact = accounts.find((account) => account.name.trim().toLowerCase() === key);
  if (exact) return exact;
  const partial = accounts
    .filter((account) => {
      const accountName = account.name.trim().toLowerCase();
      return key.includes(accountName) || accountName.includes(key);
    })
    .sort((a, b) => b.name.length - a.name.length);
  return partial[0] ?? null;
}

function dedupeKey(accountId: string, date: string, amount: number, description: string): string {
  const cents = Math.round(amount * 100);
  const text = description.trim().toLowerCase().replace(/\s+/g, ' ');
  return `${accountId}|${date}|${cents}|${text}`;
}

function cardMonthKey(cardId: string, month: string): string {
  return `${cardId}|${month.slice(0, 7)}`;
}

function matchingCard(description: string, cards: CardAccount[]): CardAccount | null {
  const haystack = description.toLowerCase();
  let best: CardAccount | null = null;
  let bestLength = 0;
  for (const card of cards) {
    const names = [card.name, ...card.matchNames].map((name) => name.trim().toLowerCase()).filter((name) => name.length >= 3);
    for (const name of names) {
      if (haystack.includes(name) && name.length > bestLength) {
        best = card;
        bestLength = name.length;
      }
    }
  }
  return best;
}

function isStatementPayment(txn: CardTxn): boolean {
  if (txn.flowOverride) return false;
  if (txn.amount <= 0) return false;
  return /payment|autopay|thank you|ach/.test(txn.description.toLowerCase()) || canonicalCategory(txn.category) === 'Credit Card';
}

function matchTransfers(lines: BudgetLine[]) {
  const used = new Set<string>();
  const outgoing = lines.filter((line) => line.amount < 0 && transferish(line) && line.origin !== 'card');
  const incoming = lines.filter((line) => line.amount > 0 && line.origin !== 'card');
  for (const out of outgoing) {
    if (used.has(out.id)) continue;
    let best: BudgetLine | null = null;
    let bestGap = 4;
    for (const candidate of incoming) {
      if (used.has(candidate.id) || candidate.accountId == null || out.accountId == null) continue;
      if (candidate.accountId === out.accountId) continue;
      if (Math.abs(candidate.amount + out.amount) > 0.009) continue;
      if (!incomingCanMatch(candidate)) continue;
      const gap = Math.abs(daysBetween(out.date, candidate.date));
      if (gap <= 3 && gap < bestGap) {
        best = candidate;
        bestGap = gap;
      }
    }
    if (!best) continue;
    used.add(out.id);
    used.add(best.id);
    out.matchedTransfer = true;
    best.matchedTransfer = true;
    out.flow = 'transfer_internal';
    best.flow = 'transfer_internal';
    out.groupName = 'transfers';
    best.groupName = 'transfers';
  }
}

function transferish(line: BudgetLine): boolean {
  if (line.flowOverride) return line.flow === 'transfer_internal' || line.flow === 'savings';
  return line.flow === 'transfer_internal' || line.flow === 'savings';
}

function incomingCanMatch(line: BudgetLine): boolean {
  if (line.flow === 'transfer_internal' || line.flow === 'savings') return true;
  if (line.flow !== 'income' && line.flow !== 'needs_review') return false;
  return /\btransfer\b|ffcu|sofi/.test(line.description.toLowerCase());
}

export { DEFAULT_BUDGET_SETTINGS };
