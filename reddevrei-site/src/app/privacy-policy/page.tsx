import type { Metadata } from "next";
import Link from "next/link";
import { PageHero, PageNote } from "@/components/marketing/PageShell";
import { pageMetadata } from "@/lib/metadata";
import styles from "./page.module.css";

export const metadata: Metadata = pageMetadata({
  title: "Privacy Policy",
  description:
    "A preview data-handling notice for the RedDev Real Estate Investments public website.",
  path: "/privacy-policy/",
});

export default function PrivacyPolicyPage() {
  return (
    <>
      <PageHero
        eyebrow="PRIVACY & DATA HANDLING"
        title="Privacy Policy"
        description="A limited-scope preview notice for this public website and its browser-based contact journey."
        breadcrumbLabel="Privacy Policy"
      />

      <article className={`prose ${styles.policy}`}>
        <PageNote title="Preview notice — not yet approved company-wide policy">
          <p>
            This page describes the current public-site experience only. Broader
            RedDev privacy wording, including company-wide collection, use,
            retention, disclosure, and individual-rights terms, must be reviewed
            and approved before production publication.
          </p>
        </PageNote>

        <p className={styles.updated}>
          Scope of this preview: the RedDevREI.com public app and its
          email-draft contact flow.
        </p>

        <h2>What this website does</h2>
        <p>
          The contact page lets you prepare an email draft in your browser.
          Depending on the inquiry, the draft can include the fields you choose
          to provide, such as your name, email address, company, phone number,
          inquiry type, and message. The available inquiry types are investment,
          student housing, partnership, and general question.
        </p>
        <p>
          The app does not submit a form to a RedDev server. It does not create
          an account, accept a payment, or provide an investor portal. When you
          choose to send the draft, your device hands it to your selected email
          application, which then sends it to{" "}
          <a href="mailto:info@reddevrei.com">info@reddevrei.com</a>. Your email
          provider and email application may handle the message under their own
          terms and privacy practices.
        </p>

        <h2>Information you choose to provide</h2>
        <p>
          Please include only information needed for your question. Information
          placed into an email draft can be visible to your email provider, the
          device or browser you use, and RedDev when the message is sent. RedDev
          can review a message received at the contact address in order to
          respond to the inquiry, but this preview does not establish a
          company-wide retention period or a complete handling policy.
        </p>

        <h2>Technical requests and third parties</h2>
        <p>
          No RedDev analytics or advertising integration has been added to this
          public app. However, hosting, browser, network, security, font, or
          other platform services may process technical requests according to
          their own policies. This notice does not make a global claim that the
          website has no cookies, logs, or tracking, and it does not describe a
          retention schedule or certification that has not been confirmed.
        </p>
        <p>
          Links to other websites are provided for access to those destinations.
          Information you provide on another website is governed by that
          website&apos;s own privacy notice and terms, not this limited-scope
          preview.
        </p>

        <h2>Questions about this notice</h2>
        <p>
          Questions about the public website or this preview can be sent to{" "}
          <a href="mailto:info@reddevrei.com">info@reddevrei.com</a>. You can
          also use the{" "}
          <Link href="/contact/?type=general-question">
            general question contact draft
          </Link>
          . RedDev&apos;s public contact information is Maple Ridge, British
          Columbia, and <a href="tel:+16047297077">604-729-7077</a>.
        </p>

        <div className={styles.approvalBlock}>
          <p className="eyebrow">
            <span />
            BEFORE PRODUCTION
          </p>
          <p>
            This preview should be replaced or formally approved after RedDev
            confirms its broader privacy practices, applicable legal
            requirements, service providers, and the way received inquiries are
            handled.
          </p>
        </div>
      </article>
    </>
  );
}
