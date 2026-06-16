import { Link } from 'react-router-dom';
import './Legal.css';

export default function Privacy() {
  return (
    <div className="legal-page">
      <header className="legal-mini-header">
        <Link to="/" className="legal-mini-header__logo">Bondly Home</Link>
      </header>
      <div className="legal-container">
        <Link to="/" className="legal-back">← Back to Bondly Home</Link>
        <h1>Privacy Policy &amp; POPIA Notice</h1>
        <p className="legal-updated">Last updated: 16 May 2026</p>

        <section>
          <h2>1. Who we are</h2>
          <p>Bondly (Pty) Ltd ("Bondly", "we", "us") is registered in South Africa and operates the Bondly Home platform at bondly.co.za. We are committed to protecting your personal information in accordance with the Protection of Personal Information Act 4 of 2013 (POPIA).</p>
          <p>Information Officer contact: <a href="mailto:privacy@bondly.co.za">privacy@bondly.co.za</a></p>
        </section>

        <section>
          <h2>2. What information we collect</h2>
          <ul>
            <li><strong>Account information</strong> — name, email address, password (hashed)</li>
            <li><strong>Financial details</strong> — income, expenses, employment status, and affordability inputs you provide</li>
            <li><strong>Property details</strong> — purchase price, deposit, target area, and property preferences</li>
            <li><strong>Documents</strong> — payslips, ID documents, bank statements, and proof of address you upload during pre-approval</li>
            <li><strong>Usage data</strong> — pages visited, calculator inputs, session information</li>
            <li><strong>Contact information</strong> — phone number if provided for callback requests</li>
          </ul>
        </section>

        <section>
          <h2>3. Why we collect your information</h2>
          <ul>
            <li>To provide the Bondly Home platform and its features (affordability checks, pre-approval applications)</li>
            <li>To match you with appropriate mortgage products and bank partners</li>
            <li>To calculate your personalised affordability and bond amount estimates</li>
            <li>To send you relevant notifications and updates (you may opt out at any time)</li>
            <li>To comply with applicable laws and financial regulations</li>
          </ul>
        </section>

        <section>
          <h2>4. Who we share your information with</h2>
          <p>We do not sell your personal data. We may share your information with:</p>
          <ul>
            <li><strong>Bank partners</strong> — only when you explicitly submit a pre-approval or bond application, and only the information required for that application</li>
            <li><strong>Mortgage brokers</strong> — only with your consent, as part of the advisory process</li>
            <li><strong>Service providers</strong> — email delivery, hosting, and analytics providers operating under data processing agreements</li>
            <li><strong>Anthropic (AI processing)</strong> — when you upload a bank statement or payslip for analysis, the text content of that document is transmitted to Anthropic, Inc. (USA) for processing by their Claude AI models. This is necessary to extract income and transaction data. Statement text is transmitted securely over HTTPS, is not stored by Anthropic beyond the processing of a single request, and is governed by Anthropic's data processing terms. By uploading a statement you consent to this cross-border transfer of your personal information to the United States.</li>
          </ul>
        </section>

        <section>
          <h2>5. Your POPIA rights</h2>
          <p>Under POPIA you have the right to:</p>
          <ul>
            <li>Access the personal information we hold about you</li>
            <li>Request correction of inaccurate information</li>
            <li>Request deletion of your information (subject to legal retention requirements)</li>
            <li>Object to or restrict processing in certain circumstances</li>
            <li>Lodge a complaint with the Information Regulator at <a href="https://www.justice.gov.za/inforeg/" target="_blank" rel="noopener noreferrer">www.justice.gov.za/inforeg</a></li>
          </ul>
          <p>To exercise any of these rights, email <a href="mailto:privacy@bondly.co.za">privacy@bondly.co.za</a>.</p>
        </section>

        <section>
          <h2>6. Data security</h2>
          <p>We use industry-standard security measures including encrypted storage, HTTPS in transit, and access controls. Passwords are never stored in plain text. Documents you upload are stored securely and accessible only to you and authorised Bondly staff.</p>
        </section>

        <section>
          <h2>7. Data retention</h2>
          <p>We retain your account data for as long as your account is active. If you delete your account, we remove your personal data within 30 days, subject to any legal retention obligations.</p>
        </section>

        <section>
          <h2>8. Cookies</h2>
          <p>We use only essential session cookies necessary for the platform to function. We do not use advertising or tracking cookies.</p>
        </section>

        <section>
          <h2>9. Contact</h2>
          <p>For any privacy-related queries: <a href="mailto:privacy@bondly.co.za">privacy@bondly.co.za</a><br />
          Bondly (Pty) Ltd, South Africa</p>
        </section>
      </div>
      <footer className="legal-footer">
        <p>© 2026 Bondly (Pty) Ltd · <Link to="/terms">Terms</Link> · <Link to="/privacy">Privacy</Link></p>
      </footer>
    </div>
  );
}
