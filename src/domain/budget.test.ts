import { describe, expect, it } from 'vitest';
import { checkingBalance } from './recurrence';
import {
  builtinCategories,
  CARD_SPENDING_LABEL,
  categorySeries,
  chartBounds,
  chartMonthLabel,
  monthlySeries,
  movingAverage,
  payrollForRange,
  periodBounds,
  prepareBudget,
  summarize,
  targetRows,
  balanceSeries,
  canonicalCategory,
  builtinTargets,
} from './budget';
import type { BudgetEntry, CardAccount, CardTxn, CheckingAccount, CheckingTxn } from './types';
import { DEFAULT_BUDGET_SETTINGS } from './types';

const ffcu: CheckingAccount = {
  id: 'ffcu',
  name: 'FFCU Checking',
  openingBalance: 2050,
  openingDate: '2026-01-15',
  lowBalanceFloor: null,
  sortOrder: 0,
};
const sofi: CheckingAccount = {
  id: 'sofi',
  name: 'SoFi Checking',
  openingBalance: 2110.86,
  openingDate: '2026-01-15',
  lowBalanceFloor: null,
  sortOrder: 1,
};

function txn(partial: Partial<CheckingTxn> & Pick<CheckingTxn, 'id' | 'accountId' | 'date' | 'amount'>): CheckingTxn {
  return {
    description: '',
    category: 'Uncategorized',
    cleared: true,
    recurringItemId: null,
    createdAt: null,
    flowOverride: null,
    ...partial,
  };
}

function entry(partial: Partial<BudgetEntry> & Pick<BudgetEntry, 'id' | 'date' | 'amount'>): BudgetEntry {
  return {
    accountName: 'FFCU Checking',
    category: 'Uncategorized',
    description: '',
    runningBalance: null,
    source: 'archive',
    sourceRow: 1,
    flowOverride: null,
    categoryLocked: false,
    ...partial,
  };
}

function cardTxn(partial: Partial<CardTxn> & Pick<CardTxn, 'id' | 'date' | 'amount'>): CardTxn {
  return {
    cardAccountId: 'chase',
    description: 'Store',
    category: 'Shopping',
    flowOverride: null,
    statementMonth: partial.date.slice(0, 7),
    ...partial,
  };
}

const chase: CardAccount = { id: 'chase', name: 'Chase', matchNames: ['Chase Sapphire'], sortOrder: 0 };

