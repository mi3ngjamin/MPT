import type { Activity, ActivityAction, AssetType } from './types';
import { EPS, nearlyZero, r8 } from './round';

/**
 * Average-cost ledger. Activity rows are the only input.
 * Stock buy: basis += qty*price*mult + fees; cash decreases by the same; nothing realized.
 * Stock sell: basis -= qty*avg; realized = proceeds − qty*avg.
 * Sell-to-open: negative quantity, negative (credit) basis, cash in, nothing realized.
 * Buy-to-close realizes credit relieved minus the cost to close.
 * Sell-to-close realizes proceeds minus basis.
 * Expire closes contracts at $0 and realizes the remaining basis (loss if long, premium if short).
 * Assignment and exercise fold premium into the underlying and do not realize option P/L.
 * In-kind transfers move quantity and pro-rata basis. Cash transfers move cash. Neither realizes.
 * Splits scale quantity and leave basis unchanged.
 * Market prices are applied later. A missing price is never stored as zero here.
 */

export interface AuditLine {
  activityId: string;
  date: string;
  action: ActivityAction;
  symbol: string | null;
  quantityDelta: number;
  basisDelta: number;
  cashDelta: number;
  realizedDelta: number;
  quantityAfter: number;
  basisAfter: number;
  cashAfter: number;
  note?: string;
}

export interface Position {
  accountId: string;
  symbol: string;
  assetType: AssetType;
  quantity: number;
  costBasis: number;
  realizedPL: number;
  multiplier: number;
  underlying?: string;
  expiry?: string;
  strike?: number;
  optionRight?: 'C' | 'P';
  oversold: boolean;
  lastTradePrice?: number;
  lastTradeDate?: string;
  audit: AuditLine[];
}

export interface AccountLedger {
  accountId: string;
  cash: number;
  negativeCash: boolean;
  wentNegative: boolean;
  realizedPL: number;
  dividendIncome: number;
  positions: Position[];
  cashAudit: AuditLine[];
}

export interface EngineWarning {
  code: 'negative_cash' | 'oversold' | 'invalid_activity';
  accountId?: string;
  symbol?: string;
  activityId?: string;
  message: string;
}

export interface Ledger {
  accounts: Record<string, AccountLedger>;
  warnings: EngineWarning[];
}

const PRIORITY: Record<ActivityAction, number> = {
  opening_cash: 0,
  opening_position: 1,
  split: 2,
  contribution: 3,
  withdrawal: 3,
  transfer: 3,
  in_kind_transfer: 3,
  dividend: 3,
  interest: 3,
  fee: 3,
  buy: 4,
  buy_to_open: 4,
  sell_to_open: 4,
  dividend_reinvest: 5,
  sell: 6,
  sell_to_close: 6,
  buy_to_close: 6,
  expire: 7,
  exercise: 8,
  assign: 8,
  adjustment: 9,
};

export function positionSymbol(activity: Pick<Activity, 'symbol' | 'assetType' | 'underlying' | 'expiry' | 'strike' | 'optionRight'>): string | null {
  if (activity.symbol && activity.symbol.trim()) return activity.symbol.trim().toUpperCase();
  if (
    activity.assetType === 'option' &&
    activity.underlying &&
    activity.expiry &&
    activity.strike != null &&
    activity.optionRight
  ) {
    return `OPT:${activity.underlying.trim().toUpperCase()}:${activity.expiry}:${activity.strike}:${activity.optionRight}`;
  }
  return null;
}

export function averageCostPerShare(position: Position): number | null {
  if (nearlyZero(position.quantity) || position.multiplier === 0) return null;
  return position.costBasis / position.quantity / position.multiplier;
}

function compareActivity(a: Activity, b: Activity): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  const ca = a.createdAt ?? '';
  const cb = b.createdAt ?? '';
  if (ca !== cb) return ca < cb ? -1 : 1;
  const pa = PRIORITY[a.action] ?? 5;
  const pb = PRIORITY[b.action] ?? 5;
  if (pa !== pb) return pa - pb;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

