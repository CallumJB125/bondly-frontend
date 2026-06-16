import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import OriginationNav from '../../components/OriginationNav.jsx';
import './Glossary.css';

const TERMS = [
  {
    id: 'bond-originator',
    term: 'Bond Originator',
    definition: 'A licensed financial intermediary (registered under FAIS) that submits home loan applications to multiple banks on a borrower\'s behalf and negotiates rates. They earn a referral fee from the bank, so the service is free to you. Bondly Home is not a bond originator — we are a comparison platform that helps you understand your options and prepare before you apply directly.',
    related: [{ label: 'Is Bondly free?', to: '/faq#is-bondly-free' }],
  },
  {
    id: 'bond-registration',
    term: 'Bond Registration',
    definition: 'The legal process of registering a new mortgage bond at the Deeds Office. This is done by the bank\'s appointed attorney and gives the bank a legal security interest in your property. Bond registration costs are a once-off fee paid at the time of purchase — they typically range from R15,000 to R40,000 depending on the bond size.',
    related: [{ label: 'What is transfer duty?', to: '/faq#transfer-duty' }],
  },
  {
    id: 'conveyancer',
    term: 'Conveyancer',
    definition: 'A specialist attorney admitted to practice conveyancing, responsible for the legal transfer of ownership of property from one party to another. They lodge the transfer documents at the Deeds Office, collect transfer duty on behalf of SARS, and ensure the title deed is registered in the buyer\'s name. There are typically two conveyancers in a property transaction: the transfer attorney (appointed by the seller) and the bond attorney (appointed by the bank).',
    related: [{ label: 'What is transfer duty?', to: '/faq#transfer-duty' }],
  },
  {
    id: 'deeds-office',
    term: 'Deeds Office',
    definition: 'The South African government office that maintains a public register of all land and property ownership (the deeds registry). All property transfers and bond registrations must be lodged and approved here before they become legally effective. Processing typically takes 2–3 weeks. There are 10 Deeds Offices across South Africa, each covering a specific region.',
  },
  {
    id: 'deposit',
    term: 'Deposit',
    definition: 'The portion of the purchase price you pay upfront from your own funds, not from the bank loan. SA banks typically require 10% deposit for first-time buyers, though 100% bonds (no deposit) are available to qualifying applicants. A larger deposit means a smaller bond, lower monthly repayments, and often a better interest rate from the bank.',
    related: [{ label: 'Do I need a deposit?', to: '/faq#deposit-needed' }],
  },
  {
    id: 'dti',
    term: 'DTI — Debt-to-Income Ratio',
    definition: 'The percentage of your gross monthly income that goes towards debt repayments (home loan, car, credit cards, store accounts, personal loans). Banks use this to assess affordability. A DTI above 40–45% significantly reduces your chance of approval. For example, if you earn R30,000/month and have R12,000 in debt repayments, your DTI is 40%.',
    related: [{ label: 'Check your affordability', to: '/mortgage-readiness' }],
  },
  {
    id: 'equity',
    term: 'Equity',
    definition: 'The difference between your property\'s current market value and the outstanding balance on your home loan. If your property is worth R2,000,000 and you owe R900,000 on your bond, your equity is R1,100,000. Equity grows as you pay down your bond and as property values increase.',
  },
  {
    id: 'fixed-rate',
    term: 'Fixed Interest Rate',
    definition: 'A home loan interest rate that is locked at a set percentage for a fixed period (typically 1–3 years), regardless of what the prime rate does. Fixed rates are usually 1–2% higher than variable rates because the bank absorbs the risk of rate changes. After the fixed period, the rate reverts to a linked (variable) rate.',
    related: [{ label: 'Linked vs fixed rate', to: '/faq#linked-vs-fixed' }],
  },
  {
    id: 'fsca',
    term: 'FSCA — Financial Sector Conduct Authority',
    definition: 'South Africa\'s market conduct regulator for financial institutions and financial service providers. The FSCA ensures that financial products and services are marketed and sold in a way that is fair and transparent to consumers. All bond originators must operate under an FSP licensed by the FSCA.',
  },
  {
    id: 'linked-rate',
    term: 'Linked (Variable) Rate',
    definition: 'A home loan interest rate that moves up and down in line with the prime lending rate, which is itself tied to the SARB repo rate. Most South African home loans are on a linked rate. When the Reserve Bank cuts rates, your repayment automatically drops. Linked rates are typically expressed as prime + x% or prime − x%.',
    related: [{ label: 'Linked vs fixed rate', to: '/faq#linked-vs-fixed' }],
  },
  {
    id: 'ltv',
    term: 'LTV — Loan-to-Value Ratio',
    definition: 'The ratio of your home loan amount to the appraised value (or purchase price) of the property, expressed as a percentage. If you borrow R900,000 on a R1,000,000 property, your LTV is 90%. A lower LTV means less risk for the bank, which usually results in a better interest rate. Most SA banks lend up to 100% LTV for qualifying first-time buyers.',
    related: [{ label: 'Do I need a deposit?', to: '/faq#deposit-needed' }],
  },
  {
    id: 'nca',
    term: 'NCA — National Credit Act',
    definition: 'South Africa\'s primary consumer credit legislation (Act 34 of 2005). The NCA governs how credit — including home loans — can be offered, granted, and enforced. Key provisions include affordability assessment requirements (banks must verify you can afford what they lend) and your rights if you fall into arrears (debt review and restructuring protections).',
  },
  {
    id: 'otp',
    term: 'OTP — Offer to Purchase',
    definition: 'A legally binding written agreement between a buyer and seller setting out the terms of a property sale — purchase price, occupation date, suspensive conditions (e.g. subject to bond approval), and any inclusions or exclusions. Once both parties sign the OTP, it becomes a binding contract. The buyer typically has 30–60 days to satisfy the bond approval condition before the sale lapses.',
    related: [{ label: 'What is an OTP?', to: '/faq#what-is-otp' }],
  },
  {
    id: 'popia',
    term: 'POPIA — Protection of Personal Information Act',
    definition: 'South Africa\'s data privacy law (Act 4 of 2013), which came into full effect in July 2021. POPIA regulates how organisations collect, store, process, and share personal information. It gives individuals the right to access their data, correct it, object to processing, and request deletion. South Africa\'s equivalent of Europe\'s GDPR.',
    related: [{ label: 'Our Privacy Policy', to: '/privacy' }],
  },
  {
    id: 'pre-approval',
    term: 'Pre-Approval',
    definition: 'A formal written commitment from a bank confirming how much they will lend you, based on a full assessment of your credit record, income, and expenses. A pre-approval letter is valid for 90 days and is taken seriously by sellers and estate agents as proof of buying ability. It requires a hard credit inquiry. Distinct from pre-qualification, which is a quick estimate with no formal assessment.',
    related: [{ label: 'Start your pre-approval', to: '/preapproval' }],
  },
  {
    id: 'pre-qualification',
    term: 'Pre-Qualification',
    definition: 'A quick affordability estimate based on self-reported income and expenses, with no formal credit check. Bondly Home\'s 2-minute online pre-qualification gives you an indicative bond amount and monthly repayment figure. It is not a binding bank offer and does not impact your credit score. The next step after pre-qualification is a formal pre-approval with supporting documents.',
    related: [{ label: 'Start your pre-qualification', to: '/preapproval' }],
  },
  {
    id: 'prime-rate',
    term: 'Prime Lending Rate',
    definition: 'The benchmark interest rate used by South African banks for home loans and other lending products, currently 11.25% (early 2026). The prime rate is set by the major banks and is always 3.5 percentage points above the South African Reserve Bank (SARB) repo rate. Most home loans are priced at prime + or prime − a margin (e.g. prime − 0.5% = 10.75%). When the SARB changes the repo rate, prime moves by the same amount.',
    related: [{ label: 'How prime affects your bond', to: '/faq#prime-rate-question' }],
  },
  {
    id: 'sarb',
    term: 'SARB — South African Reserve Bank',
    definition: 'South Africa\'s central bank, responsible for monetary policy, financial stability, and setting the repo rate. The SARB\'s Monetary Policy Committee (MPC) meets every two months to decide whether to raise, cut, or hold the repo rate. Because the prime lending rate is always 3.5% above the repo rate, any SARB decision directly affects every variable-rate home loan in the country.',
    related: [{ label: 'Prime lending rate', to: '/glossary#prime-rate' }],
  },
  {
    id: 'transfer-duty',
    term: 'Transfer Duty',
    definition: 'A government tax paid by the buyer to SARS when purchasing property above R1,210,000 (2025/26 threshold — properties below this are exempt). The rate is progressive, scaling from 3% on the portion between R1.21M and R1.663M, up to 13% above R13.31M. Transfer duty must be paid before a property transfer can be registered at the Deeds Office. It is distinct from bond registration costs and conveyancing fees.',
    related: [{ label: 'What is transfer duty?', to: '/faq#transfer-duty' }],
  },
];

