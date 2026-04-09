import { Link } from 'react-router-dom';

const LAST_UPDATED = 'April 9, 2026';

export default function PrivacyPolicyPage() {
  return (
    <div className="gradient-warm py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        <h1 className="text-4xl font-display font-bold text-foreground mb-8">Privacy Policy</h1>
        <div className="bg-card rounded-xl border p-8 md:p-12 shadow-sm space-y-8 text-sm leading-relaxed text-foreground/80">
          <p className="text-muted-foreground">Last updated: {LAST_UPDATED}</p>

          <section>
            <h2 className="text-xl font-display font-semibold text-foreground mb-3">1. Introduction</h2>
            <p>House of Hope (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is committed to protecting the privacy and security of personal data, especially that of the minors in our care. This Privacy Policy explains how we collect, use, store, and protect information in compliance with the General Data Protection Regulation (GDPR), the Philippine Data Privacy Act of 2012 (Republic Act No. 10173), and other applicable data protection laws.</p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold text-foreground mb-3">2. Data Controller</h2>
            <p>House of Hope Foundation, Inc. is the data controller responsible for your personal data. For any data privacy inquiries, please contact our Data Protection Officer at privacy@houseofhope.ph.</p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold text-foreground mb-3">3. Data We Collect</h2>
            <p className="mb-2">We collect the following categories of data:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Resident Data:</strong> Case information, demographics, health records, counseling notes, and educational progress. All resident data is anonymized in public-facing contexts.</li>
              <li><strong>Donor Data:</strong> Name, email address, country, donation history, and payment information.</li>
              <li><strong>Website Visitor Data:</strong> IP address, browser type, pages visited, and optional preference cookies when you consent.</li>
              <li><strong>Staff Data:</strong> Employment information, access credentials, and activity logs.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold text-foreground mb-3">4. Special Category Data (Sensitive Data)</h2>
            <p>Given our mission to serve minor survivors of abuse and trafficking, we process special category data including health information, details of abuse or trafficking, and psychological assessments. This data is processed under the legal basis of substantial public interest and vital interests of the data subjects, with appropriate safeguards including encryption, strict access controls, and anonymization.</p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold text-foreground mb-3">5. Machine Learning &amp; Automated Processing</h2>
            <p>To support our staff, we use automated processing (machine learning models, including ONNX-based inference in our systems) to analyze operational data. This includes models that assist with case risk escalation awareness and reintegration success indicators for case planning, as well as models that help assess social media engagement patterns for fundraising outreach. Outputs are advisory for authorized staff only and are not used to make solely automated decisions with legal or similarly significant effects regarding minors in our care.</p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold text-foreground mb-3">6. Children&apos;s Privacy</h2>
            <p>We take the protection of children&apos;s data extremely seriously. All data concerning minors in our care is subject to the highest level of protection. We never publicly disclose identifying information about any resident. All public-facing statistics are fully anonymized and aggregated. Access to resident data is strictly limited to authorized personnel with a legitimate need.</p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold text-foreground mb-3">7. Legal Basis for Processing</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Consent:</strong> For non-essential preference cookies (theme and UI settings), marketing communications, and donor newsletters.</li>
              <li><strong>Legitimate Interest:</strong> For secure service delivery and operational improvement.</li>
              <li><strong>Contractual Necessity:</strong> For processing donations and issuing receipts.</li>
              <li><strong>Vital Interests:</strong> For the protection and welfare of the minors in our care.</li>
              <li><strong>Legal Obligation:</strong> For compliance with Philippine social welfare laws and reporting requirements.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold text-foreground mb-3">8. Cookies</h2>
            <p className="mb-2">We use cookies strictly to enhance your browsing experience. Types of cookies we use:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Essential Cookies:</strong> Required for secure website functionality, such as authentication and session management when logging in (no consent needed).</li>
              <li><strong>Preference Cookies:</strong> Used to remember your non-essential user interface settings, such as your light or warm-dark theme preference and sidebar state (requires consent).</li>
            </ul>
            <p className="mt-2">You can manage your cookie preferences using our cookie consent banner or the Cookie preferences link in the site footer. Declining non-essential cookies will not affect your ability to use our website, but your UI preferences will not be saved across sessions.</p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold text-foreground mb-3">9. Data Security</h2>
            <p>We implement appropriate technical and organizational measures to protect personal data, including encryption at rest and in transit, role-based access controls, regular security audits, anonymization and pseudonymization of sensitive data, secure backup procedures, and staff training on data protection.</p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold text-foreground mb-3">10. Data Retention</h2>
            <p>We retain personal data only as long as necessary for the purposes outlined in this policy. Resident case files are retained in accordance with Philippine social welfare regulations. Donor data is retained for the duration of the donor relationship plus 7 years for tax compliance. Non-essential preference cookies expire after a set duration unless cleared manually by the user or removed when you withdraw consent.</p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold text-foreground mb-3">11. Your Rights</h2>
            <p className="mb-2">Under the GDPR and Philippine Data Privacy Act, you have the right to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Access your personal data</li>
              <li>Rectify inaccurate data</li>
              <li>Erase your data (&quot;right to be forgotten&quot;)</li>
              <li>Restrict processing of your data</li>
              <li>Data portability</li>
              <li>Object to processing</li>
              <li>Withdraw consent at any time</li>
            </ul>
            <p className="mt-2">To exercise any of these rights, contact us at privacy@houseofhope.ph.</p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold text-foreground mb-3">12. International Data Transfers</h2>
            <p>When transferring data outside the Philippines or the European Economic Area, we ensure appropriate safeguards are in place, including Standard Contractual Clauses approved by the European Commission.</p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold text-foreground mb-3">13. Contact Us</h2>
            <p>If you have questions about this Privacy Policy or wish to exercise your data rights, please contact our Data Protection Officer at privacy@houseofhope.ph.</p>
          </section>
        </div>
        <div className="mt-6 text-center">
          <Link to="/" className="text-sm text-primary hover:underline">← Back to Home</Link>
        </div>
      </div>
    </div>
  );
}
