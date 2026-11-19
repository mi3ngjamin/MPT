import { averageCostLabel } from './labels';
import { averageCostPerShare, processLedger, type AuditLine, type Position } from './engine';
import { computeNetWorth, type NetWorthResult } from './networth';
import { resolvePrice, valuePosition, type ResolvedPrice } from './prices';
import { addDays } from './dates';
import { checkingBalance, projectAccount, type OccurrenceView, type Projection } from './recurrence';
import type {
  Account,
  Activity,
  CheckingAccount,
  CheckingTxn,
  Liability,
  Occurrence,
  Portfolio,
  PriceMode,
  Quote,
  RecurringItem,
  TaxTreatment,
  WhatIfPrice,
} from './types';
import { r8 } from './round';

export interface HoldingView {
  accountId: string;
  accountName: string;
  portfolioId: string;
  portfolioName: string;
  includeInNetWorth: boolean;
  taxTreatment: TaxTreatment;
  symbol: string;
  assetType: Position['assetType'];
  quantity: number;
  costBasis: number;
  avgCost: number | null;
  avgCostLabel: string;
  price: number | null;
  priceSource: ResolvedPrice['source'];
  stale: boolean;
  fallback: boolean;
  missing: boolean;
  previousClose: number | null;
  marketValue: number | null;
  unrealized: number | null;
  unrealizedPct: number | null;
  dayChange: number | null;
  weight: number | null;
  realized: number;
  multiplier: number;
  oversold: boolean;
  audit: AuditLine[];
  underlying?: string;
  expiry?: string;
  strike?: number;
  optionRight?: 'C' | 'P';
}

export interface AccountView {
  account: Account;
  portfolio: Portfolio;
  cash: number;
  negativeCash: boolean;
  invested: number;
  investedPartial: boolean;
  total: number | null;
  unrealized: number | null;
  realized: number;
  holdings: HoldingView[];
  dividendIncome: number;
}

export interface Slice {
  label: string;
  value: number;
}

export interface AggregatedHolding {
  symbol: string;
  assetType: Position['assetType'];
  quantity: number;
  costBasis: number;
  marketValue: number | null;
  unrealized: number | null;
  realized: number;
  weight: number | null;
  partial: boolean;
  avgCost: number | null;
  multiplier: number;
}

export interface PortfolioView {
  portfolio: Portfolio;
  accounts: AccountView[];
  invested: number;
  investedPartial: boolean;
  cash: number;
  total: number | null;
  unrealized: number | null;
  realized: number;
  dayChange: number | null;
  aggregated: AggregatedHolding[];
}

export interface UserWarning {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
}

export interface CheckingView {
  account: CheckingAccount;
  balance: number;
  projection: Projection;
}

export interface Books {
  accounts: AccountView[];
  portfolios: PortfolioView[];
  included: PortfolioView[];
  excluded: PortfolioView[];
  netWorth: NetWorthResult;
  warnings: UserWarning[];
  topHoldings: HoldingView[];
  allocationBySymbol: Slice[];
  allocationByAccount: Slice[];
  dayChange: number | null;
  invested: number;
  investedPartial: boolean;
  brokerageCash: number;
  portfolioCash: number;
  realized: number;
  unrealized: number | null;
  checking: CheckingView[];
  upcomingBills: OccurrenceView[];
}

