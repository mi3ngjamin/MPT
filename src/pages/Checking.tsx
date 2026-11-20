import { useMemo, useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { todayLocal } from '../domain/dates';
import { createId } from '../domain/ids';
import { runningBalances } from '../domain/recurrence';
import type { CheckingTxn } from '../domain/types';
import { money, moneyTight, plClass } from '../lib/format';

export default function Checking() {
  const { snapshot, saveCheckingTxn, deleteCheckingTxn } = useFinance();
  const [accountId, setAccountId] = useState(snapshot.checkingAccounts[0]?.id ?? '');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<CheckingTxn | null>(null);
  const account = snapshot.checkingAccounts.find((row) => row.id === accountId) ?? snapshot.checkingAccounts[0];
  const txns = snapshot.checkingTxns.filter((row) => row.accountId === account?.id);
  const balances = account ? runningBalances(account, snapshot.checkingTxns) : new Map<string, number>();
  const categories = useMemo(() => {
    const set = new Set(['Groceries', 'Home', 'Transport', 'Pay', 'Transfer', 'Utilities', 'Other']);
    for (const txn of snapshot.checkingTxns) set.add(txn.category);
    return [...set];
  }, [snapshot.checkingTxns]);
  const visible = txns
    .filter((row) => `${row.description} ${row.category}`.toLowerCase().includes(query.trim().toLowerCase()))
    .slice()
    .sort((a, b) => (a.date === b.date ? (b.createdAt ?? '').localeCompare(a.createdAt ?? '') : a.date < b.date ? 1 : -1));
  const balance = account
    ? snapshot.checkingTxns.filter((row) => row.accountId === account.id && row.date <= todayLocal()).reduce((sum, row) => sum + row.amount, account.openingDate <= todayLocal() ? account.openingBalance : 0)
    : 0;

  if (!account) {
    return <p className="text-sm text-muted">Add a checking account in Settings.</p>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Checking</h1>
          <p className="num text-3xl font-semibold sm:hidden">{moneyTight(balance)}</p>
          <p className="num hidden text-3xl font-semibold sm:block">{money(balance)}</p>
          <p className="text-xs text-muted">
            Opening {money(account.openingBalance)} on {account.openingDate}
            {account.lowBalanceFloor != null ? ` · floor ${money(account.lowBalanceFloor)}` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          {snapshot.checkingAccounts.map((row) => (
            <button key={row.id} type="button" className={`chip ${row.id === account.id ? 'border-accent text-ink' : ''}`} onClick={() => setAccountId(row.id)}>
              {row.name}
            </button>
          ))}
        </div>
      </div>
      <TxnForm
        key={`${account.id}-${editing?.id ?? 'new'}`}
        accountId={account.id}
        categories={categories}
        editing={editing}
        onDone={() => setEditing(null)}
        onSave={async (row) => {
          await saveCheckingTxn(row);
          setEditing(null);
        }}
      />
      <label>
        <span className="label">Search</span>
        <input className="field" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Description or category" aria-label="Search transactions" />
      </label>
      <div className="card divide-y divide-line">
        {visible.length === 0 ? <p className="p-4 text-sm text-muted">No transactions.</p> : null}
        {visible.map((txn) => (
          <div key={txn.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
            <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setEditing(txn)}>
              <span className="block truncate font-medium">{txn.description || 'Transaction'}</span>
              <span className="text-xs text-muted">
                {txn.date} · {txn.category}
                {txn.cleared ? ' · Cleared' : ''}
              </span>
            </button>
            <div className="text-right">
              <p className={`num font-medium ${plClass(txn.amount)}`}>{money(txn.amount, true)}</p>
              <p className="num text-xs text-muted">{money(balances.get(txn.id) ?? null)}</p>
            </div>
            <button type="button" className="text-xs text-loss" onClick={() => void deleteCheckingTxn(txn.id)} aria-label={`Delete ${txn.description}`}>
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function TxnForm({
  accountId,
  categories,
  editing,
  onSave,
  onDone,
}: {
  accountId: string;
  categories: string[];
  editing: CheckingTxn | null;
  onSave: (row: CheckingTxn) => Promise<void>;
  onDone: () => void;
}) {
  const [date, setDate] = useState(editing?.date ?? todayLocal());
  const [description, setDescription] = useState(editing?.description ?? '');
  const [amount, setAmount] = useState(editing ? String(editing.amount) : '');
  const [category, setCategory] = useState(editing?.category ?? categories[0] ?? 'Other');
  const [cleared, setCleared] = useState(editing?.cleared ?? false);

  return (
    <form
      className="card grid gap-3 p-4 sm:grid-cols-6"
      onSubmit={(event) => {
        event.preventDefault();
        const value = Number(amount);
        if (!Number.isFinite(value)) return;
        void onSave({
          id: editing?.id ?? createId(),
          accountId,
          date,
          description,
          amount: value,
          category,
          cleared,
          recurringItemId: editing?.recurringItemId ?? null,
          createdAt: editing?.createdAt ?? new Date().toISOString(),
          flowOverride: editing?.flowOverride ?? null,
        });
        if (!editing) {
          setDescription('');
          setAmount('');
          const field = document.getElementById('txn-description');
          field?.focus();
        } else {
          onDone();
        }
      }}
    >
      <label className="sm:col-span-1">
        <span className="label">Date</span>
        <input className="field" type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
      </label>
      <label className="sm:col-span-2">
        <span className="label">Description</span>
        <input id="txn-description" className="field" value={description} onChange={(event) => setDescription(event.target.value)} required />
      </label>
      <label>
        <span className="label">Amount</span>
        <input className="field num" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="-12.34" required aria-label="Amount, negative for spending" />
      </label>
      <label>
        <span className="label">Category</span>
        <input className="field" list="categories" value={category} onChange={(event) => setCategory(event.target.value)} />
        <datalist id="categories">
          {categories.map((item) => (
            <option key={item} value={item} />
          ))}
        </datalist>
      </label>
      <div className="flex items-end gap-2">
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input type="checkbox" checked={cleared} onChange={(event) => setCleared(event.target.checked)} />
          Cleared
        </label>
        <button type="submit" className="btn-primary">
          {editing ? 'Save' : 'Add'}
        </button>
      </div>
    </form>
  );
}
