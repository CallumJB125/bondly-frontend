import { Link } from 'react-router-dom';
import { CheckCircle, AlertCircle, Home, FileText, Banknote, Key, Calculator, ShieldCheck } from 'lucide-react';
import OriginationNav from '../../components/OriginationNav.jsx';
import './FirstTimeBuyerGuide.css';

/**
 * Plain-English guide for first-time SA home buyers.
 *
 * Audience: Thandi — 38, admin assistant, no prior experience with bonds,
 * vaguely understands interest, never heard of "prime" or "stress rate".
 *
 * Goal: 5-minute read that gets her from "I have no idea what any of this
 * means" to "OK I know what to expect and what to do next."
 *
 * Style: short sentences, no jargon without a definition, no marketing-speak,
 * no patronising tone. Use the actual SA numbers (transfer duty bands,
 * deposit ranges, prime/repo relationship) so it's actually useful.
 */
function MidCTA() {
  return (
    <div className="ftb-mid-cta">
      <Link to="/preapproval" className="ftb-mid-cta__btn">
        Ready? Start your free pre-approval →
      </Link>
    </div>
  );
}

export default function FirstTimeBuyerGuide() {
  return (
    <>
      <OriginationNav />
      <div className="ftb-page">
        <article className="ftb-article">

          <header className="ftb-header">
            <div className="ftb-eyebrow">5-minute guide · No jargon</div>
            <h1 className="ftb-title">Your first home loan — explained without the jargon.</h1>
            <p className="ftb-lede">
              Buying a home in South Africa for the first time? This is what nobody told you. We'll cover what you actually need, what banks really look at, how much extra money you'll need beyond the deposit, and what scary terms like "prime" and "stress rate" mean.
            </p>
            {/* Jump navigation */}
            <nav className="ftb-toc ftb-toc--prominent" aria-label="Jump to section">
              <p className="ftb-toc__label">In this guide:</p>
              <ol className="ftb-toc__list">
                <li><a href="#section-1">What a home loan is</a></li>
                <li><a href="#section-2">What banks look at</a></li>
                <li><a href="#section-3">Deposit &amp; hidden costs</a></li>
                <li><a href="#section-4">Prime, repo &amp; stress rate</a></li>
                <li><a href="#section-5">The whole process</a></li>
                <li><a href="#section-6">What Bondly does</a></li>
              </ol>
            </nav>
          </header>

          {/* ─── 1. What a home loan actually is */}
          <section id="section-1" className="ftb-section">
            <div className="ftb-section__num">1</div>
            <h2><Home size={20} /> What a home loan (bond) actually is</h2>
            <p>
              A bank lends you most of the money to buy a home. You agree to pay it back monthly, with interest, usually over 20 years. The bank owns a piece of the home until you finish paying. If you stop paying, they can sell the home.
            </p>
            <p>
              <strong>The word "bond" in South Africa means home loan.</strong> Same thing. The rest of the world says "mortgage". When you hear "bond originator" or "register the bond", they're talking about your home loan.
            </p>
          </section>

          {/* ─── 2. What banks actually look at */}
          <section id="section-2" className="ftb-section">
            <div className="ftb-section__num">2</div>
            <h2><FileText size={20} /> What banks actually look at</h2>
            <p>Banks decide how much they'll lend you based on three things:</p>
            <ul className="ftb-list">
              <li>
                <strong>Your monthly take-home pay</strong> — the income that arrives in your bank account, after tax. They'll want 3 to 6 months of payslips and bank statements as proof.
              </li>
              <li>
                <strong>Your existing monthly debts</strong> — credit card minimums, car finance, store accounts, student loans. Every rand you owe each month reduces how much they'll lend.
              </li>
              <li>
                <strong>Your credit record</strong> — a number out of 999 that summarises how reliably you've paid your bills in the past. You can check yours for free at <a href="https://www.mycreditcheck.co.za" target="_blank" rel="noopener noreferrer">MyCreditCheck</a> or Experian. Most banks want at least 600. Above 680 is good.
              </li>
            </ul>
            <div className="ftb-callout ftb-callout--ok">
              <CheckCircle size={18} />
              <div>
                <strong>The 30% rule.</strong> Your monthly repayment can't be more than 30% of your gross income, minus what you already owe each month. So on R 25 000/month income with R 2 000 of existing debt: max monthly bond ≈ 30% × 25 000 − 2 000 = R 5 500.
              </div>
            </div>
          </section>

          <MidCTA />

          {/* ─── 3. The deposit + the hidden costs */}
          <section id="section-3" className="ftb-section">
            <div className="ftb-section__num">3</div>
            <h2><Banknote size={20} /> The deposit — and the costs nobody warns you about</h2>
            <p>
              First-time buyers often get a 100% bond (no deposit needed), but a deposit of 10% usually gets you a better interest rate. That difference can mean R 400–R 800 less per month over 20 years.
            </p>
            <p>
              <strong>Beyond the deposit, you need cash for:</strong>
            </p>
            <ul className="ftb-list">
              <li>
                <strong>Transfer duty</strong> — a tax on buying a property.
                <em> Homes under R 1.21 million are exempt.</em> Above R 1.21m you pay between 3% and 13% of the price (the bands get steeper as the price goes up). On a R 1.5m home: about R 9 000.
              </li>
              <li>
                <strong>Bond registration fees</strong> (the lawyer who registers your bond at the deeds office) — roughly 1.2% of the bond plus R 5 000.
              </li>
              <li>
                <strong>Transfer attorney fees</strong> (the lawyer who transfers the property into your name) — roughly 1.4% of the price plus R 6 000.
              </li>
              <li>
                <strong>FICA documents</strong> — ID, proof of address, payslips, statements. Free, but expect to chase paperwork for a week.
              </li>
              <li>
                <strong>Moving + first-month costs</strong> — movers, utilities deposit, rates clearance.
              </li>
            </ul>
            <div className="ftb-callout ftb-callout--warn">
              <AlertCircle size={18} />
              <div>
                <strong>Quick maths for a R 1.5m home:</strong> 10% deposit (R 150k) + transfer duty (R 12k) + attorney fees (~R 47k) = <strong>R 209k cash</strong> you need before you move in. Without the deposit it's still about R 60k.
              </div>
            </div>
          </section>

          <MidCTA />

          {/* ─── 4. Prime, repo, stress rate — the rates explained */}
          <section id="section-4" className="ftb-section">
            <div className="ftb-section__num">4</div>
            <h2><Calculator size={20} /> Prime, repo, stress rate — what those numbers mean</h2>
            <p>
              These three numbers run South African home loans. Here's what each one actually is:
            </p>
            <dl className="ftb-defs">
              <div>
                <dt>Repo rate</dt>
                <dd>
                  The rate the <Link to="/glossary#sarb">SARB</Link> (our central bank) charges commercial banks to borrow money overnight. They change this every two months at their MPC meeting. When they cut it, your bond gets cheaper a few weeks later.
                </dd>
              </div>
              <div>
                <dt>Prime rate</dt>
                <dd>
                  The rate commercial banks charge their best customers. Always <strong>repo + 3.5%</strong>, by long-standing convention. So if repo is 7.50%, prime is 11.00%.
                </dd>
              </div>
              <div>
                <dt>Your bond rate</dt>
                <dd>
                  Quoted as <strong>prime plus or minus a spread</strong>. Strong credit + larger deposit can earn you prime − 0.5% (so 10.50% if prime is 11.00%). First-time buyers with smaller deposits usually pay prime + something. Each bank competes on this spread.
                </dd>
              </div>
              <div>
                <dt>Stress rate</dt>
                <dd>
                  When a bank decides whether you <em>qualify</em>, they assume rates will rise by 2 percentage points above prime — to make sure you can still afford the payments if rates go up. So your max bond is calculated at <strong>13.00%</strong> even though your actual repayments are based on your real, lower rate. This is why your qualifying bond is smaller than the bond your income would suggest.
                </dd>
              </div>
            </dl>
          </section>

          {/* ─── 5. The journey */}
          <section id="section-5" className="ftb-section">
            <div className="ftb-section__num">5</div>
            <h2><Key size={20} /> What the whole process looks like</h2>
            <ol className="ftb-process">
              <li>
                <strong>Get pre-approved.</strong> A bank (or Bondly) confirms how much you can borrow based on your finances. Takes a day. Free. <strong>Doesn't affect your credit score.</strong>
              </li>
              <li>
                <strong>House-hunt with confidence.</strong> Estate agents take you seriously when you have pre-approval in hand.
              </li>
              <li>
                <strong>Make an offer.</strong> Once accepted by the seller, you sign an "Offer to Purchase" (OTP) — this is a legal contract. <em>Read it. Or ask someone who reads them to read it.</em>
              </li>
              <li>
                <strong>Submit for the actual bond.</strong> The bank does its full credit check, valuation of the property, and the legal paperwork begins. Takes 4–8 weeks.
              </li>
              <li>
                <strong>Registration.</strong> Two sets of lawyers (yours and the bank's) do the paperwork at the deeds office. The bank pays the seller. You sign more papers than you've ever signed.
              </li>
              <li>
                <strong>You get the keys.</strong> First payment is usually 30–60 days after registration.
              </li>
            </ol>
          </section>

          <MidCTA />

          {/* ─── 6. What Bondly is */}
          <section id="section-6" className="ftb-section">
            <div className="ftb-section__num">6</div>
            <h2><ShieldCheck size={20} /> What Bondly does (and how we get paid)</h2>
            <p>Bondly is two things:</p>
            <ul className="ftb-list">
              <li>
                <strong>A comparison + preparation platform.</strong> You upload your bank statement, we analyse it the way a bank would, and we show you exactly what you qualify for. Free.
              </li>
              <li>
                <strong>A submission service via our partnered broker team.</strong> When you're ready, our team takes your application to the SA banks most likely to offer you the best rate. You hear back within 3–10 business days.
              </li>
            </ul>
            <p>
              <strong>How we get paid:</strong> The banks pay us a referral fee when an application completes through us. You never pay us directly, and the fee doesn't change your rate or terms in any way. You can also use Bondly purely as a comparison tool and apply to a bank directly yourself — that's entirely your choice.
            </p>
          </section>

          {/* CTAs */}
          <div className="ftb-ctas">
            <Link to="/mortgage-readiness" className="ftb-cta ftb-cta--primary">
              Check what I qualify for — free →
            </Link>
            <Link to="/glossary" className="ftb-cta ftb-cta--ghost">
              Browse the full glossary
            </Link>
          </div>

        </article>
      </div>
    </>
  );
}
