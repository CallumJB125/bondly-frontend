import { describe, it, expect } from 'vitest';
import {
  calcMonthly,
  calcMaxBond,
  calcTransferDuty,
  calcSwapSavings,
  calcSavingsRange,
  calcRefinanceDecision,
  calcTotalInterest,
  calcUpfrontCosts,
  calcMonthsToPayoff,
  calcSwitchOutcomes,
  calcSwitchScore,
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
  // SARS 2025/26 table — 0% up to R1,210,000 (residential, after 1 April 2025)
  it('returns 0 for properties at or below the R1,210,000 threshold', () => {
    expect(calcTransferDuty(1_000_000)).toBe(0);
    expect(calcTransferDuty(1_210_000)).toBe(0);
  });

  it('applies 3% on value above R1,210,000 up to R1,663,800', () => {
    // R1.3M → (R1,300,000 - R1,210,000) * 3% = R2,700
    expect(calcTransferDuty(1_300_000)).toBeCloseTo(2_700, 0);
  });

  it('applies the 6% bracket with its cumulative base', () => {
    // R2M → R13,614 + (R2,000,000 - R1,663,800) * 6% = R33,786
    expect(calcTransferDuty(2_000_000)).toBeCloseTo(33_786, 0);
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

describe('calcSavingsRange', () => {
  it('returns a symmetric ±10% band snapped to R50', () => {
    const { low, high, point } = calcSavingsRange(1000);
    expect(low).toBe(900);   // 1000 * 0.90
    expect(high).toBe(1100); // 1000 * 1.10
    expect(point).toBe(1000);
  });

  it('snaps bounds to the nearest R50 step', () => {
    const { low, high } = calcSavingsRange(1013);
    expect(low % 50).toBe(0);
    expect(high % 50).toBe(0);
    expect(low).toBe(900);   // 911.7 → 900
    expect(high).toBe(1100); // 1114.3 → 1100
  });

  it('returns zeros for non-positive or invalid input', () => {
    expect(calcSavingsRange(0)).toEqual({ low: 0, high: 0, point: 0 });
    expect(calcSavingsRange(-500)).toEqual({ low: 0, high: 0, point: 0 });
    expect(calcSavingsRange(NaN)).toEqual({ low: 0, high: 0, point: 0 });
    expect(calcSavingsRange(undefined)).toEqual({ low: 0, high: 0, point: 0 });
  });

  it('low bound never exceeds the point estimate (never over-promises)', () => {
    for (const p of [250, 777, 1013, 5400]) {
      const { low } = calcSavingsRange(p);
      expect(low).toBeLessThanOrEqual(Math.round(p / 50) * 50 + 1);
    }
  });
});

describe('Landing ↔ Switch number agreement', () => {
  // Switch's computeOffers best bank sits at PRIME + 0.0 spread, i.e. "balance
  // at prime". Landing's estimate is calcSwapSavings(balance, currentRate,
  // prime, ...). For identical inputs and the SAME prime, both must produce the
  // same monthly saving — and therefore the same displayed range.
  const inlineSwitchBestSaving = (balance, currentRate, prime, termYears) => {
    const n = Math.max(1, Math.round(termYears * 12));
    const pay = (rate) => balance * (rate / 100 / 12) / (1 - Math.pow(1 + rate / 100 / 12, -n));
    return Math.round(pay(currentRate) - pay(prime)); // best offer = prime + 0.0
  };

  it('produces the same range on both screens for identical inputs', () => {
    const balance = 1_200_000, currentRate = 12.5, prime = 11.25, termYears = 18;
    const landingSaving = calcSwapSavings(balance, currentRate, prime, termYears * 12).monthlySaving;
    const switchSaving  = inlineSwitchBestSaving(balance, currentRate, prime, termYears);
    // Agree to the rand (rounding aside)
    expect(Math.abs(landingSaving - switchSaving)).toBeLessThanOrEqual(1);
    // And therefore agree on the displayed band
    expect(calcSavingsRange(landingSaving)).toEqual(calcSavingsRange(switchSaving));
  });

  it('agrees even when prime differs from the 11.25 constant (async-prime path)', () => {
    const balance = 950_000, currentRate = 13.0, prime = 10.75, termYears = 22;
    const landingSaving = calcSwapSavings(balance, currentRate, prime, termYears * 12).monthlySaving;
    const switchSaving  = inlineSwitchBestSaving(balance, currentRate, prime, termYears);
    expect(calcSavingsRange(landingSaving)).toEqual(calcSavingsRange(switchSaving));
  });

  it('calcSwitchOutcomes saving still matches the Landing reveal (saving vs prime)', () => {
    const balance = 1_200_000, currentRate = 12.5, prime = 11.25, termYears = 18;
    const landingSaving = calcSwapSavings(balance, currentRate, prime, termYears * 12).monthlySaving;
    const out = calcSwitchOutcomes(balance, currentRate, prime, termYears);
    expect(calcSavingsRange(landingSaving)).toEqual(calcSavingsRange(out.monthlySaving));
  });
});

describe('calcMonthsToPayoff', () => {
  it('paying the scheduled amount clears the bond in roughly the full term', () => {
    const balance = 1_000_000, rate = 11.25, term = 20;
    const scheduled = calcMonthly(balance, rate, term);
    const months = calcMonthsToPayoff(balance, rate, scheduled);
    expect(months).toBeGreaterThanOrEqual(239);
    expect(months).toBeLessThanOrEqual(241);
  });

  it('paying MORE than scheduled (the old higher payment) clears it sooner', () => {
    const balance = 1_000_000, term = 20;
    const oldPayment = calcMonthly(balance, 12.5, term); // higher than the new-rate payment
    expect(calcMonthsToPayoff(balance, 11.25, oldPayment)).toBeLessThan(240);
  });

  it('returns null when the payment cannot cover the monthly interest', () => {
    // R1M at 12% → ~R10 000/mo interest alone; R5 000 never amortises
    expect(calcMonthsToPayoff(1_000_000, 12, 5_000)).toBeNull();
  });

  it('handles a zero interest rate as simple division', () => {
    expect(calcMonthsToPayoff(120_000, 0, 10_000)).toBe(12);
  });
});

describe('calcSwitchOutcomes', () => {
  const balance = 1_200_000, currentRate = 12.5, newRate = 11.25, term = 18;
  const out = calcSwitchOutcomes(balance, currentRate, newRate, term);

  it('Path A — a lower rate lowers the monthly payment', () => {
    expect(out.newPayment).toBeLessThan(out.currentPayment);
    expect(out.monthlySaving).toBeCloseTo(out.currentPayment - out.newPayment, 5);
    expect(out.annualSaving).toBeCloseTo(out.monthlySaving * 12, 5);
    expect(out.lifetimeSaving).toBeCloseTo(out.monthlySaving * term * 12, 5);
  });

  it('Path B — keeping the same payment clears the bond sooner and saves interest', () => {
    expect(out.payoffMonths).toBeLessThan(out.termMonths);
    expect(out.monthsSaved).toBe(out.termMonths - out.payoffMonths);
    expect(out.interestSaved).toBeGreaterThan(0);
  });

  it('no rate gap → no saving, no time shaved off, no interest saved', () => {
    const flat = calcSwitchOutcomes(balance, 11.25, 11.25, term);
    expect(flat.monthlySaving).toBe(0);
    expect(flat.monthsSaved).toBe(0);
    expect(flat.interestSaved).toBe(0);
  });
});

describe('calcSwitchScore', () => {
  const base = { prime: 11.25, balance: 1_200_000, termYears: 18 };

  it('a competitive (at-prime) rate scores lower than a bloated rate', () => {
    const competitive = calcSwitchScore({ ...base, currentRate: 11.30 });
    const bloated     = calcSwitchScore({ ...base, currentRate: 14.00 });
    expect(competitive.score).toBeLessThan(bloated.score);
  });

  it('caps rate headroom at +2% so an unrealistic rate cannot run the score away', () => {
    const at2 = calcSwitchScore({ ...base, currentRate: 13.25 }); // +2.0
    const at5 = calcSwitchScore({ ...base, currentRate: 16.25 }); // +5.0
    const ptsOf = (s) => s.components.find(c => c.key === 'rate').points;
    expect(ptsOf(at2)).toBe(60);
    expect(ptsOf(at5)).toBe(60); // identical — the bloated portion is not scored
  });

  it('is built from inputs only — a bigger, longer bond scores higher at the same rate', () => {
    const small = calcSwitchScore({ currentRate: 12.5, prime: 11.25, balance: 300_000,   termYears: 5 });
    const large = calcSwitchScore({ currentRate: 12.5, prime: 11.25, balance: 1_500_000, termYears: 20 });
    expect(large.score).toBeGreaterThan(small.score);
  });

  it('never exceeds 97, even at absurd inputs', () => {
    const max = calcSwitchScore({ currentRate: 30, prime: 11.25, balance: 5_000_000, termYears: 30 });
    expect(max.score).toBeLessThanOrEqual(97);
  });

  it('component points sum to the displayed score (within rounding)', () => {
    const s = calcSwitchScore({ currentRate: 12.5, prime: 11.25, balance: 900_000, termYears: 18 });
    const sum = s.components.reduce((t, c) => t + c.points, 0);
    expect(Math.abs(sum - s.score)).toBeLessThanOrEqual(2);
  });
});
