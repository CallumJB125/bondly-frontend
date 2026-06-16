import { useState } from 'react';
import { Link } from 'react-router-dom';
import OriginationNav from '../../components/OriginationNav.jsx';
import './FAQ.css';

const FAQS = [
  {
    id: 'is-bondly-free',
    q: 'Is Bondly Home free to use?',
    a: 'Yes — completely free. We earn a referral fee from bank partners only when a bond application facilitated through our platform is successfully completed. That fee is paid by the bank and has no effect on the rate or terms you receive.',
  },
  {
    id: 'deposit-needed',
    q: 'Do I need a deposit to buy a home?',
    a: 'Not necessarily. South African banks offer 100% home loans (no deposit) to qualifying first-time buyers with a strong credit profile. However, a deposit of 10–20% improves your chances of approval and typically earns you a better interest rate, since the bank\'s risk is lower. Our affordability check shows you what\'s achievable in your situation.',
  },
  {
    id: 'credit-score',
    q: 'Will this affect my credit score?',
    a: 'No. Our affordability check and pre-qualification are a soft inquiry only — they do not appear on your credit report and will not affect your score. Only when you proceed to a formal pre-approval or bond application will a hard inquiry be made by the bank.',
  },
  {
    id: 'documents',
    q: 'What documents will I need?',
    a: 'For a pre-approval you\'ll typically need: a copy of your SA ID, your last 3 months\' payslips (or 6 months\' bank statements if self-employed), your last 3 months\' bank statements, and proof of address (e.g. a utility bill). You can upload these securely through Bondly Home and reuse them across multiple bank applications.',
  },
  {
    id: 'how-long',
    q: 'How long does the process take?',
    a: 'A pre-qualification takes about 2 minutes online. A formal pre-approval from a bank typically takes 3–5 business days once all documents are submitted. After signing an Offer to Purchase, full bond registration at the Deeds Office takes 6–10 weeks. We keep you updated at every step.',
  },
  {
    id: 'prequal-vs-preapproval',
    q: 'What is the difference between pre-qualification and pre-approval?',
    a: 'Pre-qualification is a quick, no-commitment affordability estimate based on your self-reported income and expenses — no credit check, no documents, done in minutes. Pre-approval is a formal bank assessment using your actual documents and a hard credit inquiry. A pre-approval letter is what sellers and agents take seriously when you make an offer on a property.',
  },
  {
    id: 'prime-rate-question',
    q: 'What is the prime rate and how does it affect my bond?',
    a: 'The prime lending rate is the benchmark rate SA banks use for home loans — currently 11.25% (early 2026). It sits 3.5% above the SARB repo rate. Most home loans are priced at prime minus a margin (e.g. prime − 0.5%). When the Reserve Bank cuts the repo rate, prime drops by the same amount and your monthly repayment decreases automatically.',
  },
  {
    id: 'transfer-duty',
    q: 'What is transfer duty and do I have to pay it?',
    a: 'Transfer duty is a government tax paid to SARS when purchasing property above R1,210,000 (2025/26 threshold). Properties below this threshold are fully exempt — great news for many first-time buyers. Above R1.21M, the rate scales progressively from 3% up to 13% on the highest bracket. It\'s a once-off cost paid before the Deeds Office registers the transfer.',
  },
  {
    id: 'self-employed',
    q: 'Can I apply if I am self-employed?',
    a: 'Yes. Banks assess self-employed applicants using 6–24 months of bank statements and, in some cases, 2 years of financial statements or tax returns. Income is assessed as an average of your deposits over the assessment period. Bondly Home\'s affordability check handles self-employed income — just select "self-employed" when prompted.',
  },
  {
    id: 'debt-review',
    q: 'What if I have existing debt?',
    a: 'Existing debt affects your debt-to-income (DTI) ratio, which banks use to assess affordability. A DTI above ~40% makes approval harder. However, each bank assesses differently and having a car payment or personal loan does not automatically disqualify you. Our affordability check calculates your DTI and shows you realistically what you can borrow.',
  },
  {
    id: 'what-is-otp',
    q: 'What is an Offer to Purchase (OTP)?',
    a: 'An OTP is the legally binding written agreement between you (the buyer) and the seller that sets out the purchase price, occupation date, and conditions — including a suspensive condition that the sale is subject to bond approval within a set period (usually 30–60 days). Once both parties sign, it is a binding contract. Never sign an OTP before you have at least a pre-qualification in hand.',
  },
  {
    id: 'linked-vs-fixed',
    q: 'Should I choose a linked or fixed interest rate?',
    a: 'Most SA home loans use a linked (variable) rate that moves with prime. A fixed rate locks your repayment for 1–3 years, giving certainty — but it is typically 1–2% higher than the linked rate and costs more if prime stays flat or drops. Fixed rates suit buyers who need absolute payment certainty; linked rates suit those who want to benefit from rate cuts. We recommend speaking to a qualified mortgage adviser for your specific situation.',
  },
  {
    id: 'popia',
    q: 'How does Bondly handle my personal information?',
    a: 'We comply fully with POPIA (Protection of Personal Information Act 4 of 2013). We collect only what is necessary, never sell your data, and share your information with banks only when you explicitly submit an application. You can read our full Privacy Policy for details on what we collect, why, and your rights.',
    link: { label: 'Read our Privacy Policy', to: '/privacy' },
  },
  {
    id: 'many-banks',
    q: 'Which banks does Bondly work with?',
    a: 'We work with all major South African home loan providers: ABSA, FNB, Nedbank, Standard Bank, Capitec, Investec, and SA Home Loans. By submitting one application through Bondly Home, your details can be assessed by multiple banks simultaneously — maximising your chance of approval at the best available rate.',
  },
];

