import { useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { useAuth } from '../context/AuthContext';
import { todayLocal } from '../domain/dates';
import { createId } from '../domain/ids';
import { ACCOUNT_TYPE_LABELS, LIABILITY_LABELS, TAX_LABELS } from '../domain/labels';
import type { Account, AccountType, CheckingAccount, Liability, LiabilityType, Portfolio, TaxTreatment } from '../domain/types';
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
