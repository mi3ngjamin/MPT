import { useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { useAuth } from '../context/AuthContext';
import { builtinCategories, builtinTargets, FLOW_LABELS, FLOW_TYPES, SAVINGS_RATE_NOTE, signedCardAmount } from '../domain/budget';
import { parseTransactionCsv } from '../domain/csv';
import { todayLocal } from '../domain/dates';
import { createId } from '../domain/ids';
import { ACCOUNT_TYPE_LABELS, LIABILITY_LABELS, TAX_LABELS } from '../domain/labels';
import type { Account, AccountType, BudgetCategory, BudgetTarget, CheckingAccount, FlowType, Liability, LiabilityType, PayrollCadence, Portfolio, TaxTreatment } from '../domain/types';
import { isBackupFile } from '../lib/backup';

export default function Settings() {
  const finance = useFinance();
  const auth = useAuth();
  const { snapshot } = finance;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted">{finance.demo ? 'Sample mode' : auth.email}</p>
      </div>

      <PortfolioSection />
      <AccountSection />
      <CheckingSection />
      <CategorySection />
      <TargetSection />
      <PayrollSection />
      <CardSection />
      <LiabilitySection />

      <section className="card space-y-3 p-5">
        <h2 className="font-semibold">Price scenarios</h2>
        {snapshot.scenarios.length === 0 ? <p className="text-sm text-muted">Save one from Investments.</p> : null}
        {snapshot.scenarios.map((scenario) => (
          <div key={scenario.id} className="flex items-center justify-between gap-3 text-sm">
            <span>{scenario.name}</span>
            <div className="flex gap-2">
              <button type="button" className="btn-ghost" onClick={() => void finance.applyScenario(scenario.id)}>
                Apply
              </button>
              <button type="button" className="btn-danger" onClick={() => void finance.deleteScenario(scenario.id)}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="font-semibold">Backup</h2>
        <p className="text-sm text-muted">JSON export of everything in your account. Import merges, or replaces after you confirm.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-primary" onClick={() => finance.exportBackup()}>
            Export JSON
          </button>
          <label className="btn-ghost cursor-pointer">
            Import JSON
            <input
              className="sr-only"
              type="file"
              accept="application/json"
              aria-label="Import JSON backup"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                void file.text().then((text) => {
                  const parsed = JSON.parse(text) as unknown;
                  if (!isBackupFile(parsed)) {
                    finance.setNotice('That file is not an MPT backup.');
                    return;
                  }
                  const replace = window.confirm('Replace existing books? Cancel merges instead.');
                  return finance.importBackup(parsed, replace);
                });
                event.target.value = '';
              }}
            />
          </label>
          <button type="button" className="btn-ghost" onClick={() => void finance.saveNetWorthSnapshot()}>
            Save net worth snapshot
          </button>
        </div>
        {snapshot.snapshots.length ? (
          <ul className="text-sm text-muted">
            {snapshot.snapshots
              .slice()
              .sort((a, b) => b.snapshotDate.localeCompare(a.snapshotDate))
              .slice(0, 6)
              .map((row) => (
                <li key={row.id}>
                  {row.snapshotDate}: {row.netWorth.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                </li>
              ))}
          </ul>
        ) : null}
      </section>

      <button type="button" className="btn-danger" onClick={() => void finance.signOut()}>
        Sign out
      </button>
    </div>
  );
}

function PortfolioSection() {
  const { snapshot, savePortfolio, deletePortfolio } = useFinance();
  const [name, setName] = useState('');
  const [include, setInclude] = useState(true);
  return (
    <section className="card space-y-3 p-5">
      <h2 className="font-semibold">Portfolios</h2>
      {snapshot.portfolios.map((row) => (
        <div key={row.id} className="flex items-center justify-between gap-3 text-sm">
          <span>
            {row.name}
            {!row.includeInNetWorth ? <span className="ml-2 text-xs text-warn">Excluded</span> : null}
          </span>
          <button type="button" className="text-xs text-loss" onClick={() => void deletePortfolio(row.id)}>
            Delete
          </button>
        </div>
      ))}
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const row: Portfolio = { id: createId(), name, includeInNetWorth: include, sortOrder: snapshot.portfolios.length };
          void savePortfolio(row);
          setName('');
        }}
      >
        <label className="min-w-40 flex-1">
          <span className="label">Name</span>
          <input className="field" value={name} onChange={(event) => setName(event.target.value)} required aria-label="Portfolio name" />
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input type="checkbox" checked={include} onChange={(event) => setInclude(event.target.checked)} />
          In net worth
        </label>
        <button type="submit" className="btn-primary">
          Add
        </button>
      </form>
    </section>
  );
}