interface CashBook {
  cash: number;
  wentNegative: boolean;
  dividendIncome: number;
  audit: AuditLine[];
}

export function processLedger(activities: Activity[], accountIds: string[] = []): Ledger {
  const warnings: EngineWarning[] = [];
  const cash = new Map<string, CashBook>();
  const positions = new Map<string, Position>();
  const ids = new Set(accountIds);

  const book = (accountId: string): CashBook => {
    let row = cash.get(accountId);
    if (!row) {
      row = { cash: 0, wentNegative: false, dividendIncome: 0, audit: [] };
      cash.set(accountId, row);
    }
    return row;
  };

  const warn = (activity: Activity, message: string, symbol?: string | null) => {
    warnings.push({
      code: 'invalid_activity',
      accountId: activity.accountId,
      activityId: activity.id,
      symbol: symbol ?? undefined,
      message,
    });
  };

  const moveCash = (accountId: string, delta: number, activity: Activity, symbol: string | null) => {
    if (nearlyZero(delta)) return;
    const row = book(accountId);
    row.cash = r8(row.cash + delta);
    if (row.cash < -1e-6) row.wentNegative = true;
    row.audit.push({
      activityId: activity.id,
      date: activity.date,
      action: activity.action,
      symbol,
      quantityDelta: 0,
      basisDelta: 0,
      cashDelta: r8(delta),
      realizedDelta: 0,
      quantityAfter: 0,
      basisAfter: 0,
      cashAfter: row.cash,
      note: activity.note ?? undefined,
    });
  };

  const keyOf = (accountId: string, symbol: string) => `${accountId}\u0000${symbol}`;

  const existing = (accountId: string, symbol: string) => positions.get(keyOf(accountId, symbol));

  const ensure = (accountId: string, symbol: string, assetType: AssetType): Position => {
    const key = keyOf(accountId, symbol);
    let row = positions.get(key);
    if (!row) {
      row = {
        accountId,
        symbol,
        assetType,
        quantity: 0,
        costBasis: 0,
        realizedPL: 0,
        multiplier: assetType === 'option' ? 100 : 1,
        oversold: false,
        audit: [],
      };
      positions.set(key, row);
    }
    return row;
  };

  const applyMeta = (row: Position, activity: Activity, mult: number) => {
    if (activity.assetType && activity.assetType !== 'cash') row.assetType = activity.assetType;
    if (activity.underlying) row.underlying = activity.underlying.trim().toUpperCase();
    if (activity.expiry) row.expiry = activity.expiry;
    if (activity.strike != null) row.strike = activity.strike;
    if (activity.optionRight) row.optionRight = activity.optionRight;
    if (mult > 0) row.multiplier = mult;
  };

  const multiplier = (activity: Activity, row?: Position): number => {
    if (activity.multiplier != null && activity.multiplier > 0) return activity.multiplier;
    if (row && row.multiplier > 0) return row.multiplier;
    if (activity.assetType === 'option' || row?.assetType === 'option') return 100;
    return 1;
  };

  const rememberPrice = (row: Position, activity: Activity) => {
    if (activity.price != null && activity.price > 0) {
      row.lastTradePrice = activity.price;
      row.lastTradeDate = activity.date;
    }
  };

  const audit = (
    row: Position,
    activity: Activity,
    beforeQty: number,
    beforeBasis: number,
    cashDelta: number,
    realizedDelta: number,
  ) => {
    row.audit.push({
      activityId: activity.id,
      date: activity.date,
      action: activity.action,
      symbol: row.symbol,
      quantityDelta: r8(row.quantity - beforeQty),
      basisDelta: r8(row.costBasis - beforeBasis),
      cashDelta: r8(cashDelta),
      realizedDelta: r8(realizedDelta),
      quantityAfter: row.quantity,
      basisAfter: row.costBasis,
      cashAfter: book(row.accountId).cash,
      note: activity.note ?? undefined,
    });
  };

  const openLong = (row: Position, activity: Activity, qty: number, price: number) => {
    const mult = multiplier(activity, row);
    const fees = activity.fees ?? 0;
    const cost = r8(qty * price * mult + fees);
    const beforeQty = row.quantity;
    const beforeBasis = row.costBasis;
    row.quantity = r8(row.quantity + qty);
    row.costBasis = r8(row.costBasis + cost);
    applyMeta(row, activity, mult);
    rememberPrice(row, activity);
    moveCash(row.accountId, -cost, activity, row.symbol);
    audit(row, activity, beforeQty, beforeBasis, -cost, 0);
  };

  const openShort = (row: Position, activity: Activity, qty: number, price: number) => {
    const mult = multiplier(activity, row);
    const fees = activity.fees ?? 0;
    const credit = r8(qty * price * mult - fees);
    const beforeQty = row.quantity;
    const beforeBasis = row.costBasis;
    row.quantity = r8(row.quantity - qty);
    row.costBasis = r8(row.costBasis - credit);
    applyMeta(row, activity, mult);
    rememberPrice(row, activity);
    moveCash(row.accountId, credit, activity, row.symbol);
    audit(row, activity, beforeQty, beforeBasis, credit, 0);
  };

  const closeLong = (row: Position, activity: Activity, qty: number, price: number) => {
    const mult = multiplier(activity, row);
    const fees = activity.fees ?? 0;
    const proceeds = r8(qty * price * mult - fees);
    const avg = nearlyZero(row.quantity) ? 0 : row.costBasis / row.quantity;
    if (qty > row.quantity + EPS) row.oversold = true;
    const relief = r8(qty * avg);
    const realized = r8(proceeds - relief);
    const beforeQty = row.quantity;
    const beforeBasis = row.costBasis;
    row.quantity = r8(row.quantity - qty);
    row.costBasis = r8(row.costBasis - relief);
    row.realizedPL = r8(row.realizedPL + realized);
    applyMeta(row, activity, mult);
    rememberPrice(row, activity);
    moveCash(row.accountId, proceeds, activity, row.symbol);
    audit(row, activity, beforeQty, beforeBasis, proceeds, realized);
  };

  const closeShort = (row: Position, activity: Activity, qty: number, price: number) => {
    const mult = multiplier(activity, row);
    const fees = activity.fees ?? 0;
    const cost = r8(qty * price * mult + fees);
    const beforeQty = row.quantity;
    const beforeBasis = row.costBasis;
    let credit = 0;
    if (row.quantity < -EPS) {
      const portion = qty / Math.abs(row.quantity);
      if (portion > 1 + 1e-8) row.oversold = true;
      credit = r8(-row.costBasis * portion);
      row.costBasis = r8(row.costBasis * (1 - portion));
      row.quantity = r8(row.quantity + qty);
    } else {
      row.oversold = true;
      row.quantity = r8(row.quantity + qty);
    }
    const realized = r8(credit - cost);
    row.realizedPL = r8(row.realizedPL + realized);
    applyMeta(row, activity, mult);
    rememberPrice(row, activity);
    moveCash(row.accountId, -cost, activity, row.symbol);
    audit(row, activity, beforeQty, beforeBasis, -cost, realized);
  };

  /** Remove contracts and return the absolute premium/basis relieved. Does not realize. */
  const relieve = (row: Position, contracts: number): number => {
    const absQty = Math.abs(row.quantity);
    if (absQty < EPS || contracts <= 0) return 0;
    const closeQty = Math.min(contracts, absQty);
    const portion = closeQty / absQty;
    const premium = r8(Math.abs(row.costBasis) * portion);
    if (row.quantity < 0) row.quantity = r8(row.quantity + closeQty);
    else row.quantity = r8(row.quantity - closeQty);
    row.costBasis = r8(row.costBasis * (1 - portion));
    return premium;
  };

  for (const activity of activities) {
    ids.add(activity.accountId);
    if (activity.transferAccountId) ids.add(activity.transferAccountId);
  }
  for (const id of ids) book(id);

  const sorted = [...activities].sort(compareActivity);

  for (const activity of sorted) {
    const symbol = positionSymbol(activity);
    const fees = activity.fees ?? 0;

    switch (activity.action) {
      case 'opening_cash': {
        if (activity.amount == null) {
          warn(activity, 'Opening cash needs an amount.');
          break;
        }
        moveCash(activity.accountId, activity.amount, activity, null);
        break;
      }
      case 'opening_position': {
        if (!symbol || activity.quantity == null) {
          warn(activity, 'Opening position needs a symbol and quantity.');
          break;
        }
        const row = ensure(activity.accountId, symbol, activity.assetType === 'cash' ? 'stock_etf' : activity.assetType);
        const mult = multiplier(activity, row);
        const basis =
          activity.amount != null ? activity.amount : r8(activity.quantity * (activity.price ?? 0) * mult);
        const beforeQty = row.quantity;
        const beforeBasis = row.costBasis;
        row.quantity = r8(row.quantity + activity.quantity);
        row.costBasis = r8(row.costBasis + basis);
        applyMeta(row, activity, mult);
        rememberPrice(row, activity);
        audit(row, activity, beforeQty, beforeBasis, 0, 0);
        break;
      }
      case 'buy':
      case 'buy_to_open': {
        if (!symbol || !(activity.quantity != null && activity.quantity > 0) || activity.price == null) {
          warn(activity, 'This open needs a symbol, a positive quantity, and a price.');
          break;
        }
        const asset = activity.action === 'buy_to_open' ? 'option' : activity.assetType;
        const row = ensure(activity.accountId, symbol, asset === 'cash' ? 'stock_etf' : asset);
        openLong(row, activity, activity.quantity, activity.price);
        break;
      }
      case 'sell': {
        if (activity.assetType === 'option') {
          warn(activity, 'Use sell to close or sell to open for options. This sell was not applied.');
          break;
        }
        if (!symbol || !(activity.quantity != null && activity.quantity > 0) || activity.price == null) {
          warn(activity, 'A sell needs a symbol, a positive quantity, and a price.');
          break;
        }
        const row = ensure(activity.accountId, symbol, activity.assetType);
        closeLong(row, activity, activity.quantity, activity.price);
        break;
      }
      case 'sell_to_close': {
        if (!symbol || !(activity.quantity != null && activity.quantity > 0) || activity.price == null) {
          warn(activity, 'Sell to close needs a symbol, contracts, and a price.');
          break;
        }
        const row = ensure(activity.accountId, symbol, 'option');
        closeLong(row, activity, activity.quantity, activity.price);
        break;
      }
      case 'sell_to_open': {
        if (!symbol || !(activity.quantity != null && activity.quantity > 0) || activity.price == null) {
          warn(activity, 'Sell to open needs a symbol, contracts, and a price.');
          break;
        }
        const row = ensure(activity.accountId, symbol, 'option');
        openShort(row, activity, activity.quantity, activity.price);
        break;
      }
      case 'buy_to_close': {
        if (!symbol || !(activity.quantity != null && activity.quantity > 0) || activity.price == null) {
          warn(activity, 'Buy to close needs a symbol, contracts, and a price.');
          break;
        }
        const row = ensure(activity.accountId, symbol, 'option');
        closeShort(row, activity, activity.quantity, activity.price);
        break;
      }
      case 'expire': {
        if (!symbol) {
          warn(activity, 'Expire needs the option symbol.');
          break;
        }
        const row = existing(activity.accountId, symbol);
        if (!row || nearlyZero(row.quantity)) {
          warn(activity, 'There are no open contracts to expire.');
          break;
        }
        const beforeQty = row.quantity;
        const beforeBasis = row.costBasis;
        const contracts = activity.quantity != null && activity.quantity > 0 ? activity.quantity : Math.abs(row.quantity);
        const absQty = Math.abs(row.quantity);
        const closeQty = Math.min(contracts, absQty);
        const portion = closeQty / absQty;
        const basisPart = r8(row.costBasis * portion);
        const realized = r8(-basisPart - fees);
        if (row.quantity > 0) row.quantity = r8(row.quantity - closeQty);
        else row.quantity = r8(row.quantity + closeQty);
        row.costBasis = r8(row.costBasis - basisPart);
        row.realizedPL = r8(row.realizedPL + realized);
        if (fees) moveCash(activity.accountId, -fees, activity, symbol);
        audit(row, activity, beforeQty, beforeBasis, fees ? -fees : 0, realized);
        break;
      }
      case 'assign':
      case 'exercise': {
        if (!symbol) {
          warn(activity, 'This option event needs a symbol.');
          break;
        }
        const opt = existing(activity.accountId, symbol);
        if (!opt) {
          warn(activity, 'No matching option position.');
          break;
        }
        const right = activity.optionRight ?? opt.optionRight;
        const strike = activity.strike ?? opt.strike;
        const underlying = (activity.underlying ?? opt.underlying ?? '').toUpperCase();
        if (!right || strike == null || !underlying) {
          warn(activity, 'Assignment and exercise need underlying, strike, and call or put.');
          break;
        }
        const isAssign = activity.action === 'assign';
        if (isAssign && opt.quantity >= -EPS) {
          warn(activity, 'Assignment applies to a short option.');
          break;
        }
        if (!isAssign && opt.quantity <= EPS) {
          warn(activity, 'Exercise applies to a long option.');
          break;
        }
        const openContracts = Math.abs(opt.quantity);
        const contracts = activity.quantity != null && activity.quantity > 0 ? activity.quantity : openContracts;
        if (contracts > openContracts + EPS) opt.oversold = true;
        const closeContracts = Math.min(contracts, openContracts);
        const beforeOptQty = opt.quantity;
        const beforeOptBasis = opt.costBasis;
        const premium = relieve(opt, closeContracts);
        audit(opt, activity, beforeOptQty, beforeOptBasis, 0, 0);
        const shares = r8(closeContracts * (opt.multiplier || 100));
        const stock = ensure(activity.accountId, underlying, 'stock_etf');
        stock.assetType = 'stock_etf';
        stock.multiplier = 1;
        const beforeQty = stock.quantity;
        const beforeBasis = stock.costBasis;
        if ((isAssign && right === 'P') || (!isAssign && right === 'C')) {
          const basisAdd = r8(strike * shares + (isAssign ? -premium : premium) + fees);
          stock.quantity = r8(stock.quantity + shares);
          stock.costBasis = r8(stock.costBasis + basisAdd);
          moveCash(activity.accountId, -r8(strike * shares + fees), activity, underlying);
          audit(stock, activity, beforeQty, beforeBasis, -r8(strike * shares + fees), 0);
        } else {
          const proceeds = r8(strike * shares + (isAssign ? premium : -premium) - fees);
          const avg = nearlyZero(stock.quantity) ? 0 : stock.costBasis / stock.quantity;
          if (shares > stock.quantity + EPS) stock.oversold = true;
          const relief = r8(shares * avg);
          const realized = r8(proceeds - relief);
          stock.quantity = r8(stock.quantity - shares);
          stock.costBasis = r8(stock.costBasis - relief);
          stock.realizedPL = r8(stock.realizedPL + realized);
          moveCash(activity.accountId, r8(strike * shares - fees), activity, underlying);
          audit(stock, activity, beforeQty, beforeBasis, r8(strike * shares - fees), realized);
        }
        break;
      }
      case 'contribution': {
        if (activity.amount == null) {
          warn(activity, 'Contribution needs an amount.');
          break;
        }
        moveCash(activity.accountId, Math.abs(activity.amount), activity, null);
        break;
      }
      case 'withdrawal': {
        if (activity.amount == null) {
          warn(activity, 'Withdrawal needs an amount.');
          break;
        }
        moveCash(activity.accountId, -Math.abs(activity.amount), activity, null);
        break;
      }
      case 'dividend':
      case 'interest': {
        if (activity.amount == null) {
          warn(activity, 'This cash credit needs an amount.');
          break;
        }
        const credit = Math.abs(activity.amount);
        if (activity.action === 'dividend') book(activity.accountId).dividendIncome = r8(book(activity.accountId).dividendIncome + credit);
        moveCash(activity.accountId, credit, activity, symbol);
        break;
      }
      case 'fee': {
        const amount = activity.amount != null ? Math.abs(activity.amount) : Math.abs(fees);
        if (!(amount > 0)) {
          warn(activity, 'Fee needs an amount.');
          break;
        }
        moveCash(activity.accountId, -amount, activity, symbol);
        break;
      }
      case 'transfer': {
        if (!activity.transferAccountId || activity.transferAccountId === activity.accountId) {
          warn(activity, 'Cash transfer needs a different destination account.');
          break;
        }
        if (activity.amount == null) {
          warn(activity, 'Cash transfer needs an amount.');
          break;
        }
        const amount = Math.abs(activity.amount);
        moveCash(activity.accountId, -(amount + fees), activity, null);
        moveCash(activity.transferAccountId, amount, activity, null);
        break;
      }
      case 'in_kind_transfer': {
        if (!symbol || !activity.transferAccountId || activity.transferAccountId === activity.accountId) {
          warn(activity, 'In-kind transfer needs a symbol and a different destination account.');
          break;
        }
        if (!(activity.quantity != null && activity.quantity > 0)) {
          warn(activity, 'In-kind transfer needs a positive quantity.');
          break;
        }
        const src = ensure(activity.accountId, symbol, activity.assetType === 'cash' ? 'stock_etf' : activity.assetType);
        const dest = ensure(activity.transferAccountId, symbol, src.assetType);
        dest.assetType = src.assetType;
        dest.multiplier = src.multiplier;
        dest.underlying = src.underlying;
        dest.expiry = src.expiry;
        dest.strike = src.strike;
        dest.optionRight = src.optionRight;
        const q = activity.quantity;
        const beforeSrcQty = src.quantity;
        const beforeSrcBasis = src.costBasis;
        const beforeDestQty = dest.quantity;
        const beforeDestBasis = dest.costBasis;
        if (src.quantity < -EPS) {
          const absQty = Math.abs(src.quantity);
          if (q > absQty + EPS) src.oversold = true;
          const portion = absQty === 0 ? 0 : q / absQty;
          const basisMoved = r8(src.costBasis * portion);
          src.quantity = r8(src.quantity + q);
          src.costBasis = r8(src.costBasis - basisMoved);
          dest.quantity = r8(dest.quantity - q);
          dest.costBasis = r8(dest.costBasis + basisMoved);
        } else {
          const avg = nearlyZero(src.quantity) ? 0 : src.costBasis / src.quantity;
          if (q > src.quantity + EPS) src.oversold = true;
          const basisMoved = r8(q * avg);
          src.quantity = r8(src.quantity - q);
          src.costBasis = r8(src.costBasis - basisMoved);
          dest.quantity = r8(dest.quantity + q);
          dest.costBasis = r8(dest.costBasis + basisMoved);
        }
        let srcCash = 0;
        let destCash = 0;
        if (activity.amount != null && Math.abs(activity.amount) > 0) {
          const amount = Math.abs(activity.amount);
          moveCash(activity.accountId, -(amount + fees), activity, symbol);
          moveCash(activity.transferAccountId, amount, activity, symbol);
          srcCash = -(amount + fees);
          destCash = amount;
        }
        audit(src, activity, beforeSrcQty, beforeSrcBasis, srcCash, 0);
        audit(dest, activity, beforeDestQty, beforeDestBasis, destCash, 0);
        break;
      }
      case 'adjustment': {
        if (!activity.note || !activity.note.trim()) {
          warn(activity, 'An adjustment requires a note.');
        }
        const dq = activity.deltaQuantity ?? 0;
        const db = activity.deltaCostBasis ?? 0;
        const dc = activity.deltaCash ?? 0;
        if (symbol && (!nearlyZero(dq) || !nearlyZero(db))) {
          const row = ensure(activity.accountId, symbol, activity.assetType === 'cash' ? 'stock_etf' : activity.assetType);
          const beforeQty = row.quantity;
          const beforeBasis = row.costBasis;
          row.quantity = r8(row.quantity + dq);
          row.costBasis = r8(row.costBasis + db);
          applyMeta(row, activity, multiplier(activity, row));
          if (!nearlyZero(dc)) moveCash(activity.accountId, dc, activity, symbol);
          audit(row, activity, beforeQty, beforeBasis, dc, 0);
        } else if (!nearlyZero(dc)) {
          moveCash(activity.accountId, dc, activity, symbol);
        } else if (!symbol) {
          warn(activity, 'A quantity or basis adjustment needs a symbol.');
        }
        break;
      }
      case 'split': {
        const ratio = activity.ratio ?? activity.quantity;
        if (!symbol || ratio == null || !(ratio > 0)) {
          warn(activity, 'A split needs a symbol and a positive ratio.');
          break;
        }
        const row = existing(activity.accountId, symbol);
        if (!row) {
          warn(activity, 'There is no position to split.');
          break;
        }
        const beforeQty = row.quantity;
        const beforeBasis = row.costBasis;
        row.quantity = r8(row.quantity * ratio);
        audit(row, activity, beforeQty, beforeBasis, 0, 0);
        break;
      }
      case 'dividend_reinvest': {
        if (!symbol || !(activity.quantity != null && activity.quantity > 0) || activity.price == null) {
          warn(activity, 'Dividend reinvest needs a symbol, shares, and a price.');
          break;
        }
        const row = ensure(activity.accountId, symbol, activity.assetType === 'cash' ? 'stock_etf' : activity.assetType);
        const mult = multiplier(activity, row);
        const buyCost = r8(activity.quantity * activity.price * mult + fees);
        const dividend = activity.amount != null ? activity.amount : buyCost;
        book(activity.accountId).dividendIncome = r8(book(activity.accountId).dividendIncome + dividend);
        moveCash(activity.accountId, dividend, activity, symbol);
        const beforeQty = row.quantity;
        const beforeBasis = row.costBasis;
        row.quantity = r8(row.quantity + activity.quantity);
        row.costBasis = r8(row.costBasis + buyCost);
        applyMeta(row, activity, mult);
        rememberPrice(row, activity);
        moveCash(activity.accountId, -buyCost, activity, symbol);
        audit(row, activity, beforeQty, beforeBasis, r8(dividend - buyCost), 0);
        break;
      }
      default:
        warn(activity, 'Unknown activity.');
    }
  }

  const accounts: Record<string, AccountLedger> = {};
  for (const accountId of ids) {
    const row = book(accountId);
    const owned = [...positions.values()]
      .filter((p) => p.accountId === accountId)
      .sort((a, b) => a.symbol.localeCompare(b.symbol));
    const realizedPL = r8(owned.reduce((sum, p) => sum + p.realizedPL, 0));
    const negative = row.cash < -1e-6 || row.wentNegative;
    if (negative) {
      warnings.push({
        code: 'negative_cash',
        accountId,
        message: 'Cash went negative. The ledger was still applied.',
      });
    }
    for (const position of owned) {
      if (position.oversold) {
        warnings.push({
          code: 'oversold',
          accountId,
          symbol: position.symbol,
          message: 'Quantity sold or transferred was larger than the open position.',
        });
      }
    }
    accounts[accountId] = {
      accountId,
      cash: row.cash,
      negativeCash: negative,
      wentNegative: row.wentNegative,
      realizedPL,
      dividendIncome: row.dividendIncome,
      positions: owned,
      cashAudit: row.audit,
    };
  }

  return { accounts, warnings };
}
