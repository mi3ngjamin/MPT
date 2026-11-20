import { useState } from 'react';
import { FlowBar, MultiLineChart } from '../components/BudgetCharts';
import { Stat } from '../components/ui';
import { useFinance } from '../context/FinanceContext';
import {
  CARD_SPENDING_LABEL,
  FLOW_LABELS,
  SAVINGS_RATE_NOTE,
  balanceSeries,
  categorySeries,
  chartBounds,
  filterLines,
  flowSlices,
  monthlySeries,
  periodBounds,
  prepareBudget,
  summarize,
  targetRows,
  type BudgetLine,
  type BudgetPeriod,
  type ChartSpan,
} from '../domain/budget';
import { todayLocal } from '../domain/dates';
import type { FlowType } from '../domain/types';
import { money, moneyTight, pct, plClass } from '../lib/format';

const PERIODS: { id: BudgetPeriod; label: string }[] = [
  { id: 'month', label: 'Month' },
  { id: 'quarter', label: 'Quarter' },
  { id: 'ytd', label: 'YTD' },
  { id: 'trailing12', label: 'Trailing 12' },
  { id: 'all', label: 'All time' },
];

const QUICK_FLOWS: FlowType[] = ['income', 'core_spending', 'taxes', 'debt_payment', 'savings', 'transfer_internal', 'adjustment'];

