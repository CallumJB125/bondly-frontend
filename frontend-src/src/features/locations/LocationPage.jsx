import { useEffect } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import Button from '../../components/Button.jsx';
import './Location.css';

const LOCATIONS = {
  'cape-town': {
    city:     'Cape Town',
    province: 'Western Cape',
    slug:     'cape-town',
    headline: 'Home Loans in Cape Town',
    intro:    'Cape Town has some of the most competitive home loan rates in South Africa — but only if you know where to look. Bondly compares rate offers from all 7 major SA banks to find the best rate for a Western Cape property.',
    medianPrice: 'R2.1M',
    avgSaving:   'R1,050',
    hotAreas:    ['Atlantic Seaboard', 'Southern Suburbs', 'Northern Suburbs', 'Blouberg', 'Somerset West'],
    insight:     "Cape Town's property market is SA's most competitive. Banks compete aggressively for well-qualified buyers, which means there's more room to find a rate below prime — especially for properties above R1.5M.",
  },
  'johannesburg': {
    city:     'Johannesburg',
    province: 'Gauteng',
    slug:     'johannesburg',
    headline: 'Home Loans in Johannesburg',
    intro:    'Johannesburg is SA\'s largest property market by volume. More competition between banks means better rates — but only if you approach more than one. Bondly compares all major lenders for Gauteng properties to find the best offer.',
    medianPrice: 'R1.4M',
    avgSaving:   'R870',
    hotAreas:    ['Sandton', 'Midrand', 'Fourways', 'Bedfordview', 'Roodepoort'],
    insight:     "Gauteng sees the highest volume of bond applications in SA. ABSA and FNB compete particularly hard here. Our data shows Johannesburg applicants consistently achieve rates 0.5–0.75% below their existing bank's first offer.",
  },
  'durban': {
    city:     'Durban',
    province: 'KwaZulu-Natal',
    slug:     'durban',
    headline: 'Home Loans in Durban',
    intro:    'KwaZulu-Natal\'s property market offers strong value, with Durban\'s coastal properties attracting competitive bank rates. Bondly finds the best home loan rate for KZN properties across all 7 major SA banks.',
    medianPrice: 'R1.1M',
    avgSaving:   'R780',
    hotAreas:    ['Umhlanga', 'Ballito', 'Westville', 'La Lucia', 'Hillcrest'],
    insight:     "Durban applicants often find that Nedbank and Standard Bank are particularly competitive for KZN properties. Applying to all banks simultaneously — rather than sequentially — saves weeks and typically produces a better rate.",
  },
  'pretoria': {
    city:     'Pretoria',
    province: 'Gauteng',
    slug:     'pretoria',
    headline: 'Home Loans in Pretoria',
    intro:    'Pretoria\'s property market is among SA\'s most affordable for the income level of buyers, making it ideal for first-time buyers. Bondly helps Pretoria homeowners and buyers get pre-approved and find the best rate across all banks.',
    medianPrice: 'R1.2M',
    avgSaving:   'R820',
    hotAreas:    ['Centurion', 'Waterkloof', 'Menlyn', 'Garsfontein', 'Faerie Glen'],
    insight:     "Pretoria's high concentration of government and public-sector employees means stable income profiles that banks view favourably. Well-qualified Pretoria buyers often achieve rates at or below prime.",
  },
};

const STEPS = [
  { n: '01', title: 'Enter your details', desc: 'Tell us your income, current rate, and what you\'re looking for. Takes 2 minutes.' },
  { n: '02', title: 'Our broker team takes your application to lenders', desc: 'A Bondly broker reviews your details, then submits to the banks we believe will offer you the best rate (typically 3–5 of the major SA banks: ABSA, FNB, Nedbank, Standard Bank, Capitec, Investec, SA Home Loans). You hear back within 3–10 business days.' },
  { n: '03', title: 'Pick the best offer', desc: 'You choose. We co-ordinate the attorneys and paperwork from there.' },
];

export default function LocationPage() {
  const { location: slug } = useParams();
  const loc = LOCATIONS[slug];

  useEffect(() => {
    if (!loc) return;
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'FinancialService',
      name: `Bondly — Home Loans ${loc.city}`,
      description: loc.intro,
      areaServed: { '@type': 'City', name: loc.city, containedInPlace: { '@type': 'State', name: loc.province } },
      url: `https://bondly.co.za/home-loans-${loc.slug}`,
      provider: { '@type': 'Organization', name: 'Bondly', url: 'https://bondly.co.za' },
    };
    const el = document.createElement('script');
    el.type = 'application/ld+json'; el.id = 'loc-schema'; el.text = JSON.stringify(schema);
    document.head.appendChild(el);
    const prev = document.title;
    document.title = `Home Loans ${loc.city} — Best Rate | Bondly`;
    return () => { document.getElementById('loc-schema')?.remove(); document.title = prev; };
  }, [loc]);

  if (!loc) return <Navigate to="/" replace />;

  return (
    <div className="location-page page">

      <section className="location-hero">
        <div className="container container--narrow">
          <p className="location-hero__kicker">{loc.province}</p>
          <h1 className="location-hero__title">{loc.headline}</h1>
          <p className="location-hero__sub">{loc.intro}</p>
          <div className="location-hero__actions">
            <Link to="/preapproval"><Button variant="lime" size="lg">Get my best rate — free →</Button></Link>
            <Link to="/tools/repayment-calculator"><Button variant="ghost" size="lg">Use calculator</Button></Link>
          </div>
        </div>
      </section>

      <section className="location-stats">
        <div className="container">
          <div className="location-stats__grid">
            <div className="location-stats__item">
              <div className="location-stats__val">{loc.medianPrice}</div>
              <div className="location-stats__label">Median property price in {loc.city}</div>
            </div>
            <div className="location-stats__item">
              <div className="location-stats__val">{loc.avgSaving}/mo</div>
              <div className="location-stats__label">Average saving for {loc.city} homeowners</div>
            </div>
            <div className="location-stats__item">
              <div className="location-stats__val">7</div>
              <div className="location-stats__label">Banks compared for you</div>
            </div>
            <div className="location-stats__item">
              <div className="location-stats__val">100%</div>
              <div className="location-stats__label">Free for homeowners and buyers</div>
            </div>
          </div>
        </div>
      </section>

      <section className="location-insight">
        <div className="container container--narrow">
          <h2 className="location-section__title">{loc.city} home loan market</h2>
          <p className="location-insight__body">{loc.insight}</p>
          <div className="location-areas">
            <p className="location-areas__label">Popular areas in {loc.city}:</p>
            <div className="location-areas__tags">
              {loc.hotAreas.map(a => <span key={a} className="location-areas__tag">{a}</span>)}
            </div>
          </div>
        </div>
      </section>

      <section className="location-how">
        <div className="container container--narrow">
          <h2 className="location-section__title">How it works</h2>
          <div className="location-how__steps">
            {STEPS.map(s => (
              <div key={s.n} className="location-how__step">
                <div className="location-how__step-num">{s.n}</div>
                <div>
                  <div className="location-how__step-title">{s.title}</div>
                  <div className="location-how__step-desc">{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="location-cta">
        <div className="container container--narrow" style={{ textAlign: 'center' }}>
          <h2>Ready to get {loc.city}'s best home loan rate?</h2>
          <p>No credit check to start. Takes 3 minutes. 100% free.</p>
          <Link to="/preapproval"><Button variant="lime" size="lg">Start — it's free →</Button></Link>
        </div>
      </section>

    </div>
  );
}