describe('budget classification', () => {
  it('maps spreadsheet categories onto the reviewed flow types', () => {
    const lines = prepareBudget({
      accounts: [ffcu],
      checkingTxns: [
        txn({ id: '1', accountId: 'ffcu', date: '2026-02-01', amount: 4000, category: 'Income', description: 'Paycheck' }),
        txn({ id: '2', accountId: 'ffcu', date: '2026-02-02', amount: -80, category: 'Cash', description: 'ATM' }),
        txn({ id: '3', accountId: 'ffcu', date: '2026-02-03', amount: -40, category: 'Withdrawal', description: 'ATM' }),
        txn({ id: '4', accountId: 'ffcu', date: '2026-02-04', amount: -90, category: 'LIfe Insurance', description: 'Policy' }),
        txn({ id: '5', accountId: 'ffcu', date: '2026-02-05', amount: -30, category: 'Life Insurance', description: 'Policy' }),
        txn({ id: '6', accountId: 'ffcu', date: '2026-02-06', amount: -500, category: 'Investments', description: 'Brokerage' }),
        txn({ id: '7', accountId: 'ffcu', date: '2026-02-07', amount: -800, category: 'Investment Property', description: 'Roof' }),
        txn({ id: '8', accountId: 'ffcu', date: '2026-02-08', amount: -200, category: 'Savings', description: 'Ally' }),
        txn({ id: '9', accountId: 'ffcu', date: '2026-02-09', amount: -500, category: 'Emmy', description: "Emmy's Savings" }),
        txn({ id: '10', accountId: 'ffcu', date: '2026-02-10', amount: -40, category: 'Emmy', description: 'Tutoring' }),
        txn({ id: '11', accountId: 'ffcu', date: '2026-02-11', amount: -15, category: 'Transfer', description: 'Venmo Jane' }),
        txn({ id: '12', accountId: 'ffcu', date: '2026-02-12', amount: -25, category: '', description: 'Mystery' }),
        txn({ id: '13', accountId: 'ffcu', date: '2026-02-13', amount: -10, category: 'Adjustment', description: 'True-up' }),
        txn({ id: '14', accountId: 'ffcu', date: '2026-02-14', amount: -300, category: 'Loan', description: 'Auto' }),
        txn({ id: '15', accountId: 'ffcu', date: '2026-02-15', amount: 5000, category: 'Loan', description: 'Proceeds' }),
        txn({ id: '16', accountId: 'ffcu', date: '2026-02-16', amount: -1000, category: 'Taxes', description: 'IRS' }),
        txn({ id: '17', accountId: 'ffcu', date: '2026-02-17', amount: -12, category: 'Food & Groceries', description: 'Market' }),
        txn({ id: '18', accountId: 'ffcu', date: '2026-02-18', amount: 4, category: 'Food & Groceries', description: 'Refund' }),
      ],
      entries: [],
      categories: builtinCategories(),
      cards: [],
      cardTxns: [],
    });
    const flow = (id: string) => lines.find((line) => line.id === id)?.flow;
    expect(flow('1')).toBe('income');
    expect(flow('2')).toBe('core_spending');
    expect(flow('3')).toBe('core_spending');
    expect(flow('4')).toBe('core_spending');
    expect(canonicalCategory('LIfe Insurance')).toBe('Life Insurance');
    expect(flow('5')).toBe('core_spending');
    expect(flow('6')).toBe('investment');
    expect(flow('7')).toBe('investment');
    expect(flow('8')).toBe('savings');
    expect(flow('9')).toBe('dependent_savings');
    expect(flow('10')).toBe('needs_review');
    expect(flow('11')).toBe('needs_review');
    expect(flow('12')).toBe('needs_review');
    expect(flow('13')).toBe('adjustment');
    expect(flow('14')).toBe('debt_payment');
    expect(flow('15')).toBe('debt_payment');
    expect(flow('16')).toBe('taxes');
    const totals = summarize(lines, DEFAULT_BUDGET_SETTINGS, '2026-02-01', '2026-02-28', true);
    expect(totals.income).toBe(4000);
    expect(totals.coreSpending).toBe(80 + 40 + 90 + 30 + 12 - 4);
    expect(totals.loanProceeds).toBe(5000);
    expect(totals.debtPayments).toBe(300);
    expect(totals.taxes).toBe(1000);
    expect(totals.dependentSavings).toBe(500);
    expect(totals.needsReviewCount).toBe(3);
  });

  it('lets a per-transaction override retag a card payment as taxes', () => {
    const lines = prepareBudget({
      accounts: [ffcu],
      checkingTxns: [
        txn({
          id: 'tax',
          accountId: 'ffcu',
          date: '2026-02-24',
          amount: -13000,
          category: 'Credit Card',
          description: 'Venture X',
          flowOverride: 'taxes',
        }),
        txn({
          id: 'hoa',
          accountId: 'ffcu',
          date: '2026-02-02',
          amount: -250,
          category: 'Investment Property',
          description: 'HOA',
          flowOverride: 'core_spending',
        }),
      ],
      entries: [],
      categories: builtinCategories(),
      cards: [{ id: 'venture', name: 'Venture X', matchNames: [], sortOrder: 0 }],
      cardTxns: [cardTxn({ id: 'c1', cardAccountId: 'venture', date: '2026-02-10', amount: -40, description: 'Coffee', category: 'Food & Groceries' })],
    });
    expect(lines.find((line) => line.id === 'tax')?.flow).toBe('taxes');
    expect(lines.find((line) => line.id === 'hoa')?.flow).toBe('core_spending');
    const totals = summarize(lines, DEFAULT_BUDGET_SETTINGS, '2026-02-01', '2026-02-28', true);
    expect(totals.taxes).toBe(13000);
    expect(totals.cardSpending).toBe(0);
    expect(totals.coreSpending).toBe(290);
  });

  it('turns itemized card payments into transfers and keeps charges as spending', () => {
    const bare = prepareBudget({
      accounts: [ffcu],
      checkingTxns: [txn({ id: 'pay', accountId: 'ffcu', date: '2026-03-05', amount: -2000, category: 'Credit Card', description: 'Chase Sapphire' })],
      entries: [],
      categories: builtinCategories(),
      cards: [chase],
      cardTxns: [],
    });
    expect(bare.find((line) => line.id === 'pay')?.reportLabel).toBe(CARD_SPENDING_LABEL);
    expect(summarize(bare, DEFAULT_BUDGET_SETTINGS, '2026-03-01', '2026-03-31', true).cardSpending).toBe(2000);

    const itemized = prepareBudget({
      accounts: [ffcu],
      checkingTxns: [txn({ id: 'pay', accountId: 'ffcu', date: '2026-03-05', amount: -2000, category: 'Credit Card', description: 'Chase Sapphire' })],
      entries: [],
      categories: builtinCategories(),
      cards: [chase],
      cardTxns: [
        cardTxn({ id: 'g', date: '2026-03-02', amount: -1500, description: 'Market', category: 'Food & Groceries' }),
        cardTxn({ id: 's', date: '2026-03-03', amount: -500, description: 'Store', category: 'Shopping' }),
        cardTxn({ id: 'p', date: '2026-03-05', amount: 2000, description: 'Autopay thank you', category: 'Credit Card' }),
      ],
    });
    expect(itemized.find((line) => line.id === 'pay')?.flow).toBe('transfer_internal');
    expect(itemized.find((line) => line.id === 'p')?.flow).toBe('transfer_internal');
    const totals = summarize(itemized, DEFAULT_BUDGET_SETTINGS, '2026-03-01', '2026-03-31', true);
    expect(totals.cardSpending).toBe(0);
    expect(totals.coreSpending).toBe(2000);
    expect(totals.income).toBe(0);
  });
});