function AccountSection() {
  const { snapshot, saveAccount, deleteAccount } = useFinance();
  const [row, setRow] = useState<Account>({
    id: '',
    portfolioId: snapshot.portfolios[0]?.id ?? '',
    name: '',
    accountType: 'brokerage',
    taxTreatment: 'taxable',
    sortOrder: 0,
  });
  return (
    <section className="card space-y-3 p-5">
      <h2 className="font-semibold">Investment accounts</h2>
      <p className="text-xs text-muted">Cash is computed from activity. Taxable accounts label average cost as not tax-lot basis.</p>
      {snapshot.accounts.map((account) => (
        <div key={account.id} className="flex items-center justify-between gap-3 text-sm">
          <span>
            {account.name}
            <span className="ml-2 text-xs text-muted">{TAX_LABELS[account.taxTreatment]}</span>
          </span>
          <button type="button" className="text-xs text-loss" onClick={() => void deleteAccount(account.id)}>
            Delete
          </button>
        </div>
      ))}
      <form
        className="grid gap-2 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          void saveAccount({ ...row, id: createId(), sortOrder: snapshot.accounts.length });
          setRow({ ...row, name: '' });
        }}
      >
        <label>
          <span className="label">Name</span>
          <input className="field" value={row.name} onChange={(event) => setRow({ ...row, name: event.target.value })} required aria-label="Account name" />
        </label>
        <label>
          <span className="label">Portfolio</span>
          <select className="field" value={row.portfolioId} onChange={(event) => setRow({ ...row, portfolioId: event.target.value })} aria-label="Portfolio">
            {snapshot.portfolios.map((portfolio) => (
              <option key={portfolio.id} value={portfolio.id}>
                {portfolio.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="label">Type</span>
          <select className="field" value={row.accountType} onChange={(event) => setRow({ ...row, accountType: event.target.value as AccountType })}>
            {Object.entries(ACCOUNT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="label">Tax treatment</span>
          <select className="field" value={row.taxTreatment} onChange={(event) => setRow({ ...row, taxTreatment: event.target.value as TaxTreatment })}>
            {Object.entries(TAX_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn-primary sm:col-span-2">
          Add account
        </button>
      </form>
    </section>
  );
}

function CheckingSection() {
  const { snapshot, saveCheckingAccount, deleteCheckingAccount } = useFinance();
  const [row, setRow] = useState<CheckingAccount>({
    id: '',
    name: '',
    openingBalance: 0,
    openingDate: todayLocal(),
    lowBalanceFloor: null,
    sortOrder: 0,
  });
  return (
    <section className="card space-y-3 p-5">
      <h2 className="font-semibold">Checking accounts</h2>
      {snapshot.checkingAccounts.map((account) => (
        <div key={account.id} className="flex items-center justify-between text-sm">
          <span>
            {account.name} · opening {account.openingBalance.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
          </span>
          <button type="button" className="text-xs text-loss" onClick={() => void deleteCheckingAccount(account.id)}>
            Delete
          </button>
        </div>
      ))}
      <form
        className="grid gap-2 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          void saveCheckingAccount({ ...row, id: createId(), sortOrder: snapshot.checkingAccounts.length });
          setRow({ ...row, name: '' });
        }}
      >
        <label>
          <span className="label">Name</span>
          <input className="field" value={row.name} onChange={(event) => setRow({ ...row, name: event.target.value })} required aria-label="Checking account name" />
        </label>
        <label>
          <span className="label">Opening balance</span>
          <input className="field num" inputMode="decimal" value={row.openingBalance} onChange={(event) => setRow({ ...row, openingBalance: Number(event.target.value) })} />
        </label>
        <label>
          <span className="label">Opening date</span>
          <input className="field" type="date" value={row.openingDate} onChange={(event) => setRow({ ...row, openingDate: event.target.value })} />
        </label>
        <label>
          <span className="label">Low balance floor</span>
          <input
            className="field num"
            inputMode="decimal"
            value={row.lowBalanceFloor ?? ''}
            onChange={(event) => setRow({ ...row, lowBalanceFloor: event.target.value === '' ? null : Number(event.target.value) })}
            aria-label="Low balance floor"
          />
        </label>
        <button type="submit" className="btn-primary sm:col-span-2">
          Add checking account
        </button>
      </form>
    </section>
  );
}

function LiabilitySection() {
  const { snapshot, saveLiability, deleteLiability } = useFinance();
  const [row, setRow] = useState<Liability>({
    id: '',
    name: '',
    liabilityType: 'loan',
    balance: 0,
    asOf: todayLocal(),
    includeInNetWorth: true,
    unresolved: false,
    note: null,
  });
  return (
    <section className="card space-y-3 p-5">
      <h2 className="font-semibold">Liabilities</h2>
      <p className="text-xs text-muted">Net worth subtracts included, resolved balances. Unresolved ones stay labeled and are not subtracted.</p>
      {snapshot.liabilities.map((item) => (
        <div key={item.id} className="flex items-center justify-between text-sm">
          <span>
            {item.name}
            {item.unresolved ? <span className="ml-2 text-xs text-warn">Unresolved</span> : null}
          </span>
          <button type="button" className="text-xs text-loss" onClick={() => void deleteLiability(item.id)}>
            Delete
          </button>
        </div>
      ))}
      <form
        className="grid gap-2 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          void saveLiability({ ...row, id: createId() });
          setRow({ ...row, name: '', note: null });
        }}
      >
        <label>
          <span className="label">Name</span>
          <input className="field" value={row.name} onChange={(event) => setRow({ ...row, name: event.target.value })} required aria-label="Liability name" />
        </label>
        <label>
          <span className="label">Type</span>
          <select className="field" value={row.liabilityType} onChange={(event) => setRow({ ...row, liabilityType: event.target.value as LiabilityType })}>
            {Object.entries(LIABILITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="label">Balance owed</span>
          <input className="field num" inputMode="decimal" value={row.balance} onChange={(event) => setRow({ ...row, balance: Number(event.target.value) })} />
        </label>
        <label>
          <span className="label">As of</span>
          <input className="field" type="date" value={row.asOf} onChange={(event) => setRow({ ...row, asOf: event.target.value })} />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={row.includeInNetWorth} onChange={(event) => setRow({ ...row, includeInNetWorth: event.target.checked })} />
          Include in net worth
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={row.unresolved} onChange={(event) => setRow({ ...row, unresolved: event.target.checked })} />
          Unresolved
        </label>
        <label className="sm:col-span-2">
          <span className="label">Note</span>
          <input className="field" value={row.note ?? ''} onChange={(event) => setRow({ ...row, note: event.target.value || null })} />
        </label>
        <button type="submit" className="btn-primary sm:col-span-2">
          Add liability
        </button>
      </form>
    </section>
  );
}

function CategorySection() {
  const { snapshot, saveBudgetCategory, deleteBudgetCategory } = useFinance();
  const [name, setName] = useState('');
  const [flowType, setFlowType] = useState<FlowType>('core_spending');
  const categories = snapshot.budgetCategories;
  return (
    <section id="categories" className="card space-y-3 p-5">
      <h2 className="font-semibold">Categories</h2>
      <p className="text-xs text-muted">Flow type decides whether a row is income, core spending, taxes, debt, savings, or a transfer.</p>
      {categories.length === 0 ? (
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            void (async () => {
              for (const row of builtinCategories()) await saveBudgetCategory({ ...row, id: createId() });
            })();
          }}
        >
          Save default categories
        </button>
      ) : (
        categories.map((row) => (
          <div key={row.id} className="grid gap-2 border-t border-line pt-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_6rem_auto]">
            <p className="truncate text-sm font-medium">{row.name}</p>
            <select
              className="field"
              aria-label={`Flow for ${row.name}`}
              value={row.flowType}
              onChange={(event) => void saveBudgetCategory({ ...row, flowType: event.target.value as FlowType })}
            >
              {FLOW_TYPES.map((flow) => (
                <option key={flow} value={flow}>
                  {FLOW_LABELS[flow]}
                </option>
              ))}
            </select>
            <input
              className="field num"
              inputMode="decimal"
              aria-label={`Monthly budget for ${row.name}`}
              value={row.budgetMonthly ?? ''}
              placeholder="Monthly"
              onChange={(event) =>
                void saveBudgetCategory({
                  ...row,
                  budgetMonthly: event.target.value === '' ? null : Number(event.target.value),
                })
              }
            />
            <button type="button" className="text-xs text-loss" onClick={() => void deleteBudgetCategory(row.id)}>
              Delete
            </button>
          </div>
        ))
      )}
      <form
        className="grid gap-2 sm:grid-cols-3"
        onSubmit={(event) => {
          event.preventDefault();
          const row: BudgetCategory = {
            id: createId(),
            name,
            flowType,
            groupName: 'other',
            budgetMonthly: null,
            color: '#94a3b8',
            hidden: false,
            sortOrder: categories.length,
          };
          void saveBudgetCategory(row);
          setName('');
        }}
      >
        <input className="field" value={name} onChange={(event) => setName(event.target.value)} placeholder="New category" aria-label="New category name" required />
        <select className="field" value={flowType} onChange={(event) => setFlowType(event.target.value as FlowType)} aria-label="New category flow">
          {FLOW_TYPES.map((flow) => (
            <option key={flow} value={flow}>
              {FLOW_LABELS[flow]}
            </option>
          ))}
        </select>
        <button type="submit" className="btn-primary">
          Add category
        </button>
      </form>
    </section>
  );
}

function TargetSection() {
  const { snapshot, saveBudgetTarget, deleteBudgetTarget } = useFinance();
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  return (
    <section className="card space-y-3 p-5">
      <h2 className="font-semibold">Budget targets</h2>
      {snapshot.budgetTargets.length === 0 ? (
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            void (async () => {
              for (const row of builtinTargets()) await saveBudgetTarget({ ...row, id: createId() });
            })();
          }}
        >
          Save monthly targets
        </button>
      ) : (
        snapshot.budgetTargets.map((row) => (
          <div key={row.id} className="flex items-center justify-between gap-3 text-sm">
            <span className="truncate">{row.label}</span>
            <span className="num">{row.monthlyAmount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</span>
            <button type="button" className="text-xs text-loss" onClick={() => void deleteBudgetTarget(row.id)}>
              Delete
            </button>
          </div>
        ))
      )}
      <form
        className="grid gap-2 sm:grid-cols-3"
        onSubmit={(event) => {
          event.preventDefault();
          const row: BudgetTarget = {
            id: createId(),
            label,
            monthlyAmount: Number(amount),
            categoryName: null,
            payee: null,
          };
          void saveBudgetTarget(row);
          setLabel('');
          setAmount('');
        }}
      >
        <input className="field" value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Label" aria-label="Target label" required />
        <input className="field num" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Monthly" aria-label="Target amount" required />
        <button type="submit" className="btn-primary">
          Add target
        </button>
      </form>
    </section>
  );
}

function PayrollSection() {
  const { snapshot, saveBudgetSettings } = useFinance();
  const settings = snapshot.budgetSettings;
  return (
    <section className="card space-y-3 p-5">
      <h2 className="font-semibold">Payroll contributions</h2>
      <p className="text-xs text-muted">{SAVINGS_RATE_NOTE}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <label>
          <span className="label">Amount each time</span>
          <input
            className="field num"
            inputMode="decimal"
            value={settings.payrollAmount || ''}
            onChange={(event) =>
              void saveBudgetSettings({
                ...settings,
                payrollAmount: event.target.value === '' ? 0 : Number(event.target.value),
              })
            }
          />
        </label>
        <label>
          <span className="label">Cadence</span>
          <select
            className="field"
            value={settings.payrollCadence}
            onChange={(event) => void saveBudgetSettings({ ...settings, payrollCadence: event.target.value as PayrollCadence })}
          >
            <option value="none">Not included</option>
            <option value="monthly">Monthly</option>
            <option value="biweekly">Biweekly</option>
          </select>
        </label>
      </div>
    </section>
  );
}

function CardSection() {
  const { snapshot, saveCardAccount, deleteCardAccount, importCardTxns } = useFinance();
  const [name, setName] = useState('');
  const [cardId, setCardId] = useState(snapshot.cardAccounts[0]?.id ?? '');
  const [purchasesPositive, setPurchasesPositive] = useState(true);
  const [notice, setNotice] = useState('');
  return (
    <section className="card space-y-3 p-5">
      <h2 className="font-semibold">Cards</h2>
      <p className="text-xs text-muted">
        Once a card has statement rows for a month, payments to that card in that month become transfers and the itemized charges become the spending.
      </p>
      {snapshot.cardAccounts.map((card) => (
        <div key={card.id} className="flex items-center justify-between text-sm">
          <span>{card.name}</span>
          <button type="button" className="text-xs text-loss" onClick={() => void deleteCardAccount(card.id)}>
            Delete
          </button>
        </div>
      ))}
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const id = createId();
          void saveCardAccount({ id, name, matchNames: [], sortOrder: snapshot.cardAccounts.length });
          setCardId(id);
          setName('');
        }}
      >
        <input className="field" value={name} onChange={(event) => setName(event.target.value)} placeholder="Chase, Amex, FFCU Visa" aria-label="Card name" required />
        <button type="submit" className="btn-primary">
          Add card
        </button>
      </form>
      <label>
        <span className="label">Import a statement</span>
        <select className="field" value={cardId} onChange={(event) => setCardId(event.target.value)} aria-label="Card for CSV import">
          <option value="">Choose a card</option>
          {snapshot.cardAccounts.map((card) => (
            <option key={card.id} value={card.id}>
              {card.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={purchasesPositive} onChange={(event) => setPurchasesPositive(event.target.checked)} />
        Purchases are positive in the file
      </label>
      <label className="btn-ghost cursor-pointer">
        CSV with date, description, amount, category
        <input
          className="sr-only"
          type="file"
          accept="text/csv,.csv"
          aria-label="Import card CSV"
          onChange={(event) => {
            const file = event.target.files?.[0];
            const accountId = cardId;
            if (!file || !accountId) {
              setNotice('Add a card before importing.');
              return;
            }
            void file.text().then((text) => {
              const parsed = parseTransactionCsv(text);
              if (!parsed.rows.length) {
                setNotice(parsed.errors[0] ?? 'No rows found.');
                return;
              }
              void importCardTxns(
                parsed.rows.map((row) => ({
                  id: createId(),
                  cardAccountId: accountId,
                  date: row.date,
                  description: row.description,
                  amount: signedCardAmount(row.amount, purchasesPositive),
                  category: row.category || 'Uncategorized',
                  flowOverride: null,
                  statementMonth: row.date.slice(0, 7),
                })),
              );
              setNotice(`Imported ${parsed.rows.length} card rows.`);
            });
            event.target.value = '';
          }}
        />
      </label>
      {notice ? <p className="text-xs text-muted">{notice}</p> : null}
    </section>
  );
}
