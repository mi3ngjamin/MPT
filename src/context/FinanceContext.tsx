import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { assembleBooks, type Books } from '../domain/assemble';
import { todayLocal } from '../domain/dates';
import { createId } from '../domain/ids';
import { hasLegacyData, planLegacyImport, type LegacyStorage } from '../domain/legacy';
import { r8 } from '../domain/round';
import {
  type Account,
  type Activity,
  type CheckingAccount,
  type CheckingTxn,
  type Liability,
  type ModeledBuy,
  type Occurrence,
  type Portfolio,
  type Preferences,
  type RecurringItem,
  type Snapshot,
  type WhatIfPrice,
} from '../domain/types';
import { demoSnapshot } from '../demo/fixtures';
import { isBackupFile, remapSnapshot, type BackupFile } from '../lib/backup';
import * as db from '../lib/db';
import { supabase } from '../lib/supabase';
import { useTheme } from './ThemeContext';

interface FinanceValue {
  demo: boolean;
  loading: boolean;
  error: string | null;
  notice: string | null;
  setNotice: (notice: string | null) => void;
  snapshot: Snapshot;
  books: Books;
  legacyAvailable: boolean;
  refreshPrices: () => Promise<void>;
  setPriceMode: (mode: Preferences['priceMode']) => Promise<void>;
  saveTheme: (theme: Preferences['theme']) => Promise<void>;
  setProjectionDays: (days: number) => Promise<void>;
  savePortfolio: (row: Portfolio) => Promise<void>;
  deletePortfolio: (id: string) => Promise<void>;
  saveAccount: (row: Account) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
  saveActivity: (row: Activity) => Promise<void>;
  deleteActivity: (id: string) => Promise<void>;
  saveCheckingAccount: (row: CheckingAccount) => Promise<void>;
  deleteCheckingAccount: (id: string) => Promise<void>;
  saveCheckingTxn: (row: CheckingTxn) => Promise<void>;
  deleteCheckingTxn: (id: string) => Promise<void>;
  saveRecurring: (row: RecurringItem) => Promise<void>;
  deleteRecurring: (id: string) => Promise<void>;
  markPaid: (item: RecurringItem, date: string) => Promise<void>;
  skipOccurrence: (item: RecurringItem, date: string) => Promise<void>;
  undoOccurrence: (id: string) => Promise<void>;
  saveLiability: (row: Liability) => Promise<void>;
  deleteLiability: (id: string) => Promise<void>;
  setWhatIf: (symbol: string, price: number | null) => Promise<void>;
  saveScenario: (name: string) => Promise<void>;
  applyScenario: (id: string) => Promise<void>;
  deleteScenario: (id: string) => Promise<void>;
  saveModeled: (row: ModeledBuy) => Promise<void>;
  saveManualPrice: (symbol: string, price: number) => Promise<void>;
  saveNetWorthSnapshot: () => Promise<void>;
  dismissLegacy: () => Promise<void>;
  importLegacy: () => Promise<void>;
  exportBackup: () => void;
  importBackup: (file: BackupFile, replace: boolean) => Promise<void>;
  signOut: () => Promise<void>;
}

const FinanceContext = createContext<FinanceValue | null>(null);