export function assembleBooks(input: {
  portfolios: Portfolio[];
  accounts: Account[];
  activities: Activity[];
  quotes: Quote[];
  whatIfs: WhatIfPrice[];
  mode: PriceMode;
  liabilities: Liability[];
  checkingAccounts: CheckingAccount[];
  checkingTxns: CheckingTxn[];
  recurring: RecurringItem[];
  occurrences: Occurrence[];
  today: string;
  nowMs?: number;
  projectionDays?: number;
}): Books {
  const ledger = processLedger(
    input.activities,
    input.accounts.map((account) => account.id),
  );
  const whatIf = new Map(input.whatIfs.map((row) => [row.symbol.toUpperCase(), row.price]));
  const quotes = input.quotes.map((quote) => ({ ...quote, symbol: quote.symbol.toUpperCase() }));

  const accounts: AccountView[] = input.accounts.map((account) => {
    const portfolio = input.portfolios.find((row) => row.id === account.portfolioId);
    const book = ledger.accounts[account.id];
    const holdings: HoldingView[] = (book?.positions ?? [])
      .filter((position) => Math.abs(position.quantity) > 1e-6)
      .map((position) => {
        const resolved = resolvePrice({
          assetType: position.assetType,
          mode: input.mode,
          whatIf: whatIf.get(position.symbol) ?? null,
          live: quotes.find((quote) => quote.symbol === position.symbol && quote.source === 'finnhub') ?? null,
          manual: quotes.find((quote) => quote.symbol === position.symbol && quote.source === 'manual') ?? null,
          lastKnown: position.lastTradePrice ?? null,
          now: input.nowMs,
        });
        const valued = valuePosition(position, resolved);
        return {
          accountId: account.id,
          accountName: account.name,
          portfolioId: account.portfolioId,
          portfolioName: portfolio?.name ?? '',
          includeInNetWorth: portfolio?.includeInNetWorth ?? true,
          taxTreatment: account.taxTreatment,
          symbol: position.symbol,
          assetType: position.assetType,
          quantity: position.quantity,
          costBasis: position.costBasis,
          avgCost: averageCostPerShare(position),
          avgCostLabel: averageCostLabel(account.taxTreatment),
          price: resolved.price,
          priceSource: resolved.source,
          stale: resolved.stale,
          fallback: resolved.fallback,
          missing: resolved.missing,
          previousClose: resolved.previousClose,
          marketValue: valued.marketValue,
          unrealized: valued.unrealized,
          unrealizedPct: valued.unrealizedPct,
          dayChange: valued.dayChange,
          weight: null,
          realized: position.realizedPL,
          multiplier: position.multiplier,
          oversold: position.oversold,
          audit: position.audit,
          underlying: position.underlying,
          expiry: position.expiry,
          strike: position.strike,
          optionRight: position.optionRight,
        };
      })
      .sort((a, b) => (b.marketValue ?? -1) - (a.marketValue ?? -1));

    const investedPartial = holdings.some((holding) => holding.missing);
    const invested = r8(
      holdings.reduce((sum, holding) => sum + (holding.missing ? 0 : (holding.marketValue ?? 0)), 0),
    );
    const knownUnrealized = holdings.filter((holding) => holding.unrealized != null);
    const unrealized = knownUnrealized.length
      ? r8(knownUnrealized.reduce((sum, holding) => sum + (holding.unrealized ?? 0), 0))
      : null;
    const cash = book?.cash ?? 0;
    return {
      account,
      portfolio: portfolio ?? {
        id: account.portfolioId,
        name: 'Portfolio',
        includeInNetWorth: true,
        sortOrder: 0,
      },
      cash,
      negativeCash: book?.negativeCash ?? false,
      invested,
      investedPartial,
      total: investedPartial ? null : r8(invested + cash),
      unrealized,
      realized: book?.realizedPL ?? 0,
      holdings,
      dividendIncome: book?.dividendIncome ?? 0,
    };
  });

  const portfolios: PortfolioView[] = input.portfolios
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    .map((portfolio) => {
      const rows = accounts
        .filter((account) => account.portfolio.id === portfolio.id)
        .sort((a, b) => a.account.sortOrder - b.account.sortOrder || a.account.name.localeCompare(b.account.name));
      const investedPartial = rows.some((account) => account.investedPartial);
      const invested = r8(rows.reduce((sum, account) => sum + account.invested, 0));
      for (const account of rows) {
        for (const holding of account.holdings) {
          holding.weight = holding.marketValue != null && invested > 0 ? holding.marketValue / invested : null;
        }
      }
      const aggregated = aggregate(rows, invested);
      const dayValues = rows.flatMap((account) => account.holdings.map((holding) => holding.dayChange)).filter((value): value is number => value != null);
      return {
        portfolio,
        accounts: rows,
        invested,
        investedPartial,
        cash: r8(rows.reduce((sum, account) => sum + account.cash, 0)),
        total: investedPartial ? null : r8(invested + rows.reduce((sum, account) => sum + account.cash, 0)),
        unrealized: rows.some((account) => account.unrealized != null)
          ? r8(rows.reduce((sum, account) => sum + (account.unrealized ?? 0), 0))
          : null,
        realized: r8(rows.reduce((sum, account) => sum + account.realized, 0)),
        dayChange: dayValues.length ? r8(dayValues.reduce((sum, value) => sum + value, 0)) : null,
        aggregated,
      };
    });

  const included = portfolios.filter((portfolio) => portfolio.portfolio.includeInNetWorth);
  const excluded = portfolios.filter((portfolio) => !portfolio.portfolio.includeInNetWorth);
  const invested = r8(included.reduce((sum, portfolio) => sum + portfolio.invested, 0));
  const investedPartial = included.some((portfolio) => portfolio.investedPartial);
  const portfolioCash = r8(included.reduce((sum, portfolio) => sum + portfolio.cash, 0));
  const brokerageCash = r8(
    accounts
      .filter((account) => account.portfolio.includeInNetWorth && account.account.accountType === 'brokerage')
      .reduce((sum, account) => sum + account.cash, 0),
  );
  const realized = r8(included.reduce((sum, portfolio) => sum + portfolio.realized, 0));
  const dayValues = included.flatMap((portfolio) => (portfolio.dayChange == null ? [] : [portfolio.dayChange]));
  const unrealized = included.some((portfolio) => portfolio.unrealized != null)
    ? r8(included.reduce((sum, portfolio) => sum + (portfolio.unrealized ?? 0), 0))
    : null;

  const horizon = addDays(input.today, 14);
  const checking: CheckingView[] = input.checkingAccounts
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    .map((account) => ({
      account,
      balance: checkingBalance(account, input.checkingTxns, input.today),
      projection: projectAccount({
        account,
        txns: input.checkingTxns,
        items: input.recurring,
        marks: input.occurrences.map((row) => ({
          recurringItemId: row.recurringItemId,
          occurrenceDate: row.occurrenceDate,
          status: row.status,
        })),
        today: input.today,
        days: input.projectionDays ?? 90,
      }),
    }));
  const checkingTotal = r8(checking.reduce((sum, row) => sum + row.balance, 0));
  const netWorth = computeNetWorth({
    invested,
    portfolioCash,
    brokerageCash,
    checking: checkingTotal,
    liabilities: input.liabilities,
  });

  const includedHoldings = accounts
    .filter((account) => account.portfolio.includeInNetWorth)
    .flatMap((account) => account.holdings);
  const topHoldings = includedHoldings
    .slice()
    .sort((a, b) => (b.marketValue ?? -1) - (a.marketValue ?? -1))
    .slice(0, 8);

  return {
    accounts,
    portfolios,
    included,
    excluded,
    netWorth,
    warnings: buildWarnings(accounts, includedHoldings, input.liabilities, checking),
    topHoldings,
    allocationBySymbol: topSlices(
      groupSum(includedHoldings.filter((holding) => (holding.marketValue ?? 0) > 0).map((holding) => ({ label: holding.symbol, value: holding.marketValue ?? 0 }))),
      6,
    ),
    allocationByAccount: topSlices(
      accounts
        .filter((account) => account.portfolio.includeInNetWorth && account.invested > 0)
        .map((account) => ({ label: account.account.name, value: account.invested })),
      6,
    ),
    dayChange: dayValues.length ? r8(dayValues.reduce((sum, value) => sum + value, 0)) : null,
    invested,
    investedPartial,
    brokerageCash,
    portfolioCash,
    realized,
    unrealized,
    checking,
    upcomingBills: checking
      .flatMap((row) => row.projection.occurrences)
      .filter((occ) => !occ.paid && !occ.skipped && occ.date <= horizon)
      .sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name)),
  };
}

