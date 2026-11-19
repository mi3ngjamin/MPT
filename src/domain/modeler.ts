import { r8 } from './round';

export interface BuyMoreResult {
  unitsAdded: number;
  newQuantity: number;
  newCostBasis: number;
  newAvgCost: number;
  avgCostReductionPct: number | null;
  newMarketValue: number;
  newWeightPct: number | null;
}

/** Amount buys units at price. Options divide by the multiplier (100). */
export function modelBuyMore(input: {
  quantity: number;
  costBasis: number;
  price: number;
  multiplier: number;
  amount: number;
  portfolioInvested: number;
  holdingMarketValue: number;
}): BuyMoreResult | null {
  const multiplier = input.multiplier > 0 ? input.multiplier : 1;
  if (!(input.price > 0) || !(input.amount > 0)) return null;
  const unitCost = input.price * multiplier;
  const unitsAdded = input.amount / unitCost;
  const newQuantity = input.quantity + unitsAdded;
  const newCostBasis = input.costBasis + input.amount;
  const newAvgCost = newQuantity !== 0 ? newCostBasis / newQuantity / multiplier : 0;
  const oldAvg = input.quantity !== 0 ? input.costBasis / input.quantity / multiplier : 0;
  const avgCostReductionPct = oldAvg > 0 ? (oldAvg - newAvgCost) / oldAvg : null;
  const newMarketValue = newQuantity * input.price * multiplier;
  const portfolio = input.portfolioInvested - input.holdingMarketValue + newMarketValue;
  const newWeightPct = portfolio > 0 ? newMarketValue / portfolio : null;
  return {
    unitsAdded: r8(unitsAdded),
    newQuantity: r8(newQuantity),
    newCostBasis: r8(newCostBasis),
    newAvgCost: r8(newAvgCost),
    avgCostReductionPct,
    newMarketValue: r8(newMarketValue),
    newWeightPct,
  };
}
