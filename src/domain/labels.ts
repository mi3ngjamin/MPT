import type { AccountType, ActivityAction, AssetType, LiabilityType, TaxTreatment } from './types';

export const ACTION_LABELS: Record<ActivityAction, string> = {
  opening_position: 'Opening position',
  opening_cash: 'Opening cash',
  buy: 'Buy',
  sell: 'Sell',
  buy_to_open: 'Buy to open',
  sell_to_open: 'Sell to open',
  buy_to_close: 'Buy to close',
  sell_to_close: 'Sell to close',
  expire: 'Expire',
  assign: 'Assign',
  exercise: 'Exercise',
  contribution: 'Contribution',
  withdrawal: 'Withdrawal',
  dividend: 'Dividend',
  interest: 'Interest',
  fee: 'Fee',
  transfer: 'Cash transfer',
  in_kind_transfer: 'In-kind transfer',
  adjustment: 'Adjustment',
  split: 'Split',
  dividend_reinvest: 'Dividend reinvest',
};

export const ASSET_LABELS: Record<AssetType, string> = {
  stock_etf: 'Stock / ETF',
  option: 'Option',
  crypto: 'Crypto',
  cash: 'Cash',
  other: 'Other',
};

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  brokerage: 'Brokerage',
  retirement: 'Retirement',
  crypto: 'Crypto',
  other: 'Other',
};

export const TAX_LABELS: Record<TaxTreatment, string> = {
  taxable: 'Taxable',
  tax_deferred: 'Tax-deferred',
  tax_free: 'Tax-free',
};

export const LIABILITY_LABELS: Record<LiabilityType, string> = {
  credit_card: 'Credit card',
  loan: 'Loan',
  tax: 'Tax',
  other: 'Other',
};

export function averageCostLabel(tax: TaxTreatment): string {
  if (tax === 'taxable') return 'Avg cost (not tax lot basis)';
  return 'Avg cost';
}

export const ACTION_HELP: Record<ActivityAction, string> = {
  opening_position: 'Cutover lot. Quantity plus total cost basis in Amount. Price is a last-known fallback only.',
  opening_cash: 'Cash already in the account on the cutover date. Amount is the cash balance.',
  buy: 'Adds shares and cost. Cash decreases by shares × price × multiplier + fees.',
  sell: 'Sells shares at average cost. Realized P/L is proceeds minus the basis removed.',
  buy_to_open: 'Opens a long option. Nothing is realized.',
  sell_to_open: 'Opens a short option: negative quantity, credit basis, cash in. Nothing is realized.',
  buy_to_close: 'Closes a short option. Realized = credit relieved − cost to close.',
  sell_to_close: 'Closes a long option. Realized = proceeds − basis.',
  expire: 'Closes the remaining contracts at $0 and realizes the full premium or loss.',
  assign: 'Short put buys shares at strike (premium reduces basis). Short call sells shares at strike (premium adds to proceeds).',
  exercise: 'Long call buys shares at strike plus premium. Long put sells shares at strike minus premium.',
  contribution: 'External cash in. Not a transfer between your accounts.',
  withdrawal: 'External cash out. Not a transfer between your accounts.',
  dividend: 'Cash dividend. Does not change cost basis.',
  interest: 'Cash interest.',
  fee: 'Standalone cash fee.',
  transfer: 'Moves cash to another account. No realized P/L, and it is not a contribution or withdrawal.',
  in_kind_transfer: 'Moves shares and pro-rata average-cost basis. No realized P/L.',
  adjustment: 'True-up. A note is required. Use deltas for quantity, cost basis, and cash.',
  split: 'Ratio is new shares per old share (4 means a 4-for-1). Basis stays the same.',
  dividend_reinvest: 'Books the dividend and the purchase together. Amount is the cash dividend; omit it to match the purchase.',
};
