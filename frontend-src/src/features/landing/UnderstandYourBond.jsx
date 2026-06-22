import { useRef } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import './UnderstandYourBond.css';

// ───────────────────────────────────────────────────────────────────────────
// UnderstandYourBond — the "what you get back" section of the landing page.
//
// Bondly-branded re-skin: navy `--brand` for interactive/figures, wheat-gold
// `--ls-gold` for the single "best"/highlight accent, the soft-card recipe for
// content cards (soft #e3e9f1 hairline, 16px radius, near-zero lift), and the
// two Bondly type families via the global tokens (`--font-display` for figures
// and titles, `--ls-subtext` for prose). It reads top-to-bottom as one story:
// a real example home → the property's numbers → the report Bondly prepares →
// the four deliverables it returns.
//
// Every figure below is illustrative example data for one example home and is
// labelled as such (see the disclaimer at the foot of the section).
// ───────────────────────────────────────────────────────────────────────────

const EASE = [0.22, 1, 0.36, 1];

// Shared reveal — a quiet rise + fade as each block enters the viewport.
const reveal = {
  hidden: { opacity: 0, y: 24 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: EASE, delay: i * 0.06 },
  }),
};

// ── Property stat: small uppercase label over a tabular value. ──
function HomeStat({ label, value, sub }) {
  return (
    <div className="uyb-homestat">
      <span className="uyb-homestat__label">{label}</span>
      <span className="uyb-homestat__value ls-serif">{value}</span>
      {sub ? <span className="uyb-homestat__sub">{sub}</span> : null}
    </div>
  );
}

// ── Bank comparison report — a card of clean rows. Lower rate reads as better;
// the best offer is highlighted with a soft cream/gold fill, a gold check and a
// small gold "BEST" badge (per the light reference). ──
const BANKS = [
  { name: 'Your current rate', rate: '11.95%', current: true },
  { name: 'SA Home Loans', rate: '11.40%' },
  { name: 'Nedbank', rate: '11.55%' },
  { name: 'Absa', rate: '11.60%' },
  { name: 'FNB', rate: '11.70%' },
  { name: 'Standard Bank', rate: '11.25%', best: true },
];

function GoldCheck() {
  return (
    <svg className="uyb-rowcheck" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="9" className="uyb-rowcheck__ring" />
      <path d="m6.2 10.2 2.4 2.4 5-5.2" className="uyb-rowcheck__tick" />
    </svg>
  );
}

function BankReport() {
  return (
    <div className="uyb-report">
      <div className="uyb-report__head">
        <span className="uyb-report__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <rect x="4" y="3.5" width="16" height="17" rx="2.5" />
            <path d="M8 9h8M8 12.5h8M8 16h5" />
          </svg>
        </span>
        <h3 className="uyb-report__title">Bank comparison report</h3>
      </div>

      <ul className="uyb-report__rows">
        {BANKS.map((b, i) => (
          <motion.li
            key={b.name}
            className={`uyb-row${b.best ? ' is-best' : ''}${b.current ? ' is-current' : ''}`}
            variants={reveal}
            custom={i}
          >
            <span className="uyb-row__name">
              {b.best ? <GoldCheck /> : <span className="uyb-row__dot" aria-hidden="true" />}
              {b.name}
              {b.best ? <span className="uyb-row__badge">BEST</span> : null}
            </span>
            <span className="uyb-row__rate">{b.rate}</span>
          </motion.li>
        ))}
      </ul>

      <p className="uyb-report__cap">6 banks reviewed · 5 beat your current rate.</p>
    </div>
  );
}

// ── The four deliverables — a row each: icon + title + one-line description,
// with a right-aligned Bondly pill where there's a headline figure. ──
const DELIVERABLES = [
  {
    icon: 'report',
    title: 'Bank comparison report',
    body: 'Every major SA bank, ranked for your profile.',
  },
  {
    icon: 'rate',
    title: 'Personalised rate offers',
    body: 'Rates matched to your profile, not a generic advertised number.',
    badge: 'from 11.25%',
  },
  {
    icon: 'legal',
    title: 'Legal cost estimates',
    body: 'Attorney and bond registration fees, known up front.',
    badge: '≈ R18,600',
  },
  {
    icon: 'timeline',
    title: 'Switching timeline',
    body: 'A week-by-week plan from accepted quote to registration.',
    badge: '≈ 3 weeks',
  },
];

const ICONS = {
  report: (
    <>
      <rect x="4" y="3.5" width="16" height="17" rx="2.5" />
      <path d="M8 9h8M8 12.5h8M8 16h5" />
    </>
  ),
  rate: (
    <>
      <path d="M4 16.5 9.5 11l3 2.6L20 6.5" />
      <path d="M15 6.5h5v5" />
    </>
  ),
  legal: (
    <>
      <path d="M12 3.5v17" />
      <path d="M5.5 7.5h13" />
      <path d="M5.5 7.5 3 14a3 3 0 0 0 5 0z" />
      <path d="M18.5 7.5 21 14a3 3 0 0 1-5 0z" />
      <path d="M8.5 20.5h7" />
    </>
  ),
  timeline: (
    <>
      <circle cx="6" cy="12" r="2" />
      <circle cx="18" cy="12" r="2" />
      <path d="M8 12h8" />
      <path d="M6 8.5V7M18 17v-1.5" />
    </>
  ),
};

