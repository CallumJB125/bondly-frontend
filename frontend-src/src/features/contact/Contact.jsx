import { useState, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { track, trackAction } from '@bondly/ui/lib/session.js';
import LandingNav from '../landing/LandingNav.jsx';
import './Contact.css';

// Env-aware sister-product URL (Bondly Home / origination), mirroring the
// pattern used across the app (Nav.jsx, Landing.jsx, LandingNav.jsx).
const ORIGINATION_URL = typeof window !== 'undefined'
  ? (import.meta.env?.VITE_ORIGINATION_URL || 'http://localhost:5174')
  : 'http://localhost:5174';

// Real contact endpoints already used elsewhere in the app (App.jsx WhatsApp FAB).
const WA_NUMBER = '27796971786';
const WA_MSG    = encodeURIComponent("Hi, I'd like to know more about switching my bond with Bondly");
const WA_HREF   = `https://wa.me/${WA_NUMBER}?text=${WA_MSG}`;
const TEL_HREF  = 'tel:+27796971786';
const MAIL_HREF = 'mailto:hello@bondly.co.za';

// ─────────────────────────────────────────────────────────────
// CHANNELS — the different ways to reach Bondly, as on-brand cards.
// Inline SVG glyphs (currentColor) per the Visual Asset Protocol —
// never a generated image for a functional channel icon.
// ─────────────────────────────────────────────────────────────
const CHANNELS = [
  {
    key: 'whatsapp',
    href: WA_HREF,
    external: true,
    label: 'WhatsApp',
    value: '+27 79 697 1786',
    hint: 'Fastest reply · usually within minutes',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M17.47 14.38c-.3-.15-1.76-.86-2.03-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.26-.47-2.39-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.62.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2-1.41.25-.7.25-1.29.18-1.41-.07-.13-.27-.2-.57-.35M12.05 21.79h-.01a9.86 9.86 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26C2.16 6.45 6.6 2 12.05 2c2.64 0 5.12 1.03 6.99 2.9a9.82 9.82 0 0 1 2.89 6.99c0 5.45-4.43 9.89-9.88 9.89M20.46 3.49A11.81 11.81 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.9 11.9 0 0 0 5.69 1.45h.01c6.55 0 11.89-5.34 11.89-11.89a11.82 11.82 0 0 0-3.49-8.42" />
      </svg>
    ),
  },
  {
    key: 'phone',
    href: TEL_HREF,
    label: 'Call us',
    value: '+27 79 697 1786',
    hint: 'Weekdays 08:00 – 18:00 SAST',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M6.5 3.5h3l1.5 4-2 1.5a12 12 0 0 0 5.5 5.5l1.5-2 4 1.5v3a2 2 0 0 1-2 2A16 16 0 0 1 4.5 5.5a2 2 0 0 1 2-2Z"
          stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    key: 'email',
    href: MAIL_HREF,
    label: 'Email',
    value: 'hello@bondly.co.za',
    hint: 'We reply within one business day',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="5" width="18" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
        <path d="m4 7 8 6 8-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

// ─────────────────────────────────────────────────────────────
// HERO + CONTACT FORM
// ─────────────────────────────────────────────────────────────
function Hero() {
  const [name, setName]       = useState('');
  const [email, setEmail]     = useState('');
  const [topic, setTopic]     = useState('Switching my bond');
  const [message, setMessage] = useState('');
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState('');

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const formValid  = name.trim().length > 1 && emailValid && message.trim().length > 4;

  function onSubmit(e) {
    e.preventDefault();
    setError('');
    if (!formValid) {
      setError('Please add your name, a valid email and a short message.');
      return;
    }
    // Non-functional local submit — design demo. Records intent for analytics.
    trackAction('contact_form_submitted', { topic, hasMessage: message.trim().length > 0 });
    setSent(true);
  }

  return (
    <header className="ct-hero">
      <div className="ls-wrap ct-hero__grid">
        <div className="ct-hero__copy">
          <div className="ls-eyebrow">Talk to a real human</div>
          <h1 className="ls-serif ct-hero__title">
            Have a question? <em>We're listening.</em>
          </h1>
          <p className="ct-hero__sub">
            Switching a bond is a big decision. Ask us anything — about your rate, the process, or
            whether it's even worth it. No call centres, no scripts, no pressure.
          </p>

          <div className="ct-channels" aria-label="Other ways to reach Bondly">
            {CHANNELS.map((c) => (
              <a
                key={c.key}
                className="ct-channel"
                href={c.href}
                {...(c.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                onClick={() => trackAction('contact_channel_clicked', { channel: c.key })}
              >
                <span className="ct-channel__icon" aria-hidden="true">{c.icon}</span>
                <span className="ct-channel__body">
                  <span className="ct-channel__label">{c.label}</span>
                  <span className="ct-channel__value">{c.value}</span>
                  <span className="ct-channel__hint">{c.hint}</span>
                </span>
                <span className="ct-channel__arrow" aria-hidden="true">→</span>
              </a>
            ))}
          </div>
        </div>

        {/* Contact form card — mirrors the landing calculator card chrome */}
        <aside className="ct-form-card">
          <div className="ct-form-card__head">
            <div>
              <h2 className="ct-form-card__title">Send us a message</h2>
              <p className="ct-form-card__subtitle">We read every one. Replies within a business day.</p>
            </div>
            <span className="ls-pill">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 2 4 5v6c0 5 3.4 8.5 8 10 4.6-1.5 8-5 8-10V5l-8-3Z" fill="currentColor" opacity="0.18" />
                <path d="M12 2 4 5v6c0 5 3.4 8.5 8 10 4.6-1.5 8-5 8-10V5l-8-3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                <path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              POPIA-safe
            </span>
          </div>

          {sent ? (
            <div className="ct-form-card__body ct-sent" role="status" aria-live="polite">
              <span className="ct-sent__mark" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="m5 13 4 4 10-11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <h3 className="ls-serif ct-sent__title">Message sent.</h3>
              <p className="ct-sent__copy">
                Thanks {name.trim().split(' ')[0] || 'there'} — we've got it and we'll be in touch at{' '}
                <b>{email.trim()}</b> within one business day. Need a faster answer?
              </p>
              <a className="ls-btn ls-btn--primary ct-sent__cta" href={WA_HREF} target="_blank" rel="noopener noreferrer">
                Message us on WhatsApp →
              </a>
            </div>
          ) : (
            <form className="ct-form-card__body" onSubmit={onSubmit} noValidate>
              <div className="ls-field">
                <label htmlFor="ct-name">Your name</label>
                <div className="ls-input">
                  <input
                    id="ct-name"
                    type="text"
                    autoComplete="name"
                    placeholder="Thandi Mokoena"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              </div>

              <div className="ls-field">
                <label htmlFor="ct-email">Email address</label>
                <div className="ls-input">
                  <input
                    id="ct-email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.co.za"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="ls-field">
                <label htmlFor="ct-topic">What's this about?</label>
                <div className="ls-input ls-input--select">
                  <select id="ct-topic" value={topic} onChange={(e) => setTopic(e.target.value)}>
                    <option>Switching my bond</option>
                    <option>Checking if it's worth it</option>
                    <option>An offer I've received</option>
                    <option>How Bondly makes money</option>
                    <option>Something else</option>
                  </select>
                  <span className="ct-select__chevron" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none"><path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </span>
                </div>
              </div>

              <div className="ls-field">
                <label htmlFor="ct-message">Your message</label>
                <div className="ls-input ls-input--area">
                  <textarea
                    id="ct-message"
                    rows={4}
                    placeholder="Tell us a bit about your bond or your question…"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                </div>
              </div>

              {error && <p className="ct-form-err" role="alert">{error}</p>}

              <button type="submit" className="ls-btn ls-btn--primary ct-form__cta" disabled={!formValid}>
                Send message →
              </button>
              <p className="ct-form__foot">
                By sending you agree to our{' '}
                <Link to="/privacy">privacy policy</Link>. We never share your details.
              </p>
            </form>
          )}
        </aside>
      </div>
    </header>
  );
}

// ─────────────────────────────────────────────────────────────
// MONEY-FLOW — "How Bondly stays free & unbiased"
// Hand-authored SVG infographic: Banks → Bondly (equal flat fee) → You.
// Two responsive variants: a horizontal flow for ≥720px, a stacked
// vertical flow for mobile so labels never shrink to illegibility.
// ─────────────────────────────────────────────────────────────
function FlowDiagram() {
  return (
    <>
      {/* Horizontal (desktop / tablet) */}
      <svg
        className="ct-flow ct-flow--wide"
        viewBox="0 0 920 360"
        role="img"
        aria-label="Every bank pays Bondly the same flat fee, so Bondly is never tied to one bank and works only for you."
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <marker id="ctArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 10 5 0 10z" fill="#1e3a5f" />
          </marker>
        </defs>

        {/* LEFT: the banks, equal flat fees */}
        <text x="118" y="34" textAnchor="middle" className="ct-flow__kicker">SEVEN BANKS</text>
        {[
          { y: 60,  name: 'Absa' },
          { y: 124, name: 'FNB' },
          { y: 188, name: 'Nedbank' },
          { y: 252, name: 'Standard Bank' },
        ].map((b, i) => (
          <g key={b.name}>
            <rect x="24" y={b.y} width="188" height="48" rx="4" fill="#ffffff" stroke="#000" strokeWidth="1.25" />
            <text x="44" y={b.y + 30} className="ct-flow__bank">{b.name}</text>
            <text x="196" y={b.y + 30} textAnchor="end" className="ct-flow__fee">R · flat</text>
            {/* connector to the Bondly node */}
            <line x1="212" y1={b.y + 24} x2="372" y2="180" stroke="#1e3a5f" strokeWidth="1.5" markerEnd="url(#ctArrow)" opacity="0.85" />
          </g>
        ))}
        <text x="118" y="322" textAnchor="middle" className="ct-flow__note">…and 3 more — each pays the same</text>

        {/* CENTER: Bondly node */}
        <g>
          <rect x="372" y="120" width="176" height="120" rx="6" fill="#1e3a5f" stroke="#000" strokeWidth="1.25" />
          <text x="460" y="166" textAnchor="middle" className="ct-flow__node-name">Bondly</text>
          <text x="460" y="192" textAnchor="middle" className="ct-flow__node-sub">Same flat fee</text>
          <text x="460" y="212" textAnchor="middle" className="ct-flow__node-sub">whichever bank wins</text>
        </g>
        {/* equal-fee chip */}
        <g transform="translate(460 96)">
          <rect x="-72" y="-20" width="144" height="34" rx="17" fill="#fdf0af" stroke="#000" strokeWidth="1.1" />
          <text x="0" y="2" textAnchor="middle" className="ct-flow__chip">= no incentive to bias</text>
        </g>

        {/* CENTER → YOU */}
        <line x1="548" y1="180" x2="700" y2="180" stroke="#1e3a5f" strokeWidth="1.75" markerEnd="url(#ctArrow)" />
        <text x="624" y="166" textAnchor="middle" className="ct-flow__edge">works only for</text>

        {/* RIGHT: You */}
        <g>
          <circle cx="780" cy="180" r="78" fill="#faefdc" stroke="#000" strokeWidth="1.25" />
          <text x="780" y="166" textAnchor="middle" className="ct-flow__you">You</text>
          <text x="780" y="196" textAnchor="middle" className="ct-flow__you-sub">the best rate,</text>
          <text x="780" y="214" textAnchor="middle" className="ct-flow__you-sub">full stop</text>
        </g>
        <text x="780" y="300" textAnchor="middle" className="ct-flow__note">R0 — you never pay Bondly</text>
      </svg>

      {/* Vertical (mobile) — labels stay full-size */}
      <svg
        className="ct-flow ct-flow--narrow"
        viewBox="0 0 360 560"
        role="img"
        aria-label="Every bank pays Bondly the same flat fee, so Bondly is never tied to one bank and works only for you."
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <marker id="ctArrowV" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 10 5 0 10z" fill="#1e3a5f" />
          </marker>
        </defs>

        <text x="180" y="30" textAnchor="middle" className="ct-flow__kicker">SEVEN BANKS · EQUAL FLAT FEE</text>
        <g>
          <rect x="40" y="46" width="280" height="64" rx="4" fill="#ffffff" stroke="#000" strokeWidth="1.25" />
          <text x="60" y="78" className="ct-flow__bank">Absa</text>
          <text x="60" y="98" className="ct-flow__note ct-flow__note--left">…and 6 more banks</text>
          <text x="300" y="84" textAnchor="end" className="ct-flow__fee">R · flat</text>
        </g>
        <line x1="180" y1="110" x2="180" y2="172" stroke="#1e3a5f" strokeWidth="1.75" markerEnd="url(#ctArrowV)" />
        <text x="196" y="148" className="ct-flow__edge ct-flow__edge--v">same fee, every bank</text>

        <g>
          <rect x="70" y="180" width="220" height="96" rx="6" fill="#1e3a5f" stroke="#000" strokeWidth="1.25" />
          <text x="180" y="220" textAnchor="middle" className="ct-flow__node-name">Bondly</text>
          <text x="180" y="246" textAnchor="middle" className="ct-flow__node-sub">paid the same</text>
          <text x="180" y="264" textAnchor="middle" className="ct-flow__node-sub">whichever bank wins</text>
        </g>
        <g transform="translate(180 300)">
          <rect x="-120" y="-20" width="240" height="34" rx="17" fill="#fdf0af" stroke="#000" strokeWidth="1.1" />
          <text x="0" y="2" textAnchor="middle" className="ct-flow__chip">= no incentive to bias</text>
        </g>

        <line x1="180" y1="334" x2="180" y2="396" stroke="#1e3a5f" strokeWidth="1.75" markerEnd="url(#ctArrowV)" />
        <text x="196" y="372" className="ct-flow__edge ct-flow__edge--v">works only for</text>

        <g>
          <circle cx="180" cy="464" r="76" fill="#faefdc" stroke="#000" strokeWidth="1.25" />
          <text x="180" y="452" textAnchor="middle" className="ct-flow__you">You</text>
          <text x="180" y="482" textAnchor="middle" className="ct-flow__you-sub">R0 — the best rate</text>
        </g>
      </svg>
    </>
  );
}

function FreeUnbiased() {
  const points = [
    {
      k: 'Paid by the bank',
      d: 'You never pay Bondly a cent. The bank you switch to pays us a fee — the same model used by every bond originator in South Africa.',
    },
    {
      k: 'The same, every time',
      d: 'Here\'s the part that matters: that fee is a flat amount, and it\'s identical no matter which of the seven banks you end up choosing.',
    },
    {
      k: 'So we work for you',
      d: 'Because we earn the same either way, we have zero reason to nudge you toward one bank. Our only job is to get you the lowest rate — full stop.',
    },
  ];
  return (
    <section className="ls-section ct-free" id="how-we-stay-free">
      <div className="ls-wrap">
        <div className="ls-sec-eyebrow">How Bondly stays free &amp; unbiased</div>
        <h2 className="ls-serif ls-h2">Paid by the banks. Loyal to you.</h2>
        <p className="ls-sec-sub">
          It's a fair question to ask of anything that's free. Here's the honest answer, drawn out
          plainly — because the way we get paid is exactly why you can trust the rate we bring back.
        </p>

        <div className="ct-flow-frame">
          <FlowDiagram />
        </div>

        <ul className="ct-free__points">
          {points.map((p, i) => (
            <li key={p.k} className="ct-free__point">
              <span className="ls-serif ct-free__num">{i + 1}</span>
              <div>
                <h3 className="ct-free__k">{p.k}</h3>
                <p className="ct-free__d">{p.d}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// FAQ — sticky heading + accordion (matches the landing pattern)
// ─────────────────────────────────────────────────────────────
const EASE_SILK = [0.22, 1, 0.36, 1];

const FAQ_ITEMS = [
  {
    q: 'How quickly will I hear back?',
    a: 'WhatsApp is fastest — usually a reply within minutes during the day. The contact form and email are answered within one business day, and our phone line is open weekdays 08:00–18:00 SAST.',
  },
  {
    q: 'If Bondly is free, what\'s the catch?',
    a: 'There isn\'t one. The bank you switch to pays us a flat fee, and it\'s the same amount whichever of the seven banks you choose. We earn the same either way, so we\'re never tied to one bank — our only incentive is to find you the lowest rate.',
  },
  {
    q: 'Will contacting you sign me up for anything?',
    a: 'No. Reaching out is just a conversation. There\'s no credit check, no obligation and no automatic enrolment — you only ever proceed if and when you decide an offer is worth it.',
  },
  {
    q: 'Is my information safe?',
    a: 'Yes. We\'re POPIA compliant and we never share or sell your details. Anything you send us is used only to answer your question and, if you ask us to, to help you compare offers.',
  },
  {
    q: 'I\'m buying a home, not switching — can you help?',
    a: 'That\'s our sister product, Bondly Home, which handles new home-loan origination. Mention it in your message and we\'ll point you to the right team, or head straight to Bondly Home from the link in the menu.',
  },
];

function FAQ() {
  const [open, setOpen] = useState(null);
  const reduce = useReducedMotion();

  const toggle = (i) => {
    setOpen((prev) => {
      const next = prev === i ? null : i;
      if (next === i) trackAction('contact_faq_opened', { question: FAQ_ITEMS[i].q });
      return next;
    });
  };

  return (
    <section className="ls-section ls-faq ct-faq" id="faq">
      <div className="ls-wrap ls-faq__grid">
        <div className="ls-faq__aside">
          <div className="ls-faq__sticky">
            <h2 className="ls-serif ls-faq__title">Before you reach out.</h2>
            <p className="ls-faq__sub">A few quick answers to the questions we hear most.</p>
          </div>
        </div>

        <div className="ls-faq__list">
          {FAQ_ITEMS.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={item.q} className={`ls-faq__item${isOpen ? ' is-open' : ''}`}>
                <button
                  type="button"
                  className="ls-faq__q"
                  aria-expanded={isOpen}
                  aria-controls={`ct-faq-panel-${i}`}
                  onClick={() => toggle(i)}
                >
                  <span>{item.q}</span>
                  <span className="ls-faq__icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none">
                      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      key="panel"
                      initial={{ height: 0 }}
                      animate={{ height: 'auto' }}
                      exit={{ height: 0 }}
                      transition={{ height: reduce ? { duration: 0 } : { duration: 0.42, ease: EASE_SILK } }}
                      style={{ overflow: 'hidden' }}
                    >
                      <motion.div
                        id={`ct-faq-panel-${i}`}
                        className="ls-faq__panel"
                        role="region"
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{
                          opacity: reduce ? { duration: 0 } : { duration: 0.32, ease: EASE_SILK, delay: isOpen ? 0.06 : 0 },
                          y: reduce ? { duration: 0 } : { duration: 0.42, ease: EASE_SILK },
                        }}
                      >
                        <p>{item.a}</p>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// FOOTER — copied from the landing Footer
// ─────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="ls-wrap ls-footer">
      <div>© 2026 Bondly (Pty) Ltd · Registered bond originator · POPIA compliant · Not a bank; rates indicative.</div>
      <div className="ls-footer__links">
        <Link to="/privacy">Privacy</Link>
        <Link to="/terms">Terms</Link>
        <Link to="/paia">PAIA</Link>
        <a href={ORIGINATION_URL} target="_blank" rel="noopener noreferrer">Bondly Home ↗</a>
      </div>
    </footer>
  );
}

// ─────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────
export default function Contact() {
  useEffect(() => { track('contact_view', 'page'); }, []);

  return (
    <div className="ls-page ct-page">
      <LandingNav />
      <Hero />
      <FreeUnbiased />
      <FAQ />
      <Footer />
    </div>
  );
}
