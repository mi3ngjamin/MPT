import { describe, expect, it } from 'vitest';
import { modelBuyMore } from './modeler';

describe('buy-more modeler', () => {
  it('adds shares and lowers average cost', () => {
    const result = modelBuyMore({
      quantity: 10,
      costBasis: 2000,
      price: 100,
      multiplier: 1,
      amount: 1000,
      portfolioInvested: 10_000,
      holdingMarketValue: 1000,
    });
    expect(result).not.toBeNull();
    expect(result!.unitsAdded).toBeCloseTo(10);
    expect(result!.newQuantity).toBeCloseTo(20);
    expect(result!.newCostBasis).toBeCloseTo(3000);
    expect(result!.newAvgCost).toBeCloseTo(150);
    expect(result!.avgCostReductionPct).toBeCloseTo(0.25);
    expect(result!.newWeightPct).toBeCloseTo(2000 / 11_000);
  });

  it('divides option contracts by the multiplier', () => {
    const result = modelBuyMore({
      quantity: 1,
      costBasis: 200,
      price: 2,
      multiplier: 100,
      amount: 1000,
      portfolioInvested: 5000,
      holdingMarketValue: 200,
    });
    expect(result!.unitsAdded).toBeCloseTo(5);
    expect(result!.newQuantity).toBeCloseTo(6);
    expect(result!.newAvgCost).toBeCloseTo(2);
  });
});
