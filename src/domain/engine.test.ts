import { describe, expect, it } from 'vitest';
import { averageCostPerShare, processLedger, type Position } from './engine';
import type { Activity } from './types';

function act(partial: Partial<Activity> & Pick<Activity, 'action' | 'date'>): Activity {
  return {
    id: partial.id ?? crypto.randomUUID(),
    accountId: 'A',
    transferAccountId: null,
    assetType: 'stock_etf',
    symbol: null,
    quantity: null,
    price: null,
    fees: 0,
    amount: null,
    multiplier: null,
    ratio: null,
    deltaQuantity: null,
    deltaCostBasis: null,
    deltaCash: null,
    underlying: null,
    expiry: null,
    strike: null,
    optionRight: null,
    note: null,
    createdAt: null,
    ...partial,
  };
}

function run(activities: Activity[], accounts = ['A']) {
  return processLedger(activities, accounts);
}

function holding(activities: Activity[], symbol: string, account = 'A'): Position {
  const found = run(activities, [account]).accounts[account].positions.find((row) => row.symbol === symbol);
  if (!found) throw new Error(`missing ${symbol}`);
  return found;
}

describe('stock average cost', () => {
  it('buys add quantity and cost including fees, and sells relieve average cost', () => {
    const ledger = run([
      act({ id: 'b', date: '2024-01-02', action: 'buy', symbol: 'VTI', quantity: 10, price: 20, fees: 1 }),
      act({ id: 's', date: '2024-02-02', action: 'sell', symbol: 'VTI', quantity: 4, price: 25, fees: 1 }),
    ]);
    const account = ledger.accounts.A;
    const row = account.positions.find((item) => item.symbol === 'VTI')!;
    expect(row.quantity).toBeCloseTo(6);
    expect(row.costBasis).toBeCloseTo(120.6);
    expect(row.realizedPL).toBeCloseTo(18.6);
    expect(account.cash).toBeCloseTo(-102);
    expect(averageCostPerShare(row)).toBeCloseTo(20.1);
    expect(row.audit.length).toBe(2);
    expect(row.oversold).toBe(false);
  });

  it('does not subtract the sell price from basis', () => {
    const row = holding([
      act({ date: '2024-01-01', action: 'buy', symbol: 'VTI', quantity: 10, price: 20 }),
      act({ date: '2024-02-01', action: 'sell', symbol: 'VTI', quantity: 4, price: 25 }),
    ], 'VTI');
    expect(row.costBasis).toBeCloseTo(120);
    expect(row.realizedPL).toBeCloseTo(20);
  });

  it('flags overselling and still applies the average-cost formula', () => {
    const ledger = run([
      act({ date: '2024-01-01', action: 'buy', symbol: 'VTI', quantity: 5, price: 100 }),
      act({ date: '2024-02-01', action: 'sell', symbol: 'VTI', quantity: 8, price: 120 }),
    ]);
    const row = ledger.accounts.A.positions[0];
    expect(row.oversold).toBe(true);
    expect(row.quantity).toBeCloseTo(-3);
    expect(row.costBasis).toBeCloseTo(-300);
    expect(row.realizedPL).toBeCloseTo(160);
    expect(ledger.warnings.some((warning) => warning.code === 'oversold')).toBe(true);
  });

  it('flags negative cash instead of hiding it', () => {
    const ledger = run([
      act({ date: '2024-01-01', action: 'opening_cash', assetType: 'cash', amount: 100 }),
      act({ date: '2024-01-02', action: 'buy', symbol: 'VTI', quantity: 10, price: 20 }),
    ]);
    expect(ledger.accounts.A.cash).toBeCloseTo(-100);
    expect(ledger.accounts.A.negativeCash).toBe(true);
    expect(ledger.warnings.some((warning) => warning.code === 'negative_cash')).toBe(true);
  });

  it('keeps an opening cost basis even when the fallback price differs', () => {
    const row = holding([
      act({
        date: '2024-01-01',
        action: 'opening_position',
        symbol: 'VTI',
        quantity: 10,
        amount: 1000,
        price: 50,
      }),
    ], 'VTI');
    expect(row.quantity).toBeCloseTo(10);
    expect(row.costBasis).toBeCloseTo(1000);
    expect(row.lastTradePrice).toBe(50);
    expect(run([act({ date: '2024-01-01', action: 'opening_position', symbol: 'VTI', quantity: 10, amount: 1000 })]).accounts.A.cash).toBe(0);
  });
});

