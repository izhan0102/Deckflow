import LegalShell from "@/components/legal/LegalShell";
import { LEGAL } from "@/lib/legal";

export const metadata = { title: "Refund & Cancellation Policy · EZdeck" };

export default function RefundPage() {
  return (
    <LegalShell title="Refund & Cancellation Policy">
      <p className="meta">Last updated: {LEGAL.LAST_UPDATED}</p>

      <p>
        This policy explains how {LEGAL.BUSINESS_NAME} ("EZdeck", "we")
        handles refunds and cancellations for the Service at {LEGAL.DOMAIN}.
        It supplements our Terms &amp; Conditions.
      </p>

      <h2>1. No Charges</h2>
      <p>
        EZdeck is completely free. Generating, editing, previewing,
        presenting, and downloading decks as PowerPoint (<code>.pptx</code>)
        or PDF files costs nothing. We do not collect payments, store payment
        details, or run any subscriptions.
      </p>

      <h2>2. Nothing to Refund or Cancel</h2>
      <p>
        Because we never charge you, there is nothing to refund and no
        billing to cancel. You can stop using the Service, or delete your
        decks and account, at any time without any cost or penalty.
      </p>
      <h2>3. Account and Data Deletion</h2>
      <p>
        You may request deletion of your account and associated decks at any time.
        To do so, contact us at{" "}
        <a href={`mailto:${LEGAL.SUPPORT_EMAIL}`}>
          {LEGAL.SUPPORT_EMAIL}
        </a>{" "}
        from the email address associated with your account.
      </p>

      <p>
        Upon verification of your request, we will delete your account data and
        presentation content from our active systems, subject to any legal,
        security, or operational retention requirements described in our Privacy
        Policy.
      </p>

      <p>
        If certain records must be retained for compliance, security, or fraud
        prevention purposes, they will be retained only for the minimum period
        required and handled in accordance with applicable laws.
      </p>

      <h2>4. If You See a Charge</h2>
      <p>
        We have no payment system, so EZdeck cannot have charged you. If you
        notice a charge that references EZdeck, it is not from us — please
        contact your bank or card issuer, and feel free to email us at{" "}
        <a href={`mailto:${LEGAL.SUPPORT_EMAIL}`}>{LEGAL.SUPPORT_EMAIL}</a> so
        we can help you look into it.
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
