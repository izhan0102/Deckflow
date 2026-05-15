import LegalShell from "@/components/legal/LegalShell";
import { LEGAL } from "@/lib/legal";

export const metadata = { title: "Shipping & Delivery Policy · DeckFlow" };

export default function ShippingPage() {
  return (
    <LegalShell title="Shipping & Delivery Policy">
      <p className="meta">Last updated: {LEGAL.LAST_UPDATED}</p>

      <h2>1. Nature of the Product</h2>
      <p>
        DeckFlow is a digital software-as-a-service product. We do not sell
        or ship any physical goods. References to "delivery" in this policy
        refer to electronic provisioning of the file you purchase to your
        DeckFlow account and browser.
      </p>

      <h2>2. Delivery Method</h2>
      <ul>
        <li>Generation, editing, and preview of decks is delivered in real time within the DeckFlow web application at no cost.</li>
        <li>The downloadable Microsoft PowerPoint (<code>.pptx</code>) file is delivered immediately after Razorpay confirms a successful payment, via direct browser download.</li>
        <li>A confirmation email with the payment receipt is sent to your registered email.</li>
      </ul>

      <h2>3. Delivery Timeline</h2>
      <ul>
        <li>File download: instant on payment success.</li>
        <li>Email receipt: within 30 minutes of successful payment.</li>
        <li>If your file has not started downloading within 5 minutes of a successful payment, please email{" "}<a href={`mailto:${LEGAL.SUPPORT_EMAIL}`}>{LEGAL.SUPPORT_EMAIL}</a> with the Razorpay transaction ID.</li>
      </ul>

      <h2>4. Failed Delivery</h2>
      <p>
        If a payment is captured but the file is not delivered, contact{" "}
        {LEGAL.SUPPORT_EMAIL} within 7 days. We will reconcile the
        transaction and either re-deliver the file or initiate a refund per
        our Refund Policy.
      </p>

      <h2>5. Geographical Availability</h2>
      <p>
        DeckFlow is offered worldwide subject to applicable export controls
        and local regulations. We reserve the right to restrict access from
        specific jurisdictions where required by law.
      </p>

      <h2>6. Contact</h2>
      <p>
        {LEGAL.BUSINESS_NAME} (operated by {LEGAL.PROPRIETOR_NAME}) <br />
        {LEGAL.BUSINESS_ADDRESS} <br />
        Email: {LEGAL.SUPPORT_EMAIL} <br />
        Phone: {LEGAL.SUPPORT_PHONE}
      </p>
    </LegalShell>
  );
}
