import Link from "next/link";

import {
  PageCallout,
  PageHero,
  PageNote,
} from "@/components/marketing/PageShell";
import { pageMetadata } from "@/lib/metadata";

import styles from "./page.module.css";

export const metadata = pageMetadata({
  title: "Investment Disclosures",
  description:
    "Important information about RedDev Real Estate Investments, investment inquiries, eligibility and the limits of information published on this website.",
  path: "/investment-disclosures/",
});

export default function InvestmentDisclosuresPage() {
  return (
    <>
      <PageHero
        eyebrow="IMPORTANT INFORMATION"
        title="Read the context before exploring an investment opportunity."
        description="This page explains how to use RedDev’s public investment information and what this website does—and does not—offer. It is general information, not a securities offering or a substitute for advice tailored to your circumstances."
        breadcrumbLabel="Investment Disclosures"
        parent={{ label: "Invest With Us", href: "/invest/" }}
      />

      <section className="page-section" aria-labelledby="purpose-heading">
        <div className={`container ${styles.introGrid}`}>
          <div>
            <p className="eyebrow">START HERE</p>
            <h2 id="purpose-heading">
              A website inquiry is not an investment transaction.
            </h2>
          </div>
          <div className="copy-flow">
            <p>
              RedDev Real Estate Investments uses this website to share general
              information about its business and to help interested people start
              a conversation with the team. You can review the investment
              overview at <Link href="/invest/">Invest With Us</Link> and
              contact the team through the{" "}
              <Link href="/contact/?type=investment">
                investment inquiry page
              </Link>
              .
            </p>
            <p>
              No purchase, subscription, transfer of funds, account creation,
              securities transaction or investor relationship is completed
              through this website. An inquiry only asks the team to respond; it
              does not reserve an opportunity or create an obligation for RedDev
              or the person making contact.
            </p>
          </div>
        </div>
      </section>

      <section
        className="page-section page-section-warm"
        aria-labelledby="information-heading"
      >
        <div className={`container ${styles.contentGrid}`}>
          <div className={styles.sectionLead}>
            <p className="eyebrow">HOW TO READ THIS SITE</p>
            <h2 id="information-heading">
              General material and approved offering documents are different
              things.
            </h2>
          </div>
          <div className="copy-flow">
            <p>
              Website pages, archived material and other public descriptions are
              provided for context. They may describe RedDev’s approach,
              services or past and proposed activity, but they are not, by
              themselves, current offering documents. Information can change as
              projects, timelines and approvals develop.
            </p>
            <p>
              If a particular opportunity is available for discussion, the team
              will confirm its current status and explain which documents are
              applicable. Availability, eligibility and access to any offering
              materials must be confirmed with RedDev directly. Do not rely on
              an older web page, an archived event notice or a prior return
              illustration as a current offer or promise.
            </p>
            <PageNote title="Current-status note">
              <p>
                RedDev’s published investment material has included project and
                event references that require confirmation before being
                presented as current. This preview therefore does not label an
                opportunity as open, available or eligible for any person. Ask
                the team for the current, approved information that applies to
                your situation.
              </p>
            </PageNote>
          </div>
        </div>
      </section>

      <section className="page-section" aria-labelledby="risk-heading">
        <div className={`container ${styles.contentGrid}`}>
          <div className={styles.sectionLead}>
            <p className="eyebrow">RISK AND INDEPENDENT ADVICE</p>
            <h2 id="risk-heading">Real estate investments involve risk.</h2>
          </div>
          <div className="copy-flow">
            <p>
              An investment in real estate or a real estate investment structure
              can involve loss of some or all invested capital, changing
              property conditions, financing and interest-rate exposure,
              operating costs, market conditions, timing risk and limited
              liquidity. Past performance, examples or targets are not
              guarantees of future results, income or distributions.
            </p>
            <p>
              Nothing on this page is financial, legal, tax or accounting
              advice. Consider speaking with your own qualified professional
              advisers about your objectives, financial position, risk
              tolerance, tax circumstances and the legal documents before making
              any decision.
            </p>
            <p>
              RedDev may ask questions about eligibility and suitability before
              sharing materials. Those conversations do not replace your own
              diligence or mean that an investment is appropriate for you.
            </p>
          </div>
        </div>
      </section>

      <section
        className="page-section page-section-warm"
        aria-labelledby="process-heading"
      >
        <div className={`container ${styles.processLayout}`}>
          <div>
            <p className="eyebrow">A CONTROLLED NEXT STEP</p>
            <h2 id="process-heading">
              If you are interested, begin with a question.
            </h2>
          </div>
          <ol className={styles.steps}>
            <li>
              <span>01</span>
              <div>
                <h3>Review the overview</h3>
                <p>
                  Start with the general background on the{" "}
                  <Link href="/invest/">investment page</Link>.
                </p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <h3>Contact the team</h3>
                <p>
                  Use the{" "}
                  <Link href="/contact/?type=investment">
                    investment inquiry route
                  </Link>
                  ; it is an email-draft contact flow, not an application or
                  subscription form.
                </p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <h3>Confirm what is current</h3>
                <p>
                  Ask about availability, eligibility and the documents that
                  apply before relying on any project information.
                </p>
              </div>
            </li>
          </ol>
        </div>
      </section>

      <section className="page-section" aria-labelledby="terms-heading">
        <div className={`container ${styles.termsRow}`}>
          <div>
            <p className="eyebrow">RELATED INFORMATION</p>
            <h2 id="terms-heading">Please also review the site terms.</h2>
          </div>
          <p className="proseInline">
            The <Link href="/terms/">Terms</Link> describe the general
            conditions for using this website. If there is a conflict between
            public website material and approved legal or offering documents,
            the applicable documents and confirmed advice govern.
          </p>
        </div>
      </section>

      <PageCallout
        title="Have a question about a current opportunity?"
        description="Contact RedDev directly so the team can confirm what information is current and appropriate to share."
        href="/contact/?type=investment"
        label="Ask the Investment Team"
      />
    </>
  );
}
