import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Button from '../../components/Button.jsx';
import './FAQ.css';

// ── Data ──────────────────────────────────────────────────────────────────────
const FAQS = [
  {
    category: 'General',
    items: [
      {
        id: 'is-bondly-free',
        q: 'Is Bondly really free?',
        a: 'Yes — completely. Bondly is free for homeowners at every step. We earn a referral fee from the bank when a switch or application completes through our platform — you never pay us directly.',
        body: <><p>Yes — completely. Bondly is free for homeowners at every step. We earn a referral fee from the bank when a switch or application completes through our platform. You never pay us anything directly, and our fee doesn't affect your rate or terms in any way.</p></>,
        cta: { text: 'See how Bondly works →', to: '/#how-it-works' },
        related: ['who-is-bondly-for', 'what-is-bond-originator'],
      },
      {
        id: 'who-is-bondly-for',
        q: 'Who is Bondly for?',
        a: 'Bondly is for South African homeowners and first-time buyers. We help you understand what you qualify for, improve your financial profile if you don\'t qualify yet, and then submit your application to lenders via our broker team.',
        body: <><p>Bondly is for South African homeowners and first-time buyers. If you already have a home loan, we estimate whether switching to another bank could save you money, and our broker team handles the application.</p><p>If you're buying your first (or next) home, we analyse your finances the way a bank would, show you what you currently qualify for, and (when you're ready) take your application to the lenders we believe will offer you the best rate. Typically 3–5 of the major SA banks — not a magic simultaneous submission to all 7.</p></>,
        cta: { text: 'Check what you qualify for →', to: '/preapproval' },
        related: ['is-bondly-free', 'which-banks'],
      },
      {
        id: 'is-bondly-registered',
        q: 'Is Bondly registered?',
        a: 'Yes. Bondly is a comparison and referral platform operating in full compliance with POPIA. Applications are processed by our partner bond originator.',
        body: <><p>Yes. Bondly is a <strong>comparison and referral platform</strong> operating in full compliance with <Link to="/glossary#popia">POPIA</Link>. Your application is submitted by our partner bond originator, who holds the required regulatory registrations.</p></>,
        related: ['data-safe', 'popia'],
      },
      {
        id: 'what-is-bond-originator',
        q: 'What is a bond originator? Is Bondly one?',
        a: 'A bond originator is an FSCA-registered intermediary that submits home loan applications to banks on a borrower\'s behalf. When you submit an application through Bondly, our partnered broker team takes it to lenders for you. We are also a comparison and preparation platform — so you understand exactly what you qualify for before submitting.',
        body: <><p>A <Link to="/glossary#bond-originator">bond originator</Link> is an FSCA-licensed financial intermediary that submits home loan applications to banks on a borrower's behalf. They are regulated under the Financial Advisory and Intermediary Services Act (FAIS).</p><p>Bondly combines two things:</p><ul><li><strong>A comparison and preparation platform</strong> — you upload your bank statement, we analyse it the way a bank would, and we show you exactly what you qualify for and what (if anything) is holding you back.</li><li><strong>A submission service via our partnered broker team</strong> — when you're ready, our team takes your application to the lenders most likely to offer you the best rate (typically 3–5 of the major SA banks). You hear back within 3–10 business days.</li></ul><p>You can also use Bondly purely as a comparison tool and apply to a bank directly — that's entirely your choice.</p></>,
        cta: { text: 'See what banks will offer →', to: '/preapproval' },
        related: ['is-bondly-free', 'which-banks'],
      },
    ],
  },
  {
    category: 'First-Time Buyers',
    items: [
      {
        id: 'credit-score',
        q: 'What credit score do I need for a home loan?',
        a: 'Most banks require a minimum score of 600–620, though a score above 680 significantly improves your chances and the rate you\'ll be offered.',
        body: <><p>Most banks require a minimum score of <strong>600–620</strong>, though a score above <strong>680</strong> significantly improves your approval chances and the rate you'll be offered. You can check your score for free via <a href="https://www.mycreditcheck.co.za" target="_blank" rel="noopener noreferrer">MyCreditCheck</a> or Experian.</p><p>If your score is below 600, our advisors can guide you on improving it before applying — this is often a 3–6 month process worth doing properly.</p></>,
        cta: { text: 'Check your affordability →', to: '/preapproval' },
        related: ['deposit-needed', 'credit-check'],
      },
      {
        id: 'deposit-needed',
        q: 'How much deposit do I need?',
        a: 'Most banks require 10–20% of the purchase price, though some first-time buyer programmes accept 0%. A larger deposit reduces your monthly repayment and usually secures a better rate.',
        body: <><p>Most banks require a deposit of <strong>10–20%</strong> of the purchase price, though some first-time buyer programmes accept as little as 0% for qualifying applicants with excellent credit.</p><p>A larger deposit reduces your monthly repayment and usually secures a better interest rate. On a R1.5M property, a 10% deposit (R150,000) could save you R400–R600 per month compared to a 0% deposit.</p></>,
        related: ['credit-score', 'what-documents'],
      },
      {
        id: 'prequal-vs-preapproval',
        q: "What's the difference between pre-qualification and pre-approval?",
        a: 'Pre-qualification is a quick estimate (no credit check) based on your stated income. Pre-approval is a formal bank assessment with a credit inquiry — it gives you a guaranteed approval amount valid for 90 days.',
        body: <><p><strong>Pre-qualification</strong> (like Bondly's 2-minute check) is a quick affordability estimate based on your stated income — no credit check, no commitment, no impact on your credit score. It gives you a ballpark figure.</p><p><strong>Pre-approval</strong> is a formal assessment by the bank with a credit inquiry and document review. It produces a guaranteed approval letter valid for 90 days, which sellers and estate agents take seriously as proof you can buy.</p></>,
        cta: { text: 'Get pre-approved →', to: '/preapproval' },
        related: ['credit-check', 'how-long-preapproval'],
      },
      {
        id: 'self-employed',
        q: "Can I apply if I'm self-employed or a freelancer?",
        a: 'Yes. Self-employed applicants need 2 years of audited financials plus 6 months of business and personal bank statements. We know which banks are most flexible for variable income profiles.',
        body: <><p>Yes. Self-employed applicants typically need <strong>2 years of audited financials</strong> (or SARS-assessed management accounts) plus 6 months of business and personal bank statements.</p><p>Banks assess your average monthly income over 24 months, which can work against freelancers with variable income — but some banks are more flexible than others. We show you the most suitable bank offers for your profile first.</p></>,
        cta: { text: 'Talk to an advisor →', href: 'mailto:hello@bondly.co.za' },
        related: ['what-documents', 'how-long-preapproval'],
      },
      {
        id: 'what-is-otp',
        q: 'What is an OTP (Offer to Purchase)?',
        a: 'An OTP is a legally binding agreement between you and the seller setting out the purchase price, conditions, and timeline. Once signed, you typically have 30–60 days to secure your home loan.',
        body: <><p>An <Link to="/glossary#otp">OTP (Offer to Purchase)</Link> is a legally binding agreement between you and the seller that sets out the purchase price, conditions, and timeline. Once both parties sign, you typically have a fixed window of <strong>30–60 days</strong> to secure your home loan.</p><p>Use Bondly to compare bank offers immediately when you share your signed OTP — starting the clock on that window as early as possible.</p></>,
        related: ['what-documents', 'what-is-conveyancer'],
      },
    ],
  },
  {
    category: 'Applications & Approvals',
    items: [
      {
        id: 'credit-check',
        q: 'Does checking affect my credit score?',
        a: 'No. The Bondly pre-qualification is a soft check that doesn\'t appear on your credit record. When applications go through our platform formally, they go to all banks in a single batch — which counts as one inquiry under NCA rules.',
        body: <><p>No. The Bondly pre-qualification is a <strong>soft enquiry</strong> — it doesn't appear on your credit record and has no impact on your score.</p><p>When you proceed, our partner bond originator submits your application to multiple banks in a single batch. Under <Link to="/glossary#nca">NCA rules</Link>, this counts as <strong>one credit inquiry</strong>, not one per bank — protecting your score regardless of how many banks are approached.</p></>,
        related: ['credit-score', 'prequal-vs-preapproval'],
      },
      {
        id: 'how-long-preapproval',
        q: 'How long does pre-approval take?',
        a: 'Bondly\'s online pre-qualification takes under 2 minutes. A formal bank pre-approval letter typically takes 1–3 business days after document submission.',
        body: <><p>Bondly's online pre-qualification takes under <strong>2 minutes</strong>.</p><p>A formal bank pre-approval letter with guaranteed figures typically takes <strong>1–3 business days</strong> once you've uploaded your supporting documents. Our advisors follow up with banks daily to keep your application moving and flag any issues early.</p></>,
        cta: { text: 'Start your 2-minute check →', to: '/preapproval' },
        related: ['what-documents', 'self-employed'],
      },
      {
        id: 'what-documents',
        q: 'What documents do I need?',
        a: 'You\'ll need: last 3 months\' payslips, last 3 months\' bank statements (which also serve as your proof of address), and a copy of your ID. Self-employed applicants also need 2 years\' financials.',
        body: <><p>For a formal application you'll need:</p><ul><li>Last 3 months' payslips</li><li>Last 3 months' bank statements <em>— these also count as your proof of address, so no separate utility bill is needed</em></li><li>Copy of your ID (green bar-coded or smart ID card)</li><li>Signed OTP (for property purchases)</li><li><em>Self-employed only:</em> 2 years' audited financials + 6 months' business statements</li></ul></>,
        related: ['self-employed', 'how-long-preapproval'],
      },
      {
        id: 'which-banks',
        q: 'Which banks does Bondly work with?',
        a: 'We work with all 7 major SA mortgage providers: ABSA, FNB, Nedbank, Standard Bank, Capitec, Investec, and SA Home Loans.',
        body: <><p>Compare offers from up to 7 major SA mortgage providers: <strong>ABSA, FNB, Nedbank, Standard Bank, Capitec, Investec,</strong> and <strong>SA Home Loans</strong>.</p><p>Comparing offers from multiple banks means they compete for your bond — which is how you get the best rate rather than one bank's take-it-or-leave-it offer. Your application goes via our partner bond originator.</p></>,
        cta: { text: 'Compare rates →', to: '/tools' },
        related: ['is-bondly-free', 'how-long-preapproval'],
      },
      {
        id: 'after-submit',
        q: 'What happens after I submit my application?',
        a: 'Your Bondly advisor tracks your application daily. Banks typically issue an approval in principle within 3–5 business days, followed by a formal grant letter.',
        body: <><p>Once submitted, your Bondly advisor tracks your application daily and keeps you updated via email and SMS. Here's what to expect:</p><ul><li><strong>Days 1–5:</strong> Banks assess your application and issue an approval in principle</li><li><strong>Days 5–10:</strong> Formal grant letters issued with confirmed rates</li><li><strong>Weeks 2–4:</strong> Bond registration at the Deeds Office (handled by the bank's attorney)</li><li><strong>Transfer:</strong> Your <Link to="/glossary#conveyancer">conveyancer</Link> finalises the property transfer</li></ul></>,
        related: ['how-long-preapproval', 'what-is-conveyancer'],
      },
      {
        id: 'what-is-conveyancer',
        q: 'What does a conveyancer do?',
        a: 'A conveyancer is a specialist attorney who handles the legal transfer of property. They register the bond at the Deeds Office and ensure the title deed is issued in your name.',
        body: <><p>A <Link to="/glossary#conveyancer">conveyancer</Link> is a specialist attorney who handles the legal transfer of property from seller to buyer. They:</p><ul><li>Register the bond at the <Link to="/glossary#deeds-office">Deeds Office</Link></li><li>Calculate and collect transfer duties and fees</li><li>Ensure the title deed is issued in your name</li><li>Coordinate between buyer, seller, and both banks</li></ul><p>The bank appoints the bond attorney (for the new bond); you or the seller typically appoint the transfer attorney.</p></>,
        related: ['what-is-otp', 'switching-costs'],
      },
    ],
  },
  {
    category: 'Switching & Saving',
    items: [
      {
        id: 'how-long-switch',
        q: 'How long does a bond switch take?',
        a: 'The full process typically takes 4–8 weeks: 1–2 weeks for bank approval, 2–3 weeks for bond registration, and 1 week for cancellation of the old bond.',
        body: <><p>The full process typically takes <strong>4–8 weeks</strong> from application to final transfer:</p><ul><li><strong>Week 1–2:</strong> New bank assesses and approves your application</li><li><strong>Week 2–4:</strong> Bond registration at the <Link to="/glossary#deeds-office">Deeds Office</Link></li><li><strong>Week 4–8:</strong> Old bond cancelled and transfer completed</li></ul><p>Our advisors chase all parties throughout — you don't need to follow up with anyone yourself.</p></>,
        related: ['switching-costs', 'arrears'],
      },
      {
        id: 'switching-costs',
        q: 'Are there costs to switch?',
        a: 'Yes — typically R8,000–R20,000 depending on bond size (registration fees and cancellation penalty). Bondly calculates your break-even point first. If savings don\'t cover costs within 18 months, we\'ll tell you not to switch.',
        body: <><p>Yes. Typical switching costs are <strong>R8,000–R20,000</strong> depending on your bond size, and include:</p><ul><li><strong>Bond registration fees:</strong> paid once to the new bank's attorney (varies by bond size)</li><li><strong>Cancellation penalty:</strong> 90 days' notice (or 3 months' interest) to your current bank — see <Link to="/glossary#cancellation-notice">cancellation notice</Link></li></ul><p><strong>Bondly always calculates your break-even point before recommending a switch.</strong> If your monthly saving won't recover the switching costs within 18 months, we'll advise you not to switch.</p></>,
        cta: { text: 'Calculate my break-even →', to: '/' },
        related: ['how-much-save', 'how-long-switch'],
      },
      {
        id: 'how-much-save',
        q: 'How much could I save by switching?',
        a: 'On a R1.2M bond at 11.25% (prime), a 0.5% rate reduction saves approximately R700–R900/month — that\'s up to R108,000 over 10 years.',
        body: <><p>It depends on your current rate vs the best rate available for your risk profile. As a guide:</p><ul><li><strong>R800k bond, 0.5% rate cut:</strong> ~R450/month saving</li><li><strong>R1.2M bond, 0.5% rate cut:</strong> ~R700–R900/month saving</li><li><strong>R2M bond, 0.5% rate cut:</strong> ~R1,100/month saving</li></ul><p>That 0.5% cut on a R1.2M bond is worth up to <strong>R108,000 over 10 years</strong>. Enter your details in our calculator for a precise number.</p></>,
        cta: { text: 'Calculate my saving →', to: '/' },
        related: ['switching-costs', 'prime-rate-question'],
      },
      {
        id: 'arrears',
        q: "Can I switch if I'm in arrears?",
        a: 'Generally no — banks won\'t approve a new bond if you have missed payments on the existing one. You\'ll need 3–6 months of clean payments first.',
        body: <><p>Generally no. Banks conduct a full credit and repayment history check as part of the switch assessment, and missed payments will result in a decline.</p><p>You'll typically need <strong>3–6 months of clean consecutive payments</strong> on your current bond before switching becomes viable. If you're struggling with repayments, contact your current bank first to discuss a payment holiday or restructure — this protects your credit record while you stabilise.</p></>,
        related: ['credit-score', 'how-long-switch'],
      },
      {
        id: 'reset-term',
        q: 'Does switching reset my bond term?',
        a: 'Only if you choose to. You can keep your remaining term (e.g. 17 years stays 17 years) or reset to 20 years for lower monthly payments — at the cost of more interest overall.',
        body: <><p>Only if you choose to. When you switch, you have two options:</p><ul><li><strong>Keep remaining term</strong> (e.g. 17 years stays 17 years) — you pay less total interest but your monthly saving is slightly smaller</li><li><strong>Reset to 20 years</strong> — gives you the maximum monthly payment reduction, but you pay more interest over the full term</li></ul><p>Your Bondly advisor will show you both scenarios with exact numbers so you can decide what makes sense for your situation.</p></>,
        related: ['how-much-save', 'switching-costs'],
      },
      {
        id: 'equity-release',
        q: 'Can I access my equity when I switch?',
        a: 'Yes. If your property has increased in value, you can borrow against that equity when switching. Banks typically allow up to 80% LTV — useful for renovations or investments.',
        body: <><p>Yes. If your property has increased in value since you bought it, you can borrow against that <Link to="/glossary#equity">equity</Link> when switching — effectively taking cash out of your property.</p><p>Banks typically allow up to <strong>80% <Link to="/glossary#ltv">LTV</Link></strong> (loan-to-value). For example, if your property is worth R2M and your outstanding bond is R900k, you could access up to R700k in equity.</p><p>This is useful for renovations or investments, but it increases your bond balance and monthly repayment — weigh the cost carefully.</p></>,
        related: ['switching-costs', 'reset-term'],
      },
      {
        id: 'cancellation-notice',
        q: 'What is bond cancellation notice?',
        a: 'When switching, you must give your current bank 90 days\' notice of cancellation (required by the NCA). Bondly shows you how to send the 90-day notice (template provided).',
        body: <><p>When you switch banks, the <Link to="/glossary#nca">NCA</Link> requires you to give your current bank <strong>90 days' notice of cancellation</strong>. If you don't give proper notice, you pay 3 months' interest as a penalty on top of normal switching costs.</p><p>Bondly provides a cancellation notice template and instructions so you can send it the moment you decide to switch — so the clock starts immediately and you never accidentally incur this penalty.</p></>,
        related: ['switching-costs', 'how-long-switch'],
      },
    ],
  },
  {
    category: 'Rates & Costs',
    items: [
      {
        id: 'prime-rate-question',
        q: 'What is the prime rate and how does it affect my bond?',
        a: 'The prime rate is the benchmark lending rate set by SA banks, currently 11.25%. Most home loans are quoted as prime + or prime −. When the SARB cuts rates, your monthly repayment drops automatically.',
        body: <><p>The <Link to="/glossary#prime-rate">prime rate</Link> is the standard lending rate used by South African banks — currently <strong>11.25%</strong> (early 2026). It's set by the major banks and tracks the SARB repo rate.</p><p>Most SA home loans are quoted as <em>prime + x%</em> or <em>prime − x%</em>. When the SARB cuts the repo rate, your home loan repayment drops automatically — no action needed. A 0.25% cut on a R1.2M bond saves approximately <strong>R175/month</strong>.</p></>,
        cta: { text: 'Track rates →', to: '/tools' },
        related: ['linked-vs-fixed', 'how-much-save'],
      },
      {
        id: 'linked-vs-fixed',
        q: 'What is a linked (variable) rate vs a fixed rate?',
        a: 'Linked rate moves with prime — you benefit when rates drop. Fixed rate stays the same for 1–3 years regardless of prime. Fixed rates are typically 1–2% higher. In the current rate-cutting cycle, most advisors recommend staying variable.',
        body: <><p><strong>Linked (variable) rate:</strong> your rate moves up and down with the <Link to="/glossary#prime-rate">prime rate</Link>. The majority of SA home loans are linked — you automatically benefit from SARB rate cuts.</p><p><strong>Fixed rate:</strong> locked for a set period (typically 1–3 years) regardless of what prime does. Fixed rates are usually <strong>1–2% higher</strong> than variable to compensate for the certainty.</p><p>In the current rate-cutting cycle (2025–2026), most advisors recommend staying on a linked rate so you benefit from cuts as they come.</p></>,
        related: ['prime-rate-question', 'how-much-save'],
      },
      {
        id: 'bond-insurance',
        q: 'What is bond insurance and is it compulsory?',
        a: 'Banks require homeowner\'s insurance (covers the structure — compulsory) and life cover (pays off the bond if you die — usually required). You\'re not obligated to buy these from the bank — your own policy is often cheaper.',
        body: <><p>Banks require two types of insurance:</p><ul><li><strong>Homeowner's insurance:</strong> covers the structure against fire, flood, theft. This is compulsory — but you can use any registered insurer, not just the bank's product.</li><li><strong>Bond protection / life cover:</strong> pays off the bond if you die or become disabled. Technically required by most banks, but you can substitute your own life policy.</li></ul><p>Shopping around for your own insurance policies can save <strong>R300–R1,500/month</strong> compared to the bank's embedded products.</p></>,
        related: ['switching-costs', 'bank-fees'],
      },
      {
        id: 'bank-fees',
        q: 'What fees does a bank charge on a home loan?',
        a: 'Typical fees include a monthly service fee (R50–R150), an initiation fee (up to R6,900 — often negotiable directly with the bank), and bond registration costs paid once at registration.',
        body: <><p>Typical bank fees on a home loan include:</p><ul><li><strong>Monthly service fee:</strong> R50–R150/month</li><li><strong>Initiation fee:</strong> up to R6,900 (paid once — initiation fees are often negotiable directly with your bank; our comparison shows you which banks are willing to reduce or waive it)</li><li><strong>Bond registration costs:</strong> paid once at registration, calculated on bond size (R15k–R40k range)</li><li><strong>Valuation fee:</strong> R1,500–R3,000 (some banks waive this)</li></ul><p>These fees are factored into Bondly's total cost calculation when comparing bank offers.</p></>,
        related: ['switching-costs', 'which-banks'],
      },
      {
        id: 'transfer-duty',
        q: 'What is transfer duty and who pays it?',
        a: 'Transfer duty is a tax paid to SARS by the buyer when purchasing property above R1,100,000. Properties below this threshold are exempt. The rate scales from 3% to 13% depending on the purchase price.',
        body: <><p><Link to="/glossary#transfer-duty">Transfer duty</Link> is a tax paid by the <strong>buyer</strong> to SARS on property purchases above <strong>R1,100,000</strong> (2024/25 threshold). Properties below this are exempt.</p><p>The rate scales: 3% on the portion between R1.1M–R1.512M, rising to 13% above R2.297M. On a R2M property, transfer duty is approximately <strong>R44,000</strong>. This is separate from bond registration costs and is payable before transfer can be registered.</p></>,
        related: ['bank-fees', 'what-is-conveyancer'],
      },
    ],
  },
  {
    category: 'Privacy & Security',
    items: [
      {
        id: 'data-safe',
        q: 'Is my data safe?',
        a: 'Yes. All data is encrypted in transit and at rest. We never sell your data to third parties. You can delete your account and all data at any time from your profile settings.',
        body: <><p>Yes. All data is encrypted in transit (TLS 1.3) and at rest. We never sell your data to third parties or use it for any purpose beyond processing your application and improving the platform.</p><p>You can delete your account and all associated data at any time from your <Link to="/profile">profile settings</Link>. We respond to deletion requests within 5 business days as required by <Link to="/glossary#popia">POPIA</Link>.</p></>,
        cta: { text: 'Read our Privacy Policy →', href: '/privacy' },
        related: ['popia', 'is-bondly-registered'],
      },
      {
        id: 'popia',
        q: 'What does POPIA mean for me?',
        a: 'POPIA is South Africa\'s data privacy law. You have the right to access, correct, and delete your personal data. Email privacy@bondly.co.za to exercise any of these rights.',
        body: <><p><Link to="/glossary#popia">POPIA</Link> (Protection of Personal Information Act) is South Africa's data privacy law, similar to Europe's GDPR. Under it, you have the right to:</p><ul><li>Know what personal data Bondly holds about you</li><li>Access and receive a copy of your data</li><li>Correct inaccurate information</li><li>Object to processing for certain purposes</li><li>Request deletion of your data</li></ul><p>To exercise any of these rights, email <a href="mailto:privacy@bondly.co.za">privacy@bondly.co.za</a>. We respond within 5 business days.</p></>,
        related: ['data-safe', 'is-bondly-registered'],
      },
    ],
  },
];

