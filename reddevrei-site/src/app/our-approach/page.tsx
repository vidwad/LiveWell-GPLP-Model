import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import {
  PageCallout,
  PageHero,
  PageNote,
} from "@/components/marketing/PageShell";
import { approach } from "@/content/approach";
import { pageMetadata } from "@/lib/metadata";
import styles from "./page.module.css";

export const metadata = pageMetadata({
  title: "Our Approach",
  description:
    "Explore RedDev’s connected approach to multifamily real estate: Analyze, Acquire, Enhance, Manage, and Report & Comply.",
  path: "/our-approach/",
});

const anchors = approach.map((step) => ({
  label: `${step.number} ${step.title}`,
  href: `#${step.title.toLowerCase().replaceAll(" & ", "-").replaceAll(" ", "-")}`,
}));

export default function OurApproachPage() {
  return (
    <>
      <PageHero
        eyebrow="OUR APPROACH"
        title="A connected process, from first look to ongoing accountability."
        description="RedDev’s approach brings investment strategy, purposeful development, property operations and regular reporting into one connected process."
        breadcrumbLabel="Our Approach"
      />

      <nav
        className={styles.anchorNav}
        aria-label="Explore the five-step process"
      >
        <div className={`container ${styles.anchorNavInner}`}>
          <span className={styles.anchorNavLabel}>Explore the process</span>
          <div className={styles.anchorLinks}>
            {anchors.map((anchor) => (
              <a
                className={styles.anchorLink}
                href={anchor.href}
                key={anchor.href}
              >
                {anchor.label}
              </a>
            ))}
          </div>
        </div>
      </nav>

      <section className="page-section" aria-labelledby="approach-overview">
        <div className="container page-split">
          <div>
            <p className="eyebrow">
              <span /> ONE CONNECTED PROCESS
            </p>
            <h2 id="approach-overview">
              Investment decisions meet the realities of building and operating.
            </h2>
          </div>
          <div className="copy-flow">
            <p>
              RedDev’s five stages connect the early work of evaluating a
              property with the ongoing responsibilities of development,
              management and communication. The process is intended to keep the
              work connected as a property moves from analysis through
              operations.
            </p>
            <p>
              It is a practical sequence rather than a promise of a particular
              result. Each property and situation calls for its own assessment,
              decisions and professional advice.
            </p>
            <Link href="/about-us/#team" className="text-link">
              Meet the people behind RedDev{" "}
              <ArrowUpRight size={18} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <section
        className={`page-section page-section-warm ${styles.processSection}`}
        aria-labelledby="five-stages"
      >
        <div className="container">
          <div className={styles.processHeading}>
            <p className="eyebrow">
              <span /> THE FIVE STAGES
            </p>
            <h2 id="five-stages">Discipline at every step.</h2>
            <p>
              From market research and due diligence to reporting and
              compliance, each stage has a clear purpose in the broader process.
            </p>
          </div>

          <ol className={styles.timeline}>
            {approach.map((step) => {
              const id = step.title
                .toLowerCase()
                .replaceAll(" & ", "-")
                .replaceAll(" ", "-");
              return (
                <li
                  id={id}
                  className={`page-anchor ${styles.step}`}
                  key={step.number}
                >
                  <div className={styles.stepNumber} aria-hidden="true">
                    {step.number}
                  </div>
                  <article className={styles.stepBody}>
                    <p className={styles.stepDetail}>{step.detail}</p>
                    <h3>{step.title}</h3>
                    <p>{step.description}</p>
                  </article>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <section
        className="page-section"
        aria-labelledby="connected-responsibilities"
      >
        <div className="container page-split">
          <div>
            <p className="eyebrow">
              <span /> ACROSS THE WORK
            </p>
            <h2 id="connected-responsibilities">
              A view across investment, development and operations.
            </h2>
          </div>
          <div className={`copy-flow ${styles.responsibilitiesCopy}`}>
            <div>
              <h3>Investment perspective</h3>
              <p>
                Analysis, acquisition and capital structuring establish the
                early framework: understand the market and property, then
                negotiate and structure financing thoughtfully.
              </p>
            </div>
            <div>
              <h3>Development and value creation</h3>
              <p>
                Enhancement centres on purposeful development, property
                improvements and better operating practices as appropriate to
                the property.
              </p>
            </div>
            <div>
              <h3>Operations and communication</h3>
              <p>
                Management remains connected to the day-to-day experience of the
                property and its residents, while regular reporting helps keep
                investment partners informed.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section
        className={`page-section page-section-warm ${styles.contextSection}`}
        aria-labelledby="context-heading"
      >
        <div className={`container ${styles.contextLayout}`}>
          <div>
            <p className="eyebrow">
              <span /> CONTEXT MATTERS
            </p>
            <h2 id="context-heading">
              A process supports decisions; it does not remove uncertainty.
            </h2>
          </div>
          <PageNote title="Current information and risk context">
            <p>
              Real estate investment, property operations, development,
              financing and compliance can involve uncertainty. RedDev’s
              published process describes how the team approaches the work; it
              does not promise a particular outcome.
            </p>
            <p>
              For current materials, project details, eligibility or disclosure
              information, please speak with the RedDev team directly before
              making decisions or relying on older corporate materials.
            </p>
          </PageNote>
        </div>
      </section>

      <section
        className={`page-section ${styles.nextSection}`}
        aria-labelledby="next-conversation"
      >
        <div className={`container ${styles.nextLayout}`}>
          <div>
            <p className="eyebrow">
              <span /> START A CONVERSATION
            </p>
            <h2 id="next-conversation">Questions about the approach?</h2>
            <p>
              Connect with the team to discuss the process and request current
              information.
            </p>
          </div>
          <Link
            href="/contact/?type=general-question"
            className="button button-gold"
          >
            Contact Our Team <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>
      </section>

      <PageCallout
        title="Talk through our approach with the team."
        description="For current materials or a conversation about RedDev’s process, get in touch directly."
        href="/contact/?type=general-question"
        label="Speak with Our Team"
      />
    </>
  );
}
