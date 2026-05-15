import LegalShell from "@/components/legal/LegalShell";
import { LEGAL } from "@/lib/legal";

export const metadata = { title: "Refund & Cancellation Policy · DeckFlow" };

export default function RefundPage() {
  return (
    <LegalShell title="Refund & Cancellation Policy">
      <p className="meta">Last updated: {LEGAL.LAST_UPDATED}</p>

      <p>
        This Refund & Cancellation Policy explains how{" "}
        {LEGAL.BUSINESS_NAME} ("DeckFlow", "we") handles cancellations,
        refunds, and chargebacks for downloads purchased on{" "}
        {LEGAL.DOMAIN}. It supplements our Terms & Conditions and is
        required by our payment processor, Razorpay.
      </p>

      <h2>1. Pricing Model</h2>
      <ul>
        <li>Generation, editing, and previewing decks in DeckFlow is free.</li>
        <li>Downloading a deck as a Microsoft PowerPoint (<code>.pptx</code>) file is a flat fee of INR {LEGAL.PRICE_PER_DECK_INR} per deck, regardless of how many slides the deck contains. The total is shown for confirmation before payment.</li>
        <li>Payments are one-time and per-deck. There are no subscriptions, no auto-pay, no recurring charges.</li>
      </ul>

      <h2>2. Cancellation</h2>
      <ul>
        <li>Because the product is delivered immediately on payment success, there is no separate "cancellation" step for a download — you simply choose not to download.</li>
        <li>If you initiate a payment and close the dialog before completing it, no charge is made by Razorpay.</li>
      </ul>

      <h2>3. Refund Eligibility</h2>
      <p>
        Each download payment is final once the file has been generated and
        delivered. We will issue a refund in the following cases:
      </p>
      <ul>
        <li><strong>Duplicate charge.</strong> If you were charged more than once for the same deck download in a single attempt, we will refund the duplicate.</li>
        <li><strong>Payment captured but file not delivered.</strong> If Razorpay confirms a successful charge but the <code>.pptx</code> file fails to generate or download, we will either re-deliver the file or issue a full refund.</li>
        <li><strong>Unauthorized transaction.</strong> If a payment was made without your authorization and you notify us within 7 days with the Razorpay transaction ID, we will reverse the transaction subject to verification.</li>
        <li><strong>Materially broken output.</strong> If the downloaded file is unusable due to a clear bug on our side (e.g., corrupt file, missing slides) and you report it within 48 hours of purchase with details, we will issue a full refund and work to fix the issue.</li>
      </ul>

      <h2>4. Non-Refundable Cases</h2>
      <ul>
        <li>Dissatisfaction with the AI-generated wording, layout, or stylistic choices, where the file was successfully generated and delivered. We strongly encourage previewing the deck — which is free — before paying to download.</li>
        <li>Requests made more than 48 hours after a successful download.</li>
        <li>Charges older than 90 days.</li>
        <li>Accounts terminated for violation of our Terms & Conditions.</li>
      </ul>

      <h2>5. How to Request a Refund</h2>
      <p>
        Email <a href={`mailto:${LEGAL.SUPPORT_EMAIL}`}>{LEGAL.SUPPORT_EMAIL}</a>{" "}
        from your registered email address with:
      </p>
      <ul>
        <li>The Razorpay transaction ID or order reference (visible on your payment receipt).</li>
        <li>Date and amount of the charge.</li>
        <li>The reason for the request and any supporting evidence.</li>
      </ul>
      <p>
        We acknowledge requests within 2 business days and resolve them
        within 7 business days of receiving the required information.
      </p>

      <h2>6. Refund Method and Timeline</h2>
      <p>
        Approved refunds are credited to the original payment instrument via
        Razorpay. Refunds typically appear in your account within 5–10
        business days, depending on your bank or card issuer. We will share
        the Razorpay refund reference once the refund is initiated.
      </p>

      <h2>7. Chargebacks</h2>
      <p>
        We encourage you to contact us before initiating a chargeback with
        your bank or card issuer; most disputes can be resolved more
        quickly directly. If a chargeback is filed, we may suspend your
        account pending resolution. Fraudulent chargebacks may result in
        permanent account termination and reporting to the payment network.
      </p>

      <h2>8. Taxes</h2>
      <p>
        Where applicable, refunds include the corresponding tax component.
        The portion paid as tax to the relevant authority is refunded
        according to the rules of that authority.
      </p>

      <h2>9. Contact</h2>
      <p>
        {LEGAL.BUSINESS_NAME} (operated by {LEGAL.PROPRIETOR_NAME}) <br />
        {LEGAL.BUSINESS_ADDRESS} <br />
        Email: {LEGAL.SUPPORT_EMAIL} <br />
        Phone: {LEGAL.SUPPORT_PHONE}
      </p>
    </LegalShell>
  );
}