describe('cash movements', () => {
  it('treats contributions, withdrawals, dividends, interest, and fees as cash only', () => {
    const ledger = run([
      act({ date: '2024-01-01', action: 'contribution', assetType: 'cash', amount: 1000 }),
      act({ date: '2024-01-02', action: 'dividend', assetType: 'cash', symbol: 'VTI', amount: 25 }),
      act({ date: '2024-01-03', action: 'interest', assetType: 'cash', amount: 5 }),
      act({ date: '2024-01-04', action: 'fee', assetType: 'cash', amount: 3 }),
      act({ date: '2024-01-05', action: 'withdrawal', assetType: 'cash', amount: 40 }),
    ]);
    expect(ledger.accounts.A.cash).toBeCloseTo(987);
    expect(ledger.accounts.A.dividendIncome).toBeCloseTo(25);
    expect(ledger.accounts.A.realizedPL).toBe(0);
  });

  it('moves cash between accounts without realizing or calling it a contribution', () => {
    const ledger = run(
      [
        act({ date: '2024-01-01', action: 'opening_cash', assetType: 'cash', amount: 1000 }),
        act({
          date: '2024-01-02',
          action: 'transfer',
          assetType: 'cash',
          amount: 400,
          fees: 1,
          transferAccountId: 'B',
        }),
      ],
      ['A', 'B'],
    );
    expect(ledger.accounts.A.cash).toBeCloseTo(599);
    expect(ledger.accounts.B.cash).toBeCloseTo(400);
    expect(ledger.accounts.A.realizedPL).toBe(0);
    expect(ledger.accounts.B.realizedPL).toBe(0);
  });

  it('moves quantity and pro-rata basis in kind with no realized P/L', () => {
    const ledger = run(
      [
        act({ date: '2024-01-01', action: 'buy', symbol: 'VTI', quantity: 10, price: 100 }),
        act({
          date: '2024-02-01',
          action: 'in_kind_transfer',
          symbol: 'VTI',
          quantity: 4,
          transferAccountId: 'B',
        }),
      ],
      ['A', 'B'],
    );
    const source = ledger.accounts.A.positions.find((row) => row.symbol === 'VTI')!;
    const dest = ledger.accounts.B.positions.find((row) => row.symbol === 'VTI')!;
    expect(source.quantity).toBeCloseTo(6);
    expect(source.costBasis).toBeCloseTo(600);
    expect(dest.quantity).toBeCloseTo(4);
    expect(dest.costBasis).toBeCloseTo(400);
    expect(source.realizedPL + dest.realizedPL).toBeCloseTo(0);
    expect(source.costBasis + dest.costBasis).toBeCloseTo(1000);
  });
});

