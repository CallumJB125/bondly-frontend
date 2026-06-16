import { describe, it, expect } from 'vitest';
import {
  calcMonthly,
  calcMaxBond,
  calcTransferDuty,
  calcSwapSavings,
  calcRefinanceDecision,
  calcTotalInterest,
  calcUpfrontCosts,
} from '../finance.js';

describe('calcMonthly', () => {
  it('returns correct monthly repayment for a standard bond', () => {
    // R1M at 11.25% over 20 years → ~R10,493/month
    const monthly = calcMonthly(1_000_000, 11.25, 20);
    expect(monthly).toBeCloseTo(10493, -1);
  });

  it('handles zero interest rate (pure principal division)', () => {
    const monthly = calcMonthly(1_200_000, 0, 20);
    expect(monthly).toBeCloseTo(5000, 0);
  });

  it('higher rate produces higher monthly payment', () => {
    const low = calcMonthly(1_000_000, 10, 20);
    const high = calcMonthly(1_000_000, 13, 20);
    expect(high).toBeGreaterThan(low);
  });

  it('shorter term produces higher monthly payment', () => {
    const long = calcMonthly(1_000_000, 11.25, 20);
    const short = calcMonthly(1_000_000, 11.25, 10);
    expect(short).toBeGreaterThan(long);
  });
});

describe('calcMaxBond', () => {
  it('is inverse of calcMonthly', () => {
    const amount = 1_500_000;
    const rate = 11.25;
    const term = 20;
    const monthly = calcMonthly(amount, rate, term);
    const backToAmount = calcMaxBond(monthly, rate, term);
    expect(backToAmount).toBeCloseTo(amount, 0);
  });

  it('returns principal * months at zero rate', () => {
    const maxBond = calcMaxBond(5000, 0, 20);
    expect(maxBond).toBeCloseTo(1_200_000, 0);
  });
});

describe('calcTransferDuty', () => {
  it('returns 0 for properties at or below R1.1M', () => {
    expect(calcTransferDuty(1_000_000)).toBe(0);
    expect(calcTransferDuty(1_100_000)).toBe(0);
  });

  it('applies 3% on value above R1.1M up to R1.5125M', () => {
    // R1.3M → (R1.3M - R1.1M) * 3% = R6,000
    expect(calcTransferDuty(1_300_000)).toBeCloseTo(6_000, 0);
  });

  it('applies higher brackets for expensive properties', () => {
    const dutyAt2M = calcTransferDuty(2_000_000);
    const dutyAt3M = calcTransferDuty(3_000_000);
    expect(dutyAt3M).toBeGreaterThan(dutyAt2M);
  });

  it('returns zero transfer duty for first-time buyer threshold', () => {
    expect(calcTransferDuty(900_000)).toBe(0);
  });
});

describe('calcSwapSavings', () => {
  it('returns positive monthly saving when new rate is lower', () => {
    const { monthlySaving } = calcSwapSavings(1_000_000, 12.5, 11.0, 240);
    expect(monthlySaving).toBeGreaterThan(0);
  });

  it('returns negative saving when new rate is higher', () => {
    const { monthlySaving } = calcSwapSavings(1_000_000, 11.0, 12.5, 240);
    expect(monthlySaving).toBeLessThan(0);
  });

  it('total saving equals monthly saving times months remaining', () => {
    const { monthlySaving, totalSaving } = calcSwapSavings(1_000_000, 12.5, 11.0, 240);
    expect(totalSaving).toBeCloseTo(monthlySaving * 240, 1);
  });

  it('returns zero saving for equal rates', () => {
    const { monthlySaving } = calcSwapSavings(1_000_000, 11.25, 11.25, 240);
    expect(monthlySaving).toBeCloseTo(0, 5);
  });
});

describe('calcRefinanceDecision', () => {
  const bankSpreads = { ABSA: 0.0, FNB: 0.0, Nedbank: 0.25 };
  const primeRate = 11.25;

  it('recommends SWITCH_NOW when break-even is within 18 months', () => {
    // High rate vs prime → big saving → short break-even
    const { recommendation } = calcRefinanceDecision(2_000_000, 13.5, 240, bankSpreads, primeRate);
    expect(recommendation).toBe('SWITCH_NOW');
  });

  it('returns NO_BENEFIT when already on competitive rate', () => {
    // Current rate equals best available
    const { recommendation } = calcRefinanceDecision(1_000_000, 11.25, 240, bankSpreads, primeRate);
    expect(recommendation).toBe('NO_BENEFIT');
  });

  it('returns NO_BENEFIT when saving is under R100/month', () => {
    // Very small spread difference on small balance
    const { recommendation } = calcRefinanceDecision(100_000, 11.35, 240, bankSpreads, primeRate);
    expect(recommendation).toBe('NO_BENEFIT');
  });

  it('includes bestBank and bestRate in result', () => {
    const result = calcRefinanceDecision(2_000_000, 13.5, 240, bankSpreads, primeRate);
    expect(result.bestBank).toBeDefined();
    expect(result.bestRate).toBeDefined();
  });
});

describe('calcTotalInterest', () => {
  it('returns positive total interest for any standard bond', () => {
    const interest = calcTotalInterest(1_000_000, 11.25, 20);
    expect(interest).toBeGreaterThan(0);
  });

  it('lower rate means less total interest', () => {
    const high = calcTotalInterest(1_000_000, 13, 20);
    const low = calcTotalInterest(1_000_000, 10, 20);
    expect(low).toBeLessThan(high);
  });
});

describe('calcUpfrontCosts', () => {
  it('returns an object with duty, bondReg, transferFee, total', () => {
    const costs = calcUpfrontCosts(2_000_000, 1_800_000);
    expect(costs).toHaveProperty('duty');
    expect(costs).toHaveProperty('bondReg');
    expect(costs).toHaveProperty('transferFee');
    expect(costs).toHaveProperty('total');
  });

  it('total equals sum of components', () => {
    const { duty, bondReg, transferFee, total } = calcUpfrontCosts(2_000_000, 1_800_000);
    expect(total).toBeCloseTo(duty + bondReg + transferFee, 0);
  });
});
