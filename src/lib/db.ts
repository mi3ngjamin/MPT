import { isFlowType } from '../domain/budget';
import { collectQuotes, type FinnhubResult } from '../domain/finnhub';
import { legacyActivitiesToRows, type LegacyPlan } from '../domain/legacy';
import {
  DEFAULT_BUDGET_SETTINGS,
  DEFAULT_PREFERENCES,
  type Account,
  type Activity,
  type BudgetCategory,
  type BudgetEntry,
  type BudgetSettings,
  type BudgetSource,
  type BudgetTarget,
  type CardAccount,
  type CardTxn,
  type CheckingAccount,
  type CheckingTxn,
  type FlowType,
  type Liability,
  type ModeledBuy,
  type NetWorthSnapshot,
  type Occurrence,
  type PayrollCadence,
  type Portfolio,
  type Preferences,
  type PriceScenario,
  type Quote,
  type RecurringItem,
  type Snapshot,
  type WhatIfPrice,
} from '../domain/types';
import { remapSnapshot } from './backup';
import { collectPages } from './paging';
import { supabase } from './supabase';

type Row = Record<string, unknown>;

function num(value: unknown): number | null {
  if (value == null || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function req(value: unknown): number {
  return num(value) ?? 0;
}

function str(value: unknown): string | null {
  return value == null || value === '' ? null : String(value);
}

async function uid(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error(error?.message ?? 'Sign in required.');
  return data.user.id;
}

async function rows(table: string, orderBy = 'id'): Promise<Row[]> {
  return collectPages(async (from, to) => {
    const { data, error } = await supabase.from(table).select('*').order(orderBy, { ascending: true }).range(from, to);
    if (error) throw new Error(error.message);
    return (data ?? []) as Row[];
  });
}

async function write(table: string, values: Row | Row[], options?: { onConflict?: string }) {
  const query = supabase.from(table).upsert(values, options?.onConflict ? { onConflict: options.onConflict } : undefined);
  const { error } = await query;
  if (error) throw new Error(error.message);
}

async function remove(table: string, id: string) {
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function loadSnapshot(): Promise<Snapshot> {
  const [
    portfolios,
    accounts,
    activities,
    quotes,
    whatIfs,
    scenarios,
    scenarioPrices,
    modeled,
    checkingAccounts,
    checkingTxns,
    recurring,
    occurrences,
    liabilities,
    snapshots,
    preferences,
    budgetCategories,
    budgetTargets,
    budgetEntries,
    budgetSettings,
    cardAccounts,
    cardTxns,
  ] = await Promise.all([
    rows('portfolios'),
    rows('accounts'),
    rows('activities'),
    rows('quotes'),
    rows('what_if_prices'),
    rows('price_scenarios'),
    rows('price_scenario_prices'),
    rows('modeled_buys'),
    rows('checking_accounts'),
    rows('checking_transactions'),
    rows('recurring_items'),
    rows('recurring_occurrences'),
    rows('liabilities'),
    rows('net_worth_snapshots'),
    rows('preferences', 'user_id'),
    rows('budget_categories'),
    rows('budget_targets'),
    rows('budget_entries'),
    rows('budget_settings', 'user_id'),
    rows('card_accounts'),
    rows('card_transactions'),
  ]);
  const preference = preferences[0];
  return {
    portfolios: portfolios.map(portfolioFrom),
    accounts: accounts.map(accountFrom),
    activities: activities.map(activityFrom),
    quotes: quotes.map(quoteFrom),
    whatIfs: whatIfs.map((row) => ({ symbol: String(row.symbol), price: req(row.price) })),
    scenarios: scenarios.map((row) => ({ id: String(row.id), name: String(row.name) })),
    scenarioPrices: scenarioPrices.map((row) => ({
      scenarioId: String(row.scenario_id),
      symbol: String(row.symbol),
      price: req(row.price),
    })),
    modeled: modeled.map(modeledFrom),
    checkingAccounts: checkingAccounts.map(checkingAccountFrom),
    checkingTxns: checkingTxns.map(txnFrom),
    recurring: recurring.map(recurringFrom),
    occurrences: occurrences.map(occurrenceFrom),
    liabilities: liabilities.map(liabilityFrom),
    snapshots: snapshots.map(snapshotFrom),
    preferences: preference ? preferenceFrom(preference) : { ...DEFAULT_PREFERENCES },
    budgetCategories: budgetCategories.map(budgetCategoryFrom).sort((a, b) => a.sortOrder - b.sortOrder),
    budgetTargets: budgetTargets.map(budgetTargetFrom),
    budgetEntries: budgetEntries.map(budgetEntryFrom),
    budgetSettings: budgetSettings[0] ? budgetSettingsFrom(budgetSettings[0]) : { ...DEFAULT_BUDGET_SETTINGS },
    cardAccounts: cardAccounts.map(cardAccountFrom),
    cardTxns: cardTxns.map(cardTxnFrom),
  };
}

export async function savePortfolio(row: Portfolio) {
  const userId = await uid();
  await write('portfolios', {
    id: row.id,
    user_id: userId,
    name: row.name,
    include_in_net_worth: row.includeInNetWorth,
    sort_order: row.sortOrder,
  });
}

export async function deletePortfolio(id: string) {
  await remove('portfolios', id);
}

export async function saveAccount(row: Account) {
  const userId = await uid();
  await write('accounts', {
    id: row.id,
    user_id: userId,
    portfolio_id: row.portfolioId,
    name: row.name,
    account_type: row.accountType,
    tax_treatment: row.taxTreatment,
    sort_order: row.sortOrder,
  });
}

export async function deleteAccount(id: string) {
  const { error: transferError } = await supabase.from('activities').delete().eq('transfer_account_id', id);
  if (transferError) throw new Error(transferError.message);
  const { error: activityError } = await supabase.from('activities').delete().eq('account_id', id);
  if (activityError) throw new Error(activityError.message);
  await remove('accounts', id);
}

export async function saveActivity(row: Activity) {
  const userId = await uid();
  await write('activities', activityTo(row, userId));
}

export async function deleteActivity(id: string) {
  await remove('activities', id);
}

export async function saveCheckingAccount(row: CheckingAccount) {
  const userId = await uid();
  await write('checking_accounts', {
    id: row.id,
    user_id: userId,
    name: row.name,
    opening_balance: row.openingBalance,
    opening_date: row.openingDate,
    low_balance_floor: row.lowBalanceFloor,
    sort_order: row.sortOrder,
  });
}

export async function deleteCheckingAccount(id: string) {
  await remove('checking_accounts', id);
}

export async function saveCheckingTxn(row: CheckingTxn) {
  const userId = await uid();
  await write('checking_transactions', {
    id: row.id,
    user_id: userId,
    account_id: row.accountId,
    txn_date: row.date,
    description: row.description,
    amount: row.amount,
    category: row.category,
    cleared: row.cleared,
    recurring_item_id: row.recurringItemId,
    flow_override: row.flowOverride ?? null,
  });
}

export async function deleteCheckingTxn(id: string) {
  await remove('checking_transactions', id);
}

export async function saveBudgetCategory(row: BudgetCategory) {
  const userId = await uid();
  await write('budget_categories', {
    id: row.id,
    user_id: userId,
    name: row.name,
    flow_type: row.flowType,
    group_name: row.groupName,
    budget_monthly: row.budgetMonthly,
    color: row.color,
    hidden: row.hidden,
    sort_order: row.sortOrder,
  });
}

export async function deleteBudgetCategory(id: string) {
  await remove('budget_categories', id);
}

export async function saveBudgetTarget(row: BudgetTarget) {
  const userId = await uid();
  await write('budget_targets', {
    id: row.id,
    user_id: userId,
    label: row.label,
    monthly_amount: row.monthlyAmount,
    category_name: row.categoryName,
    payee: row.payee,
  });
}

export async function deleteBudgetTarget(id: string) {
  await remove('budget_targets', id);
}

export async function saveBudgetSettings(row: BudgetSettings) {
  const userId = await uid();
  await write('budget_settings', {
    user_id: userId,
    payroll_amount: row.payrollAmount,
    payroll_cadence: row.payrollCadence,
  });
}

export async function saveBudgetEntry(row: BudgetEntry) {
  const userId = await uid();
  await write('budget_entries', {
    id: row.id,
    user_id: userId,
    account_name: row.accountName,
    txn_date: row.date,
    category: row.category,
    description: row.description,
    amount: row.amount,
    running_balance: row.runningBalance,
    source: row.source,
    source_row: row.sourceRow,
    flow_override: row.flowOverride,
    category_locked: row.categoryLocked,
  });
}

export async function saveCardAccount(row: CardAccount) {
  const userId = await uid();
  await write('card_accounts', {
    id: row.id,
    user_id: userId,
    name: row.name,
    match_names: row.matchNames,
    sort_order: row.sortOrder,
  });
}

export async function deleteCardAccount(id: string) {
  await remove('card_accounts', id);
}

export async function saveCardTxn(row: CardTxn) {
  const userId = await uid();
  await write('card_transactions', cardTxnTo(row, userId));
}

export async function saveCardTxns(rows: CardTxn[]) {
  if (!rows.length) return;
  const userId = await uid();
  await write('card_transactions', rows.map((row) => cardTxnTo(row, userId)));
}

export async function deleteCardTxn(id: string) {
  await remove('card_transactions', id);
}

export async function saveRecurring(row: RecurringItem) {
  const userId = await uid();
  await write('recurring_items', {
    id: row.id,
    user_id: userId,
    account_id: row.accountId,
    name: row.name,
    kind: row.kind,
    amount: row.amount,
    cadence: row.cadence,
    day_of_month: row.dayOfMonth,
    interval_weeks: row.intervalWeeks,
    anchor_date: row.anchorDate,
    month_of_year: row.monthOfYear,
    autopay: row.autopay,
    active: row.active,
    category: row.category,
  });
}

export async function deleteRecurring(id: string) {
  await remove('recurring_items', id);
}

export async function saveOccurrence(row: Occurrence) {
  const userId = await uid();
  await write('recurring_occurrences', {
    id: row.id,
    user_id: userId,
    recurring_item_id: row.recurringItemId,
    occurrence_date: row.occurrenceDate,
    status: row.status,
    transaction_id: row.transactionId,
  });
}

export async function deleteOccurrence(id: string) {
  await remove('recurring_occurrences', id);
}

export async function saveLiability(row: Liability) {
  const userId = await uid();
  await write('liabilities', {
    id: row.id,
    user_id: userId,
    name: row.name,
    liability_type: row.liabilityType,
    balance: row.balance,
    as_of: row.asOf,
    include_in_net_worth: row.includeInNetWorth,
    unresolved: row.unresolved,
    note: row.note,
  });
}

export async function deleteLiability(id: string) {
  await remove('liabilities', id);
}

export async function saveWhatIf(row: WhatIfPrice) {
  const userId = await uid();
  await write(
    'what_if_prices',
    { user_id: userId, symbol: row.symbol.toUpperCase(), price: row.price },
    { onConflict: 'user_id,symbol' },
  );
}

export async function deleteWhatIf(symbol: string) {
  const userId = await uid();
  const { error } = await supabase.from('what_if_prices').delete().eq('user_id', userId).eq('symbol', symbol.toUpperCase());
  if (error) throw new Error(error.message);
}

export async function saveScenario(scenario: PriceScenario, prices: WhatIfPrice[]) {
  const userId = await uid();
  await write('price_scenarios', { id: scenario.id, user_id: userId, name: scenario.name });
  if (prices.length) {
    await write(
      'price_scenario_prices',
      prices.map((price) => ({
        user_id: userId,
        scenario_id: scenario.id,
        symbol: price.symbol.toUpperCase(),
        price: price.price,
      })),
      { onConflict: 'scenario_id,symbol' },
    );
  }
}

export async function deleteScenario(id: string) {
  await remove('price_scenarios', id);
}

export async function replaceWhatIfs(prices: WhatIfPrice[]) {
  const userId = await uid();
  const { error } = await supabase.from('what_if_prices').delete().eq('user_id', userId);
  if (error) throw new Error(error.message);
  if (!prices.length) return;
  await write(
    'what_if_prices',
    prices.map((price) => ({ user_id: userId, symbol: price.symbol.toUpperCase(), price: price.price })),
    { onConflict: 'user_id,symbol' },
  );
}

export async function saveModeled(row: ModeledBuy) {
  const userId = await uid();
  await write(
    'modeled_buys',
    {
      id: row.id,
      user_id: userId,
      account_id: row.accountId,
      symbol: row.symbol.toUpperCase(),
      amount: row.amount,
      amount_source: row.amountSource,
    },
    { onConflict: 'user_id,account_id,symbol' },
  );
}

export async function deleteModeled(id: string) {
  await remove('modeled_buys', id);
}

export async function saveQuote(row: Quote) {
  const userId = await uid();
  await write(
    'quotes',
    {
      user_id: userId,
      symbol: row.symbol.toUpperCase(),
      price: row.price,
      previous_close: row.previousClose,
      source: row.source,
      fetched_at: row.fetchedAt,
    },
    { onConflict: 'user_id,symbol,source' },
  );
}

export async function savePreferences(row: Preferences) {
  const userId = await uid();
  await write(
    'preferences',
    {
      user_id: userId,
      price_mode: row.priceMode,
      theme: row.theme,
      legacy_import_status: row.legacyImportStatus,
      projection_days: row.projectionDays,
      active_scenario_id: row.activeScenarioId,
    },
    { onConflict: 'user_id' },
  );
}

export async function upsertDailySnapshot(row: Omit<NetWorthSnapshot, 'id'>) {
  const userId = await uid();
  const { error } = await supabase.from('net_worth_snapshots').upsert(
    {
      user_id: userId,
      snapshot_date: row.snapshotDate,
      net_worth: row.netWorth,
      invested_value: row.investedValue,
      brokerage_cash: row.brokerageCash,
      checking_cash: row.checkingCash,
      liabilities: row.liabilities,
      unrealized_pl: row.unrealizedPL,
      realized_pl: row.realizedPL,
      note: row.note,
    },
    { onConflict: 'user_id,snapshot_date' },
  );
  if (error) throw new Error(error.message);
}

export async function saveSnapshotRow(row: NetWorthSnapshot) {
  const userId = await uid();
  await write('net_worth_snapshots', {
    id: row.id,
    user_id: userId,
    snapshot_date: row.snapshotDate,
    net_worth: row.netWorth,
    invested_value: row.investedValue,
    brokerage_cash: row.brokerageCash,
    checking_cash: row.checkingCash,
    liabilities: row.liabilities,
    unrealized_pl: row.unrealizedPL,
    realized_pl: row.realizedPL,
    note: row.note,
  });
}

export async function importLegacyPlan(plan: LegacyPlan) {
  const userId = await uid();
  const portfolioId = crypto.randomUUID();
  if (plan.activities.length || plan.accounts.length) {
    await write('portfolios', {
      id: portfolioId,
      user_id: userId,
      name: plan.portfolioName,
      include_in_net_worth: true,
      sort_order: 0,
    });
  }
  const accountIds: Record<string, string> = {};
  for (const [index, name] of plan.accounts.entries()) {
    const id = crypto.randomUUID();
    accountIds[name] = id;
    await write('accounts', {
      id,
      user_id: userId,
      portfolio_id: portfolioId,
      name,
      account_type: 'brokerage',
      tax_treatment: 'taxable',
      sort_order: index,
    });
  }
  const activities = legacyActivitiesToRows(plan, accountIds).map((row) => activityTo(row, userId));
  if (activities.length) await write('activities', activities);
  let checkingId: string | null = null;
  if (plan.transactions.length || plan.bills.length || plan.openingBalance) {
    checkingId = crypto.randomUUID();
    await write('checking_accounts', {
      id: checkingId,
      user_id: userId,
      name: plan.checkingName,
      opening_balance: plan.openingBalance,
      opening_date: plan.openingDate,
      low_balance_floor: null,
      sort_order: 0,
    });
  }
  if (checkingId && plan.transactions.length) {
    await write(
      'checking_transactions',
      plan.transactions.map((row) => ({
        id: crypto.randomUUID(),
        user_id: userId,
        account_id: checkingId,
        txn_date: row.date,
        description: row.description,
        amount: row.amount,
        category: row.category,
        cleared: row.cleared,
      })),
    );
  }
  if (checkingId && plan.bills.length) {
    await write(
      'recurring_items',
      plan.bills.map((row) => ({
        id: crypto.randomUUID(),
        user_id: userId,
        account_id: checkingId,
        name: row.name,
        kind: row.kind,
        amount: row.amount,
        cadence: 'monthly',
        day_of_month: row.dayOfMonth,
        autopay: false,
        active: true,
        category: row.category,
      })),
    );
  }
  if (plan.quotes.length) {
    const stale = new Date(Date.now() - 10 * 86_400_000).toISOString();
    await write(
      'quotes',
      plan.quotes.map((row) => ({
        user_id: userId,
        symbol: row.symbol,
        price: row.price,
        previous_close: null,
        source: 'finnhub',
        fetched_at: stale,
      })),
      { onConflict: 'user_id,symbol,source' },
    );
  }
}

export async function replaceWithSnapshot(next: Snapshot) {
  const userId = await uid();
  const tables = [
    'card_transactions',
    'budget_entries',
    'budget_import_raw',
    'budget_targets',
    'budget_categories',
    'card_accounts',
    'budget_settings',
    'recurring_occurrences',
    'checking_transactions',
    'recurring_items',
    'modeled_buys',
    'price_scenario_prices',
    'what_if_prices',
    'activities',
    'tax_lots',
    'quotes',
    'net_worth_snapshots',
    'liabilities',
    'checking_accounts',
    'price_scenarios',
    'accounts',
    'portfolios',
  ];
  for (const table of tables) {
    const { error } = await supabase.from(table).delete().eq('user_id', userId);
    if (error) throw new Error(error.message);
  }
  await insertSnapshot(userId, next);
}

export async function mergeSnapshot(next: Snapshot) {
  const userId = await uid();
  await insertSnapshot(userId, remapSnapshot(next));
}

async function insertSnapshot(userId: string, next: Snapshot) {
  if (next.portfolios.length) {
    await write(
      'portfolios',
      next.portfolios.map((row) => ({
        id: row.id,
        user_id: userId,
        name: row.name,
        include_in_net_worth: row.includeInNetWorth,
        sort_order: row.sortOrder,
      })),
    );
  }
  if (next.accounts.length) {
    await write(
      'accounts',
      next.accounts.map((row) => ({
        id: row.id,
        user_id: userId,
        portfolio_id: row.portfolioId,
        name: row.name,
        account_type: row.accountType,
        tax_treatment: row.taxTreatment,
        sort_order: row.sortOrder,
      })),
    );
  }
  if (next.activities.length) await write('activities', next.activities.map((row) => activityTo(row, userId)));
  if (next.scenarios.length) {
    await write(
      'price_scenarios',
      next.scenarios.map((row) => ({ id: row.id, user_id: userId, name: row.name })),
    );
  }
  if (next.scenarioPrices.length) {
    await write(
      'price_scenario_prices',
      next.scenarioPrices.map((row) => ({
        user_id: userId,
        scenario_id: row.scenarioId,
        symbol: row.symbol,
        price: row.price,
      })),
    );
  }
  if (next.whatIfs.length) {
    await write(
      'what_if_prices',
      next.whatIfs.map((row) => ({ user_id: userId, symbol: row.symbol, price: row.price })),
      { onConflict: 'user_id,symbol' },
    );
  }
  if (next.quotes.length) {
    await write(
      'quotes',
      next.quotes.map((row) => ({
        user_id: userId,
        symbol: row.symbol,
        price: row.price,
        previous_close: row.previousClose,
        source: row.source,
        fetched_at: row.fetchedAt,
      })),
      { onConflict: 'user_id,symbol,source' },
    );
  }
  if (next.checkingAccounts.length) {
    await write(
      'checking_accounts',
      next.checkingAccounts.map((row) => ({
        id: row.id,
        user_id: userId,
        name: row.name,
        opening_balance: row.openingBalance,
        opening_date: row.openingDate,
        low_balance_floor: row.lowBalanceFloor,
        sort_order: row.sortOrder,
      })),
    );
  }
  if (next.recurring.length) {
    await write(
      'recurring_items',
      next.recurring.map((row) => ({
        id: row.id,
        user_id: userId,
        account_id: row.accountId,
        name: row.name,
        kind: row.kind,
        amount: row.amount,
        cadence: row.cadence,
        day_of_month: row.dayOfMonth,
        interval_weeks: row.intervalWeeks,
        anchor_date: row.anchorDate,
        month_of_year: row.monthOfYear,
        autopay: row.autopay,
        active: row.active,
        category: row.category,
      })),
    );
  }
  if (next.checkingTxns.length) {
    await write(
      'checking_transactions',
      next.checkingTxns.map((row) => ({
        id: row.id,
        user_id: userId,
        account_id: row.accountId,
        txn_date: row.date,
        description: row.description,
        amount: row.amount,
        category: row.category,
        cleared: row.cleared,
        recurring_item_id: row.recurringItemId,
        flow_override: row.flowOverride ?? null,
      })),
    );
  }
  if (next.occurrences.length) {
    await write(
      'recurring_occurrences',
      next.occurrences.map((row) => ({
        id: row.id,
        user_id: userId,
        recurring_item_id: row.recurringItemId,
        occurrence_date: row.occurrenceDate,
        status: row.status,
        transaction_id: row.transactionId,
      })),
    );
  }
  if (next.modeled.length) {
    await write('modeled_buys', next.modeled.map((row) => ({
      id: row.id,
      user_id: userId,
      account_id: row.accountId,
      symbol: row.symbol,
      amount: row.amount,
      amount_source: row.amountSource,
    })));
  }
  if (next.liabilities.length) {
    await write(
      'liabilities',
      next.liabilities.map((row) => ({
        id: row.id,
        user_id: userId,
        name: row.name,
        liability_type: row.liabilityType,
        balance: row.balance,
        as_of: row.asOf,
        include_in_net_worth: row.includeInNetWorth,
        unresolved: row.unresolved,
        note: row.note,
      })),
    );
  }
  if (next.snapshots.length) {
    await write(
      'net_worth_snapshots',
      next.snapshots.map((row) => ({
        id: row.id,
        user_id: userId,
        snapshot_date: row.snapshotDate,
        net_worth: row.netWorth,
        invested_value: row.investedValue,
        brokerage_cash: row.brokerageCash,
        checking_cash: row.checkingCash,
        liabilities: row.liabilities,
        unrealized_pl: row.unrealizedPL,
        realized_pl: row.realizedPL,
        note: row.note,
      })),
    );
  }
  if (next.budgetCategories?.length) {
    await write(
      'budget_categories',
      next.budgetCategories.map((row) => ({
        id: row.id,
        user_id: userId,
        name: row.name,
        flow_type: row.flowType,
        group_name: row.groupName,
        budget_monthly: row.budgetMonthly,
        color: row.color,
        hidden: row.hidden,
        sort_order: row.sortOrder,
      })),
    );
  }
  if (next.budgetTargets?.length) {
    await write(
      'budget_targets',
      next.budgetTargets.map((row) => ({
        id: row.id,
        user_id: userId,
        label: row.label,
        monthly_amount: row.monthlyAmount,
        category_name: row.categoryName,
        payee: row.payee,
      })),
    );
  }
  if (next.budgetEntries?.length) {
    await write(
      'budget_entries',
      next.budgetEntries.map((row) => ({
        id: row.id,
        user_id: userId,
        account_name: row.accountName,
        txn_date: row.date,
        category: row.category,
        description: row.description,
        amount: row.amount,
        running_balance: row.runningBalance,
        source: row.source,
        source_row: row.sourceRow,
        flow_override: row.flowOverride,
        category_locked: row.categoryLocked,
      })),
    );
  }
  if (next.cardAccounts?.length) {
    await write(
      'card_accounts',
      next.cardAccounts.map((row) => ({
        id: row.id,
        user_id: userId,
        name: row.name,
        match_names: row.matchNames,
        sort_order: row.sortOrder,
      })),
    );
  }
  if (next.cardTxns?.length) {
    await write('card_transactions', next.cardTxns.map((row) => cardTxnTo(row, userId)));
  }
  if (next.budgetSettings) await saveBudgetSettings(next.budgetSettings);
  await savePreferences(next.preferences);
}

export async function fetchFinnhub(
  symbols: string[],
  options?: { onQuote?: (quote: Quote) => Promise<void> },
): Promise<FinnhubResult> {
  const key = import.meta.env.VITE_FINNHUB_API_KEY;
  if (!key) throw new Error('Finnhub key is not configured for this build.');
  return collectQuotes(
    symbols,
    async (symbol) => {
      const response = await fetch(
        `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(key)}`,
      );
      if (!response.ok) return { status: response.status };
      const body = (await response.json()) as { c?: number; pc?: number };
      return { status: response.status, body };
    },
    { onQuote: options?.onQuote },
  );
}

function portfolioFrom(row: Row): Portfolio {
  return {
    id: String(row.id),
    name: String(row.name),
    includeInNetWorth: Boolean(row.include_in_net_worth),
    sortOrder: req(row.sort_order),
  };
}

function accountFrom(row: Row): Account {
  return {
    id: String(row.id),
    portfolioId: String(row.portfolio_id),
    name: String(row.name),
    accountType: row.account_type as Account['accountType'],
    taxTreatment: row.tax_treatment as Account['taxTreatment'],
    sortOrder: req(row.sort_order),
  };
}

function activityFrom(row: Row): Activity {
  return {
    id: String(row.id),
    accountId: String(row.account_id),
    transferAccountId: str(row.transfer_account_id),
    date: String(row.activity_date),
    action: row.action as Activity['action'],
    assetType: row.asset_type as Activity['assetType'],
    symbol: str(row.symbol),
    quantity: num(row.quantity),
    price: num(row.price),
    fees: req(row.fees),
    amount: num(row.amount),
    multiplier: num(row.multiplier),
    ratio: num(row.ratio),
    deltaQuantity: num(row.delta_quantity),
    deltaCostBasis: num(row.delta_cost_basis),
    deltaCash: num(row.delta_cash),
    underlying: str(row.underlying),
    expiry: str(row.expiry),
    strike: num(row.strike),
    optionRight: row.option_right === 'C' || row.option_right === 'P' ? row.option_right : null,
    note: str(row.note),
    createdAt: str(row.created_at),
  };
}

function activityTo(row: Activity, userId: string): Row {
  return {
    id: row.id,
    user_id: userId,
    account_id: row.accountId,
    transfer_account_id: row.transferAccountId,
    activity_date: row.date,
    action: row.action,
    asset_type: row.assetType,
    symbol: row.symbol,
    quantity: row.quantity,
    price: row.price,
    fees: row.fees,
    amount: row.amount,
    multiplier: row.multiplier ?? 1,
    ratio: row.ratio,
    delta_quantity: row.deltaQuantity,
    delta_cost_basis: row.deltaCostBasis,
    delta_cash: row.deltaCash,
    underlying: row.underlying,
    expiry: row.expiry,
    strike: row.strike,
    option_right: row.optionRight,
    note: row.note,
  };
}

function quoteFrom(row: Row): Quote {
  return {
    symbol: String(row.symbol),
    price: req(row.price),
    previousClose: num(row.previous_close),
    source: row.source === 'manual' ? 'manual' : 'finnhub',
    fetchedAt: String(row.fetched_at),
  };
}

function modeledFrom(row: Row): ModeledBuy {
  return {
    id: String(row.id),
    accountId: String(row.account_id),
    symbol: String(row.symbol),
    amount: num(row.amount),
    amountSource: row.amount_source as ModeledBuy['amountSource'],
  };
}

function checkingAccountFrom(row: Row): CheckingAccount {
  return {
    id: String(row.id),
    name: String(row.name),
    openingBalance: req(row.opening_balance),
    openingDate: String(row.opening_date),
    lowBalanceFloor: num(row.low_balance_floor),
    sortOrder: req(row.sort_order),
  };
}

function txnFrom(row: Row): CheckingTxn {
  return {
    id: String(row.id),
    accountId: String(row.account_id),
    date: String(row.txn_date),
    description: String(row.description ?? ''),
    amount: req(row.amount),
    category: String(row.category ?? 'Uncategorized'),
    cleared: Boolean(row.cleared),
    recurringItemId: str(row.recurring_item_id),
    createdAt: str(row.created_at),
    flowOverride: flowOf(row.flow_override),
  };
}

function budgetCategoryFrom(row: Row): BudgetCategory {
  return {
    id: String(row.id),
    name: String(row.name),
    flowType: flowOf(row.flow_type) ?? 'needs_review',
    groupName: String(row.group_name ?? 'other'),
    budgetMonthly: num(row.budget_monthly),
    color: String(row.color ?? '#94a3b8'),
    hidden: Boolean(row.hidden),
    sortOrder: req(row.sort_order),
  };
}

function budgetTargetFrom(row: Row): BudgetTarget {
  return {
    id: String(row.id),
    label: String(row.label),
    monthlyAmount: req(row.monthly_amount),
    categoryName: str(row.category_name),
    payee: str(row.payee),
  };
}

function budgetEntryFrom(row: Row): BudgetEntry {
  const source = row.source === 'ffcu' || row.source === 'sofi' || row.source === 'archive' ? row.source : 'archive';
  return {
    id: String(row.id),
    accountName: String(row.account_name),
    date: String(row.txn_date),
    category: String(row.category ?? 'Uncategorized'),
    description: String(row.description ?? ''),
    amount: req(row.amount),
    runningBalance: num(row.running_balance),
    source: source as BudgetSource,
    sourceRow: req(row.source_row),
    flowOverride: flowOf(row.flow_override),
    categoryLocked: Boolean(row.category_locked),
  };
}

function budgetSettingsFrom(row: Row): BudgetSettings {
  const cadence: PayrollCadence = row.payroll_cadence === 'monthly' || row.payroll_cadence === 'biweekly' ? row.payroll_cadence : 'none';
  return { payrollAmount: req(row.payroll_amount), payrollCadence: cadence };
}

function cardAccountFrom(row: Row): CardAccount {
  const names = Array.isArray(row.match_names) ? row.match_names.map((name) => String(name)) : [];
  return { id: String(row.id), name: String(row.name), matchNames: names, sortOrder: req(row.sort_order) };
}

function cardTxnFrom(row: Row): CardTxn {
  return {
    id: String(row.id),
    cardAccountId: String(row.card_account_id),
    date: String(row.txn_date),
    description: String(row.description ?? ''),
    amount: req(row.amount),
    category: String(row.category ?? 'Uncategorized'),
    flowOverride: flowOf(row.flow_override),
    statementMonth: String(row.statement_month).slice(0, 7),
  };
}

function cardTxnTo(row: CardTxn, userId: string): Row {
  const month = row.statementMonth.length === 7 ? `${row.statementMonth}-01` : row.statementMonth;
  return {
    id: row.id,
    user_id: userId,
    card_account_id: row.cardAccountId,
    txn_date: row.date,
    description: row.description,
    amount: row.amount,
    category: row.category,
    flow_override: row.flowOverride,
    statement_month: month,
  };
}

function flowOf(value: unknown): FlowType | null {
  return typeof value === 'string' && isFlowType(value) ? value : null;
}

function recurringFrom(row: Row): RecurringItem {
  return {
    id: String(row.id),
    accountId: String(row.account_id),
    name: String(row.name),
    kind: row.kind as RecurringItem['kind'],
    amount: req(row.amount),
    cadence: row.cadence as RecurringItem['cadence'],
    dayOfMonth: num(row.day_of_month),
    intervalWeeks: num(row.interval_weeks),
    anchorDate: str(row.anchor_date),
    monthOfYear: num(row.month_of_year),
    autopay: Boolean(row.autopay),
    active: Boolean(row.active),
    category: String(row.category ?? 'Uncategorized'),
  };
}

function occurrenceFrom(row: Row): Occurrence {
  return {
    id: String(row.id),
    recurringItemId: String(row.recurring_item_id),
    occurrenceDate: String(row.occurrence_date),
    status: row.status === 'skipped' ? 'skipped' : 'paid',
    transactionId: str(row.transaction_id),
  };
}

function liabilityFrom(row: Row): Liability {
  return {
    id: String(row.id),
    name: String(row.name),
    liabilityType: row.liability_type as Liability['liabilityType'],
    balance: req(row.balance),
    asOf: String(row.as_of),
    includeInNetWorth: Boolean(row.include_in_net_worth),
    unresolved: Boolean(row.unresolved),
    note: str(row.note),
  };
}

function snapshotFrom(row: Row): NetWorthSnapshot {
  return {
    id: String(row.id),
    snapshotDate: String(row.snapshot_date),
    netWorth: req(row.net_worth),
    investedValue: req(row.invested_value),
    brokerageCash: req(row.brokerage_cash),
    checkingCash: req(row.checking_cash),
    liabilities: req(row.liabilities),
    unrealizedPL: req(row.unrealized_pl),
    realizedPL: req(row.realized_pl),
    note: str(row.note),
  };
}

function preferenceFrom(row: Row): Preferences {
  return {
    priceMode: row.price_mode === 'what_if' ? 'what_if' : 'live',
    theme: row.theme === 'light' ? 'light' : 'dark',
    legacyImportStatus:
      row.legacy_import_status === 'imported' || row.legacy_import_status === 'dismissed'
        ? row.legacy_import_status
        : 'pending',
    projectionDays: req(row.projection_days) || 90,
    activeScenarioId: str(row.active_scenario_id),
  };
}
