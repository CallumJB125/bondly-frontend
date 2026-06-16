import { PRIME_RATE, STRESS_RATE } from './constants.js';

// ── Monthly repayment (PMT) ───────────────────────────────
// rate: annual %, amount: rand, termYears: years
export function calcMonthly(amount, ratePercent, termYears) {
  const r = ratePercent / 100 / 12;
  const n = termYears * 12;
  if (r === 0) return amount / n;
  return amount * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

// ── Max bond from monthly payment ────────────────────────
export function calcMaxBond(monthlyPayment, ratePercent, termYears) {
  const r = ratePercent / 100 / 12;
  const n = termYears * 12;
  if (r === 0) return monthlyPayment * n;
  return monthlyPayment * (Math.pow(1 + r, n) - 1) / (r * Math.pow(1 + r, n));
}

// ── Transfer duty (SARS 2025/26 tables) ──────────────────
// Applies to residential properties sold after 1 April 2025
export function calcTransferDuty(price) {
  if (price <= 1_210_000)  return 0;
  if (price <= 1_663_800)  return (price - 1_210_000) * 0.03;
  if (price <= 2_329_300)  return 13_614 + (price - 1_663_800) * 0.06;
  if (price <= 2_994_800)  return 53_544 + (price - 2_329_300) * 0.08;
  if (price <= 13_310_000) return 106_784 + (price - 2_994_800) * 0.11;
  return 1_241_456 + (price - 13_310_000) * 0.13;
}

// ── Bond registration + transfer attorney estimate ────────
export function calcUpfrontCosts(price, bondAmount) {
  const duty = calcTransferDuty(price);
  const bondReg = Math.round(bondAmount * 0.012 + 5_000);
  const transferFee = Math.round(price * 0.014 + 6_000);
  return {
    duty,
    bondReg,
    transferFee,
    total: Math.round(duty + bondReg + transferFee),
  };
}

// ── Amortisation schedule ─────────────────────────────────
export function calcAmortSchedule(principal, ratePercent, termYears, extraMonthly = 0) {
  const r = ratePercent / 100 / 12;
  const n = termYears * 12;
  const basePayment = calcMonthly(principal, ratePercent, termYears);
  const payment = basePayment + extraMonthly;

  let bal = principal;
  const rows = [];
  let month = 0;

  while (bal > 0.01 && month < n + 12) {
    month++;
    const interest = bal * r;
    const principal_paid = Math.min(payment - interest, bal);
    bal = Math.max(0, bal - principal_paid);
    rows.push({
      month,
      payment: principal_paid + interest,
      principal: principal_paid,
      interest,
      balance: bal,
    });
  }

  return rows;
}

// ── Total interest paid ───────────────────────────────────
export function calcTotalInterest(principal, ratePercent, termYears) {
  const monthly = calcMonthly(principal, ratePercent, termYears);
  return monthly * termYears * 12 - principal;
}

// ── Affordability check ───────────────────────────────────
// SA NCA method: max bond repayment = 30% of gross income minus existing debt.
// Banks qualify at a stress rate (prime + 2%) to account for future rate hikes.
// Monthly repayment shown at current prime rate.
export function calcAffordability(income, price, deposit = 0, debt = 0, termYears = 20) {
  const maxMonthly = Math.max(0, income * 0.30 - debt);
  // Qualify at stress rate — conservative, matches SA bank underwriting
  const sr = STRESS_RATE / 100 / 12;
  const n  = termYears * 12;
  const maxBond = maxMonthly * (Math.pow(1 + sr, n) - 1) / (sr * Math.pow(1 + sr, n));
  const bondAmt = Math.max(0, price - deposit);
  const monthly = bondAmt > 0 ? calcMonthly(bondAmt, PRIME_RATE, termYears) : 0;
  const canAfford = bondAmt <= maxBond;
  const borderline = bondAmt > maxBond * 0.85;
  const depositNeeded = Math.max(0, Math.round(price - maxBond));
  const costs = calcUpfrontCosts(price, bondAmt);

  const dtiRatio = income > 0 ? (debt + monthly) / income : 1;
  const ltv      = price > 0 ? bondAmt / price : 1;
  let confidence;
  if (!canAfford) {
    confidence = 'Low';
  } else if (borderline || dtiRatio > 0.30 || ltv > 0.90) {
    confidence = 'Medium';
  } else {
    confidence = 'High';
  }

  return { maxBond, bondAmt, monthly, canAfford, borderline, depositNeeded, costs, maxMonthly, stressRate: STRESS_RATE, confidence };
}

// ── Equity tracker ────────────────────────────────────────
export function calcEquity(purchasePrice, originalBalance, ratePercent, termYears, monthsElapsed, appreciation = 0.06) {
  const schedule = calcAmortSchedule(originalBalance, ratePercent, termYears);
  const row = schedule[Math.min(monthsElapsed - 1, schedule.length - 1)];
  const currentBalance = row?.balance ?? originalBalance;
  const currentValue = purchasePrice * Math.pow(1 + appreciation, monthsElapsed / 12);
  const equity = currentValue - currentBalance;
  return { currentValue, currentBalance, equity, equityPct: equity / currentValue };
}

// ── Swap savings ──────────────────────────────────────────
// SA bond switching costs: registration (attorney + deeds, scales with balance) +
// initiation fee (NCA cap) + cancellation notice fee.
export function calcSwitchingCosts(balance) {
  const registrationFee = Math.round(8000 + balance * 0.008);
  const initiationFee   = 6325;
  const cancellationFee = 3750;
  return { registrationFee, initiationFee, cancellationFee, total: registrationFee + initiationFee + cancellationFee };
}

export function calcSwapSavings(balance, currentRate, newRate, termRemaining) {
  const currentMonthly = calcMonthly(balance, currentRate, termRemaining / 12);
  const newMonthly     = calcMonthly(balance, newRate,     termRemaining / 12);
  const monthlySaving  = currentMonthly - newMonthly;
  const totalSaving    = monthlySaving * termRemaining;
  return { currentMonthly, newMonthly, monthlySaving, totalSaving };
}

// ── Refinance Decision Engine ─────────────────────────────
// Returns: { recommendation, reason, breakEvenMonths, annualSaving, bestBank, bestRate }
// recommendation: 'SWITCH_NOW' | 'SWITCH_SOON' | 'WAIT' | 'NO_BENEFIT'
// termMonths: remaining months on the bond
export function calcRefinanceDecision(balance, currentRate, termMonths, bankSpreads, primeRate) {
  const bestBankEntry = Object.entries(bankSpreads)
    .map(([bank, spread]) => ({ bank, rate: primeRate + spread }))
    .sort((a, b) => a.rate - b.rate)[0];

  if (!bestBankEntry || currentRate <= bestBankEntry.rate + 0.1) {
    return { recommendation: 'NO_BENEFIT', reason: 'You are already on a competitive rate.', breakEvenMonths: null, annualSaving: 0, bestBank: bestBankEntry?.bank, bestRate: bestBankEntry?.rate };
  }

  const savings = calcSwapSavings(balance, currentRate, bestBankEntry.rate, termMonths);
  const monthlySaving = savings.monthlySaving;

  if (monthlySaving < 100) {
    return { recommendation: 'NO_BENEFIT', reason: 'Potential saving is too small to justify switching costs.', breakEvenMonths: null, annualSaving: Math.round(monthlySaving * 12), bestBank: bestBankEntry.bank, bestRate: bestBankEntry.rate };
  }

  // Estimated switching costs (all figures are estimates):
  //   Bond cancellation attorney: ~R3,000–R4,500 (flat fee, varies by attorney)
  //   New bond registration: ~1.2% of bond value + base fee
  //   Admin / deeds office: ~R500
  const switchCost    = Math.round(balance * 0.012 + 5000 + balance * 0.005 + 3500);
  const breakEven     = Math.ceil(switchCost / monthlySaving);
  const annualSaving  = Math.round(monthlySaving * 12);

  // Don't recommend switching if break-even is beyond remaining term
  if (breakEven >= termMonths) {
    return {
      recommendation: 'NO_BENEFIT',
      reason: `Switching costs won't be recovered within your remaining term (${Math.round(termMonths / 12)} years).`,
      breakEvenMonths: breakEven, annualSaving, bestBank: bestBankEntry.bank, bestRate: bestBankEntry.rate,
      monthlySaving: Math.round(monthlySaving), switchCost,
    };
  }

  let recommendation, reason;
  if (breakEven <= 18) {
    recommendation = 'SWITCH_NOW';
    reason = `You'll recover switching costs in ~${breakEven} months — well worth it.`;
  } else if (breakEven <= 36) {
    recommendation = 'SWITCH_SOON';
    reason = `Break-even in ~${breakEven} months — consider switching if you plan to stay in the property.`;
  } else {
    recommendation = 'WAIT';
    reason = `Break-even is ~${breakEven} months. Monitor rates and switch when the gap widens.`;
  }

  return { recommendation, reason, breakEvenMonths: breakEven, annualSaving, bestBank: bestBankEntry.bank, bestRate: bestBankEntry.rate, monthlySaving: Math.round(monthlySaving), switchCost };
}

// ── Equity forecast ───────────────────────────────────────
// Returns array of { year, balance, propertyValue, equity, equityPct } for each year
// ASSUMPTIONS (all are estimates):
//   - Interest rate remains constant at ratePercent (no future rate changes modelled)
//   - Property appreciation: conservative 4% | base 6.5% | optimistic 9% per year
//   - No extra payments, fees, or levies included
//   - Location and property-specific factors not modelled
export function calcEquityForecast(purchasePrice, originalBalance, ratePercent, termYears, monthsElapsed, yearsAhead = 10) {
  const schedule = calcAmortSchedule(originalBalance, ratePercent, termYears);
  const scenarios = { conservative: 0.04, base: 0.065, optimistic: 0.09 };
  const result = {};
  for (const [name, appreciation] of Object.entries(scenarios)) {
    result[name] = [];
    for (let y = 0; y <= yearsAhead; y++) {
      const month = Math.min(monthsElapsed + y * 12, schedule.length - 1);
      const balance = schedule[month]?.balance ?? 0;
      const propVal = purchasePrice * Math.pow(1 + appreciation, (monthsElapsed + y * 12) / 12);
      const equity  = Math.max(0, propVal - balance);
      result[name].push({ year: y, balance: Math.round(balance), propertyValue: Math.round(propVal), equity: Math.round(equity), equityPct: Math.round(equity / propVal * 100) });
    }
  }
  return result;
}