const ALPHABET = [...new Set(TERMS.map(t => t.term[0].toUpperCase()))].sort();
const byLetter = ALPHABET.reduce((acc, letter) => {
  acc[letter] = TERMS.filter(t => t.term[0].toUpperCase() === letter);
  return acc;
}, {});

export default function Glossary() {
  const location = useLocation();

  useEffect(() => {
    document.title = 'Mortgage Glossary | Bondly Home';
    return () => { document.title = 'Bondly Home | Get Your First Home Loan in South Africa'; };
  }, []);

  useEffect(() => {
    const hash = location.hash.slice(1);
    if (!hash) return;
    setTimeout(() => {
      document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 120);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="glossary-page">
      <OriginationNav />
      <header className="glossary-mini-header">
        <Link to="/" className="glossary-mini-header__logo">Bondly Home</Link>
      </header>

      <div className="glossary-wrap">
        <div className="glossary-header">
          <Link to="/faq" className="btn btn--ghost btn--sm">← Back to FAQ</Link>
          <h1 className="glossary-title">Home Loan Glossary</h1>
          <p className="glossary-subtitle">Plain-English definitions for every term you'll encounter on your home loan journey.</p>
        </div>

        <nav className="glossary-nav" aria-label="Jump to letter">
          {ALPHABET.map(letter => (
            <a key={letter} href={`#letter-${letter}`} className="glossary-nav__letter">{letter}</a>
          ))}
        </nav>

        {ALPHABET.map(letter => (
          <div key={letter} className="glossary-group" id={`letter-${letter}`}>
            <div className="glossary-group__letter" aria-hidden="true">{letter}</div>
            {byLetter[letter].map(term => (
              <div key={term.id} id={term.id} className="glossary-term">
                <h2 className="glossary-term__name">{term.term}</h2>
                <p className="glossary-term__def">{term.definition}</p>
                {term.related && term.related.length > 0 && (
                  <div className="glossary-term__related">
                    {term.related.map(r => (
                      <Link key={r.to} to={r.to} className="glossary-term__link">
                        {r.label} →
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}

        <div className="glossary-cta">
          <p>Have a question that's not covered here?</p>
          <div className="glossary-cta__actions">
            <Link to="/faq" className="btn btn--ghost btn--sm">Back to FAQ</Link>
            <a href="mailto:hello@bondly.co.za" className="btn btn--lime btn--sm">Email us →</a>
          </div>
        </div>
      </div>

      <footer className="glossary-footer">
        <p>© 2026 Bondly (Pty) Ltd · <Link to="/terms">Terms</Link> · <Link to="/privacy">Privacy</Link></p>
      </footer>
    </div>
  );
}
