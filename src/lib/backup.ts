import { createId } from '../domain/ids';
import { DEFAULT_BUDGET_SETTINGS, type Snapshot } from '../domain/types';

export interface BackupFile {
  version: 1;
  exportedAt: string;
  data: Snapshot;
}

export function isBackupFile(value: unknown): value is BackupFile {
  if (!value || typeof value !== 'object') return false;
  const row = value as BackupFile;
  return row.version === 1 && !!row.data && Array.isArray(row.data.portfolios);
}

function mapId(ids: Map<string, string>, id: string | null): string | null {
  if (!id) return null;
  let next = ids.get(id);
  if (!next) {
    next = createId();
    ids.set(id, next);
  }
  return next;
}

function must(ids: Map<string, string>, id: string): string {
  return mapId(ids, id) ?? id;
}

/** New ids so an import cannot collide with rows already in the account. */
export function remapSnapshot(input: Snapshot): Snapshot {
  const ids = new Map<string, string>();
  return {
    portfolios: input.portfolios.map((row) => ({ ...row, id: must(ids, row.id) })),
    accounts: input.accounts.map((row) => ({
      ...row,
      id: must(ids, row.id),
      portfolioId: must(ids, row.portfolioId),
    })),
    activities: input.activities.map((row) => ({
      ...row,
      id: must(ids, row.id),
      accountId: must(ids, row.accountId),
      transferAccountId: mapId(ids, row.transferAccountId),
    })),
    quotes: input.quotes.map((row) => ({ ...row })),
    whatIfs: input.whatIfs.map((row) => ({ ...row })),
    scenarios: input.scenarios.map((row) => ({ ...row, id: must(ids, row.id) })),
    scenarioPrices: input.scenarioPrices.map((row) => ({
      ...row,
      scenarioId: must(ids, row.scenarioId),
    })),
    modeled: input.modeled.map((row) => ({
      ...row,
      id: must(ids, row.id),
      accountId: must(ids, row.accountId),
    })),
    checkingAccounts: input.checkingAccounts.map((row) => ({ ...row, id: must(ids, row.id) })),
    checkingTxns: input.checkingTxns.map((row) => ({
      ...row,
      id: must(ids, row.id),
      accountId: must(ids, row.accountId),
      recurringItemId: mapId(ids, row.recurringItemId),
    })),
    recurring: input.recurring.map((row) => ({
      ...row,
      id: must(ids, row.id),
      accountId: must(ids, row.accountId),
    })),
    occurrences: input.occurrences.map((row) => ({
      ...row,
      id: must(ids, row.id),
      recurringItemId: must(ids, row.recurringItemId),
      transactionId: mapId(ids, row.transactionId),
    })),
    liabilities: input.liabilities.map((row) => ({ ...row, id: must(ids, row.id) })),
    snapshots: input.snapshots.map((row) => ({ ...row, id: must(ids, row.id) })),
    budgetCategories: (input.budgetCategories ?? []).map((row) => ({ ...row, id: must(ids, row.id) })),
    budgetTargets: (input.budgetTargets ?? []).map((row) => ({ ...row, id: must(ids, row.id) })),
    budgetEntries: (input.budgetEntries ?? []).map((row) => ({ ...row, id: must(ids, row.id) })),
    budgetSettings: input.budgetSettings ?? { ...DEFAULT_BUDGET_SETTINGS },
    cardAccounts: (input.cardAccounts ?? []).map((row) => ({ ...row, id: must(ids, row.id) })),
    cardTxns: (input.cardTxns ?? []).map((row) => ({
      ...row,
      id: must(ids, row.id),
      cardAccountId: must(ids, row.cardAccountId),
    })),
    preferences: {
      ...input.preferences,
      activeScenarioId: mapId(ids, input.preferences.activeScenarioId),
    },
  };
}
