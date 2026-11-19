import { useMemo, useState } from 'react';
import { BalanceChart } from '../components/Charts';
import { Field, Modal } from '../components/ui';
import { useFinance } from '../context/FinanceContext';
import { addMonths, endOfMonth, monthOf, startOfMonth, todayLocal, yearOf } from '../domain/dates';
import { occurrencesInRange } from '../domain/recurrence';
import { createId } from '../domain/ids';
import type { Cadence, RecurringItem, RecurringKind } from '../domain/types';
import { money } from '../lib/format';

export default function Bills() {
  const { snapshot, books, saveRecurring, deleteRecurring, markPaid, skipOccurrence, undoOccurrence, setProjectionDays } = useFinance();
  const [cursor, setCursor] = useState(startOfMonth(todayLocal()));
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringItem | null>(null);
  const start = startOfMonth(cursor);
  const end = endOfMonth(cursor);
  const days = useMemo(() => monthGrid(start), [start]);
  const marks = snapshot.occurrences;

  const events = snapshot.recurring.flatMap((item) =>
    occurrencesInRange(item, start, end).map((date) => ({
      item,
      date,
      paid: marks.some((row) => row.recurringItemId === item.id && row.occurrenceDate === date && row.status === 'paid'),
      skipped: marks.some((row) => row.recurringItemId === item.id && row.occurrenceDate === date && row.status === 'skipped'),
      occurrence: marks.find((row) => row.recurringItemId === item.id && row.occurrenceDate === date),
    })),
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bills</h1>
          <p className="text-sm text-muted">Calendar, upcoming items, and the projected balance.</p>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          Add recurring
        </button>
      </div>
      <div className="flex items-center justify-between">
        <button type="button" className="btn-ghost" onClick={() => setCursor(addMonths(cursor, -1))} aria-label="Previous month">
          Prev
        </button>
        <h2 className="font-semibold">
          {cursor.slice(0, 7)}
        </h2>
        <button type="button" className="btn-ghost" onClick={() => setCursor(addMonths(cursor, 1))} aria-label="Next month">
          Next
        </button>
      </div>
      <div className="card p-3">
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] uppercase text-muted">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="py-1">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => {
            const items = events.filter((event) => event.date === day);
            const inMonth = day.slice(0, 7) === cursor.slice(0, 7);
            return (
              <div key={day} className={`min-h-16 rounded-xl p-1 text-xs ${inMonth ? 'bg-panel-2/40' : 'opacity-40'}`}>
                <p className="num">{Number(day.slice(8))}</p>
                {items.map((item) => (
                  <p
                    key={`${item.item.id}-${item.date}`}
                    title={item.item.name}
                    className={`whitespace-normal break-words text-left leading-tight ${item.item.kind === 'income' ? 'text-gain' : 'text-ink'}`}
                  >
                    {item.item.name}
                  </p>
                ))}
              </div>
            );
          })}
        </div>
      </div>
      <section className="card divide-y divide-line">
        {events.length === 0 ? <p className="p-4 text-sm text-muted">Nothing this month.</p> : null}
        {events
          .slice()
          .sort((a, b) => a.date.localeCompare(b.date))
          .map((event) => (
            <div key={`${event.item.id}-${event.date}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
              <div>
                <p className="font-medium">
                  {event.item.name}
                  {event.item.autopay ? <span className="ml-2 text-xs text-muted">Autopay</span> : null}
                </p>
                <p className="text-xs text-muted">
                  {event.date} · {snapshot.checkingAccounts.find((account) => account.id === event.item.accountId)?.name}
                  {event.paid ? ' · Paid' : event.skipped ? ' · Skipped' : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="num">{money(event.item.kind === 'income' ? event.item.amount : -event.item.amount, true)}</span>
                {event.paid || event.skipped ? (
                  <button type="button" className="btn-ghost" onClick={() => event.occurrence && void undoOccurrence(event.occurrence.id)}>
                    Undo
                  </button>
                ) : (
                  <>
                    <button type="button" className="btn-primary" onClick={() => void markPaid(event.item, event.date)}>
                      Mark paid
                    </button>
                    <button type="button" className="btn-ghost" onClick={() => void skipOccurrence(event.item, event.date)}>
                      Skip
                    </button>
                  </>
                )}
                <button type="button" className="btn-ghost" onClick={() => { setEditing(event.item); setOpen(true); }}>
                  Edit
                </button>
              </div>
            </div>
          ))}
      </section>
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Projected balance</h2>
          <label className="flex items-center gap-2 text-sm text-muted">
            Days
            <select
              className="field w-24"
              value={snapshot.preferences.projectionDays}
              onChange={(event) => void setProjectionDays(Number(event.target.value))}
              aria-label="Projection length"
            >
              <option value={60}>60</option>
              <option value={90}>90</option>
            </select>
          </label>
        </div>
        {books.checking.map((row) => (
          <div key={row.account.id} className="card p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-medium">{row.account.name}</p>
              <p className="num text-sm text-muted">
                Low {money(row.projection.minBalance)} on {row.projection.minDate}
              </p>
            </div>
            <BalanceChart points={row.projection.points} floor={row.account.lowBalanceFloor} />
          </div>
        ))}
      </section>
      {open ? (
        <RecurringDialog
          initial={editing}
          onClose={() => setOpen(false)}
          onSave={async (row) => {
            await saveRecurring(row);
            setOpen(false);
          }}
          onDelete={
            editing
              ? async () => {
                  await deleteRecurring(editing.id);
                  setOpen(false);
                }
              : undefined
          }
        />
      ) : null}
    </div>
  );
}

function monthGrid(start: string): string[] {
  const first = new Date(yearOf(start), monthOf(start) - 1, 1);
  const lead = first.getDay();
  const days: string[] = [];
  for (let index = 0; index < 42; index += 1) {
    const date = new Date(first);
    date.setDate(index - lead + 1);
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    days.push(iso);
  }
  return days;
}

function RecurringDialog({
  initial,
  onClose,
  onSave,
  onDelete,
}: {
  initial: RecurringItem | null;
  onClose: () => void;
  onSave: (row: RecurringItem) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const { snapshot } = useFinance();
  const [row, setRow] = useState<RecurringItem>(
    initial ?? {
      id: createId(),
      accountId: snapshot.checkingAccounts[0]?.id ?? '',
      name: '',
      kind: 'bill',
      amount: 0,
      cadence: 'monthly',
      dayOfMonth: 1,
      intervalWeeks: 2,
      anchorDate: todayLocal(),
      monthOfYear: 1,
      autopay: false,
      active: true,
      category: 'Home',
    },
  );
  return (
    <Modal open onClose={onClose} title={initial ? 'Edit recurring' : 'Add recurring'}>
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          void onSave(row);
        }}
      >
        <Field label="Name">
          <input className="field" value={row.name} onChange={(event) => setRow({ ...row, name: event.target.value })} required />
        </Field>
        <Field label="Account">
          <select className="field" value={row.accountId} onChange={(event) => setRow({ ...row, accountId: event.target.value })}>
            {snapshot.checkingAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Kind">
          <select className="field" value={row.kind} onChange={(event) => setRow({ ...row, kind: event.target.value as RecurringKind })}>
            <option value="bill">Bill</option>
            <option value="income">Income</option>
          </select>
        </Field>
        <Field label="Amount">
          <input className="field num" inputMode="decimal" value={row.amount} onChange={(event) => setRow({ ...row, amount: Number(event.target.value) })} required />
        </Field>
        <Field label="Cadence">
          <select className="field" value={row.cadence} onChange={(event) => setRow({ ...row, cadence: event.target.value as Cadence })}>
            <option value="monthly">Monthly</option>
            <option value="weekly">Every N weeks</option>
            <option value="yearly">Yearly</option>
            <option value="once">One time</option>
          </select>
        </Field>
        {row.cadence === 'monthly' || row.cadence === 'yearly' ? (
          <Field label="Day of month">
            <input className="field num" type="number" min={1} max={31} value={row.dayOfMonth ?? 1} onChange={(event) => setRow({ ...row, dayOfMonth: Number(event.target.value) })} />
          </Field>
        ) : null}
        {row.cadence === 'yearly' ? (
          <Field label="Month">
            <input className="field num" type="number" min={1} max={12} value={row.monthOfYear ?? 1} onChange={(event) => setRow({ ...row, monthOfYear: Number(event.target.value) })} />
          </Field>
        ) : null}
        {row.cadence === 'weekly' ? (
          <Field label="Every N weeks">
            <input className="field num" type="number" min={1} value={row.intervalWeeks ?? 2} onChange={(event) => setRow({ ...row, intervalWeeks: Number(event.target.value) })} />
          </Field>
        ) : null}
        {row.cadence === 'weekly' || row.cadence === 'once' ? (
          <Field label="Anchor date">
            <input className="field" type="date" value={row.anchorDate ?? ''} onChange={(event) => setRow({ ...row, anchorDate: event.target.value })} />
          </Field>
        ) : null}
        <Field label="Category">
          <input className="field" value={row.category} onChange={(event) => setRow({ ...row, category: event.target.value })} />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={row.autopay} onChange={(event) => setRow({ ...row, autopay: event.target.checked })} />
          Autopay
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={row.active} onChange={(event) => setRow({ ...row, active: event.target.checked })} />
          Active
        </label>
        <div className="flex gap-2 sm:col-span-2">
          <button type="submit" className="btn-primary">
            Save
          </button>
          {onDelete ? (
            <button type="button" className="btn-danger" onClick={() => void onDelete()}>
              Delete
            </button>
          ) : null}
        </div>
      </form>
    </Modal>
  );
}
