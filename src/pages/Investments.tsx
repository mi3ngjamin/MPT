import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useFinance } from '../context/FinanceContext';
import type { AccountView, HoldingView } from '../domain/assemble';
import { modelBuyMore } from '../domain/modeler';
import { createId } from '../domain/ids';
import { contractLabel } from '../domain/labels';
import { money, moneyTight, pct, plClass, price, qty, relativeTime } from '../lib/format';

export default function Investments() {
  const { books, snapshot, setWhatIf, saveScenario, applyScenario, saveManualPrice } = useFinance();
  const [params] = useSearchParams();
  const manualSymbol = params.get('manual');
  const [portfolioId, setPortfolioId] = useState('all');
  const portfolios = portfolioId === 'all' ? books.portfolios : books.portfolios.filter((row) => row.portfolio.id === portfolioId);
  const largestAccountId = useMemo(() => {
    let bestId = '';
    let best = -Infinity;
    for (const portfolio of portfolios) {
      for (const account of portfolio.accounts) {
        const value = account.total ?? account.invested + account.cash;
        if (value > best) {
          best = value;
          bestId = account.account.id;
        }
      }
    }
    return bestId;
  }, [portfolios]);
  const [opened, setOpened] = useState<Set<string> | null>(null);
  const expanded = opened ?? new Set(largestAccountId ? [largestAccountId] : []);
  const toggleAccount = (id: string) => {
    setOpened((current) => {
      const next = new Set(current ?? (largestAccountId ? [largestAccountId] : []));
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const [scenarioName, setScenarioName] = useState('');
  const symbols = useMemo(() => {
    const set = new Set<string>();
    for (const portfolio of books.portfolios) {
      for (const account of portfolio.accounts) {
        for (const holding of account.holdings) set.add(holding.symbol);
      }
    }
    return [...set].sort();
  }, [books.portfolios]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Investments</h1>
          <p className="text-sm text-muted">Average cost, cash from the ledger, and a buy-more model on every row.</p>
        </div>
        <span className="chip">{snapshot.preferences.priceMode === 'what_if' ? 'What-if prices' : 'Live prices'}</span>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <FilterChip active={portfolioId === 'all'} onClick={() => setPortfolioId('all')}>
          All
        </FilterChip>
        {books.portfolios.map((portfolio) => (
          <FilterChip key={portfolio.portfolio.id} active={portfolioId === portfolio.portfolio.id} onClick={() => setPortfolioId(portfolio.portfolio.id)}>
            {portfolio.portfolio.name}
          </FilterChip>
        ))}
      </div>

      {portfolios.length === 0 ? (
        <p className="text-sm text-muted">Add a portfolio in Settings, then an opening position in Activity.</p>
      ) : (
        portfolios.map((portfolio) => (
          <section key={portfolio.portfolio.id} className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold">{portfolio.portfolio.name}</h2>
                {!portfolio.portfolio.includeInNetWorth ? <p className="text-xs text-warn">Excluded from net worth</p> : null}
              </div>
              <p className="num text-sm text-muted">
                {moneyTight(portfolio.total ?? portfolio.invested)} · cash {moneyTight(portfolio.cash)} · P/L {moneyTight(portfolio.unrealized, true)}
              </p>
            </div>
            {portfolio.accounts.map((account) => (
              <AccountCard
                key={account.account.id}
                account={account}
                portfolioCash={portfolio.cash}
                portfolioInvested={portfolio.invested}
                open={expanded.has(account.account.id)}
                onToggle={() => toggleAccount(account.account.id)}
              />
            ))}
            {portfolio.aggregated.length ? (
              <div className="card p-4">
                <h3 className="text-sm font-semibold">Across accounts</h3>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs uppercase text-muted">
                      <tr>
                        <th className="py-2 font-medium">Symbol</th>
                        <th className="py-2 text-right font-medium">Qty</th>
                        <th className="py-2 text-right font-medium">Value</th>
                        <th className="py-2 text-right font-medium">Weight</th>
                      </tr>
                    </thead>
                    <tbody>
                      {portfolio.aggregated.map((row) => (
                        <tr key={row.symbol} className="border-t border-line">
                          <td className="py-2">{contractLabel({ symbol: row.symbol })}</td>
                          <td className="num py-2 text-right">{qty(row.quantity)}</td>
                          <td className="num py-2 text-right">{moneyTight(row.marketValue)}</td>
                          <td className="num py-2 text-right">{pct(row.weight)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </section>
        ))
      )}

      <section className="card p-5">
        <h2 className="font-semibold">What-if prices</h2>
        <p className="mt-1 text-sm text-muted">Saved per symbol. The Live / What-if switch recomputes the whole app.</p>
        <div className="mt-4 space-y-3">
          {symbols.map((symbol) => {
            const current = snapshot.whatIfs.find((row) => row.symbol === symbol);
            return (
              <form
                key={symbol}
                className="flex flex-wrap items-end gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  const data = new FormData(event.currentTarget);
                  const raw = String(data.get('price') ?? '');
                  void setWhatIf(symbol, raw === '' ? null : Number(raw));
                }}
              >
                <label className="min-w-32 flex-1">
                  <span className="label">{contractLabel({ symbol })}</span>
                  <input className="field num" name="price" inputMode="decimal" defaultValue={current?.price ?? ''} aria-label={`What-if price for ${symbol}`} />
                </label>
                <button type="submit" className="btn-ghost">
                  Save
                </button>
                <button type="button" className="btn-ghost" onClick={() => void setWhatIf(symbol, null)}>
                  Clear
                </button>
              </form>
            );
          })}
        </div>
        <form
          className="mt-4 flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!scenarioName.trim()) return;
            void saveScenario(scenarioName.trim());
            setScenarioName('');
          }}
        >
          <label className="min-w-48 flex-1">
            <span className="label">Save these prices as a scenario</span>
            <input className="field" value={scenarioName} onChange={(event) => setScenarioName(event.target.value)} aria-label="Scenario name" />
          </label>
          <button type="submit" className="btn-primary self-end">
            Save scenario
          </button>
        </form>
        <ul className="mt-4 space-y-2 text-sm">
          {snapshot.scenarios.map((scenario) => (
            <li key={scenario.id} className="flex items-center justify-between gap-3">
              <span>{scenario.name}</span>
              <button type="button" className="btn-ghost" onClick={() => void applyScenario(scenario.id)}>
                Apply
              </button>
            </li>
          ))}
        </ul>
      </section>

      <ManualPriceForm key={manualSymbol ?? 'manual'} symbols={symbols} initialSymbol={manualSymbol} onSave={saveManualPrice} />
    </div>
  );
}

function AccountCard({
  account,
  portfolioCash,
  portfolioInvested,
  open,
  onToggle,
}: {
  account: AccountView;
  portfolioCash: number;
  portfolioInvested: number;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <article className="card p-4">
      <button type="button" className="flex w-full items-start justify-between gap-3 text-left" onClick={onToggle} aria-expanded={open}>
        <div className="min-w-0">
          <h3 className="font-semibold">
            <span className="mr-2 text-muted" aria-hidden>{open ? '▾' : '▸'}</span>
            {account.account.name}
          </h3>
          <p className="text-xs text-muted">
            {account.account.accountType} · {account.account.taxTreatment.replace('_', ' ')} · {account.holdings.length} holding{account.holdings.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="shrink-0 text-right text-sm">
          <p className={`num font-semibold ${account.negativeCash ? 'text-loss' : ''}`}>Cash {moneyTight(account.cash)}</p>
          <p className="num text-muted">Total {moneyTight(account.total ?? account.invested + account.cash)}</p>
        </div>
      </button>
      {open ? (
        <div className="mt-4 space-y-3">
          {account.negativeCash ? <p className="text-sm text-loss">Cash is negative. The ledger was still applied.</p> : null}
          {account.holdings.length === 0 ? <p className="text-sm text-muted">No open positions. This account is cash only.</p> : null}
          {account.holdings.map((holding) => (
            <HoldingRow
              key={holding.symbol}
              holding={holding}
              accountCash={account.cash}
              portfolioCash={portfolioCash}
              portfolioInvested={portfolioInvested}
            />
          ))}
        </div>
      ) : null}
    </article>
  );
}

function HoldingRow({
  holding,
  accountCash,
  portfolioCash,
  portfolioInvested,
}: {
  holding: HoldingView;
  accountCash: number;
  portfolioCash: number;
  portfolioInvested: number;
}) {
  const { snapshot, saveModeled, unsupportedSymbols } = useFinance();
  const noLiveFeed =
    unsupportedSymbols.includes(holding.symbol) &&
    holding.priceSource !== 'manual' &&
    holding.priceSource !== 'live' &&
    holding.priceSource !== 'what_if';
  const saved = snapshot.modeled.find((row) => row.accountId === holding.accountId && row.symbol === holding.symbol);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(saved?.amountSource === 'custom' ? String(saved.amount ?? '') : '');
  const [source, setSource] = useState(saved?.amountSource ?? 'custom');
  const resolvedAmount = source === 'account_cash' ? Math.max(accountCash, 0) : source === 'portfolio_cash' ? Math.max(portfolioCash, 0) : Number(amount);
  const model =
    holding.price != null && resolvedAmount > 0
      ? modelBuyMore({
          quantity: holding.quantity,
          costBasis: holding.costBasis,
          price: holding.price,
          multiplier: holding.multiplier,
          amount: resolvedAmount,
          portfolioInvested,
          holdingMarketValue: holding.marketValue ?? 0,
        })
      : null;
  const option = holding.assetType === 'option';

  return (
    <div className="rounded-xl border border-line bg-panel-2/40 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">{contractLabel(holding)}</p>
          <p className="text-xs text-muted">
            {qty(holding.quantity)} {option ? 'contracts' : 'shares'} · {holding.avgCostLabel} {price(holding.avgCost)}
          </p>
        </div>
        <div className="text-right">
          <p className="num font-semibold">{moneyTight(holding.marketValue)}</p>
          <p className={`num text-xs ${plClass(holding.unrealized)}`}>
            {moneyTight(holding.unrealized, true)} {pct(holding.unrealizedPct, true)}
          </p>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted">
        {price(holding.price)} ·{' '}
        {noLiveFeed ? (
          <Link className="text-accent underline" to={`/investments?manual=${encodeURIComponent(holding.symbol)}`}>
            no live feed: set a manual price
          </Link>
        ) : (
          priceCaption(holding)
        )}
        {holding.oversold ? ' · oversold' : ''}
      </p>
      <button type="button" className="mt-2 text-xs font-medium text-accent" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        {open ? 'Hide buy-more' : 'Buy more'}
      </button>
      {open ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label>
            <span className="label">Amount</span>
            <input
              className="field num"
              inputMode="decimal"
              value={source === 'custom' ? amount : String(resolvedAmount || '')}
              onChange={(event) => {
                setSource('custom');
                setAmount(event.target.value);
              }}
              aria-label={`Buy more amount for ${holding.symbol}`}
            />
          </label>
          <div className="flex flex-wrap items-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setSource('account_cash')}>
              This account's cash
            </button>
            <button type="button" className="btn-ghost" onClick={() => setSource('portfolio_cash')}>
              Portfolio cash
            </button>
          </div>
          {model ? (
            <dl className="grid grid-cols-2 gap-2 text-sm sm:col-span-2">
              <Meta label={option ? 'Contracts added' : 'Shares added'} value={qty(model.unitsAdded)} />
              <Meta label="New quantity" value={qty(model.newQuantity)} />
              <Meta label="New avg cost" value={price(model.newAvgCost)} />
              <Meta label="New basis" value={money(model.newCostBasis)} />
              <Meta label="Avg cost reduction" value={pct(model.avgCostReductionPct)} />
              <Meta label="New weight" value={pct(model.newWeightPct)} />
            </dl>
          ) : (
            <p className="text-sm text-muted sm:col-span-2">Enter an amount and a price to model the purchase.</p>
          )}
          <button
            type="button"
            className="btn-primary sm:col-span-2"
            onClick={() =>
              void saveModeled({
                id: saved?.id ?? createId(),
                accountId: holding.accountId,
                symbol: holding.symbol,
                amount: source === 'custom' ? Number(amount) : null,
                amountSource: source,
              })
            }
          >
            Save modeled amount
          </button>
          {holding.audit.length ? (
            <details className="sm:col-span-2">
              <summary className="cursor-pointer text-sm text-muted">Cost basis breakdown</summary>
              <ul className="mt-2 space-y-1 text-xs text-muted">
                {holding.audit.map((line, index) => (
                  <li key={`${line.activityId}-${index}`} className="num">
                    {line.date} {line.action} qty {qty(line.quantityAfter)} basis {money(line.basisAfter)}
                    {line.realizedDelta ? ` realized ${money(line.realizedDelta, true)}` : ''}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ManualPriceForm({
  symbols,
  initialSymbol,
  onSave,
}: {
  symbols: string[];
  initialSymbol: string | null;
  onSave: (symbol: string, price: number) => Promise<void>;
}) {
  const [symbol, setSymbol] = useState(initialSymbol ?? symbols[0] ?? '');
  const [value, setValue] = useState('');
  useEffect(() => {
    if (!initialSymbol) return;
    document.getElementById('manual-price')?.scrollIntoView({ block: 'center' });
  }, [initialSymbol]);
  return (
    <form
      id="manual-price"
      className="card flex flex-wrap items-end gap-3 p-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (!symbol || !(Number(value) > 0)) return;
        void onSave(symbol, Number(value));
        setValue('');
      }}
    >
      <label className="min-w-36 flex-1">
        <span className="label">Manual price symbol</span>
        <input className="field" value={symbol} onChange={(event) => setSymbol(event.target.value.toUpperCase())} aria-label="Manual price symbol" />
      </label>
      <label className="min-w-32">
        <span className="label">Price</span>
        <input className="field num" inputMode="decimal" value={value} onChange={(event) => setValue(event.target.value)} aria-label="Manual price" />
      </label>
      <button type="submit" className="btn-primary">
        Save manual price
      </button>
    </form>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button type="button" onClick={onClick} className={`chip ${active ? 'border-accent text-ink' : ''}`}>
      {children}
    </button>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="num font-medium">{value}</dd>
    </div>
  );
}

function priceCaption(holding: HoldingView): string {
  const when = holding.priceAsOf ? relativeTime(holding.priceAsOf) : null;
  if (holding.missing) return 'No price';
  if (holding.priceSource === 'what_if') return 'What-if';
  if (holding.priceSource === 'live') return when ? `Live · ${when}` : 'Live';
  if (holding.priceSource === 'manual') return when ? `Manual · ${when}` : 'Manual';
  return when ? `Last known price · ${when}` : 'Last known price';
}
