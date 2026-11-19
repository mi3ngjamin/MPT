import { RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AllocationChart } from '../components/Charts';
import { Empty, Stat } from '../components/ui';
import { useFinance } from '../context/FinanceContext';
import { todayLocal } from '../domain/dates';
import { money, pct, plClass, price } from '../lib/format';

export default function Dashboard() {
  const { books, snapshot, refreshPrices } = useFinance();
  const whatIf = snapshot.preferences.priceMode === 'what_if';
  const empty = books.portfolios.length === 0 && books.checking.length === 0;

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted">{todayLocal()}</p>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className={`chip ${whatIf ? 'border-warn/40 text-warn' : ''}`}>{whatIf ? 'What-if' : 'Live'}</span>
          <button type="button" className="btn-ghost" onClick={() => void refreshPrices()}>
            <RefreshCw size={16} />
            Refresh prices
          </button>
        </div>
      </div>

      <section className="card overflow-hidden px-5 py-6 sm:px-7">
        <p className="text-sm text-muted">{books.netWorth.label}</p>
        <p className="num mt-1 text-4xl font-semibold tracking-tight sm:text-5xl">{money(books.netWorth.netWorth)}</p>
        <p className="mt-2 max-w-xl text-sm text-muted">
          Owner portfolios, brokerage cash, and checking, minus resolved liabilities.
          {books.netWorth.hasUnresolved
            ? ` Unresolved ${money(books.netWorth.unresolvedLiabilities)} is shown separately and is not subtracted.`
            : ''}
          {books.investedPartial ? ' Totals exclude holdings with no price.' : ''}
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label="Invested" value={money(books.invested)} hint={books.investedPartial ? 'Partial — a price is missing' : 'Market value'} />
        <Stat label="Brokerage cash" value={money(books.brokerageCash)} />
        <Stat label="Unrealized" value={money(books.unrealized, true)} tone={plClass(books.unrealized)} />
        <Stat label="Realized" value={money(books.realized, true)} tone={plClass(books.realized)} />
        <Stat label="Day change" value={books.dayChange == null ? '—' : money(books.dayChange, true)} tone={plClass(books.dayChange)} hint="From the last close" />
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
                    <td className="py-3 pr-3 font-medium">{holding.symbol}</td>
                    <td className="py-3 pr-3 text-muted">{holding.accountName}</td>
                    <td className="num py-3 pr-3 text-right">{money(holding.marketValue)}</td>
                    <td className={`num py-3 text-right ${plClass(holding.unrealized)}`}>
                      {money(holding.unrealized, true)}
                      <span className="ml-2 text-xs">{pct(holding.unrealizedPct, true)}</span>
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
                  <p className="num text-xl font-semibold">{money(row.balance)}</p>
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
                  <p className={`num ${bill.kind === 'income' ? 'text-gain' : ''}`}>{money(bill.signedAmount, true)}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {books.warnings.length ? (
        <section className="card p-5">
          <h2 className="font-semibold">Warnings</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {books.warnings.map((warning) => (
              <li key={warning.id} className={warning.severity === 'critical' ? 'text-loss' : warning.severity === 'warning' ? 'text-warn' : 'text-muted'}>
                {warning.message}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {books.excluded.length ? (
        <section>
          <h2 className="mb-3 font-semibold">Excluded from net worth</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {books.excluded.map((portfolio) => (
              <div key={portfolio.portfolio.id} className="card p-4">
                <p className="text-xs uppercase tracking-wide text-muted">Family portfolio</p>
                <p className="mt-1 font-medium">{portfolio.portfolio.name}</p>
                <p className="num mt-2 text-xl font-semibold">{money(portfolio.total ?? portfolio.invested + portfolio.cash)}</p>
                <p className="text-xs text-muted">{price(portfolio.invested)} invested · {money(portfolio.cash)} cash</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