describe('adjustments, splits, and reinvested dividends', () => {
  it('applies a noted adjustment to quantity, basis, and cash', () => {
    const ledger = run([
      act({ date: '2024-01-01', action: 'buy', symbol: 'VTI', quantity: 10, price: 100 }),
      act({
        date: '2024-02-01',
        action: 'adjustment',
        symbol: 'VTI',
        deltaQuantity: 1,
        deltaCostBasis: 10,
        deltaCash: 5,
        note: 'Broker true-up',
      }),
    ]);
    const row = ledger.accounts.A.positions[0];
    expect(row.quantity).toBeCloseTo(11);
    expect(row.costBasis).toBeCloseTo(1010);
    expect(ledger.accounts.A.cash).toBeCloseTo(-995);
    expect(ledger.warnings.some((warning) => warning.code === 'invalid_activity')).toBe(false);
  });

  it('warns when an adjustment has no note and still applies it', () => {
    const ledger = run([
      act({
        date: '2024-02-01',
        action: 'adjustment',
        assetType: 'cash',
        deltaCash: -15,
        note: '   ',
      }),
    ]);
    expect(ledger.accounts.A.cash).toBeCloseTo(-15);
    expect(ledger.warnings.some((warning) => warning.message.includes('note'))).toBe(true);
  });

  it('scales quantity on a split and leaves basis unchanged', () => {
    const row = holding([
      act({ date: '2024-01-01', action: 'buy', symbol: 'VTI', quantity: 10, price: 100 }),
      act({ date: '2024-06-01', action: 'split', symbol: 'VTI', ratio: 4 }),
    ], 'VTI');
    expect(row.quantity).toBeCloseTo(40);
    expect(row.costBasis).toBeCloseTo(1000);
    expect(averageCostPerShare(row)).toBeCloseTo(25);
    expect(row.realizedPL).toBe(0);
  });

  it('reinvests a dividend as a buy without realizing P/L', () => {
    const ledger = run([
      act({
        date: '2024-03-01',
        action: 'dividend_reinvest',
        symbol: 'VTI',
        quantity: 2,
        price: 50,
        fees: 1,
        amount: 100,
      }),
    ]);
    const row = ledger.accounts.A.positions[0];
    expect(row.quantity).toBeCloseTo(2);
    expect(row.costBasis).toBeCloseTo(101);
    expect(ledger.accounts.A.cash).toBeCloseTo(-1);
    expect(ledger.accounts.A.negativeCash).toBe(true);
    expect(row.realizedPL).toBe(0);
    expect(ledger.accounts.A.dividendIncome).toBeCloseTo(100);
  });

  it('matches the purchase when the dividend amount is omitted', () => {
    const ledger = run([
      act({ date: '2024-03-01', action: 'dividend_reinvest', symbol: 'VTI', quantity: 2, price: 10 }),
    ]);
    expect(ledger.accounts.A.cash).toBeCloseTo(0);
    expect(ledger.accounts.A.positions[0].costBasis).toBeCloseTo(20);
  });
});

