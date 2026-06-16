import { Link } from 'react-router-dom';
import Button from '../../components/Button.jsx';
import './About.css';

const STATS = [
  { value: '0.5–1%', label: 'Typical rate reduction' },
  { value: 'R650–R1,100/mo', label: 'Typical monthly saving*' },
  { value: '7', label: 'Major banks we compare' },
  { value: '100%', label: 'Free for homeowners' },
];

const TEAM = [
  {
    name: 'Callum Baker',
    role: 'Founder & CEO',
    bio: 'Callum built Bondly after watching friends and family overpay on their home loans for years — simply because the switching process was too complicated. He set out to make it as easy as switching a cell phone contract.',
    initials: 'CB',
    linkedin: 'https://www.linkedin.com/in/callum-baker',
  },
];

const VALUES = [
  {
    icon: '⚖️',
    title: 'We work for you, not the banks',
    body: "Banks profit from inertia. Most homeowners stay with the same bank for the life of their bond — often paying a rate that's 0.5–1% higher than what a new customer would get. Bondly exists to close that gap.",
  },
  {
    icon: '🔒',
    title: 'Your data stays private',
    body: 'We are POPIA-compliant. Your information is encrypted at rest and in transit, and is never sold to third parties. You can delete your account and all associated data at any time.',
  },
  {
    icon: '🏦',
    title: 'All 7 major SA banks',
    body: 'We show you rate offers from ABSA, FNB, Nedbank, Standard Bank, Capitec, Investec, and SA Home Loans — so banks compete for your business.',
  },
];

export default function About() {
  return (
    <div className="about-page page">

      {/* Hero */}
      <section className="about-hero">
        <div className="container container--narrow">
          <p className="about-hero__kicker">About Bondly</p>
          <h1 className="about-hero__headline">
            SA homeowners are overpaying.<br />We're here to fix that.
          </h1>
          <p className="about-hero__sub">
            The average South African homeowner pays 0.5–1% more on their bond rate than they need to.
            On a R1.5M bond that's over R1,000 every single month — money that goes to the bank,
            not to you. Bondly was built to change that.
          </p>
        </div>
      </section>

      {/* Stats */}
      <section className="about-stats">
        <div className="container">
          <div className="about-stats__grid">
            {STATS.map(s => (
              <div key={s.label} className="about-stats__item">
                <div className="about-stats__value">{s.value}</div>
                <div className="about-stats__label">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Story */}
      <section className="about-story">
        <div className="container container--narrow">
          <h2 className="about-section__title">The problem we solve</h2>
          <p>
            South Africa's home loan market has a dirty secret: banks offer their lowest rates to new
            customers who shop around, while existing loyal customers quietly pay more. The difference
            is real — a 0.75% gap on a R1.2M bond is R780 a month, or over R9,000 a year.
          </p>
          <p>
            Most homeowners don't switch because the process feels complicated. You'd have to contact
            multiple banks yourself, compare rates without knowing what's fair, and coordinate attorneys
            and paperwork. It's designed to be hard.
          </p>
          <p>
            Bondly makes it effortless. We compare offers from up to 7 major SA banks and show you
            exactly where you stand. You pick the best offer. It takes 3 minutes to start and costs you nothing.
          </p>
        </div>
      </section>

      {/* Team */}
      <section className="about-team">
        <div className="container container--narrow">
          <h2 className="about-section__title">Who's behind Bondly</h2>
          <div className="about-team__grid">
            {TEAM.map(member => (
              <div key={member.name} className="about-team__card">
                <div className="about-team__avatar">{member.initials}</div>
                <div className="about-team__info">
                  <div className="about-team__name">{member.name}</div>
                  <div className="about-team__role">{member.role}</div>
                  <p className="about-team__bio">{member.bio}</p>
                  {member.linkedin && (
                    <a
                      href={member.linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="about-team__linkedin"
                      aria-label={`${member.name} on LinkedIn`}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                      </svg>
                      LinkedIn
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="about-values">
        <div className="container container--narrow">
          <h2 className="about-section__title">What we stand for</h2>
          <div className="about-values__grid">
            {VALUES.map(v => (
              <div key={v.title} className="about-values__card">
                <div className="about-values__icon">{v.icon}</div>
                <h3 className="about-values__card-title">{v.title}</h3>
                <p className="about-values__card-body">{v.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="about-trust">
        <div className="container container--narrow">
          <h2 className="about-section__title">Credentials &amp; compliance</h2>
          <div className="about-trust__grid">
            <div className="about-trust__item">
              <div className="about-trust__badge">POPIA</div>
              <div className="about-trust__text">Your personal data is protected under South Africa's Protection of Personal Information Act</div>
            </div>
            <div className="about-trust__item">
              <div className="about-trust__badge">Partner</div>
              <div className="about-trust__text">Applications submitted via a registered bond originator partner</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="about-cta">
        <div className="container container--narrow" style={{ textAlign: 'center' }}>
          <h2>Ready to see what you could save?</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-5)' }}>
            It takes 3 minutes and there's no credit check. You might be surprised.
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/preapproval"><Button variant="lime" size="lg">Check my rate — free →</Button></Link>
            <Link to="/optimize"><Button variant="ghost" size="lg">Financial check first</Button></Link>
          </div>
        </div>
      </section>

    </div>
  );
}
