import { isIsoDate } from './dates';
import { positionSymbol } from './engine';
import type { Activity } from './types';

const OPTION_ACTIONS = new Set([
  'buy_to_open',
  'sell_to_open',
  'buy_to_close',
  'sell_to_close',
  'expire',
  'assign',
  'exercise',
]);

export function validateActivity(activity: Activity): string[] {
  const errors: string[] = [];
  if (!isIsoDate(activity.date)) errors.push('Enter a valid date.');
  if (!activity.accountId) errors.push('Choose an account.');
  if (activity.action === 'adjustment' && !activity.note?.trim()) {
    errors.push('An adjustment needs a note.');
  }
  if (
    (activity.action === 'transfer' || activity.action === 'in_kind_transfer') &&
    (!activity.transferAccountId || activity.transferAccountId === activity.accountId)
  ) {
    errors.push('Choose a different destination account.');
  }
  if (OPTION_ACTIONS.has(activity.action)) {
    if (!activity.underlying?.trim() || activity.strike == null || !activity.optionRight || !activity.expiry) {
      errors.push('Options need an underlying, expiry, strike, and call or put.');
    }
    if (!positionSymbol({ ...activity, assetType: 'option' })) {
      errors.push('Give the contract a symbol, or fill in the option terms.');
    }
  }
  const needsTrade =
    activity.action === 'buy' ||
    activity.action === 'sell' ||
    activity.action === 'buy_to_open' ||
    activity.action === 'sell_to_open' ||
    activity.action === 'buy_to_close' ||
    activity.action === 'sell_to_close' ||
    activity.action === 'dividend_reinvest';
  if (needsTrade) {
    if (!activity.symbol?.trim()) errors.push('Enter a symbol.');
    if (!(activity.quantity != null && activity.quantity > 0)) errors.push('Quantity must be greater than zero.');
    if (activity.price == null || activity.price < 0) errors.push('Enter a price.');
  }
  if (activity.action === 'opening_position') {
    if (!activity.symbol?.trim()) errors.push('Enter a symbol.');
    if (activity.quantity == null) errors.push('Enter a quantity.');
    if (activity.amount == null) errors.push('Enter the total cost basis.');
  }
  if (activity.action === 'split' && !(activity.ratio != null && activity.ratio > 0)) {
    errors.push('Enter the split ratio (new shares per old share).');
  }
  if (activity.action === 'in_kind_transfer') {
    if (!activity.symbol?.trim()) errors.push('Enter a symbol.');
    if (!(activity.quantity != null && activity.quantity > 0)) errors.push('Quantity must be greater than zero.');
  }
  const cashActions = ['opening_cash', 'contribution', 'withdrawal', 'dividend', 'interest', 'transfer'];
  if (cashActions.includes(activity.action) && activity.amount == null) {
    errors.push('Enter an amount.');
  }
  if (activity.action === 'sell' && activity.assetType === 'option') {
    errors.push('Use sell to open or sell to close for options.');
  }
  return errors;
}
