import { useMemo, useState } from 'react';
import { Modal, Field } from '../components/ui';
import { useFinance } from '../context/FinanceContext';
import { ACTION_HELP, ACTION_LABELS } from '../domain/labels';
import { todayLocal } from '../domain/dates';
import { createId } from '../domain/ids';
import type { Activity, ActivityAction, AssetType } from '../domain/types';
import { validateActivity } from '../domain/validate';
import { money, qty } from '../lib/format';

const ACTIONS = Object.keys(ACTION_LABELS) as ActivityAction[];

export default function ActivityPage() {
  const { snapshot, saveActivity, deleteActivity } = useFinance();
  const [accountId, setAccountId] = useState('all');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Activity | null>(null);
  const [open, setOpen] = useState(false);
  const rows = useMemo(() => {
    return snapshot.activities
      .filter((row) => accountId === 'all' || row.accountId === accountId || row.transferAccountId === accountId)
      .filter((row) => {
        const hay = `${row.symbol ?? ''} ${row.note ?? ''} ${row.action}`.toLowerCase();
        return hay.includes(query.trim().toLowerCase());
      })
      .slice()
      .sort((a, b) => (a.date === b.date ? (b.createdAt ?? '').localeCompare(a.createdAt ?? '') : a.date < b.date ? 1 : -1));
  }, [accountId, query, snapshot.activities]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Activity</h1>
          <p className="text-sm text-muted">The ledger is the only input. Balances are computed from these rows.</p>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            setEditing(blank(snapshot.accounts[0]?.id ?? '', todayLocal()));
            setOpen(true);
          }}
        >
          Add activity
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        <label className="min-w-40 flex-1">
          <span className="label">Account</span>
          <select className="field" value={accountId} onChange={(event) => setAccountId(event.target.value)} aria-label="Filter by account">
            <option value="all">All accounts</option>
            {snapshot.accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-40 flex-1">
          <span className="label">Search</span>
          <input className="field" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Symbol or note" aria-label="Search activity" />
        </label>
      </div>
      <div className="card divide-y divide-line">
        {rows.length === 0 ? <p className="p-4 text-sm text-muted">No activity yet.</p> : null}
        {rows.map((row) => (
          <button
            key={row.id}
            type="button"
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm hover:bg-panel-2/50"
            onClick={() => {
              setEditing(row);
              setOpen(true);
            }}
          >
            <span>
              <span className="font-medium">{ACTION_LABELS[row.action]}</span>
              <span className="ml-2 text-muted">{row.symbol ?? row.note ?? ''}</span>
              <span className="mt-1 block text-xs text-muted">
                {row.date} · {snapshot.accounts.find((account) => account.id === row.accountId)?.name}
              </span>
            </span>
            <span className="num text-right text-muted">
              {row.quantity != null ? qty(row.quantity) : ''}
              {row.amount != null ? <span className="block">{money(row.amount)}</span> : null}
            </span>
          </button>
        ))}
      </div>
      {editing ? (
        <ActivityDialog
          key={editing.id}
          open={open}
          activity={editing}
          onClose={() => setOpen(false)}
          onSave={async (row) => {
            await saveActivity(row);
            setOpen(false);
          }}
          onDelete={async () => {
            if (!window.confirm('Delete this activity?')) return;
            await deleteActivity(editing.id);
            setOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

function ActivityDialog({
  open,
  activity,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean;
  activity: Activity;
  onClose: () => void;
  onSave: (row: Activity) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const { snapshot } = useFinance();
  const [row, setRow] = useState(activity);
  const [errors, setErrors] = useState<string[]>([]);
  const set = <K extends keyof Activity>(key: K, value: Activity[K]) => setRow((current) => ({ ...current, [key]: value }));
  const option = row.action.startsWith('buy_to') || row.action.startsWith('sell_to') || ['expire', 'assign', 'exercise'].includes(row.action);

  return (
    <Modal open={open} onClose={onClose} title={ACTION_LABELS[row.action]}>
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          const next = { ...row, assetType: option ? 'option' : row.assetType, symbol: row.symbol?.toUpperCase() ?? null };
          const found = validateActivity(next);
          setErrors(found);
          if (found.length) return;
          void onSave(next);
        }}
      >
        <Field label="Date">
          <input className="field" type="date" value={row.date} onChange={(event) => set('date', event.target.value)} required />
        </Field>
        <Field label="Account">
          <select className="field" value={row.accountId} onChange={(event) => set('accountId', event.target.value)} required>
            {snapshot.accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Action">
          <select
            className="field"
            value={row.action}
            onChange={(event) => {
              const action = event.target.value as ActivityAction;
              setRow((current) => ({
                ...current,
                action,
                assetType: action.includes('to_') || ['expire', 'assign', 'exercise'].includes(action) ? 'option' : current.assetType,
                multiplier: action.includes('to_') || ['expire', 'assign', 'exercise'].includes(action) ? 100 : current.multiplier,
              }));
            }}
          >
            {ACTIONS.map((action) => (
              <option key={action} value={action}>
                {ACTION_LABELS[action]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Asset">
          <select className="field" value={row.assetType} onChange={(event) => set('assetType', event.target.value as AssetType)}>
            <option value="stock_etf">Stock / ETF</option>
            <option value="option">Option</option>
            <option value="crypto">Crypto</option>
            <option value="cash">Cash</option>
            <option value="other">Other</option>
          </select>
        </Field>
        <p className="text-xs text-muted sm:col-span-2">{ACTION_HELP[row.action]}</p>
        {row.action === 'transfer' || row.action === 'in_kind_transfer' ? (
          <Field label="Destination account">
            <select className="field" value={row.transferAccountId ?? ''} onChange={(event) => set('transferAccountId', event.target.value || null)}>
              <option value="">Choose</option>
              {snapshot.accounts
                .filter((account) => account.id !== row.accountId)
                .map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
            </select>
          </Field>
        ) : null}
        <Field label="Symbol">
          <input className="field" value={row.symbol ?? ''} onChange={(event) => set('symbol', event.target.value.toUpperCase())} aria-label="Symbol" />
        </Field>
        <Field label={row.action === 'split' ? 'Ratio, if not using the ratio field' : 'Quantity'}>
          <input className="field num" inputMode="decimal" value={row.quantity ?? ''} onChange={(event) => set('quantity', event.target.value === '' ? null : Number(event.target.value))} />
        </Field>
        <Field label="Price">
          <input className="field num" inputMode="decimal" value={row.price ?? ''} onChange={(event) => set('price', event.target.value === '' ? null : Number(event.target.value))} />
        </Field>
        <Field label="Amount / total basis">
          <input className="field num" inputMode="decimal" value={row.amount ?? ''} onChange={(event) => set('amount', event.target.value === '' ? null : Number(event.target.value))} />
        </Field>
        <Field label="Fees">
          <input className="field num" inputMode="decimal" value={row.fees} onChange={(event) => set('fees', Number(event.target.value || 0))} />
        </Field>
        <Field label="Multiplier">
          <input className="field num" inputMode="decimal" value={row.multiplier ?? ''} onChange={(event) => set('multiplier', event.target.value === '' ? null : Number(event.target.value))} />
        </Field>
        {row.action === 'split' ? (
          <Field label="Split ratio">
            <input className="field num" inputMode="decimal" value={row.ratio ?? ''} onChange={(event) => set('ratio', event.target.value === '' ? null : Number(event.target.value))} />
          </Field>
        ) : null}
        {row.action === 'adjustment' ? (
          <>
            <Field label="Delta quantity">
              <input className="field num" inputMode="decimal" value={row.deltaQuantity ?? ''} onChange={(event) => set('deltaQuantity', event.target.value === '' ? null : Number(event.target.value))} />
            </Field>
            <Field label="Delta cost basis">
              <input className="field num" inputMode="decimal" value={row.deltaCostBasis ?? ''} onChange={(event) => set('deltaCostBasis', event.target.value === '' ? null : Number(event.target.value))} />
            </Field>
            <Field label="Delta cash">
              <input className="field num" inputMode="decimal" value={row.deltaCash ?? ''} onChange={(event) => set('deltaCash', event.target.value === '' ? null : Number(event.target.value))} />
            </Field>
          </>
        ) : null}
        {option ? (
          <>
            <Field label="Underlying">
              <input className="field" value={row.underlying ?? ''} onChange={(event) => set('underlying', event.target.value.toUpperCase())} />
            </Field>
            <Field label="Expiry">
              <input className="field" type="date" value={row.expiry ?? ''} onChange={(event) => set('expiry', event.target.value || null)} />
            </Field>
            <Field label="Strike">
              <input className="field num" inputMode="decimal" value={row.strike ?? ''} onChange={(event) => set('strike', event.target.value === '' ? null : Number(event.target.value))} />
            </Field>
            <Field label="Right">
              <select className="field" value={row.optionRight ?? ''} onChange={(event) => set('optionRight', event.target.value === 'C' || event.target.value === 'P' ? event.target.value : null)}>
                <option value="">Choose</option>
                <option value="C">Call</option>
                <option value="P">Put</option>
              </select>
            </Field>
          </>
        ) : null}
        <label className="sm:col-span-2">
          <span className="label">Note</span>
          <textarea className="field" rows={2} value={row.note ?? ''} onChange={(event) => set('note', event.target.value || null)} />
        </label>
        {errors.length ? (
          <ul className="text-sm text-loss sm:col-span-2">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        ) : null}
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <button type="submit" className="btn-primary">
            Save
          </button>
          <button type="button" className="btn-danger" onClick={() => void onDelete()}>
            Delete
          </button>
        </div>
      </form>
    </Modal>
  );
}

function blank(accountId: string, date: string): Activity {
  return {
    id: createId(),
    accountId,
    transferAccountId: null,
    date,
    action: 'buy',
    assetType: 'stock_etf',
    symbol: null,
    quantity: null,
    price: null,
    fees: 0,
    amount: null,
    multiplier: 1,
    ratio: null,
    deltaQuantity: null,
    deltaCostBasis: null,
    deltaCash: null,
    underlying: null,
    expiry: null,
    strike: null,
    optionRight: null,
    note: null,
    createdAt: new Date().toISOString(),
  };
}
