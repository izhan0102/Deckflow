import LegalShell from "@/components/legal/LegalShell";
import { LEGAL } from "@/lib/legal";

export const metadata = { title: "Privacy Policy · DeckFlow" };

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy">
      <p className="meta">Last updated: {LEGAL.LAST_UPDATED}</p>

      <p>
        This Privacy Policy describes how {LEGAL.BUSINESS_NAME} ("DeckFlow",
        "we", "our", "us") collects, uses, discloses, and safeguards your
        information when you visit, register an account on, or use the
        services available at {LEGAL.DOMAIN} (collectively, the "Service").
        DeckFlow is operated by {LEGAL.PROPRIETOR_NAME} from{" "}
        {LEGAL.JURISDICTION_CITY}, {LEGAL.JURISDICTION_STATE}, India. By
        using the Service you agree to the practices described in this
        policy.
      </p>

      <h2>1. Information We Collect</h2>

      <h3>1.1 Information you provide</h3>
      <ul>
        <li><strong>Account information:</strong> name, email address, password (stored as a hashed credential by our authentication provider), and profile photo if you sign in with a third-party identity provider such as Google.</li>
        <li><strong>Content:</strong> text prompts, presentation content, theme settings, uploaded images, and any text you type into the AI editing chat. This content is processed to generate and edit your decks.</li>
        <li><strong>Payment information:</strong> when you pay to download a deck, payment details (card number, UPI handle, etc.) are entered directly into Razorpay's interface and are not stored on our servers. We retain a transaction reference and the last four digits of the payment instrument for reconciliation.</li>
        <li><strong>Communications:</strong> messages you send to {LEGAL.SUPPORT_EMAIL} or other support channels.</li>
      </ul>

      <h3>1.2 Information collected automatically</h3>
      <ul>
        <li><strong>Usage events:</strong> pages visited, deck generations, edits, sign-in events, the device and browser you use, and approximate IP-based location. We use this for product analytics, abuse prevention, and capacity planning.</li>
        <li><strong>Cookies and local storage:</strong> session cookies for authentication, plus <code>localStorage</code> entries used to preserve work in progress and preferences.</li>
      </ul>

      <h3>1.3 Information from third parties</h3>
      <p>
        If you sign in with Google, we receive your name, email, and profile
        image as permitted by your Google account settings. We do not
        request or store any other Google account data.
      </p>

      <h2>2. How We Use Your Information</h2>
      <ul>
        <li>To create and authenticate your account and provide the Service.</li>
        <li>To process the prompts you send to our AI provider so we can return generated and edited slides.</li>
        <li>To process per-deck payments and send transactional messages such as receipts and refund confirmations.</li>
        <li>To detect, investigate, and prevent fraud, abuse, and violations of our Terms.</li>
        <li>To improve the product through aggregated, de-identified analytics.</li>
        <li>To respond to your support requests.</li>
      </ul>

      <h2>3. AI Processing and Third-Party Models</h2>
      <p>
        The text you submit through DeckFlow's prompt and chat features is
        sent to our AI inference provider for the sole purpose of generating
        a response. Your prompts are not used to train our or our provider's
        foundation models. Where the provider has a separate privacy policy,
        their terms apply to data processed on their infrastructure.
      </p>

      <h2>4. Sharing of Information</h2>
      <p>We do not sell your personal information. We share it only with:</p>
      <ul>
        <li><strong>Service providers</strong> that help us operate the Service: hosting, database and authentication (Google Firebase), AI inference, email/transactional messaging, and payment processing (Razorpay). Each is contractually bound to handle your information only on our instructions.</li>
        <li><strong>Authorities</strong> when required by valid legal process, or to protect the rights, property, or safety of {LEGAL.BUSINESS_NAME}, our users, or the public.</li>
        <li><strong>Successors</strong> in the event of a merger, acquisition, or sale of assets, in which case we will provide notice before personal information is transferred.</li>
      </ul>

      <h2>5. Data Retention</h2>
      <p>
        Account information is retained for as long as your account is active
        and for up to 30 days after deletion to allow account recovery.
        Decks, uploads, and chat history are retained until you delete them
        or close your account. Aggregated analytics may be retained
        indefinitely. Payment records are retained for the period required
        by tax and accounting laws of {LEGAL.JURISDICTION_STATE}, India.
      </p>

      <h2>6. Your Rights</h2>
      <p>Subject to applicable law, you may:</p>
      <ul>
        <li>Access, correct, or download a copy of your personal information.</li>
        <li>Delete your account and associated content.</li>
        <li>Withdraw consent for processing where consent is the lawful basis.</li>
        <li>Lodge a complaint with the data protection authority in your jurisdiction.</li>
      </ul>
      <p>
        To exercise these rights, write to {LEGAL.SUPPORT_EMAIL}. We respond
        to verifiable requests within 30 days.
      </p>

      <h2>7. Security</h2>
      <p>
        We use industry-standard measures including encrypted transport
        (TLS), encryption at rest for stored credentials, role-based access
        controls, and audit logging. No method of transmission over the
        internet is 100% secure; you use the Service at your own risk.
      </p>

      <h2>8. Children</h2>
      <p>
        DeckFlow is not directed to children under 13 (or 16 in
        jurisdictions where that is the minimum age of digital consent), and
        we do not knowingly collect personal information from them. If we
        learn that we have collected such information, we will delete it
        promptly.
      </p>

      <h2>9. International Transfers</h2>
      <p>
        Our service providers may process your data outside India. We rely
        on appropriate safeguards such as standard contractual clauses and
        the providers' published data processing addenda to protect
        transfers.
      </p>

      <h2>10. Changes to This Policy</h2>
      <p>
        We may update this Policy from time to time. Material changes will
        be notified by email or in-product banner at least 7 days before
        they take effect. The "Last updated" date above always reflects the
        currently effective version.
      </p>

      <h2>11. Contact Us</h2>
      <p>
        Questions, concerns, or requests can be directed to: <br />
        {LEGAL.BUSINESS_NAME} (operated by {LEGAL.PROPRIETOR_NAME}) <br />
        {LEGAL.BUSINESS_ADDRESS} <br />
        Email: {LEGAL.SUPPORT_EMAIL} <br />
        Phone: {LEGAL.SUPPORT_PHONE}
      </p>
    </LegalShell>
  );
}
