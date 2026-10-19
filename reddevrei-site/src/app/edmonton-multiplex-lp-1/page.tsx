import Link from "next/link";

import {
  PageCallout,
  PageHero,
  PageNote,
} from "@/components/marketing/PageShell";
import { pageMetadata } from "@/lib/metadata";

import styles from "./page.module.css";

export const metadata = pageMetadata({
  title: "Edmonton Multiplex LP 1",
  description:
    "A legacy RedDev project overview for Edmonton Multiplex LP 1. Current availability, project details and offering documents must be confirmed directly with the RedDev team.",
  path: "/edmonton-multiplex-lp-1/",
});

export default function EdmontonMultiplexLpPage() {
  return (
    <>
      <PageHero
        eyebrow="LEGACY PROJECT OVERVIEW"
        title="Edmonton Multiplex LP 1"
        description="A historical RedDev project page for an Edmonton multifamily and student-housing concept. Current availability and approved project information must be confirmed with the team."
        breadcrumbLabel="Edmonton Multiplex LP 1"
        parent={{ label: "Invest With Us", href: "/invest/" }}
        image={{
          src: "/brand/edmonton-bridge.jpg",
          alt: "Walterdale Bridge in Edmonton, Alberta",
        }}
      />

      <section className="page-section" aria-labelledby="overview-heading">
        <div className={`container ${styles.overviewGrid}`}>
          <div className={styles.sectionLead}>
            <p className="eyebrow">
              <span />
              PROJECT CONTEXT
            </p>
            <h2 id="overview-heading">
              A legacy Edmonton project path, retained with care.
            </h2>
          </div>
          <div className="copy-flow">
            <p>
              RedDev’s original public page described Edmonton Multiplex Limited
              Partnership 1 as an Edmonton multifamily concept connected to
              student housing near the University of Alberta. It referred to a
              Garneau-area focus and to the housing needs of students and other
              university-area renters.
            </p>
            <p>
              This page keeps the established public route and the broad project
              context, but it does not repeat historical financing details,
              return illustrations, timelines, property counts or unit
              configurations. Those details require current, approved project
              information rather than reliance on a legacy webpage.
            </p>
            <PageNote title="Current availability is unconfirmed">
              <p>
                This preview does not identify Edmonton Multiplex LP 1 as open,
                active, available or suitable for any person. RedDev must
                confirm current project status, eligibility and which
                information can be shared.
              </p>
            </PageNote>
          </div>
        </div>
      </section>

      <section
        className="page-section page-section-warm"
        aria-labelledby="confirmation-heading"
      >
        <div className={`container ${styles.confirmationGrid}`}>
          <div className={styles.sectionLead}>
            <p className="eyebrow">
              <span />
              BEFORE YOU RELY ON PROJECT INFORMATION
            </p>
            <h2 id="confirmation-heading">
              Historical context and current project information are different
              things.
            </h2>
          </div>
          <dl className={styles.confirmationList}>
            <div>
              <dt>Project status</dt>
              <dd>
                Ask the team whether this project is current and whether any
                opportunity is available for discussion.
              </dd>
            </div>
            <div>
              <dt>Project scope</dt>
              <dd>
                Confirm the applicable location, development scope, housing
                details and timing directly with RedDev.
              </dd>
            </div>
            <div>
              <dt>Approved documents</dt>
              <dd>
                Any offering information, eligibility requirements and formal
                documents must come from the team in their current approved
                form.
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section
        className="page-section page-anchor"
        aria-labelledby="student-context-heading"
      >
        <div className={`container ${styles.studentGrid}`}>
          <div className="copy-flow">
            <p className="eyebrow">
              <span />
              STUDENT-HOUSING CONTEXT
            </p>
            <h2 id="student-context-heading">
              University-area housing was part of the original project story.
            </h2>
            <p>
              The legacy project page positioned this Edmonton concept in a
              university-area rental context, with the University of Alberta and
              the Garneau area referenced as part of its background. RedDev’s
              separate student-housing material also describes a focus on
              furnished housing and services near universities.
            </p>
            <p>
              Separate legacy student-housing descriptions require
              reconciliation before they are presented as one project. This
              overview therefore does not combine Garneau information with the
              distinct Queen Alexandra description, or state an address,
              capacity, configuration or operating status.
            </p>
          </div>
          <aside className={styles.imageContext} aria-label="Image context">
            <span className={styles.imageRule} aria-hidden="true" />
            <p>Edmonton city context</p>
            <small>
              The hero image is an existing RedDev Edmonton landmark image. It
              is illustrative and does not depict a project property.
            </small>
          </aside>
        </div>
      </section>

      <section
        className="page-section page-section-warm"
        aria-labelledby="information-heading"
      >
        <div className={`container ${styles.informationGrid}`}>
          <div className={styles.sectionLead}>
            <p className="eyebrow">
              <span />
              INFORMATION, NOT A TRANSACTION
            </p>
            <h2 id="information-heading">
              Request the information that applies now.
            </h2>
          </div>
          <div className="copy-flow">
            <p>
              This is not an offering memorandum, prospectus, application,
              account-creation flow or request for funds. A visit to this page
              does not reserve an opportunity or create an investor
              relationship.
            </p>
            <p>
              If you would like to understand the current status of Edmonton
              Multiplex LP 1, contact RedDev’s investment team. They can explain
              what information is current and whether there are approved
              materials appropriate to share.
            </p>
            <p className={styles.relatedLink}>
              For general context, visit{" "}
              <Link href="/invest/">Invest With Us</Link> or review the{" "}
              <Link href="/investment-disclosures/">
                Investment Disclosures
              </Link>{" "}
              before contacting the team.
            </p>
          </div>
        </div>
      </section>

      <PageCallout
        title="Looking for current project information?"
        description="Use the investment inquiry route to prepare an email to RedDev. It opens an email draft only; nothing is submitted, stored or created on this website."
        href="/contact/?type=investment"
        label="Prepare an Investment Email"
      />
    </>
  );
}