function aggregate(accounts: AccountView[], invested: number): AggregatedHolding[] {
  const map = new Map<string, AggregatedHolding>();
  for (const account of accounts) {
    for (const holding of account.holdings) {
      const current = map.get(holding.symbol) ?? {
        symbol: holding.symbol,
        assetType: holding.assetType,
        quantity: 0,
        costBasis: 0,
        marketValue: 0,
        unrealized: 0,
        realized: 0,
        weight: null,
        partial: false,
        avgCost: null,
        multiplier: holding.multiplier,
      };
      current.quantity = r8(current.quantity + holding.quantity);
      current.costBasis = r8(current.costBasis + holding.costBasis);
      current.realized = r8(current.realized + holding.realized);
      current.multiplier = holding.multiplier;
      if (holding.marketValue == null) current.partial = true;
      else current.marketValue = r8((current.marketValue ?? 0) + holding.marketValue);
      if (holding.unrealized == null) current.partial = true;
      else current.unrealized = r8((current.unrealized ?? 0) + holding.unrealized);
      map.set(holding.symbol, current);
    }
  }
  return [...map.values()]
    .map((row) => ({
      ...row,
      marketValue: row.partial ? null : row.marketValue,
      unrealized: row.partial ? null : row.unrealized,
      avgCost:
        Math.abs(row.quantity) > 1e-8 ? row.costBasis / row.quantity / (row.multiplier || 1) : null,
      weight: !row.partial && row.marketValue != null && invested > 0 ? row.marketValue / invested : null,
    }))
    .sort((a, b) => (b.marketValue ?? -1) - (a.marketValue ?? -1));
}