describe('budget transfers and balances', () => {
  it('cancels FFCU and SoFi transfer legs and never calls the incoming leg income', () => {
    const lines = prepareBudget({
      accounts: [ffcu, sofi],
      checkingTxns: [
        txn({ id: 'out', accountId: 'ffcu', date: '2026-03-01', amount: -800, category: 'Transfer', description: 'To SoFi' }),
        txn({ id: 'in', accountId: 'sofi', date: '2026-03-03', amount: 800, category: 'Income', description: 'Transfer from FFCU' }),
        txn({ id: 'pay', accountId: 'sofi', date: '2026-03-04', amount: 800, category: 'Income', description: 'Paycheck' }),
      ],
      entries: [],
      categories: builtinCategories(),
      cards: [],
      cardTxns: [],
    });
    expect(lines.find((line) => line.id === 'out')?.matchedTransfer).toBe(true);
    expect(lines.find((line) => line.id === 'in')?.matchedTransfer).toBe(true);
    expect(lines.find((line) => line.id === 'pay')?.matchedTransfer).toBe(false);
    const household = summarize(lines, DEFAULT_BUDGET_SETTINGS, '2026-03-01', '2026-03-31', true);
    expect(household.income).toBe(800);
    expect(household.net).toBe(800);
    const oneAccount = summarize(
      lines.filter((line) => line.accountId === 'ffcu'),
      DEFAULT_BUDGET_SETTINGS,
      '2026-03-01',
      '2026-03-31',
      false,
    );
    expect(oneAccount.net).toBe(-800);
  });

  it('keeps seeded checking balances when archived rows are analytics-only', () => {
    const manual = [
      txn({ id: 'm', accountId: 'ffcu', date: '2026-02-01', amount: -25, category: 'Fee', description: 'Wire' }),
    ];
    const history = [
      entry({ id: 'h1', date: '2019-07-01', amount: -2050, category: 'Monthly Bills', description: 'Rent', sourceRow: 1 }),
      entry({ id: 'h2', date: '2025-12-31', amount: 100, category: 'Income', description: 'Paycheck', sourceRow: 2, accountName: 'SoFi Checking', source: 'sofi' }),
      entry({ id: 'h3', date: '2026-02-01', amount: -25, category: 'Fee', description: 'Wire', source: 'ffcu', sourceRow: 3 }),
      entry({ id: 'h4', date: '2026-02-02', amount: -999, category: 'Shopping', description: 'Late import', source: 'ffcu', sourceRow: 4 }),
    ];
    expect(checkingBalance(ffcu, manual, '2026-11-19')).toBe(2025);
    expect(checkingBalance(sofi, [], '2026-11-19')).toBeCloseTo(2110.86);
    const lines = prepareBudget({
      accounts: [ffcu, sofi],
      checkingTxns: manual,
      entries: history,
      categories: builtinCategories(),
      cards: [],
      cardTxns: [],
    });
    expect(lines.filter((line) => line.countsInBalance).map((line) => line.id)).toEqual(['m']);
    expect(lines.some((line) => line.id === 'h3')).toBe(false);
    expect(lines.find((line) => line.id === 'h1')?.beforeOpening).toBe(true);
    expect(lines.find((line) => line.id === 'h4')?.countsInBalance).toBe(false);
    const totals = summarize(lines, DEFAULT_BUDGET_SETTINGS, '2019-01-01', '2026-12-31', true);
    expect(totals.coreSpending).toBe(2050 + 25 + 999);
    const balances = balanceSeries([ffcu], manual, history, '2026-02-28');
    const february = balances[0].points.find((point) => point.month === '2026-02');
    expect(february?.balance).toBe(2025);
    const december = balances[0].points.find((point) => point.month === '2025-12');
    expect(december?.balance).toBe(2050);
  });
});

