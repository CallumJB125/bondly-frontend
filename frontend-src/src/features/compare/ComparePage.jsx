import { useEffect, useState } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import Button from '../../components/Button.jsx';
import './Compare.css';

const BANK_DATA = {
  absa: {
    name: 'ABSA',
    full: 'ABSA Home Loans',
    rateRange: 'Prime − 0.5% to Prime + 1.5%',
    bestFor: ['Salaried professionals', 'ABSA transactional clients', 'First-time buyers in Gauteng & Western Cape', 'Properties R600k–R3M'],
    strengths: ['Largest SA mortgage lender by volume', 'Competitive for well-qualified salaried applicants', 'Faster processing for existing ABSA clients', 'Strong first-time buyer support'],
    watch: 'Self-employed applicants may find stricter documentation requirements than at some competitors.',
  },
  fnb: {
    name: 'FNB',
    full: 'FNB Home Finance',
    rateRange: 'Prime − 0.5% to Prime + 1%',
    bestFor: ['High-income earners', 'Existing FNB banking clients', 'Buyers wanting linked savings accounts', 'Fast pre-approval timelines'],
    strengths: ['Among the fastest pre-approval turnaround in SA', 'Willing to match or beat competitor offers', 'Linked savings account can reduce effective rate', 'Strong digital experience'],
    watch: 'Rates can be less competitive for applicants without an existing FNB relationship.',
  },
  nedbank: {
    name: 'Nedbank',
    full: 'Nedbank Home Finance',
    rateRange: 'Prime − 0.5% to Prime + 1.5%',
    bestFor: ['Self-employed applicants', 'Mid-market bonds R800k–R2M', 'Buyers with smaller deposits', 'Commission earners'],
    strengths: ['More flexible underwriting for self-employed', 'Competitive in mid-market segment', 'Willing to consider lower deposit percentages for strong profiles'],
    watch: 'Turnaround time tends to be slightly slower than FNB or ABSA.',
  },
  'standard-bank': {
    name: 'Standard Bank',
    full: 'Standard Bank Home Loans',
    rateRange: 'Prime − 0.5% to Prime + 1.5%',
    bestFor: ['High-value properties R2M+', 'Existing Standard Bank business clients', 'Clients wanting interest rate linked to prime'],
    strengths: ['Very competitive for luxury properties', 'Strong relationship management for high-net-worth clients'],
    watch: 'Processing times tend to be longer. Less competitive for smaller bonds.',
  },
  capitec: {
    name: 'Capitec',
    full: 'Capitec Home Loans',
    rateRange: 'Prime to Prime + 1.5%',
    bestFor: ['Capitec bank account holders', 'Bonds under R1.5M', 'First-time buyers', 'Buyers without existing big-4 relationships'],
    strengths: ['Competitive pricing for Capitec clients', 'Simple, transparent process', 'Growing market share — increasingly competitive on rate'],
    watch: 'Less history in the mortgage market than the big-4 lenders. Rate floor typically higher than ABSA or FNB for top-tier profiles.',
  },
};

const COMPARISONS = {
  'absa-vs-fnb-home-loan': { a: 'absa', b: 'fnb',
    summary: "ABSA vs FNB is SA's most competitive home loan matchup. Both lend aggressively and can price at prime minus 0.5% for the right applicant. FNB tends to win on speed; ABSA tends to win on first-time buyer flexibility. The only reliable way to know which is better for your specific profile is to apply to both — which Bondly does automatically.",
    verdict: "For most salaried applicants, the final rate from ABSA and FNB will be within 0.25% of each other. The differentiator is usually your existing banking relationship, the specific property, and how you're packaged for submission." },
  'nedbank-vs-standard-bank': { a: 'nedbank', b: 'standard-bank',
    summary: "Nedbank and Standard Bank both compete strongly in the R1M–R3M segment. Nedbank has the edge for self-employed and commission earners; Standard Bank is stronger for high-value properties and business owners banking with them.",
    verdict: "For mid-market purchases, Nedbank is generally more flexible on documentation. For high-value properties, Standard Bank can be more competitive — but only when you have a relationship with them. Applying to both via Bondly costs you nothing." },
  'absa-vs-nedbank': { a: 'absa', b: 'nedbank',
    summary: "ABSA and Nedbank take different approaches to risk. ABSA is volume-focused and generally faster; Nedbank is more flexible on profile edge cases. For a typical salaried applicant with clean credit, ABSA will usually match or beat Nedbank on rate.",
    verdict: "If your credit is strong and income is straightforward, ABSA is usually the stronger starting point. If your situation is more complex — commission income, self-employed, or thin credit — Nedbank's more flexible underwriting gives you a better shot." },
  'fnb-vs-capitec-home-loan': { a: 'fnb', b: 'capitec',
    summary: "FNB vs Capitec represents the old guard vs the challenger. FNB has a longer track record and typically achieves lower rates for top-tier applicants. Capitec competes hard on simplicity and is closing the gap for standard applicants.",
    verdict: "For most applicants, FNB will produce a marginally better rate — but Capitec is worth including in any comparison. Their pricing has become increasingly competitive, especially for their own account holders." },
};