export function FinanceProvider({ demo, children }: { demo: boolean; children: ReactNode }) {
  const { setTheme } = useTheme();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(demo ? demoSnapshot() : null);
  const [loading, setLoading] = useState(!demo);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const snapshotRef = useRef(snapshot);
  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  useEffect(() => {
    if (demo) return;
    let active = true;
    void db
      .loadSnapshot()
      .then((next) => {
        if (!active) return;
        setSnapshot(next);
        setTheme(next.preferences.theme);
      })
      .catch((err: unknown) => {
        if (active) setError(text(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [demo, setTheme]);

  const books = useMemo(
    () =>
      snapshot
        ? assembleBooks({
            ...snapshot,
            mode: snapshot.preferences.priceMode,
            today: todayLocal(),
            projectionDays: snapshot.preferences.projectionDays,
          })
        : null,
    [snapshot],
  );

  const legacyAvailable = useMemo(
    () => !demo && !!snapshot && snapshot.preferences.legacyImportStatus === 'pending' && hasLegacyData(readLegacy()),
    [demo, snapshot],
  );

  async function commit(local: (current: Snapshot) => Snapshot, remote: () => Promise<void>) {
    const current = snapshotRef.current;
    if (!current) return;
    setError(null);
    try {
      if (demo) {
        setSnapshot(local(current));
        return;
      }
      await remote();
      const next = await db.loadSnapshot();
      setSnapshot(next);
    } catch (err) {
      setError(text(err));
    }
  }

  if (loading || !snapshot || !books) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <div className="text-center">
          <p className="text-2xl font-semibold tracking-tight">MPT</p>
          <p className="mt-2 text-sm text-muted">{error ?? 'Loading your books…'}</p>
        </div>
      </div>
    );
  }

  const value: FinanceValue = {
    demo,
    loading,
    error,
    notice,
    setNotice,
    snapshot,
    books,
    legacyAvailable,
    async refreshPrices() {
      const symbols = [
        ...new Set(
          snapshot.activities
            .filter((row) => row.assetType === 'stock_etf' && row.symbol)
            .map((row) => row.symbol as string),
        ),
      ];
      if (!symbols.length) {
        setNotice('No stock symbols to refresh.');
        return;
      }
      if (demo) {
        setSnapshot({
          ...snapshot,
          quotes: snapshot.quotes.map((quote) =>
            quote.source === 'finnhub'
              ? { ...quote, price: r8(quote.price * 1.001), fetchedAt: new Date().toISOString() }
              : quote,
          ),
        });
        setNotice('Sample prices marked fresh.');
        return;
      }
      const result = await db.fetchFinnhub(symbols);
      for (const quote of result.quotes) await db.saveQuote(quote);
      setSnapshot(await db.loadSnapshot());
      setNotice(
        result.missing.length
          ? `Updated ${result.quotes.length}. No quote for ${result.missing.join(', ')}.`
          : `Updated ${result.quotes.length} quotes.`,
      );
    },
    setPriceMode: (mode) =>
      commit(
        (current) => ({ ...current, preferences: { ...current.preferences, priceMode: mode } }),
        () => db.savePreferences({ ...snapshot.preferences, priceMode: mode }),
      ),
    saveTheme: (theme) =>
      commit(
        (current) => ({ ...current, preferences: { ...current.preferences, theme } }),
        () => db.savePreferences({ ...snapshot.preferences, theme }),
      ),
    setProjectionDays: (days) =>
      commit(
        (current) => ({ ...current, preferences: { ...current.preferences, projectionDays: days } }),
        () => db.savePreferences({ ...snapshot.preferences, projectionDays: days }),
      ),
    savePortfolio: (row) =>
      commit(
        (current) => ({ ...current, portfolios: upsert(current.portfolios, row) }),
        () => db.savePortfolio(row),
      ),
    deletePortfolio: (id) =>
      commit(
        (current) => {
          const accountIds = new Set(current.accounts.filter((account) => account.portfolioId === id).map((account) => account.id));
          return {
            ...current,
            portfolios: current.portfolios.filter((row) => row.id !== id),
            accounts: current.accounts.filter((row) => row.portfolioId !== id),
            activities: current.activities.filter((row) => !accountIds.has(row.accountId) && !accountIds.has(row.transferAccountId ?? '')),
            modeled: current.modeled.filter((row) => !accountIds.has(row.accountId)),
          };
        },
        () => db.deletePortfolio(id),
      ),
    saveAccount: (row) =>
      commit(
        (current) => ({ ...current, accounts: upsert(current.accounts, row) }),
        () => db.saveAccount(row),
      ),
    deleteAccount: (id) =>
      commit(
        (current) => ({
          ...current,
          accounts: current.accounts.filter((row) => row.id !== id),
          activities: current.activities.filter((row) => row.accountId !== id && row.transferAccountId !== id),
          modeled: current.modeled.filter((row) => row.accountId !== id),
        }),
        () => db.deleteAccount(id),
      ),
    saveActivity: (row) =>
      commit(
        (current) => ({ ...current, activities: upsert(current.activities, row) }),
        () => db.saveActivity(row),
      ),
    deleteActivity: (id) =>
      commit(
        (current) => ({ ...current, activities: current.activities.filter((row) => row.id !== id) }),
        () => db.deleteActivity(id),
      ),
    saveCheckingAccount: (row) =>
      commit(
        (current) => ({ ...current, checkingAccounts: upsert(current.checkingAccounts, row) }),
        () => db.saveCheckingAccount(row),
      ),
    deleteCheckingAccount: (id) =>
      commit(
        (current) => ({
          ...current,
          checkingAccounts: current.checkingAccounts.filter((row) => row.id !== id),
          checkingTxns: current.checkingTxns.filter((row) => row.accountId !== id),
          recurring: current.recurring.filter((row) => row.accountId !== id),
        }),
        () => db.deleteCheckingAccount(id),
      ),
    saveCheckingTxn: (row) =>
      commit(
        (current) => ({ ...current, checkingTxns: upsert(current.checkingTxns, row) }),
        () => db.saveCheckingTxn(row),
      ),
    deleteCheckingTxn: (id) =>
      commit(
        (current) => ({
          ...current,
          checkingTxns: current.checkingTxns.filter((row) => row.id !== id),
          occurrences: current.occurrences.map((row) => (row.transactionId === id ? { ...row, transactionId: null } : row)),
        }),
        () => db.deleteCheckingTxn(id),
      ),
    saveRecurring: (row) =>
      commit(
        (current) => ({ ...current, recurring: upsert(current.recurring, row) }),
        () => db.saveRecurring(row),
      ),
    deleteRecurring: (id) =>
      commit(
        (current) => ({
          ...current,
          recurring: current.recurring.filter((row) => row.id !== id),
          occurrences: current.occurrences.filter((row) => row.recurringItemId !== id),
        }),
        () => db.deleteRecurring(id),
      ),
    async markPaid(item, date) {
      const txn: CheckingTxn = {
        id: createId(),
        accountId: item.accountId,
        date,
        description: item.name,
        amount: item.kind === 'income' ? Math.abs(item.amount) : -Math.abs(item.amount),
        category: item.category,
        cleared: true,
        recurringItemId: item.id,
        createdAt: new Date().toISOString(),
      };
      const occurrence: Occurrence = {
        id: createId(),
        recurringItemId: item.id,
        occurrenceDate: date,
        status: 'paid',
        transactionId: txn.id,
      };
      await commit(
        (current) => ({
          ...current,
          checkingTxns: [...current.checkingTxns, txn],
          occurrences: [...current.occurrences.filter((row) => !(row.recurringItemId === item.id && row.occurrenceDate === date)), occurrence],
        }),
        async () => {
          await db.saveCheckingTxn(txn);
          await db.saveOccurrence(occurrence);
        },
      );
    },
    async skipOccurrence(item, date) {
      const occurrence: Occurrence = {
        id: createId(),
        recurringItemId: item.id,
        occurrenceDate: date,
        status: 'skipped',
        transactionId: null,
      };
      await commit(
        (current) => ({
          ...current,
          occurrences: [...current.occurrences.filter((row) => !(row.recurringItemId === item.id && row.occurrenceDate === date)), occurrence],
        }),
        () => db.saveOccurrence(occurrence),
      );
    },
    undoOccurrence: (id) =>
      commit(
        (current) => {
          const row = current.occurrences.find((item) => item.id === id);
          return {
            ...current,
            occurrences: current.occurrences.filter((item) => item.id !== id),
            checkingTxns: current.checkingTxns.filter((txn) => txn.id !== row?.transactionId),
          };
        },
        async () => {
          const row = snapshot.occurrences.find((item) => item.id === id);
          await db.deleteOccurrence(id);
          if (row?.transactionId) await db.deleteCheckingTxn(row.transactionId);
        },
      ),
    saveLiability: (row) =>
      commit(
        (current) => ({ ...current, liabilities: upsert(current.liabilities, row) }),
        () => db.saveLiability(row),
      ),
    deleteLiability: (id) =>
      commit(
        (current) => ({ ...current, liabilities: current.liabilities.filter((row) => row.id !== id) }),
        () => db.deleteLiability(id),
      ),
    setWhatIf: (symbol, price) =>
      commit(
        (current) => ({
          ...current,
          whatIfs:
            price == null
              ? current.whatIfs.filter((row) => row.symbol !== symbol.toUpperCase())
              : upsertSymbol(current.whatIfs, { symbol: symbol.toUpperCase(), price }),
        }),
        async () => {
          if (price == null) await db.deleteWhatIf(symbol);
          else await db.saveWhatIf({ symbol, price });
        },
      ),
    saveScenario: (name) => {
      const id = createId();
      const prices = snapshot.whatIfs;
      return commit(
        (current) => ({
          ...current,
          scenarios: [...current.scenarios, { id, name }],
          scenarioPrices: [
            ...current.scenarioPrices.filter((row) => row.scenarioId !== id),
            ...prices.map((price) => ({ scenarioId: id, symbol: price.symbol, price: price.price })),
          ],
          preferences: { ...current.preferences, activeScenarioId: id },
        }),
        () => db.saveScenario({ id, name }, prices),
      );
    },
    applyScenario: (id) =>
      commit(
        (current) => ({
          ...current,
          whatIfs: current.scenarioPrices
            .filter((row) => row.scenarioId === id)
            .map((row) => ({ symbol: row.symbol, price: row.price })),
          preferences: { ...current.preferences, priceMode: 'what_if', activeScenarioId: id },
        }),
        async () => {
          const prices = snapshot.scenarioPrices
            .filter((row) => row.scenarioId === id)
            .map((row) => ({ symbol: row.symbol, price: row.price }));
          await db.replaceWhatIfs(prices);
          await db.savePreferences({ ...snapshot.preferences, priceMode: 'what_if', activeScenarioId: id });
        },
      ),
    deleteScenario: (id) =>
      commit(
        (current) => ({
          ...current,
          scenarios: current.scenarios.filter((row) => row.id !== id),
          scenarioPrices: current.scenarioPrices.filter((row) => row.scenarioId !== id),
          preferences:
            current.preferences.activeScenarioId === id
              ? { ...current.preferences, activeScenarioId: null }
              : current.preferences,
        }),
        () => db.deleteScenario(id),
      ),
    saveModeled: (row) =>
      commit(
        (current) => ({
          ...current,
          modeled: [
            ...current.modeled.filter((item) => !(item.accountId === row.accountId && item.symbol === row.symbol)),
            row,
          ],
        }),
        () => db.saveModeled(row),
      ),
    saveManualPrice: (symbol, price) =>
      commit(
        (current) => ({
          ...current,
          quotes: [
            ...current.quotes.filter((row) => !(row.symbol === symbol.toUpperCase() && row.source === 'manual')),
            { symbol: symbol.toUpperCase(), price, previousClose: null, source: 'manual', fetchedAt: new Date().toISOString() },
          ],
        }),
        () =>
          db.saveQuote({
            symbol,
            price,
            previousClose: null,
            source: 'manual',
            fetchedAt: new Date().toISOString(),
          }),
      ),
    async saveNetWorthSnapshot() {
      const row = {
        id: createId(),
        snapshotDate: todayLocal(),
        netWorth: books.netWorth.netWorth,
        investedValue: books.invested,
        brokerageCash: books.brokerageCash,
        checkingCash: books.netWorth.checking,
        liabilities: books.netWorth.liabilitiesApplied,
        unrealizedPL: books.unrealized ?? 0,
        realizedPL: books.realized,
        note: null,
      };
      await commit(
        (current) => ({ ...current, snapshots: [...current.snapshots, row] }),
        () => db.saveSnapshotRow(row),
      );
      setNotice('Saved a net worth snapshot.');
    },
    dismissLegacy: () =>
      commit(
        (current) => savePrefsLocal(current, { ...current.preferences, legacyImportStatus: 'dismissed' }),
        () => db.savePreferences({ ...snapshot.preferences, legacyImportStatus: 'dismissed' }),
      ),
    async importLegacy() {
      const plan = planLegacyImport(readLegacy(), todayLocal());
      if (!plan) return;
      if (demo) {
        setNotice('Sample mode does not read browser storage.');
        return;
      }
      await db.importLegacyPlan(plan);
      await db.savePreferences({ ...snapshot.preferences, legacyImportStatus: 'imported' });
      setSnapshot(await db.loadSnapshot());
      setNotice('Imported the data stored in this browser.');
    },
    exportBackup() {
      const file: BackupFile = { version: 1, exportedAt: new Date().toISOString(), data: snapshot };
      const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `mpt-backup-${todayLocal()}.json`;
      link.click();
      URL.revokeObjectURL(url);
    },
    async importBackup(file, replace) {
      if (!isBackupFile(file)) throw new Error('That file is not an MPT backup.');
      const next = replace ? file.data : remapSnapshot(file.data);
      if (demo) {
        setSnapshot(replace ? { ...next, preferences: { ...next.preferences, legacyImportStatus: 'dismissed' } } : mergeLocal(snapshot, remapSnapshot(file.data)));
        setNotice(replace ? 'Replaced the sample books.' : 'Merged the backup into the sample books.');
        return;
      }
      if (replace) await db.replaceWithSnapshot(next);
      else await db.mergeSnapshot(file.data);
      setSnapshot(await db.loadSnapshot());
      setNotice(replace ? 'Replaced your books with the backup.' : 'Merged the backup into your books.');
    },
    async signOut() {
      if (demo) {
        window.location.assign(`${import.meta.env.BASE_URL}`);
        return;
      }
      await supabase.auth.signOut();
    },
  };

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance() {
  const value = useContext(FinanceContext);
  if (!value) throw new Error('Finance data is unavailable.');
  return value;
}

function upsert<T extends { id: string }>(rows: T[], row: T): T[] {
  return rows.some((item) => item.id === row.id) ? rows.map((item) => (item.id === row.id ? row : item)) : [...rows, row];
}

function upsertSymbol(rows: WhatIfPrice[], row: WhatIfPrice): WhatIfPrice[] {
  return rows.some((item) => item.symbol === row.symbol)
    ? rows.map((item) => (item.symbol === row.symbol ? row : item))
    : [...rows, row];
}

function savePrefsLocal(current: Snapshot, preferences: Preferences): Snapshot {
  return { ...current, preferences };
}

function mergeLocal(current: Snapshot, extra: Snapshot): Snapshot {
  return {
    ...current,
    portfolios: [...current.portfolios, ...extra.portfolios],
    accounts: [...current.accounts, ...extra.accounts],
    activities: [...current.activities, ...extra.activities],
    quotes: [...current.quotes, ...extra.quotes],
    whatIfs: [...current.whatIfs, ...extra.whatIfs],
    scenarios: [...current.scenarios, ...extra.scenarios],
    scenarioPrices: [...current.scenarioPrices, ...extra.scenarioPrices],
    modeled: [...current.modeled, ...extra.modeled],
    checkingAccounts: [...current.checkingAccounts, ...extra.checkingAccounts],
    checkingTxns: [...current.checkingTxns, ...extra.checkingTxns],
    recurring: [...current.recurring, ...extra.recurring],
    occurrences: [...current.occurrences, ...extra.occurrences],
    liabilities: [...current.liabilities, ...extra.liabilities],
    snapshots: [...current.snapshots, ...extra.snapshots],
  };
}

function readLegacy(): LegacyStorage {
  return {
    transactions: localStorage.getItem('transactions'),
    categories: localStorage.getItem('categories'),
    investments: localStorage.getItem('investments'),
    livePrices: localStorage.getItem('livePrices'),
    budgetItems: localStorage.getItem('budgetItems'),
    startingBalance: localStorage.getItem('startingBalance'),
  };
}

function text(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong.';
}