function buildWarnings(
  accounts: AccountView[],
  holdings: HoldingView[],
  liabilities: Liability[],
  checking: CheckingView[],
): UserWarning[] {
  const warnings: UserWarning[] = [];
  for (const account of accounts) {
    if (account.negativeCash) {
      warnings.push({
        id: `cash-${account.account.id}`,
        severity: 'critical',
        message: `Cash in ${account.account.name} is negative (${fmt(account.cash)}).`,
      });
    }
    for (const holding of account.holdings) {
      if (holding.oversold) {
        warnings.push({
          id: `oversold-${account.account.id}-${holding.symbol}`,
          severity: 'critical',
          message: `${holding.symbol} in ${account.account.name} was sold or transferred for more than the open quantity.`,
        });
      }
    }
  }
  for (const holding of holdings) {
    if (holding.missing) {
      warnings.push({
        id: `missing-${holding.accountId}-${holding.symbol}`,
        severity: 'warning',
        message: `No price for ${holding.symbol}. It is excluded from totals instead of counted as $0.`,
      });
    } else if (holding.fallback) {
      warnings.push({
        id: `fallback-${holding.accountId}-${holding.symbol}`,
        severity: 'warning',
        message: `${holding.symbol} is using its last trade price (${fmt(holding.price ?? 0)}), not a live quote.`,
      });
    }
  }
  const stale = holdings.filter((holding) => holding.stale && holding.priceSource === 'live');
  if (stale.length) {
    const symbols = [...new Set(stale.map((holding) => holding.symbol))];
    warnings.push({
      id: 'stale-prices',
      severity: 'info',
      message: `${symbols.length === 1 ? symbols[0] : `${symbols.length} quotes`} ${symbols.length === 1 ? 'is' : 'are'} more than 36 hours old.`,
    });
  }
  if (liabilities.some((row) => row.unresolved)) {
    warnings.push({
      id: 'unresolved',
      severity: 'info',
      message: 'Net worth is labeled before unresolved taxes and liabilities. Those balances are not subtracted.',
    });
  }
  for (const row of checking) {
    if (row.balance < 0) {
      warnings.push({
        id: `checking-neg-${row.account.id}`,
        severity: 'critical',
        message: `${row.account.name} balance is negative (${fmt(row.balance)}).`,
      });
    } else if (row.account.lowBalanceFloor != null && row.balance < row.account.lowBalanceFloor) {
      warnings.push({
        id: `checking-floor-${row.account.id}`,
        severity: 'warning',
        message: `${row.account.name} is below its ${fmt(row.account.lowBalanceFloor)} floor.`,
      });
    }
    for (const warning of row.projection.warnings) {
      warnings.push({
        id: `proj-${row.account.id}-${warning.code}-${warning.date}`,
        severity: warning.code === 'below_zero' || warning.code === 'autopay_shortfall' ? 'critical' : 'warning',
        message: `${row.account.name}: ${warning.message}`,
      });
    }
  }
  return warnings;
}

function groupSum(rows: { label: string; value: number }[]): Slice[] {
  const map = new Map<string, number>();
  for (const row of rows) map.set(row.label, (map.get(row.label) ?? 0) + row.value);
  return [...map.entries()].map(([label, value]) => ({ label, value: r8(value) }));
}

function topSlices(rows: Slice[], count: number): Slice[] {
  const sorted = rows.filter((row) => row.value > 0).sort((a, b) => b.value - a.value);
  const top = sorted.slice(0, count);
  const rest = r8(sorted.slice(count).reduce((sum, row) => sum + row.value, 0));
  if (rest > 0) top.push({ label: 'Other', value: rest });
  return top;
}

function fmt(value: number): string {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}
