export type ActivityAction =
  | 'opening_position'
  | 'opening_cash'
  | 'buy'
  | 'sell'
  | 'buy_to_open'
  | 'sell_to_open'
  | 'buy_to_close'
  | 'sell_to_close'
  | 'expire'
  | 'assign'
  | 'exercise'
  | 'contribution'
  | 'withdrawal'
  | 'dividend'
  | 'interest'
  | 'fee'
  | 'transfer'
  | 'in_kind_transfer'
  | 'adjustment'
  | 'split'
  | 'dividend_reinvest';

export type AssetType = 'stock_etf' | 'option' | 'crypto' | 'cash' | 'other';
export type AccountType = 'brokerage' | 'retirement' | 'crypto' | 'other';
export type TaxTreatment = 'taxable' | 'tax_deferred' | 'tax_free';
export type PriceMode = 'live' | 'what_if';
export type LiabilityType = 'credit_card' | 'loan' | 'tax' | 'other';
export type Cadence = 'monthly' | 'weekly' | 'yearly' | 'once';
export type RecurringKind = 'bill' | 'income';
export type AmountSource = 'custom' | 'account_cash' | 'portfolio_cash';

export interface Portfolio {
  id: string;
  name: string;
  includeInNetWorth: boolean;
  sortOrder: number;
}

export interface Account {
  id: string;
  portfolioId: string;
  name: string;
  accountType: AccountType;
  taxTreatment: TaxTreatment;
  sortOrder: number;
}

export interface Activity {
  id: string;
  accountId: string;
  transferAccountId: string | null;
  date: string;
  action: ActivityAction;
  assetType: AssetType;
  symbol: string | null;
  quantity: number | null;
  price: number | null;
  fees: number;
  amount: number | null;
  multiplier: number | null;
  ratio: number | null;
  deltaQuantity: number | null;
  deltaCostBasis: number | null;
  deltaCash: number | null;
  underlying: string | null;
  expiry: string | null;
  strike: number | null;
  optionRight: 'C' | 'P' | null;
  note: string | null;
  createdAt: string | null;
}

export interface Quote {
  symbol: string;
  price: number;
  previousClose: number | null;
  source: 'finnhub' | 'manual';
  fetchedAt: string;
}

export interface WhatIfPrice {
  symbol: string;
  price: number;
}

export interface PriceScenario {
  id: string;
  name: string;
}

export interface ScenarioPrice {
  scenarioId: string;
  symbol: string;
  price: number;
}

export interface ModeledBuy {
  id: string;
  accountId: string;
  symbol: string;
  amount: number | null;
  amountSource: AmountSource;
}

export interface CheckingAccount {
  id: string;
  name: string;
  openingBalance: number;
  openingDate: string;
  lowBalanceFloor: number | null;
  sortOrder: number;
}

export interface CheckingTxn {
  id: string;
  accountId: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  cleared: boolean;
  recurringItemId: string | null;
  createdAt: string | null;
}

export interface RecurringItem {
  id: string;
  accountId: string;
  name: string;
  kind: RecurringKind;
  amount: number;
  cadence: Cadence;
  dayOfMonth: number | null;
  intervalWeeks: number | null;
  anchorDate: string | null;
  monthOfYear: number | null;
  autopay: boolean;
  active: boolean;
  category: string;
}

export interface Occurrence {
  id: string;
  recurringItemId: string;
  occurrenceDate: string;
  status: 'paid' | 'skipped';
  transactionId: string | null;
}

export interface Liability {
  id: string;
  name: string;
  liabilityType: LiabilityType;
  balance: number;
  asOf: string;
  includeInNetWorth: boolean;
  unresolved: boolean;
  note: string | null;
}

export interface NetWorthSnapshot {
  id: string;
  snapshotDate: string;
  netWorth: number;
  investedValue: number;
  brokerageCash: number;
  checkingCash: number;
  liabilities: number;
  unrealizedPL: number;
  realizedPL: number;
  note: string | null;
}

export interface Preferences {
  priceMode: PriceMode;
  theme: 'dark' | 'light';
  legacyImportStatus: 'pending' | 'imported' | 'dismissed';
  projectionDays: number;
  activeScenarioId: string | null;
}

export interface Snapshot {
  portfolios: Portfolio[];
  accounts: Account[];
  activities: Activity[];
  quotes: Quote[];
  whatIfs: WhatIfPrice[];
  scenarios: PriceScenario[];
  scenarioPrices: ScenarioPrice[];
  modeled: ModeledBuy[];
  checkingAccounts: CheckingAccount[];
  checkingTxns: CheckingTxn[];
  recurring: RecurringItem[];
  occurrences: Occurrence[];
  liabilities: Liability[];
  snapshots: NetWorthSnapshot[];
  preferences: Preferences;
}

export const DEFAULT_PREFERENCES: Preferences = {
  priceMode: 'live',
  theme: 'dark',
  legacyImportStatus: 'pending',
  projectionDays: 90,
  activeScenarioId: null,
};

export function emptySnapshot(): Snapshot {
  return {
    portfolios: [],
    accounts: [],
    activities: [],
    quotes: [],
    whatIfs: [],
    scenarios: [],
    scenarioPrices: [],
    modeled: [],
    checkingAccounts: [],
    checkingTxns: [],
    recurring: [],
    occurrences: [],
    liabilities: [],
    snapshots: [],
    preferences: { ...DEFAULT_PREFERENCES },
  };
}