export default function Budget() {
  const finance = useFinance();
  const { snapshot } = finance;
  const today = todayLocal();
  const [period, setPeriod] = useState<BudgetPeriod>('month');
  const [month, setMonth] = useState(today.slice(0, 7));
  const [account, setAccount] = useState('all');
  const [span, setSpan] = useState<ChartSpan>('24m');
  const [showAverage, setShowAverage] = useState(false);
  const [showTaxes, setShowTaxes] = useState(true);
  const [showDebt, setShowDebt] = useState(true);
  const [picked, setPicked] = useState<string[]>(['Monthly Bills', 'Food & Groceries', 'Shopping', CARD_SPENDING_LABEL]);
  const [query, setQuery] = useState('');
  const [drill, setDrill] = useState<string | null>(null);

  const lines = prepareBudget({
    accounts: snapshot.checkingAccounts,
    checkingTxns: snapshot.checkingTxns,
    entries: snapshot.budgetEntries,
    categories: snapshot.budgetCategories,
    cards: snapshot.cardAccounts,
    cardTxns: snapshot.cardTxns,
  });
  const scoped = filterLines(lines, account);
  const household = account === 'all';
  const bounds = periodBounds(period, today, month);
  const totals = summarize(scoped, snapshot.budgetSettings, bounds.start, bounds.end, household);
  const earliest = lines.reduce<string | null>((min, line) => (min == null || line.date < min ? line.date : min), null);
  const charts = chartBounds(span, today, earliest);
  const months = monthlySeries(scoped, snapshot.budgetSettings, charts.start, charts.end, household);
  const targets = targetRows(scoped, snapshot.budgetTargets, bounds.start, bounds.end);
  const slices = flowSlices(scoped, bounds.start, bounds.end, household);
  const balances = balanceSeries(snapshot.checkingAccounts, snapshot.checkingTxns, snapshot.budgetEntries, charts.end);
  const categoryLabels = [...new Set(scoped.filter((line) => !line.hidden).map((line) => line.reportLabel).concat(picked))].sort((a, b) =>
    a.localeCompare(b),
  );
  const trends = categorySeries(scoped, picked, charts.start, charts.end);
  const review = scoped.filter((line) => line.flow === 'needs_review' && !line.matchedTransfer);
  const visible = scoped
    .filter((line) => line.date >= bounds.start && line.date <= bounds.end)
    .filter((line) => (drill ? line.reportLabel === drill || line.category === drill : true))
    .filter((line) => `${line.description} ${line.category} ${line.accountName}`.toLowerCase().includes(query.trim().toLowerCase()))
    .slice()
    .sort((a, b) => (a.date === b.date ? b.id.localeCompare(a.id) : a.date < b.date ? 1 : -1));

  const budgeted = targets.reduce((sum, row) => sum + row.budget, 0);
  const tracked = targets.reduce((sum, row) => sum + (row.actual ?? 0), 0);

  async function applyFlow(line: BudgetLine, flow: FlowType | null) {
    if (line.origin === 'checking') {
      const row = snapshot.checkingTxns.find((txn) => txn.id === line.id);
      if (!row) return;
      await finance.saveCheckingTxn({ ...row, flowOverride: flow });
      return;
    }
    if (line.origin === 'history') {
      const row = snapshot.budgetEntries.find((entry) => entry.id === line.id);
      if (!row) return;
      await finance.saveBudgetEntry({ ...row, flowOverride: flow });
      return;
    }
    const row = snapshot.cardTxns.find((txn) => txn.id === line.id);
    if (!row) return;
    await finance.saveCardTxn({ ...row, flowOverride: flow });
  }

  async function applyCategory(line: BudgetLine, category: string) {
    if (line.origin === 'checking') {
      const row = snapshot.checkingTxns.find((txn) => txn.id === line.id);
      if (row) await finance.saveCheckingTxn({ ...row, category });
      return;
    }
    if (line.origin === 'history') {
      const row = snapshot.budgetEntries.find((entry) => entry.id === line.id);
      if (row) await finance.saveBudgetEntry({ ...row, category, categoryLocked: true });
      return;
    }
    const row = snapshot.cardTxns.find((txn) => txn.id === line.id);
    if (row) await finance.saveCardTxn({ ...row, category });
  }

  const categoryOptions = (snapshot.budgetCategories.length ? snapshot.budgetCategories : []).map((row) => row.name);
  const optionNames = categoryOptions.length ? categoryOptions : ['Income', 'Monthly Bills', 'Credit Card', 'Taxes', 'Transfer', 'Uncategorized'];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Budget</h1>
          <p className="text-sm text-muted">Checking cash flow. History before an opening date stays out of the balance.</p>
        </div>
        <label>
          <span className="label">Month</span>
          <input className="field" type="month" value={month} onChange={(event) => setMonth(event.target.value)} aria-label="Budget month" />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        {PERIODS.map((item) => (
          <button key={item.id} type="button" className={`chip ${period === item.id ? 'border-accent text-ink' : ''}`} onClick={() => setPeriod(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={`chip ${account === 'all' ? 'border-accent text-ink' : ''}`} onClick={() => setAccount('all')}>
          Both
        </button>
        {snapshot.checkingAccounts.map((row) => (
          <button key={row.id} type="button" className={`chip ${account === row.id ? 'border-accent text-ink' : ''}`} onClick={() => setAccount(row.id)}>
            {row.name}
          </button>
        ))}
        {snapshot.cardAccounts.map((row) => (
          <button key={row.id} type="button" className={`chip ${account === `card:${row.id}` ? 'border-accent text-ink' : ''}`} onClick={() => setAccount(`card:${row.id}`)}>
            {row.name}
          </button>
        ))}
      </div>

      {review.length ? (
        <section className="card space-y-3 p-4">
          <h2 className="font-semibold">Needs review ({review.length})</h2>
          <p className="text-xs text-muted">Venmo, blanks, and anything still uncategorized. A flow override wins over the category.</p>
          <ul className="divide-y divide-line">
            {review.slice(0, 8).map((line) => (
              <li key={line.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate">
                  {line.date} · {line.description || line.category} · {money(line.amount, true)}
                </span>
                {QUICK_FLOWS.map((flow) => (
                  <button key={flow} type="button" className="chip" onClick={() => void applyFlow(line, flow)}>
                    {FLOW_LABELS[flow] === 'Adjustment' ? 'Ignore' : FLOW_LABELS[flow]}
                  </button>
                ))}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label="Income" value={moneyTight(totals.income)} />
        <Stat label="Core spending" value={moneyTight(totals.coreSpending)} hint={`Budgeted lines ${moneyTight(budgeted)} · tracked ${moneyTight(tracked)}`} />
        <Stat label="Taxes" value={moneyTight(totals.taxes)} />
        <Stat label="Debt payments" value={moneyTight(totals.debtPayments)} hint={totals.loanProceeds ? `Proceeds ${money(totals.loanProceeds)} are not income` : undefined} />
        <Stat label="Net cash flow" value={moneyTight(totals.net, true)} tone={plClass(totals.net)} hint={totals.cardSpending ? `Card spending ${moneyTight(totals.cardSpending)}` : undefined} />
        <Stat label="Take-home savings rate" value={pct(totals.savingsRate)} title={SAVINGS_RATE_NOTE} hint={`Savings ${moneyTight(totals.savings)} · investments ${moneyTight(totals.investment)}${totals.payroll ? ` · payroll ${moneyTight(totals.payroll)}` : ''}`} />
      </section>
      <p className="text-xs text-muted">{SAVINGS_RATE_NOTE}</p>

      <section className="card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Income, core spending, and net</h2>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={`chip ${span === '24m' ? 'border-accent text-ink' : ''}`} onClick={() => setSpan('24m')}>
              24 months
            </button>
            <button type="button" className={`chip ${span === 'all' ? 'border-accent text-ink' : ''}`} onClick={() => setSpan('all')}>
              All time
            </button>
            <button type="button" className={`chip ${showAverage ? 'border-accent text-ink' : ''}`} onClick={() => setShowAverage((value) => !value)}>
              3-month average
            </button>
            <button type="button" className={`chip ${showTaxes ? 'border-accent text-ink' : ''}`} onClick={() => setShowTaxes((value) => !value)}>
              Taxes
            </button>
            <button type="button" className={`chip ${showDebt ? 'border-accent text-ink' : ''}`} onClick={() => setShowDebt((value) => !value)}>
              Debt
            </button>
          </div>
        </div>
        <MultiLineChart
          labels={months.map((point) => point.month)}
          onSelect={(index) => {
            const chosen = months[index];
            if (!chosen) return;
            setMonth(chosen.month);
            setPeriod('month');
          }}
          series={[
            { key: 'income', label: 'Income', color: '#34d399', values: months.map((point) => point.income) },
            { key: 'core', label: 'Core spending', color: '#38bdf8', values: months.map((point) => point.coreSpending) },
            { key: 'net', label: 'Net', color: '#f5c16c', values: months.map((point) => point.net) },
            ...(showTaxes ? [{ key: 'taxes', label: 'Taxes', color: '#f87171', values: months.map((point) => point.taxes) }] : []),
            ...(showDebt ? [{ key: 'debt', label: 'Debt payments', color: '#fb923c', values: months.map((point) => point.debtPayments) }] : []),
            ...(showAverage
              ? [
                  { key: 'income-ma', label: 'Income avg', color: '#34d399', dashed: true, values: months.map((point) => point.incomeMa) },
                  { key: 'core-ma', label: 'Core avg', color: '#38bdf8', dashed: true, values: months.map((point) => point.coreSpendingMa) },
                  { key: 'net-ma', label: 'Net avg', color: '#f5c16c', dashed: true, values: months.map((point) => point.netMa) },
                ]
              : []),
          ]}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <h2 className="mb-3 font-semibold">Where it went</h2>
          <FlowBar slices={slices} />
        </div>
        <div className="card p-4">
          <h2 className="mb-3 font-semibold">Savings rate</h2>
          <MultiLineChart
            labels={months.map((point) => point.month)}
            series={[
              { key: 'rate', label: 'Take-home savings rate', color: '#5eead4', values: months.map((point) => (point.savingsRate == null ? null : point.savingsRate * 100)) },
              ...(showAverage
                ? [{ key: 'rate-ma', label: '3-month average', color: '#5eead4', dashed: true, values: months.map((point) => (point.savingsRateMa == null ? null : point.savingsRateMa * 100)) }]
                : []),
            ]}
          />
        </div>
      </section>

      <section className="card p-4">
        <h2 className="mb-2 font-semibold">Category trends</h2>
        <div className="mb-3 flex flex-wrap gap-2">
          {categoryLabels.slice(0, 18).map((label) => (
            <button
              key={label}
              type="button"
              className={`chip ${picked.includes(label) ? 'border-accent text-ink' : ''}`}
              onClick={() => setPicked((current) => (current.includes(label) ? current.filter((item) => item !== label) : [...current, label]))}
            >
              {label}
            </button>
          ))}
        </div>
        <MultiLineChart
          labels={trends.map((point) => point.month)}
          onSelect={(index) => {
            const chosen = trends[index];
            if (!chosen) return;
            setMonth(chosen.month);
            setPeriod('month');
          }}
          series={picked.map((label, index) => ({
            key: label,
            label,
            color: ['#2dd4bf', '#38bdf8', '#f472b6', '#f5c16c', '#a78bfa', '#fb7185'][index % 6],
            values: trends.map((point) => point.values[label] ?? 0),
          }))}
        />
      </section>

      <section className="card p-4">
        <h2 className="mb-3 font-semibold">Checking balance</h2>
        <MultiLineChart
          labels={balances[0]?.points.map((point) => point.month) ?? []}
          series={balances.map((series, index) => ({
            key: series.accountId,
            label: series.accountName,
            color: ['#14b8a6', '#818cf8', '#f5c16c'][index % 3],
            values: series.points.map((point) => point.balance),
          }))}
        />
        <p className="mt-2 text-xs text-muted">Before each opening date the line is rebuilt from archived rows. After that it follows the register, not the archive.</p>
      </section>

      <section className="card p-4">
        <h2 className="mb-3 font-semibold">Budget vs actual</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="py-2 pr-3">Line</th>
                <th className="py-2 pr-3 text-right">Budget</th>
                <th className="py-2 text-right">Actual</th>
              </tr>
            </thead>
            <tbody>
              {targets.map((row) => (
                <tr key={row.id} className="border-t border-line">
                  <td className="py-2 pr-3">
                    <button type="button" className="text-left" onClick={() => setDrill(row.label)}>
                      {row.label}
                    </button>
                    {row.untracked ? <p className="text-xs text-muted">Not tracked in checking yet (likely on a card).</p> : null}
                  </td>
                  <td className="num py-2 pr-3 text-right">{money(row.budget)}</td>
                  <td className="num py-2 text-right">{row.actual == null ? '—' : money(row.actual)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-semibold">Transactions</h2>
          <label className="min-w-[12rem] flex-1">
            <span className="label">Search</span>
            <input className="field" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Payee, category, account" aria-label="Search budget transactions" />
          </label>
        </div>
        {drill ? (
          <button type="button" className="chip mb-3" onClick={() => setDrill(null)}>
            Clear {drill}
          </button>
        ) : null}
        <div className="card divide-y divide-line">
          {visible.length === 0 ? <p className="p-4 text-sm text-muted">No transactions in this period.</p> : null}
          {visible.slice(0, 80).map((line) => (
            <div key={`${line.origin}-${line.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{line.description || line.category}</p>
                <p className="text-xs text-muted">
                  {line.date} · {line.accountName} · {FLOW_LABELS[line.flow]}
                  {line.matchedTransfer ? ' · Matched transfer' : ''}
                  {line.beforeOpening ? ' · History' : ''}
                  {!line.countsInBalance && line.origin === 'history' ? ' · Not in balance' : ''}
                </p>
              </div>
              <label className="w-36">
                <span className="sr-only">Category for {line.description}</span>
                <input className="field" list="budget-categories" value={line.category} onChange={(event) => void applyCategory(line, event.target.value)} />
              </label>
              <label className="w-36">
                <span className="sr-only">Flow override for {line.description}</span>
                <select
                  className="field"
                  value={line.flowOverride ?? ''}
                  onChange={(event) => void applyFlow(line, event.target.value ? (event.target.value as FlowType) : null)}
                >
                  <option value="">Category default</option>
                  {Object.entries(FLOW_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <p className={`num w-24 text-right font-medium ${plClass(line.amount)}`}>{money(line.amount, true)}</p>
            </div>
          ))}
        </div>
        <datalist id="budget-categories">
          {optionNames.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </section>
    </div>
  );
}
