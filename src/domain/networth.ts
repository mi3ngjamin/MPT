export interface NetWorthInput {
  invested: number;
  portfolioCash: number;
  brokerageCash: number;
  checking: number;
  liabilities: {
    balance: number;
    includeInNetWorth: boolean;
    unresolved: boolean;
  }[];
}

export interface NetWorthResult {
  invested: number;
  portfolioCash: number;
  brokerageCash: number;
  checking: number;
  assets: number;
  liabilitiesApplied: number;
  unresolvedLiabilities: number;
  netWorth: number;
  /** Shown when any liability is still unresolved. Those amounts are not subtracted. */
  label: 'Net worth' | 'Net worth before unresolved taxes/liabilities';
  hasUnresolved: boolean;
}

export function computeNetWorth(input: NetWorthInput): NetWorthResult {
  const assets = input.invested + input.portfolioCash + input.checking;
  let applied = 0;
  let unresolved = 0;
  let hasUnresolved = false;
  for (const row of input.liabilities) {
    if (row.unresolved) {
      hasUnresolved = true;
      unresolved += row.balance;
      continue;
    }
    if (row.includeInNetWorth) applied += row.balance;
  }
  return {
    invested: input.invested,
    portfolioCash: input.portfolioCash,
    brokerageCash: input.brokerageCash,
    checking: input.checking,
    assets,
    liabilitiesApplied: applied,
    unresolvedLiabilities: unresolved,
    netWorth: assets - applied,
    label: hasUnresolved ? 'Net worth before unresolved taxes/liabilities' : 'Net worth',
    hasUnresolved,
  };
}
