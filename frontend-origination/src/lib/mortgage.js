// Shared mortgage / bank qualification utilities
// Used by FinancesTab BankViewSubTab and FinancialFitnessTab

export const STRESS_RATE = 13.25;
export const LOAN_TERM = 240; // 20 years in months

export const BANK_PROFILES = [
  { name: 'Capitec',       minIncome: 3500,  maxDti: 0.36, salaryBoost: false },
  { name: 'ABSA',          minIncome: 5000,  maxDti: 0.28, salaryBoost: true  },
  { name: 'FNB',           minIncome: 6000,  maxDti: 0.28, salaryBoost: true  },
  { name: 'Standard Bank', minIncome: 5000,  maxDti: 0.28, salaryBoost: true  },
  { name: 'Nedbank',       minIncome: 5000,  maxDti: 0.30, salaryBoost: false },
  { name: 'SA Home Loans', minIncome: 5000,  maxDti: 0.30, salaryBoost: false },
  { name: 'Investec',      minIncome: 58000, maxDti: 0.25, salaryBoost: true  },
];

export function calcPvFactor() {
  const r = STRESS_RATE / 100 / 12;
  const n = LOAN_TERM;
  return (Math.pow(1 + r, n) - 1) / (r * Math.pow(1 + r, n));
}

export function calcMaxBond(income, debt) {
  return Math.round(Math.max(0, income * 0.30 - debt) * calcPvFactor());
}

export function bankLikelihood(income, dtiDecimal, employmentType) {
  return BANK_PROFILES.map(bank => {
    if (!income || income < bank.minIncome)
      return { ...bank, status: 'unlikely', reason: `Income below minimum (R ${bank.minIncome.toLocaleString('en-ZA')}/mo)` };
    const eDti = bank.salaryBoost && employmentType === 'salaried' ? dtiDecimal * 0.92 : dtiDecimal;
    if (eDti > bank.maxDti)
      return { ...bank, status: 'borderline', reason: `DTI ${(dtiDecimal * 100).toFixed(0)}% above their typical ${(bank.maxDti * 100).toFixed(0)}% cap` };
    if (eDti > bank.maxDti * 0.82)
      return { ...bank, status: 'possible', reason: 'DTI close to their limit — borderline case' };
    return { ...bank, status: 'likely', reason: 'Profile fits their typical criteria' };
  });
}