function DelIcon({ name }) {
  return (
    <svg className="uyb-del__ico" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

// ── A slim "rate over time" strip (echoes the dark reference). The gold marker
// sits on "now"; the rail draws in on scroll. ──
const RATE_HISTORY = [
  { when: '3 months ago', rate: '10.75%' },
  { when: '2 months ago', rate: '11.00%' },
  { when: 'Now', rate: '11.95%', now: true },
  { when: 'Projected', rate: '11.95%' },
];

function RateStrip() {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start 0.9', 'end 0.6'],
  });
  const dash = useTransform(scrollYProgress, [0, 1], [1, 0]);

  return (
    <div className="uyb-strip" ref={ref}>
      <span className="uyb-strip__kicker">Rate over time · last 12 months</span>
      <svg className="uyb-strip__line" viewBox="0 0 1000 6" preserveAspectRatio="none" aria-hidden="true">
        <line x1="3" y1="3" x2="997" y2="3" className="uyb-strip__rail" />
        <motion.line
          x1="3" y1="3" x2="997" y2="3"
          className="uyb-strip__progress"
          pathLength="1"
          style={reduce ? { pathLength: 1 } : { pathLength: 1, strokeDashoffset: dash }}
          strokeDasharray="1"
        />
      </svg>
      <ol className="uyb-strip__points">
        {RATE_HISTORY.map((p) => (
          <li key={p.when} className={`uyb-strip__point${p.now ? ' is-now' : ''}`}>
            <span className="uyb-strip__dot" aria-hidden="true" />
            <span className="uyb-strip__rate ls-serif">{p.rate}</span>
            <span className="uyb-strip__when">{p.when}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function UnderstandYourBond() {
  const reduce = useReducedMotion();
  const inViewProps = (i = 0) =>
    reduce
      ? {}
      : {
          variants: reveal,
          custom: i,
          initial: 'hidden',
          whileInView: 'show',
          viewport: { once: true, amount: 0.3 },
        };

  return (
    <section id="understand-your-bond" className="uyb">
      <div className="uyb__inner ls-wrap">
        {/* ── Header ── */}
        <motion.header className="uyb__head" {...inViewProps(0)}>
          <p className="uyb__kicker">An example home</p>
          <h2 className="uyb__title ls-serif">Understand your bond better.</h2>
          <p className="uyb__lede">
            Every switch starts with a clear, personalised picture of where you stand.
            The figures here are an illustrative example.
          </p>
        </motion.header>

        {/* ── The home photo + its numbers ── */}
        <motion.div
          className="uyb__home"
          {...(reduce
            ? {}
            : {
                initial: 'hidden',
                whileInView: 'show',
                viewport: { once: true, amount: 0.2 },
                transition: { staggerChildren: 0.08 },
              })}
        >
          <motion.figure className="uyb__home-art" variants={reveal}>
            <img
              className="uyb__home-photo"
              src="/uyb-home.jpg"
              alt="A modern double-storey family home in a leafy Johannesburg suburb, the example property used throughout this section."
              loading="lazy"
              decoding="async"
            />
            <figcaption className="uyb__home-tag">
              <span className="uyb__home-place">14 Acacia Crescent</span>
              <span className="uyb__home-type">Fourways, Johannesburg</span>
            </figcaption>
          </motion.figure>

          <motion.div className="uyb__home-stats" variants={reveal} custom={1}>
            <HomeStat label="Bedrooms" value="4" />
            <HomeStat label="Floor size" value="280 m²" />
            <HomeStat label="Estimated value" value="R2.45m" />
            <HomeStat label="Outstanding bond" value="R1.45m" />
            <HomeStat label="Years remaining" value="18" />
            <HomeStat label="Current rate" value="11.95%" sub="Prime − 0.05" />
          </motion.div>
        </motion.div>

        {/* ── Rate-over-time strip ── */}
        <motion.div {...inViewProps(0)}>
          <RateStrip />
        </motion.div>

        {/* ── Bank comparison report (left) + the four deliverables (right) ── */}
        <div className="uyb__report-grid">
          <motion.div
            className="uyb__report-col"
            {...(reduce
              ? {}
              : {
                  initial: 'hidden',
                  whileInView: 'show',
                  viewport: { once: true, amount: 0.25 },
                  transition: { staggerChildren: 0.05 },
                })}
          >
            <BankReport />
          </motion.div>

          <motion.div
            className="uyb__deliver"
            {...(reduce
              ? {}
              : {
                  initial: 'hidden',
                  whileInView: 'show',
                  viewport: { once: true, amount: 0.2 },
                  transition: { staggerChildren: 0.06 },
                })}
          >
            <p className="uyb__deliver-intro">What Bondly prepares for you</p>
            {DELIVERABLES.map((d) => (
              <motion.article key={d.title} className="uyb-del" variants={reveal}>
                <span className="uyb-del__icon" aria-hidden="true">
                  <DelIcon name={d.icon} />
                </span>
                <div className="uyb-del__text">
                  <h4 className="uyb-del__title">{d.title}</h4>
                  <p className="uyb-del__body">{d.body}</p>
                </div>
                {d.badge ? <span className="uyb-del__badge">{d.badge}</span> : null}
              </motion.article>
            ))}
          </motion.div>
        </div>

        {/* ── Secure-data footnote (echoes the dark reference) ── */}
        <motion.div className="uyb__secure" {...inViewProps(0)}>
          <svg className="uyb__secure-ico" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
            <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
            <circle cx="12" cy="15" r="1.4" fill="currentColor" stroke="none" />
          </svg>
          <span>Your data is secure and never shared.</span>
        </motion.div>

        <p className="uyb__disclaimer">
          Illustrative example for one home. Your figures depend on your bond size,
          credit profile and prevailing rates. Bondly is free; we are paid by the bank
          you switch to, never by you.
        </p>
      </div>
    </section>
  );
}
