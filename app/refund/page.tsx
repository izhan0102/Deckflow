import LegalShell from "@/components/legal/LegalShell";
import { LEGAL } from "@/lib/legal";

export const metadata = { title: "Refund & Cancellation Policy · EXdeck" };

export default function RefundPage() {
  return (
    <LegalShell title="Refund & Cancellation Policy">
      <p className="meta">Last updated: {LEGAL.LAST_UPDATED}</p>

      <p>
        This policy explains how {LEGAL.BUSINESS_NAME} ("EXdeck", "we")
        handles refunds and cancellations for the Service at {LEGAL.DOMAIN}.
        It supplements our Terms &amp; Conditions.
      </p>

      <h2>1. Plans</h2>
      <p>
        EXdeck offers a free plan and paid subscription plans (Pro at
        US$5/month and Pro Plus at US$10/month). The free plan lets you
        generate, edit, present, and export decks within its monthly limits.
        Paid plans raise those limits and unlock additional features.
      </p>
      <p>
        Paid plans are not yet available for purchase. Until paid checkout
        launches, every account is on the free plan and no payment is taken.
        The terms below govern paid subscriptions once purchasing is enabled.
      </p>

      <h2>2. Billing and Cancellation</h2>
      <ul>
        <li>Paid plans are billed monthly in advance and renew automatically until cancelled.</li>
        <li>You can cancel anytime from your account or by emailing us. Cancellation stops future renewals; your plan stays active until the end of the current billing period, after which the account returns to the free plan.</li>
        <li>We do not charge cancellation fees.</li>
      </ul>

      <h2>3. Refunds</h2>
      <p>
        If you are not satisfied, you may request a full refund within{" "}
        <strong>14 days</strong> of your purchase. To request one, email{" "}
        <a href={`mailto:${LEGAL.SUPPORT_EMAIL}`}>{LEGAL.SUPPORT_EMAIL}</a>{" "}
        with your account email and order details, and we will process the
        refund to your original payment method. This 14-day refund right
        applies to subscription payments and is in addition to any statutory
        consumer rights you may have.
      </p>
      <p>
        Payments are processed by our reseller and Merchant of Record,
        Paddle.com. Refunds are issued in line with Paddle&rsquo;s Buyer
        Terms; you may also contact Paddle directly regarding any charge.
        After the 14-day window, refunds for partial or unused billing
        periods are at our discretion, for example where the Service was
        materially unavailable due to a fault on our side.
      </p>

      <h2>4. Account and Data Deletion</h2>
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

      <h2>5. Unexpected Charges</h2>
      <p>
        If you see a charge referencing EXdeck that you do not recognise,
        email us at{" "}
        <a href={`mailto:${LEGAL.SUPPORT_EMAIL}`}>{LEGAL.SUPPORT_EMAIL}</a>{" "}
        and we will help you look into it.
      </p>

      <h2>6. Contact</h2>
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
