import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import './Legal.css';

export default function Paia() {
  useEffect(() => {
    document.title = 'PAIA Manual | Bondly';
    return () => { document.title = 'Bondly — Switch Your Home Loan & Save'; };
  }, []);
  return (
    <div className="legal-page">
      <div className="container legal-container">
        <Link to="/" className="legal-back">← Back to Bondly</Link>
        <h1>PAIA Manual</h1>
        <p className="legal-updated">Promotion of Access to Information Act 2 of 2000</p>
        <p className="legal-updated">Last updated: June 2026</p>

        <section>
          <h2>1. Contact details of the information officer</h2>
          <p><strong>Company:</strong> Bondly (Pty) Ltd</p>
          <p><strong>Information Officer:</strong> Callum Baker</p>
          <p><strong>Email:</strong> <a href="mailto:privacy@bondly.co.za">privacy@bondly.co.za</a></p>
          <p><strong>Website:</strong> <a href="https://bondly.co.za">https://bondly.co.za</a></p>
          <p>Bondly is a private company registered in South Africa that operates a bond origination and mortgage comparison platform.</p>
        </section>

        <section>
          <h2>2. Categories of records held</h2>
          <p>Bondly holds the following categories of records:</p>
          <ul>
            <li><strong>Customer account records</strong> — name, email address, hashed password, registration date</li>
            <li><strong>Financial records</strong> — bond details, income, expense, and debt information provided by users</li>
            <li><strong>Bank statements</strong> — PDF or CSV files uploaded by users for analysis (processed in memory; not stored beyond the session)</li>
            <li><strong>Application records</strong> — pre-approval applications submitted to banks via the platform</li>
            <li><strong>Correspondence</strong> — emails and messages sent to or from Bondly</li>
            <li><strong>Usage logs</strong> — anonymised analytics data for platform improvement</li>
          </ul>
        </section>

        <section>
          <h2>3. How to request access to records</h2>
          <p>To request access to records held by Bondly, submit a written request to:</p>
          <p><strong>Email:</strong> <a href="mailto:privacy@bondly.co.za">privacy@bondly.co.za</a></p>
          <p>Your request must include:</p>
          <ul>
            <li>Your full name and contact details</li>
            <li>A copy of your identity document</li>
            <li>A description of the records you are requesting</li>
            <li>The form of access requested (copy, inspection, etc.)</li>
            <li>The reason for the request, if access is requested on behalf of a third party</li>
          </ul>
          <p>We will respond within 30 days of receiving a valid request. A prescribed request fee may apply in accordance with the PAIA regulations.</p>
        </section>

        <section>
          <h2>4. Grounds for refusal</h2>
          <p>Bondly may refuse a request for access on the grounds set out in Chapter 4 of PAIA, including (but not limited to):</p>
          <ul>
            <li>Protection of personal information of a third party</li>
            <li>Commercial confidentiality</li>
            <li>Records subject to legal privilege</li>
            <li>Records that do not exist or cannot be found</li>
          </ul>
        </section>

        <section>
          <h2>5. Available records</h2>
          <p>The following records are automatically available without a formal PAIA request:</p>
          <ul>
            <li>This PAIA manual</li>
            <li>Our <Link to="/privacy">Privacy Policy &amp; POPIA Notice</Link></li>
            <li>Our <Link to="/terms">Terms of Service</Link></li>
          </ul>
        </section>

        <section>
          <h2>6. South African Human Rights Commission</h2>
          <p>
            A copy of this manual has been submitted to the South African Human Rights Commission as required by PAIA.
            For more information about your rights under PAIA, visit{' '}
            <a href="https://www.sahrc.org.za" target="_blank" rel="noopener noreferrer">www.sahrc.org.za</a>.
          </p>
        </section>
      </div>
    </div>
  );
}