// ── Schema markup ─────────────────────────────────────────────────────────────
function FaqSchema() {
  const all = FAQS.flatMap(s => s.items);
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: all.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

// ── Search bar ────────────────────────────────────────────────────────────────
function SearchBar({ value, onChange }) {
  return (
    <div className="faq-search">
      <svg className="faq-search__icon" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <input
        type="search"
        className="faq-search__input"
        placeholder="Search questions…"
        value={value}
        onChange={e => onChange(e.target.value)}
        aria-label="Search FAQ"
      />
      {value && (
        <button className="faq-search__clear" onClick={() => onChange('')} aria-label="Clear search">✕</button>
      )}
    </div>
  );
}

// ── FAQ item ──────────────────────────────────────────────────────────────────
function FaqItem({ item, isOpen, onToggle, allItems, onRelatedClick }) {
  const ref = useRef(null);

  const [helpful, setHelpful] = useState(() => {
    try { return JSON.parse(localStorage.getItem('faq_helpful') || '{}')[item.id] || null; } catch { return null; }
  });

  function vote(v) {
    if (helpful) return;
    setHelpful(v);
    try {
      const store = JSON.parse(localStorage.getItem('faq_helpful') || '{}');
      store[item.id] = v;
      localStorage.setItem('faq_helpful', JSON.stringify(store));
    } catch {}
  }

  const relatedItems = (item.related || [])
    .map(id => allItems.find(i => i.id === id))
    .filter(Boolean);

  return (
    <div className={`faq-item ${isOpen ? 'faq-item--open' : ''}`} id={item.id} ref={ref}>
      <button
        className="faq-item__q"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={`faq-body-${item.id}`}
      >
        <span>{item.q}</span>
        <span className="faq-item__chevron" aria-hidden="true">
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </span>
      </button>

      {isOpen && (
        <div className="faq-item__body" id={`faq-body-${item.id}`}>
          <div className="faq-item__answer">{item.body}</div>

          {item.cta && (
            <div className="faq-item__cta">
              {item.cta.to ? (
                <Link to={item.cta.to} className="faq-item__cta-link">{item.cta.text}</Link>
              ) : (
                <a href={item.cta.href} className="faq-item__cta-link">{item.cta.text}</a>
              )}
            </div>
          )}

          {relatedItems.length > 0 && (
            <div className="faq-item__related">
              <span className="faq-item__related-label">Related questions</span>
              <div className="faq-item__related-chips">
                {relatedItems.map(r => (
                  <button key={r.id} className="faq-item__chip" onClick={() => onRelatedClick(r.id)}>
                    {r.q}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="faq-item__helpful">
            <span className="faq-item__helpful-label">Was this helpful?</span>
            <button
              className={`faq-item__helpful-btn ${helpful === 'yes' ? 'faq-item__helpful-btn--yes' : ''}`}
              onClick={() => vote('yes')}
              aria-label="Yes, this was helpful"
              disabled={!!helpful}
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
              Yes
            </button>
            <button
              className={`faq-item__helpful-btn ${helpful === 'no' ? 'faq-item__helpful-btn--no' : ''}`}
              onClick={() => vote('no')}
              aria-label="No, this wasn't helpful"
              disabled={!!helpful}
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z"/><path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg>
              No
            </button>
            {helpful && <span className="faq-item__helpful-thanks">Thanks for the feedback</span>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function FAQ() {
  const location = useLocation();
  const [search, setSearch]   = useState('');
  const [openIds, setOpenIds] = useState(new Set(['is-bondly-free', 'credit-check', 'how-long-switch']));

  // Deep-link: auto-open and scroll to #hash on load
  useEffect(() => {
    const hash = location.hash.slice(1);
    if (!hash) return;
    setOpenIds(prev => new Set([...prev, hash]));
    setTimeout(() => {
      document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 120);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function toggle(id) {
    setOpenIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function openRelated(id) {
    setOpenIds(prev => new Set([...prev, id]));
    setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  }

  const allItems = FAQS.flatMap(s => s.items);
  const q = search.trim().toLowerCase();
  const filtered = q
    ? FAQS
        .map(s => ({ ...s, items: s.items.filter(i => i.q.toLowerCase().includes(q) || i.a.toLowerCase().includes(q)) }))
        .filter(s => s.items.length > 0)
    : FAQS;

  const totalQ = allItems.length;

  return (
    <div className="page faq-page">
      <FaqSchema />

      <div className="container container--narrow">

        <div className="faq-header">
          <Link to="/" className="btn btn--ghost btn--sm">← Back to Home</Link>
          <h1 className="faq-title">Frequently Asked Questions</h1>
          <p className="faq-subtitle">{totalQ} questions about home loans, switching, and Bondly — answered.</p>
          <SearchBar value={search} onChange={setSearch} />
        </div>

        {filtered.length === 0 ? (
          <div className="faq-no-results">
            <p>No questions match <strong>"{search}"</strong>.</p>
            <p>Try different keywords, or <a href="mailto:hello@bondly.co.za">email us directly</a> — we'll answer within 24 hours.</p>
          </div>
        ) : (
          filtered.map(section => (
            <div key={section.category} className="faq-section">
              <h2 className="faq-section__title">{section.category}</h2>
              {section.items.map(item => (
                <FaqItem
                  key={item.id}
                  item={item}
                  isOpen={openIds.has(item.id)}
                  onToggle={() => toggle(item.id)}
                  allItems={allItems}
                  onRelatedClick={openRelated}
                />
              ))}
            </div>
          ))
        )}

        <div className="faq-glossary-callout">
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
          <span>New to home loan jargon?</span>
          <Link to="/glossary">Browse the full glossary →</Link>
        </div>

        <div className="faq-cta">
          <h3>Still have questions?</h3>
          <p>Our team is here to help. Get in touch and we'll respond within 24 hours.</p>
          <div className="faq-cta__actions">
            <a href="mailto:hello@bondly.co.za">
              <Button variant="forest">Email us</Button>
            </a>
            <Link to="/preapproval">
              <Button variant="lime">Check what I qualify for →</Button>
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