describe('budget math', () => {
  it('computes take-home savings rate with optional payroll and without dependent savings', () => {
    const lines = prepareBudget({
      accounts: [ffcu],
      checkingTxns: [
        txn({ id: 'in', accountId: 'ffcu', date: '2026-01-15', amount: 10000, category: 'Income', description: 'Paycheck' }),
        txn({ id: 'sav', accountId: 'ffcu', date: '2026-01-16', amount: -1000, category: 'Savings', description: 'Ally' }),
        txn({ id: 'inv', accountId: 'ffcu', date: '2026-01-17', amount: -2000, category: 'Investments', description: 'Brokerage' }),
        txn({ id: 'em', accountId: 'ffcu', date: '2026-01-18', amount: -500, category: 'Savings', description: "Emmy's Savings" }),
      ],
      entries: [],
      categories: builtinCategories(),
      cards: [],
      cardTxns: [],
    });
    const settings = { payrollAmount: 600, payrollCadence: 'biweekly' as const };
    expect(payrollForRange(settings, '2026-01-01', '2026-01-14')).toBe(600);
    const totals = summarize(lines, settings, '2026-01-15', '2026-01-28', true);
    expect(totals.savings).toBe(1000);
    expect(totals.dependentSavings).toBe(500);
    expect(totals.investment).toBe(2000);
    expect(totals.payroll).toBe(600);
    expect(totals.savingsRate).toBeCloseTo(0.36);
  });

  it('builds a 3-month average and keeps taxes off the core spending line', () => {
    expect(movingAverage([1, 2, 3, 4], 3)).toEqual([null, null, 2, 3]);
    const lines = prepareBudget({
      accounts: [ffcu],
      checkingTxns: [
        txn({ id: 'a', accountId: 'ffcu', date: '2026-01-05', amount: 100, category: 'Income', description: 'Pay' }),
        txn({ id: 'b', accountId: 'ffcu', date: '2026-01-06', amount: -40, category: 'Monthly Bills', description: 'Rent' }),
        txn({ id: 'c', accountId: 'ffcu', date: '2026-02-06', amount: -10, category: 'Taxes', description: 'IRS' }),
        txn({ id: 'd', accountId: 'ffcu', date: '2026-03-06', amount: -7, category: 'Loan', description: 'Auto' }),
      ],
      entries: [],
      categories: builtinCategories(),
      cards: [],
      cardTxns: [],
    });
    const series = monthlySeries(lines, DEFAULT_BUDGET_SETTINGS, '2026-01-01', '2026-03-31', true);
    expect(series.map((point) => point.coreSpending)).toEqual([40, 0, 0]);
    expect(series.map((point) => point.taxes)).toEqual([0, 10, 0]);
    expect(series.map((point) => point.debtPayments)).toEqual([0, 0, 7]);
    expect(series[2].incomeMa).toBeCloseTo(100 / 3);
    const categories = categorySeries(lines, ['Monthly Bills'], '2026-01-01', '2026-01-31');
    expect(categories[0].values['Monthly Bills']).toBe(40);
    const targets = targetRows(lines, builtinTargets(), '2026-01-01', '2026-01-31');
    const rent = targets.find((row) => row.label === 'Rent');
    const cell = targets.find((row) => row.label === 'Cell Phone');
    expect(rent?.actual).toBe(40);
    expect(cell?.untracked).toBe(true);
    expect(cell?.budget).toBe(201);
    expect(periodBounds('trailing12', '2026-11-19', '2026-11').start).toBe('2025-12-01');
    expect(chartBounds('24m', '2026-11-19', '2019-07-01').start).toBe('2024-12-01');
    expect(chartBounds('all', '2026-11-19', '2019-07-04').start).toBe('2019-07-01');
    expect(chartMonthLabel('2024-12')).toBe("Dec '24");
  });
});