export default function ComparePage() {
  const { slug } = useParams();
  const comp = COMPARISONS[slug];

  const [liveRates, setLiveRates] = useState([]);

  useEffect(() => {
    fetch('/api/bank-rates')
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (j?.rates?.length) setLiveRates(j.rates); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!comp) return;
    const bankA = BANK_DATA[comp.a];
    const bankB = BANK_DATA[comp.b];
    const prev = document.title;
    document.title = `${bankA.name} vs ${bankB.name} Home Loan 2026 | Bondly`;
    return () => { document.title = prev; };
  }, [comp]);

  if (!comp) return <Navigate to="/" replace />;

  const bankA = BANK_DATA[comp.a];
  const bankB = BANK_DATA[comp.b];

  return (
    <div className="compare-page page">

      <section className="compare-hero">
        <div className="container container--narrow">
          <p className="compare-hero__kicker">Bank Comparison · South Africa 2026</p>
          <h1 className="compare-hero__title">{bankA.name} vs {bankB.name} Home Loan</h1>
          <p className="compare-hero__sub">{comp.summary}</p>
        </div>
      </section>

      <section className="compare-cards">
        <div className="container container--narrow">
          <div className="compare-cards__grid">
            {[bankA, bankB].map(bank => (
              <div key={bank.name} className="compare-card">
                <div className="compare-card__name">{bank.name}</div>
                <div className="compare-card__full">{bank.full}</div>
                <div className="compare-card__row">
                  <div className="compare-card__label">Rate range</div>
                  <div className="compare-card__val">{bank.rateRange}</div>
                </div>
                {liveRates.find(r => r.bank?.toLowerCase() === bank.name.toLowerCase())?.bestRate != null && (
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                    Current live rate: Prime − {liveRates.find(r => r.bank?.toLowerCase() === bank.name.toLowerCase()).baseRate.toFixed(2)}%
                  </p>
                )}
                <div className="compare-card__label" style={{ marginTop: 'var(--space-4)' }}>Best for</div>
                <ul className="compare-card__list">
                  {bank.bestFor.map(b => <li key={b}>{b}</li>)}
                </ul>
                <div className="compare-card__label" style={{ marginTop: 'var(--space-4)' }}>Strengths</div>
                <ul className="compare-card__list">
                  {bank.strengths.map(s => <li key={s}>{s}</li>)}
                </ul>
                {bank.watch && (
                  <div className="compare-card__watch">
                    <strong>Watch out:</strong> {bank.watch}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="compare-verdict">
        <div className="container container--narrow">
          <h2 className="compare-section__title">The verdict</h2>
          <p className="compare-verdict__body">{comp.verdict}</p>
          <div className="compare-verdict__cta">
            <div className="compare-verdict__cta-text">
              <strong>Why choose? Get quotes from both — and all 5 other SA banks — in one step.</strong>
              <span>Bondly submits to all 7 simultaneously. Free. No credit check to start.</span>
            </div>
            <Link to="/preapproval"><Button variant="lime">Compare my rate — free →</Button></Link>
          </div>
        </div>
      </section>

    </div>
  );
}
