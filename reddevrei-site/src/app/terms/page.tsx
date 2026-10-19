import type { Metadata } from "next";
import Link from "next/link";

import { PageHero, PageNote } from "@/components/marketing/PageShell";
import { pageMetadata } from "@/lib/metadata";

import styles from "./page.module.css";

export const metadata: Metadata = pageMetadata({
  title: "Website Use Notice",
  description:
    "A preview website-use notice for RedDev Real Estate Investments, including information-only and inquiry-use boundaries.",
  path: "/terms/",
});

export default function TermsPage() {
  return (
    <>
      <PageHero
        eyebrow="WEBSITE USE NOTICE"
        title="A clear note about this website."
        description="This preview website shares general information about RedDev Real Estate Investments and provides a way to contact the team. It is not a transaction platform or a substitute for formal documents."
        breadcrumbLabel="Terms"
      />

      <div>
        <section className="page-section" aria-labelledby="purpose-heading">
          <div className={`container ${styles.introGrid}`}>
            <div>
              <p className="eyebrow">
                <span />
                PLEASE READ
              </p>
              <h2 id="purpose-heading">Information for website visitors</h2>
            </div>
            <div className="copy-flow">
              <p>
                This Website Use Notice is written for the RedDev website
                preview. It explains the intended boundaries of the public pages
                while the company reviews its final production policies and
                legal documents.
              </p>
              <p>
                By using these pages, please treat the information as general,
                dated website information. RedDev may update, correct, or remove
                website content as the site develops. This notice does not
                replace any formal agreement or disclosure document that may
                apply to a specific relationship or potential opportunity.
              </p>
            </div>
          </div>
        </section>

        <section
          className="page-section page-section-warm"
          aria-labelledby="not-offer-heading"
        >
          <div className="container page-split">
            <div>
              <p className="eyebrow">
                <span />
                IMPORTANT CONTEXT
              </p>
              <h2 id="not-offer-heading">
                General information, not investment advice
              </h2>
            </div>
            <div className="copy-flow">
              <p>
                Nothing on this website is investment, legal, tax, accounting,
                or other professional advice. The website does not constitute an
                offer to sell, or a solicitation of an offer to buy, any
                security or investment product.
              </p>
              <p>
                No investment opportunity is being made available for
                subscription, commitment, or payment through this website. Any
                potential opportunity, eligibility requirements, risks, terms,
                and disclosures would need to be communicated through materials
                approved for that purpose. Formal documents, rather than website
                summaries, would govern any potential offer or relationship.
              </p>
              <PageNote title="No online transaction or account creation">
                <p>
                  This website does not process investments, accept funds, open
                  investor accounts, or provide access to a private investor
                  dashboard. To ask a question, please use the{" "}
                  <Link href="/contact/">contact page</Link> or email the team.
                </p>
              </PageNote>
            </div>
          </div>
        </section>

        <section className="page-section" aria-labelledby="contact-heading">
          <div className="container page-split">
            <div>
              <p className="eyebrow">
                <span />
                CONTACT AND CONTENT
              </p>
              <h2 id="contact-heading">How to use the site</h2>
            </div>
            <div className="copy-flow">
              <h3>Questions and inquiries</h3>
              <p>
                The website is intended to help visitors learn more and start a
                conversation. You may contact RedDev about a general question,
                investment inquiry, student housing, or partnership through the{" "}
                <Link href="/contact/">email-draft contact route</Link>. Sending
                an inquiry does not create an investor, client, account,
                subscription, or other business relationship.
              </p>
              <h3>Original materials and links</h3>
              <p>
                RedDev and its content providers retain their respective rights
                in original names, marks, text, images, documents, and other
                materials made available on the site. Please do not reproduce or
                republish website materials without appropriate permission.
                Links to other websites are provided for convenience; their
                content and policies are separate from this notice.
              </p>
              <h3>Related pages</h3>
              <p>
                For information about personal information and the contact
                journey, see the{" "}
                <Link href="/privacy-policy/">Privacy information page</Link>.
                For investment-related context and qualifications, see the{" "}
                <Link href="/investment-disclosures/">
                  Investment Disclosures page
                </Link>
                . These pages should be read alongside any formal materials
                provided directly by RedDev.
              </p>
            </div>
          </div>
        </section>

        <section
          className="page-section page-section-warm"
          aria-labelledby="changes-heading"
        >
          <div className={`container ${styles.finalSection}`}>
            <p className="eyebrow">
              <span />
              PREVIEW STATUS
            </p>
            <h2 id="changes-heading">A draft boundary for review</h2>
            <p className="proseLead">
              This notice is intentionally limited. It does not attempt to
              create contractual terms, make jurisdictional statements, set
              dispute procedures, describe regulated status, or add liability
              waivers. RedDev and its legal advisers should review and approve
              final Terms, Privacy, and disclosure content before any production
              launch.
            </p>
            <p className={styles.updated}>
              Website preview · Last reviewed October 2026
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
