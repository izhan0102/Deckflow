import LegalShell from "@/components/legal/LegalShell";
import { LEGAL } from "@/lib/legal";

export const metadata = { title: "Contact Us · EXdeck" };

export default function ContactPage() {
  return (
    <LegalShell title="Contact Us">
      <p className="meta">Last updated: {LEGAL.LAST_UPDATED}</p>

      <p>
        We respond to most enquiries within 1 business day, Monday to Friday,
        excluding public holidays in {LEGAL.JURISDICTION_STATE}, India.
      </p>

      <h2>Support</h2>
      <p>
        For account or product issues, write to{" "}
        <a href={`mailto:${LEGAL.SUPPORT_EMAIL}`}>{LEGAL.SUPPORT_EMAIL}</a>.
        Please include your registered email so we can help you quickly.
      </p>

      <h2>Phone</h2>
      <p>
        {LEGAL.SUPPORT_PHONE} (Mon–Fri, 10:00–18:00 IST). For detailed
        issues, email is preferred so we can attach references.
      </p>

      <h2>Postal Address</h2>
      <p>
        {LEGAL.BUSINESS_NAME} <br />
        c/o {LEGAL.PROPRIETOR_NAME} <br />
        {LEGAL.BUSINESS_ADDRESS}
      </p>

      <h2>Grievance Officer</h2>
      <p>
        In compliance with the Information Technology (Intermediary
        Guidelines and Digital Media Ethics Code) Rules, 2021, complaints
        regarding content, privacy, or user rights may be addressed to the
        Grievance Officer, {LEGAL.PROPRIETOR_NAME}, at{" "}
        <a href={`mailto:${LEGAL.SUPPORT_EMAIL}`}>{LEGAL.SUPPORT_EMAIL}</a>.
        Complaints will be acknowledged within 24 hours and resolved within
        15 days.
      </p>

      <h2>About</h2>
      <p>{LEGAL.BUSINESS_DESCRIPTION}</p>
    </LegalShell>
  );
}
