import LegalShell from "@/components/legal/LegalShell";
import { LEGAL } from "@/lib/legal";

export const metadata = { title: "Shipping & Delivery Policy · EZdeck" };

export default function ShippingPage() {
  return (
    <LegalShell title="Shipping & Delivery Policy">
      <p className="meta">Last updated: {LEGAL.LAST_UPDATED}</p>

      <h2>1. Nature of the Product</h2>
      <p>
        EZdeck is a free, digital software-as-a-service product. We do not
        sell or ship any physical goods. References to "delivery" refer to
        electronic provisioning of files within your browser.
      </p>

      <h2>2. Delivery Method</h2>
      <ul>
        <li>Generation, editing, and preview of decks is delivered in real time within the EZdeck web application at no cost.</li>
        <li>Downloadable Microsoft PowerPoint (<code>.pptx</code>) and PDF files are delivered instantly via direct browser download, free of charge.</li>
      </ul>

      <h2>3. Delivery Timeline</h2>
      <ul>
        <li>Decks are generated in about ten seconds and edits save automatically.</li>
        <li>File downloads start instantly when you choose to export.</li>
        <li>If a download does not start, please email{" "}<a href={`mailto:${LEGAL.SUPPORT_EMAIL}`}>{LEGAL.SUPPORT_EMAIL}</a> and we will help.</li>
      </ul>

      <h2>4. Geographical Availability</h2>
      <p>
        EZdeck is offered worldwide subject to applicable export controls
        and local regulations. We reserve the right to restrict access from
        specific jurisdictions where required by law.
      </p>

      <h2>5. Contact</h2>
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
