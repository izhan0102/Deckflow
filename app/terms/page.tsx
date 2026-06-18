import LegalShell from "@/components/legal/LegalShell";
import { LEGAL } from "@/lib/legal";

export const metadata = { title: "Terms & Conditions · EXdeck" };

export default function TermsPage() {
  return (
    <LegalShell title="Terms & Conditions">
      <p className="meta">Last updated: {LEGAL.LAST_UPDATED}</p>

      <p>
        These Terms & Conditions ("Terms") form a binding agreement between
        you ("user", "you") and {LEGAL.BUSINESS_NAME} ("EXdeck", "we",
        "our", "us") governing your access to and use of the website at{" "}
        {LEGAL.DOMAIN} and all related services (the "Service"). EXdeck is
        operated by {LEGAL.PROPRIETOR_NAME} as a sole-proprietor independent
        project. By creating an account or using the Service, you accept
        these Terms in full. If you do not accept them, do not use the
        Service.
      </p>

      <h2>1. Eligibility</h2>
      <p>
        You must be at least 18 years old, or the age of majority in your
        jurisdiction, to register for an account. By using the Service you
        represent that you meet this requirement and that all information
        you provide is accurate and current.
      </p>

      <h2>2. Account Registration</h2>
      <p>
        You are responsible for maintaining the confidentiality of your
        credentials and for all activities under your account. Notify us at{" "}
        {LEGAL.SUPPORT_EMAIL} immediately if you suspect unauthorized
        access. We may suspend or terminate accounts that breach these
        Terms.
      </p>

      <h2>3. Description of Service</h2>
      <p>
        EXdeck is a software-as-a-service product that uses generative AI
        to produce, edit, and export presentation files based on user
        prompts and uploads. The Service is offered on an "as is" basis with
        a free plan and optional paid plans. Features may change; we will
        provide reasonable notice of material changes.
      </p>

      <h2>4. Plans and Pricing</h2>
      <ul>
        <li>The free plan lets you generate, edit, present, and export decks as PowerPoint (<code>.pptx</code>) or PDF within a monthly deck limit. Free exports include a small "Made with EXdeck" watermark.</li>
        <li>Paid plans — Pro (US$5/month), plus Team and Organisation plans for shared seats — remove the monthly deck limit and unlock features such as AI speaker notes, Q&amp;A prep, slide reordering, icons, watermark-free exports, deck translation, and unlimited generation. Annual billing is available at a 10% discount.</li>
        <li>Paid plans are billed for the period you choose — monthly, or annually at a 10% discount — and grant access for that billing period. Payments are processed securely by our payment gateway, Razorpay; we do not collect or store your full card or banking details.</li>
        <li>Coupon or promotional codes, where offered, are subject to their stated discount, validity, and usage limits, and may be withdrawn at any time.</li>
        <li>Refunds and cancellations are governed by our Refund &amp; Cancellation Policy.</li>
        <li>Monthly generation quotas and feature limits apply per plan and may change over time.</li>
      </ul>

      <h2>5. Feedback and Reviews</h2>
      <p>
        Reviews and feedback you submit may be displayed publicly on the
        Service (for example, on the landing page). By submitting a review
        you grant us permission to display the name, role, rating, and text
        you provide. Do not include confidential or personal information you
        do not want shown publicly.
      </p>

      <h2>6. User Content</h2>
      <p>
        You retain all ownership of the prompts, uploads, and decks you
        create ("User Content"). You grant us a worldwide, non-exclusive,
        royalty-free licence to host, store, transmit, and display your
        User Content solely as necessary to operate the Service for you.
      </p>
      <p>You represent and warrant that:</p>
      <ul>
        <li>You own or have the necessary rights to the User Content you submit.</li>
        <li>Your User Content does not violate any law, contract, or third-party right (including intellectual-property, privacy, and publicity rights).</li>
      </ul>

      <h2>7. Acceptable Use</h2>
      <p>You agree not to use the Service to:</p>
      <ul>
        <li>Generate or distribute unlawful, defamatory, harassing, or infringing content.</li>
        <li>Generate sexual content involving minors, content that promotes violence or terrorism, or content that would constitute a criminal offence.</li>
        <li>Attempt to reverse engineer, decompile, or extract the underlying models or source code.</li>
        <li>Bypass quotas, rate limits, or usage controls.</li>
        <li>Resell or sublicence the Service without our prior written consent.</li>
        <li>Use the Service to develop a competing AI presentation product.</li>
      </ul>
      <p>We may suspend or terminate access for violations.</p>

      <h2>8. AI-Generated Output</h2>
      <p>
        Output produced by the Service is generated by statistical models
        and may contain inaccuracies, fabrications, or biased content. You
        are solely responsible for reviewing, fact-checking, and editing
        output before use. We make no warranty regarding the accuracy,
        fitness, or reliability of generated content.
      </p>

      <h2>9. Intellectual Property</h2>
      <p>
        The Service, including its source code, design, trademarks, and
        documentation, is the property of {LEGAL.BUSINESS_NAME} and protected
        by copyright, trademark, and other laws. No rights are granted to
        you except as expressly set out in these Terms.
      </p>

      <h2>10. Third-Party Services</h2>
      <p>
        The Service relies on third-party providers for hosting,
        authentication, and AI inference. Your use of these providers'
        features may be subject to their separate terms and privacy
        policies.
      </p>

      <h2>11. Disclaimers</h2>
      <p>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE SERVICE IS PROVIDED
        "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, WHETHER
        EXPRESS, IMPLIED, OR STATUTORY, INCLUDING WARRANTIES OF
        MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
        NON-INFRINGEMENT.
      </p>

      <h2>12. Limitation of Liability</h2>
      <p>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, {LEGAL.BUSINESS_NAME} SHALL
        NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL,
        OR EXEMPLARY DAMAGES, OR ANY LOSS OF PROFITS, REVENUES, DATA, OR
        GOODWILL. OUR TOTAL AGGREGATE LIABILITY ARISING OUT OF OR RELATING
        TO THE SERVICE WILL NOT EXCEED INR 1,000.
      </p>

      <h2>13. Indemnification</h2>
      <p>
        You agree to indemnify and hold harmless {LEGAL.BUSINESS_NAME} and
        its proprietor, employees, and agents from any claim arising out of
        your breach of these Terms, your User Content, or your misuse of
        the Service.
      </p>

      <h2>14. Termination</h2>
      <p>
        You may stop using the Service at any time. We may suspend or
        terminate your access for violation of these Terms or prolonged
        inactivity. On termination your right to use the Service
        ceases; sections that by their nature should survive (including
        Sections 6, 9–13) will survive.
      </p>

      <h2>15. Governing Law and Disputes</h2>
      <p>
        These Terms are governed by the laws of India. Subject to
        mandatory consumer-protection statutes, the courts at{" "}
        {LEGAL.JURISDICTION_CITY}, {LEGAL.JURISDICTION_STATE} have
        exclusive jurisdiction over any dispute arising out of or in
        connection with these Terms.
      </p>

      <h2>16. Changes</h2>
      <p>
        We may update these Terms from time to time. Material changes take
        effect 7 days after we post the updated Terms or notify you,
        whichever is later. Continued use of the Service after the effective
        date constitutes acceptance.
      </p>

      <h2>17. Contact</h2>
      <p>
        {LEGAL.BUSINESS_NAME} (operated by {LEGAL.PROPRIETOR_NAME}) <br />
        {LEGAL.BUSINESS_ADDRESS} <br />
        Email: {LEGAL.SUPPORT_EMAIL} <br />
        Phone:{" "}
<a
  href={`tel:${LEGAL.SUPPORT_PHONE.replace(/\s+/g, "")}`}
  aria-label={`Call support at ${LEGAL.SUPPORT_PHONE}`}
>
  {LEGAL.SUPPORT_PHONE}
</a>
      </p>
    </LegalShell>
  );
}
