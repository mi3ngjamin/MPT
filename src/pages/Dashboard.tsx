import { RefreshCw } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AllocationChart, Sparkline } from '../components/Charts';
import { Empty, Stat } from '../components/ui';
import { useFinance } from '../context/FinanceContext';
import { monthlySeries, periodBounds, prepareBudget, summarize } from '../domain/budget';
import { addMonths, startOfMonth, todayLocal } from '../domain/dates';
import { contractLabel } from '../domain/labels';
import { money, moneyTight, pct, plClass } from '../lib/format';

export default function Dashboard() {
  const { books, snapshot, refreshPrices } = useFinance();
  const whatIf = snapshot.preferences.priceMode === 'what_if';
  const empty = books.portfolios.length === 0 && books.checking.length === 0;
  const today = todayLocal();
  const budgetCard = useMemo(() => {
    const lines = prepareBudget({
      accounts: snapshot.checkingAccounts,
      checkingTxns: snapshot.checkingTxns,
      entries: snapshot.budgetEntries,
      categories: snapshot.budgetCategories,
      cards: snapshot.cardAccounts,
      cardTxns: snapshot.cardTxns,
    });
    const month = today.slice(0, 7);
    const bounds = periodBounds('month', today, month);
    const totals = summarize(lines, snapshot.budgetSettings, bounds.start, bounds.end, true);
    const trendStart = addMonths(startOfMonth(today), -5);
    const series = monthlySeries(lines, snapshot.budgetSettings, trendStart, today, true);
    const budget = snapshot.budgetTargets.reduce((sum, row) => sum + row.monthlyAmount, 0);
    return { totals, series, budget };
  }, [snapshot, today]);

  if (empty) {
    return (
      <Empty
        title="Your books are empty"
        body="Add a portfolio and an account in Settings, then record an opening position in Activity. Checking accounts and bills live in their own pages."
        action={
          <Link to="/settings" className="btn-primary">
            Open settings
          </Link>
        }
      />
    );
  }

  const trend = snapshot.snapshots
    .filter((row) => row.snapshotDate !== todayLocal())
    .map((row) => ({ date: row.snapshotDate, value: row.netWorth }))
    .concat({ date: todayLocal(), value: books.netWorth.netWorth })
    .sort((a, b) => a.date.localeCompare(b.date));
  const ownedAccounts = books.accounts.filter((account) => account.portfolio.includeInNetWorth);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted">{todayLocal()}</p>
          <h1 className="hidden text-2xl font-semibold tracking-tight lg:block">Dashboard</h1>
        </div>
        <button type="button" className="btn-ghost" onClick={() => void refreshPrices({ force: true })}>
          <RefreshCw size={16} />
          Refresh prices
        </button>
      </div>

      {books.warnings.length ? (
        <section className="card border-warn/40 p-4 sm:p-5">
          <h2 className="font-semibold">Needs attention</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {books.warnings.map((warning) => (
              <li key={warning.id} className={warning.rank === 0 ? 'font-medium text-loss' : warning.severity === 'critical' ? 'text-loss' : warning.severity === 'warning' ? 'text-warn' : 'text-muted'}>
                {warning.symbols?.length ? (
                  <details>
                    <summary className="cursor-pointer">{warning.message}</summary>
                    <p className="mt-1 font-normal text-muted">{warning.symbols.join(', ')}</p>
                  </details>
                ) : (
                  warning.message
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="card overflow-hidden px-4 py-4 sm:px-7 sm:py-6">
        <p className="text-xs text-muted sm:text-sm">{books.netWorth.label}</p>
        <p className="num mt-1 text-3xl font-semibold tracking-tight sm:hidden">{moneyTight(books.netWorth.netWorth)}</p>
        <p className="num mt-1 hidden text-5xl font-semibold tracking-tight sm:block">{money(books.netWorth.netWorth)}</p>
        <p className="mt-2 hidden max-w-xl text-sm text-muted sm:block">
          Owner portfolios, brokerage cash, and checking, minus resolved liabilities.
          {books.netWorth.hasUnresolved
            ? ` Unresolved ${money(books.netWorth.unresolvedLiabilities)} is shown separately and is not subtracted.`
            : ''}
          {books.investedPartial ? ' Totals exclude holdings with no price.' : ''}
          {whatIf ? ' What-if prices are on.' : ''}
        </p>
        <Sparkline points={trend} />
      </section>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <Stat label="Invested" value={moneyTight(books.invested)} hint={books.investedPartial ? 'Partial — a price is missing' : 'Market value'} />
        <Stat
          label="Cash"
          value={moneyTight(books.liquidCash)}
          title={`Investment accounts ${money(books.brokerageCash)}. Bank and savings ${money(books.otherCash)}. Checking ${money(books.netWorth.checking)}.`}
          hint={`Investment accounts ${moneyTight(books.brokerageCash)} · Bank & savings ${moneyTight(books.otherCash)} · Checking ${moneyTight(books.netWorth.checking)}`}
        />
        <Stat label="Unrealized" value={moneyTight(books.unrealized, true)} tone={plClass(books.unrealized)} />
        <Stat label="Realized" value={moneyTight(books.realized, true)} tone={plClass(books.realized)} />
        <Stat label="Day change" value={books.dayChange == null ? '—' : moneyTight(books.dayChange, true)} tone={plClass(books.dayChange)} hint="From the last close" />
      </section>

      <Link to="/budget" className="card block p-4 transition hover:border-accent/40">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Budget this month</p>
            <p className="num mt-2 text-xl font-semibold">{moneyTight(budgetCard.totals.coreSpending)}</p>
            <p className="mt-1 text-xs text-muted">Core spending vs {moneyTight(budgetCard.budget)} budgeted</p>
          </div>
          <p className={`num text-sm ${plClass(budgetCard.totals.net)}`}>Net {moneyTight(budgetCard.totals.net, true)}</p>
        </div>
        <Sparkline label="Core spending trend" points={budgetCard.series.map((point) => ({ date: point.month, value: point.coreSpending }))} />
      </Link>

      <section>
        <h2 className="mb-3 font-semibold">Accounts</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {ownedAccounts
            .slice()
            .sort((a, b) => (b.total ?? b.invested + b.cash) - (a.total ?? a.invested + a.cash))
            .map((account) => {
            const dayValues = account.holdings.map((holding) => holding.dayChange).filter((value): value is number => value != null);
            const day = dayValues.length ? dayValues.reduce((sum, value) => sum + value, 0) : null;
            const value = account.total ?? account.invested + account.cash;
            return (
              <Link key={account.account.id} to="/investments" className="card block min-w-0 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{account.account.name}</p>
                    <p className="mt-1 text-xs text-muted">
                      {account.holdings.length === 0 ? 'Cash account · ' : ''}Cash {moneyTight(account.cash)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="num text-lg font-semibold">{moneyTight(value)}</p>
                    <p className={`num text-xs ${plClass(day)}`}>{day == null ? '—' : moneyTight(day, true)}</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="font-semibold">By symbol</h2>
          <AllocationChart data={books.allocationBySymbol} label="Allocation by symbol" />
        </div>
        <div className="card p-5">
          <h2 className="font-semibold">By account</h2>
          <AllocationChart data={books.allocationByAccount} label="Allocation by account" />
        </div>
      </section>

      <section className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Top holdings</h2>
          <Link to="/investments" className="text-sm text-accent">
            All investments
          </Link>
        </div>
        {books.topHoldings.length === 0 ? (
          <p className="text-sm text-muted">No open positions yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="py-2 pr-3 font-medium">Symbol</th>
                  <th className="py-2 pr-3 font-medium">Account</th>
                  <th className="py-2 pr-3 text-right font-medium">Value</th>
                  <th className="py-2 text-right font-medium">P/L</th>
                </tr>
              </thead>
              <tbody>
                {books.topHoldings.map((holding) => (
                  <tr key={`${holding.accountId}-${holding.symbol}`} className="border-t border-line">
                    <td className="max-w-[9rem] truncate py-3 pr-3 font-medium sm:max-w-none">{contractLabel(holding)}</td>
                    <td className="hidden py-3 pr-3 text-muted sm:table-cell">{holding.accountName}</td>
                    <td className="num py-3 pr-3 text-right">{moneyTight(holding.marketValue)}</td>
                    <td className={`num py-3 text-right ${plClass(holding.unrealized)}`}>
                      {moneyTight(holding.unrealized, true)}
                      <span className="ml-2 hidden text-xs sm:inline">{pct(holding.unrealizedPct, true)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <h2 className="font-semibold">Checking</h2>
          {books.checking.length === 0 ? (
            <p className="text-sm text-muted">No checking accounts yet.</p>
          ) : (
            books.checking.map((row) => (
              <Link key={row.account.id} to="/checking" className="card block p-4 transition hover:border-accent/40">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{row.account.name}</p>
                    <p className="mt-1 text-xs text-muted">
                      Projected low {money(row.projection.minBalance)} on {row.projection.minDate}
                    </p>
                  </div>
                  <p className="num shrink-0 text-lg font-semibold sm:text-xl">{moneyTight(row.balance)}</p>
                </div>
              </Link>
            ))
          )}
        </div>
        <div>
          <h2 className="mb-3 font-semibold">Bills, next 14 days</h2>
          <div className="card divide-y divide-line">
            {books.upcomingBills.length === 0 ? (
              <p className="p-4 text-sm text-muted">Nothing scheduled.</p>
            ) : (
              books.upcomingBills.map((bill) => (
                <div key={`${bill.itemId}-${bill.date}`} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div>
                    <p className="font-medium">{bill.name}</p>
                    <p className="text-xs text-muted">
                      {bill.date}
                      {bill.autopay ? ' · Autopay' : ''}
                    </p>
                  </div>
                  <p className={`num shrink-0 ${bill.kind === 'income' ? 'text-gain' : ''}`}>{moneyTight(bill.signedAmount, true)}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {books.excluded.length ? (
        <section>
          <h2 className="mb-3 font-semibold">Excluded from net worth</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {books.excluded.map((portfolio) => (
              <div key={portfolio.portfolio.id} className="card p-4">
                <p className="text-xs uppercase tracking-wide text-muted">Family portfolio</p>
                <p className="mt-1 font-medium">{portfolio.portfolio.name}</p>
                <p className="num mt-2 text-xl font-semibold">{moneyTight(portfolio.total ?? portfolio.invested + portfolio.cash)}</p>
                <p className="text-xs text-muted">{moneyTight(portfolio.invested)} invested · {moneyTight(portfolio.cash)} cash</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
