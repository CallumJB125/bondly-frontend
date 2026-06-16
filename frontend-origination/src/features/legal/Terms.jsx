import { Link } from 'react-router-dom';
import './Legal.css';

export default function Terms() {
  return (
    <div className="legal-page">
      <header className="legal-mini-header">
        <Link to="/" className="legal-mini-header__logo">Bondly Home</Link>
      </header>
      <main className="legal-container">
        <Link to="/" className="legal-back">← Back to Bondly Home</Link>
        <h1>Terms of Service</h1>
        <p className="legal-updated">Last updated: 16 May 2026</p>

        <section>
          <h2>1. About Bondly Home</h2>
          <p>Bondly Home is a free home loan origination and comparison platform for South African first-home buyers and property purchasers. Bondly is not a bank, financial institution, or registered financial adviser. We provide information, calculators, and a platform to facilitate connections between users and regulated financial institutions.</p>
        </section>

        <section>
          <h2>2. The service</h2>
          <p>By using Bondly Home, you may:</p>
          <ul>
            <li>Check your affordability and estimate your bond amount</li>
            <li>Compare interest rates across SA banks</li>
            <li>Calculate repayments, deposit requirements, and transfer duty</li>
            <li>Submit pre-approval applications (forwarded to regulated bank partners)</li>
            <li>Upload documents to a secure vault for use in applications</li>
          </ul>
          <p>All financial calculations and estimates are indicative only and do not constitute financial advice. Actual rates, approvals, and terms are determined solely by the relevant bank or financial institution.</p>
        </section>

        <section>
          <h2>3. Eligibility</h2>
          <p>You must be 18 years or older and a South African resident to use Bondly Home. By registering, you confirm that the information you provide is accurate and complete.</p>
        </section>

        <section>
          <h2>4. Free service — how we earn</h2>
          <p>Bondly Home is free to use. We earn a referral fee from bank partners when a bond application facilitated through our platform is successfully completed. This fee is paid by the bank and does not affect the rate or terms offered to you.</p>
        </section>

        <section>
          <h2>5. Not financial advice</h2>
          <p>Nothing on Bondly Home constitutes financial, legal, or investment advice. Rate estimates, affordability calculations, and savings projections are indicative only. Always obtain independent financial advice before making major financial decisions. Bondly is not liable for any financial decisions made based on information displayed on the platform.</p>
        </section>

        <section>
          <h2>6. Your account</h2>
          <p>You are responsible for maintaining the security of your account credentials. You may delete your account at any time from your profile settings. Upon deletion, your personal data will be removed within 30 days.</p>
        </section>

        <section>
          <h2>7. Intellectual property</h2>
          <p>All content, designs, and functionality on Bondly Home are the property of Bondly (Pty) Ltd. You may not copy, reproduce, or distribute any part of the platform without written permission.</p>
        </section>

        <section>
          <h2>8. Limitation of liability</h2>
          <p>To the maximum extent permitted by South African law, Bondly is not liable for any indirect, incidental, or consequential losses arising from your use of the platform. Our total liability is limited to the amount you have paid us (which for free accounts is R0).</p>
        </section>

        <section>
          <h2>9. Changes to these terms</h2>
          <p>We may update these terms from time to time. We will notify registered users of material changes by email. Continued use of the platform after changes constitutes acceptance.</p>
        </section>

        <section>
          <h2>10. Governing law</h2>
          <p>These terms are governed by South African law. Any disputes shall be subject to the jurisdiction of the South African courts.</p>
        </section>

        <section>
          <h2>11. Contact</h2>
          <p>For questions about these terms: <a href="mailto:hello@bondly.co.za">hello@bondly.co.za</a></p>
        </section>
      </main>
      <footer className="legal-footer">
        <p>© 2026 Bondly (Pty) Ltd · <Link to="/terms">Terms</Link> · <Link to="/privacy">Privacy</Link></p>
      </footer>
    </div>
  );
}