describe('options', () => {
  const meta = {
    assetType: 'option' as const,
    underlying: 'AAPL',
    expiry: '2026-06-18',
    strike: 50,
    multiplier: 100,
  };

  it('uses the contract multiplier and realizes nothing on an open', () => {
    const ledger = run([
      act({
        date: '2024-01-01',
        action: 'buy_to_open',
        symbol: 'AAPL260618C00050000',
        quantity: 1,
        price: 2,
        fees: 0.65,
        ...meta,
      }),
    ]);
    const row = ledger.accounts.A.positions[0];
    expect(row.quantity).toBeCloseTo(1);
    expect(row.costBasis).toBeCloseTo(200.65);
    expect(ledger.accounts.A.cash).toBeCloseTo(-200.65);
    expect(row.realizedPL).toBe(0);
  });

  it('opens a short with credit basis and cash in, and realizes only on the close', () => {
    const opened = run([
      act({
        id: 'sto',
        date: '2024-01-01',
        action: 'sell_to_open',
        symbol: 'PUT',
        quantity: 2,
        price: 3,
        fees: 1.3,
        ...meta,
        optionRight: 'P',
      }),
    ]);
    const short = opened.accounts.A.positions[0];
    expect(short.quantity).toBeCloseTo(-2);
    expect(short.costBasis).toBeCloseTo(-598.7);
    expect(opened.accounts.A.cash).toBeCloseTo(598.7);
    expect(short.realizedPL).toBe(0);

    const closed = run([
      act({
        id: 'sto',
        date: '2024-01-01',
        action: 'sell_to_open',
        symbol: 'PUT',
        quantity: 2,
        price: 3,
        fees: 1.3,
        ...meta,
        optionRight: 'P',
      }),
      act({
        id: 'btc',
        date: '2024-02-01',
        action: 'buy_to_close',
        symbol: 'PUT',
        quantity: 1,
        price: 1,
        ...meta,
        optionRight: 'P',
      }),
    ]);
    const left = closed.accounts.A.positions[0];
    expect(left.quantity).toBeCloseTo(-1);
    expect(left.costBasis).toBeCloseTo(-299.35);
    expect(left.realizedPL).toBeCloseTo(199.35);
    expect(closed.accounts.A.cash).toBeCloseTo(498.7);
  });

  it('realizes proceeds minus basis on sell to close', () => {
    const ledger = run([
      act({ date: '2024-01-01', action: 'buy_to_open', symbol: 'CALL', quantity: 1, price: 2, fees: 0.65, ...meta }),
      act({ date: '2024-03-01', action: 'sell_to_close', symbol: 'CALL', quantity: 1, price: 3.5, fees: 0.65, ...meta }),
    ]);
    const row = ledger.accounts.A.positions[0];
    expect(row.quantity).toBeCloseTo(0);
    expect(row.realizedPL).toBeCloseTo(148.7);
  });

  it('expires a long worthless and a short at full premium', () => {
    const long = run([
      act({ date: '2024-01-01', action: 'buy_to_open', symbol: 'CALL', quantity: 1, price: 2, fees: 0.65, ...meta }),
      act({ date: '2024-06-18', action: 'expire', symbol: 'CALL', ...meta }),
    ]);
    expect(long.accounts.A.positions[0].quantity).toBeCloseTo(0);
    expect(long.accounts.A.positions[0].realizedPL).toBeCloseTo(-200.65);
    expect(long.accounts.A.cash).toBeCloseTo(-200.65);

    const short = run([
      act({ date: '2024-01-01', action: 'sell_to_open', symbol: 'PUT', quantity: 1, price: 2, ...meta, optionRight: 'P' }),
      act({ date: '2024-06-18', action: 'expire', symbol: 'PUT', ...meta, optionRight: 'P' }),
    ]);
    expect(short.accounts.A.positions[0].realizedPL).toBeCloseTo(200);
    expect(short.accounts.A.cash).toBeCloseTo(200);
  });

  it('does not apply a plain option sell', () => {
    const ledger = run([
      act({ date: '2024-01-01', action: 'sell', ...meta, assetType: 'option', symbol: 'PUT', quantity: 1, price: 2 }),
    ]);
    expect(ledger.accounts.A.positions).toHaveLength(0);
    expect(ledger.accounts.A.cash).toBe(0);
    expect(ledger.warnings[0].message).toMatch(/sell to close/i);
  });

  it('assigns a short put into shares at strike minus premium', () => {
    const ledger = run([
      act({
        date: '2024-01-01',
        action: 'sell_to_open',
        symbol: 'PUT',
        quantity: 1,
        price: 2,
        ...meta,
        optionRight: 'P',
      }),
      act({ date: '2024-02-01', action: 'assign', symbol: 'PUT', ...meta, optionRight: 'P' }),
    ]);
    const option = ledger.accounts.A.positions.find((row) => row.symbol === 'PUT')!;
    const stock = ledger.accounts.A.positions.find((row) => row.symbol === 'AAPL')!;
    expect(option.quantity).toBeCloseTo(0);
    expect(option.realizedPL).toBeCloseTo(0);
    expect(stock.quantity).toBeCloseTo(100);
    expect(stock.costBasis).toBeCloseTo(4800);
    expect(averageCostPerShare(stock)).toBeCloseTo(48);
    expect(ledger.accounts.A.cash).toBeCloseTo(-4800);
    expect(ledger.accounts.A.realizedPL).toBeCloseTo(0);
  });

  it('reduces assigned-share basis by premium net of the opening fee', () => {
    const stock = holding([
      act({
        date: '2024-01-01',
        action: 'sell_to_open',
        symbol: 'PUT',
        quantity: 1,
        price: 2,
        fees: 5,
        ...meta,
        optionRight: 'P',
      }),
      act({ date: '2024-02-01', action: 'assign', symbol: 'PUT', ...meta, optionRight: 'P' }),
    ], 'AAPL');
    expect(stock.costBasis).toBeCloseTo(4805);
    expect(averageCostPerShare(stock)).toBeCloseTo(48.05);
  });

  it('adds short-call premium to the stock sale and not to cash a second time', () => {
    const ledger = run([
      act({ date: '2024-01-01', action: 'buy', symbol: 'AAPL', quantity: 100, price: 40 }),
      act({
        date: '2024-01-02',
        action: 'sell_to_open',
        symbol: 'CALL',
        quantity: 1,
        price: 2,
        ...meta,
        strike: 45,
        optionRight: 'C',
      }),
      act({ date: '2024-02-01', action: 'assign', symbol: 'CALL', ...meta, strike: 45, optionRight: 'C' }),
    ]);
    const stock = ledger.accounts.A.positions.find((row) => row.symbol === 'AAPL')!;
    const option = ledger.accounts.A.positions.find((row) => row.symbol === 'CALL')!;
    expect(stock.quantity).toBeCloseTo(0);
    expect(stock.realizedPL).toBeCloseTo(700);
    expect(option.realizedPL).toBeCloseTo(0);
    expect(ledger.accounts.A.cash).toBeCloseTo(700);
  });

  it('exercises a long call into shares at strike plus premium', () => {
    const ledger = run([
      act({ date: '2024-01-01', action: 'buy_to_open', symbol: 'CALL', quantity: 1, price: 2, ...meta, optionRight: 'C' }),
      act({ date: '2024-02-01', action: 'exercise', symbol: 'CALL', ...meta, optionRight: 'C' }),
    ]);
    const stock = ledger.accounts.A.positions.find((row) => row.symbol === 'AAPL')!;
    expect(stock.quantity).toBeCloseTo(100);
    expect(stock.costBasis).toBeCloseTo(5200);
    expect(averageCostPerShare(stock)).toBeCloseTo(52);
    expect(ledger.accounts.A.positions.find((row) => row.symbol === 'CALL')!.realizedPL).toBe(0);
    expect(ledger.accounts.A.cash).toBeCloseTo(-5200);
  });

  it('exercises a long put by reducing stock proceeds by the premium', () => {
    const ledger = run([
      act({ date: '2024-01-01', action: 'buy', symbol: 'AAPL', quantity: 100, price: 50 }),
      act({ date: '2024-01-02', action: 'buy_to_open', symbol: 'PUT', quantity: 1, price: 2, ...meta, optionRight: 'P' }),
      act({ date: '2024-02-01', action: 'exercise', symbol: 'PUT', ...meta, optionRight: 'P' }),
    ]);
    const stock = ledger.accounts.A.positions.find((row) => row.symbol === 'AAPL')!;
    expect(stock.quantity).toBeCloseTo(0);
    expect(stock.realizedPL).toBeCloseTo(-200);
    expect(ledger.accounts.A.cash).toBeCloseTo(-200);
    expect(ledger.accounts.A.positions.find((row) => row.symbol === 'PUT')!.realizedPL).toBe(0);
  });
});

describe('same-day order', () => {
  it('applies openings before later actions when timestamps tie', () => {
    const row = holding([
      act({ id: 's', date: '2024-01-01', createdAt: '2024-01-01T00:00:00.000Z', action: 'sell', symbol: 'VTI', quantity: 4, price: 30 }),
      act({
        id: 'o',
        date: '2024-01-01',
        createdAt: '2024-01-01T00:00:00.000Z',
        action: 'opening_position',
        symbol: 'VTI',
        quantity: 10,
        amount: 200,
      }),
    ], 'VTI');
    expect(row.quantity).toBeCloseTo(6);
    expect(row.oversold).toBe(false);
    expect(row.realizedPL).toBeCloseTo(40);
  });

  it('respects createdAt when it is present', () => {
    const row = holding([
      act({ id: 'b', date: '2024-01-02', createdAt: '2024-01-02T15:00:00.000Z', action: 'buy', symbol: 'VTI', quantity: 5, price: 10 }),
      act({ id: 's', date: '2024-01-02', createdAt: '2024-01-02T09:00:00.000Z', action: 'sell', symbol: 'VTI', quantity: 5, price: 12 }),
    ], 'VTI');
    expect(row.oversold).toBe(true);
  });
});