const DEFAULT_OPEN = new Set(['is-bondly-free', 'deposit-needed', 'credit-score']);

export default function FAQ() {
  const [open, setOpen] = useState(DEFAULT_OPEN);

  function toggle(id) {
    setOpen(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="faq-page">
      <OriginationNav />

      <div className="faq-wrap">
        <div className="faq-header">
          <h1 className="faq-title">Frequently Asked Questions</h1>
          <p className="faq-subtitle">Everything first-home buyers need to know about getting a bond in South Africa.</p>
        </div>

        <div className="faq-list">
          {FAQS.map(item => {
            const isOpen = open.has(item.id);
            return (
              <div key={item.id} id={item.id} className={`faq-item${isOpen ? ' faq-item--open' : ''}`}>
                <button
                  className="faq-item__q"
                  onClick={() => toggle(item.id)}
                  aria-expanded={isOpen}
                >
                  <span>{item.q}</span>
                  <span className="faq-item__chevron" aria-hidden="true">{isOpen ? '−' : '+'}</span>
                </button>
                {isOpen && (
                  <div className="faq-item__a">
                    <p>{item.a}</p>
                    {item.link && (
                      <Link to={item.link.to} className="faq-item__link">{item.link.label} →</Link>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="faq-cta">
          <h2>Ready to find out what you can afford?</h2>
          <p>Our 2-minute affordability check is free and won't affect your credit score.</p>
          <div className="faq-cta__actions">
            <Link to="/mortgage-readiness" className="btn btn--primary">Check affordability</Link>
            <Link to="/preapproval" className="btn btn--ghost">Start pre-approval →</Link>
          </div>
          <p className="faq-cta__glossary">
            Unfamiliar with a term? See our <Link to="/glossary">Home Loan Glossary</Link>.
          </p>
        </div>
      </div>

      <footer className="faq-footer">
        <p>© 2026 Bondly (Pty) Ltd · <Link to="/terms">Terms</Link> · <Link to="/privacy">Privacy</Link></p>
      </footer>
    </div>
  );
}
