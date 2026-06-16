import { describe, it, expect } from 'vitest';
import { fmt, fmtShort, fmtPct, fmtDate, fmtMonthYear, parseNum } from '../format.js';

describe('fmt', () => {
  it('formats a whole number as R with thousand separators', () => {
    expect(fmt(1234567)).toBe('R 1 234 567');
  });

  it('rounds decimals to nearest integer', () => {
    expect(fmt(1000.7)).toBe('R 1 001');
    expect(fmt(1000.3)).toBe('R 1 000');
  });

  it('returns R 0 for null', () => {
    expect(fmt(null)).toBe('R 0');
  });

  it('returns R 0 for NaN', () => {
    expect(fmt(NaN)).toBe('R 0');
  });

  it('handles zero', () => {
    expect(fmt(0)).toBe('R 0');
  });
});

describe('fmtShort', () => {
  it('formats millions with M suffix', () => {
    expect(fmtShort(1_500_000)).toBe('R 1.5M');
    expect(fmtShort(2_000_000)).toBe('R 2.0M');
  });

  it('formats thousands with k suffix', () => {
    expect(fmtShort(500_000)).toBe('R 500k');
    expect(fmtShort(1_000)).toBe('R 1k');
  });

  it('formats small values as plain Rands', () => {
    expect(fmtShort(500)).toBe('R 500');
  });

  it('returns R 0 for null', () => {
    expect(fmtShort(null)).toBe('R 0');
  });
});

describe('fmtPct', () => {
  it('formats a percentage with 2 decimal places by default', () => {
    expect(fmtPct(11.25)).toBe('11.25%');
  });

  it('respects custom decimal count', () => {
    expect(fmtPct(11.25, 0)).toBe('11%');
    expect(fmtPct(11.255, 1)).toBe('11.3%');
  });

  it('returns 0% for null or NaN', () => {
    expect(fmtPct(null)).toBe('0%');
    expect(fmtPct(NaN)).toBe('0%');
  });

  it('ends with %', () => {
    expect(fmtPct(5)).toMatch(/%$/);
  });
});

describe('fmtDate', () => {
  it('returns empty string for falsy input', () => {
    expect(fmtDate(null)).toBe('');
    expect(fmtDate('')).toBe('');
  });

  it('formats a valid ISO date string', () => {
    const result = fmtDate('2025-01-15');
    expect(result).toMatch(/Jan/);
    expect(result).toMatch(/2025/);
  });

  it('returns a non-empty string for a valid date', () => {
    expect(fmtDate('2024-06-01').length).toBeGreaterThan(0);
  });
});

describe('fmtMonthYear', () => {
  it('returns empty string for falsy input', () => {
    expect(fmtMonthYear('')).toBe('');
  });

  it('formats to month and year only', () => {
    const result = fmtMonthYear('2025-03-01');
    expect(result).toMatch(/Mar/);
    expect(result).toMatch(/2025/);
  });
});

describe('parseNum', () => {
  it('parses a plain number string', () => {
    expect(parseNum('1234')).toBe(1234);
  });

  it('strips currency symbols and spaces', () => {
    expect(parseNum('R 1 234 567')).toBeCloseTo(1234567, 0);
  });

  it('parses decimals', () => {
    expect(parseNum('11.25')).toBe(11.25);
  });

  it('returns fallback for non-numeric strings', () => {
    expect(parseNum('abc', 0)).toBe(0);
    expect(parseNum('', -1)).toBe(-1);
  });

  it('returns fallback for null/undefined', () => {
    expect(parseNum(null, 99)).toBe(99);
  });

  it('handles negative numbers', () => {
    expect(parseNum('-500')).toBe(-500);
  });
});