describe('archived history larger than one PostgREST page', () => {
  it('keeps trailing-12 income when more than 1000 rows exist', () => {
    const today = '2026-11-20';
    const archive = volumeArchive();
    expect(archive).toHaveLength(2276);
    const recent = archive.filter((row) => row.date >= '2025-12-01' && row.date <= '2026-11-13');
    expect(recent.length).toBe(213);
    const lines = prepareBudget({
      accounts: [ffcu, sofi],
      checkingTxns: [],
      entries: archive,
      categories: builtinCategories(),
      cards: [],
      cardTxns: [],
    });
    const bounds = periodBounds('trailing12', today, '2026-11');
    const totals = summarize(lines, DEFAULT_BUDGET_SETTINGS, bounds.start, bounds.end, true);
    expect(totals.income).toBe(117600);
    expect(checkingBalance(ffcu, [], today)).toBe(2050);
    expect(checkingBalance(sofi, [], today)).toBeCloseTo(2110.86);

    const oldestPage = [...archive].sort((a, b) => a.date.localeCompare(b.date) || a.sourceRow - b.sourceRow).slice(0, 1000);
    const truncated = prepareBudget({
      accounts: [ffcu, sofi],
      checkingTxns: [],
      entries: oldestPage,
      categories: builtinCategories(),
      cards: [],
      cardTxns: [],
    });
    expect(summarize(truncated, DEFAULT_BUDGET_SETTINGS, bounds.start, bounds.end, true).income).toBe(0);
    const rent = targetRows(lines, builtinTargets(), bounds.start, bounds.end).find((row) => row.label === 'Rent');
    expect(rent?.actual).toBe(24600);
  });
});

function volumeArchive(): BudgetEntry[] {
  const rows: BudgetEntry[] = [];
  let sourceRow = 1;
  const push = (date: string, category: string, description: string, amount: number, accountName = 'FFCU Checking') => {
    rows.push(
      entry({
        id: `vol-${sourceRow}`,
        date,
        amount,
        category,
        description,
        accountName,
        source: 'archive',
        sourceRow,
      }),
    );
    sourceRow += 1;
  };
  for (let index = 0; index < 2063; index += 1) {
    const day = String((index % 27) + 1).padStart(2, '0');
    const month = (index % 78) + 1;
    const year = 2019 + Math.floor((index * 6) / 2063);
    const clampedYear = Math.min(year, 2025);
    const monthNumber = clampedYear === 2025 ? Math.min(month, 11) : ((month - 1) % 12) + 1;
    const date = `${clampedYear}-${String(monthNumber).padStart(2, '0')}-${day}`;
    push(date < '2019-07-24' ? '2019-07-24' : date, 'Shopping', 'Old', -12, index % 2 === 0 ? 'FFCU Checking' : 'SoFi Checking');
  }
  for (let month = 0; month < 12; month += 1) {
    const year = month === 0 ? 2025 : 2026;
    const monthNumber = month === 0 ? 12 : month;
    const stamp = `${year}-${String(monthNumber).padStart(2, '0')}`;
    push(`${stamp}-01`, 'Income', 'Paycheck', 4900);
    push(stamp === '2026-11' ? `${stamp}-13` : `${stamp}-15`, 'Income', 'Paycheck', 4900, 'SoFi Checking');
    push(`${stamp}-02`, 'Monthly Bills', 'Rent', -2050);
  }
  for (let index = 0; index < 177; index += 1) {
    const month = (index % 12) + 1;
    const year = month === 12 ? 2025 : 2026;
    const monthNumber = month === 12 ? 12 : month;
    const day = String((index % 12) + 1).padStart(2, '0');
    const date = `${year}-${String(monthNumber).padStart(2, '0')}-${day}`;
    if (index < 49) push(date, 'Emmy', 'Tutoring', -40);
    else if (index < 54) push(date, 'Check', 'Check', -20);
    else if (index < 70) push(date, 'Transfer', 'Venmo', -15);
    else push(date, 'Shopping', 'Store', -18);
  }
  return rows;
}
