import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  FileSearch,
  MapPin,
  MessageCircle,
} from "lucide-react";

import {
  PageCallout,
  PageHero,
  PageNote,
} from "@/components/marketing/PageShell";
import { pageMetadata } from "@/lib/metadata";

import styles from "./page.module.css";

export const metadata = pageMetadata({
  title: "Invest With Us",
  description:
    "Learn how to discuss RedDev real estate investment opportunities, review approved materials and connect with the team.",
  path: "/invest/",
});

const nextSteps = [
  {
    number: "01",
    title: "Learn about RedDev",
    description:
      "Explore our integrated approach to multifamily real estate and the work behind each stage of the process.",
    Icon: BookOpen,
  },
  {
    number: "02",
    title: "Start a conversation",
    description:
      "Tell us what you would like to discuss. Our team can confirm current availability and the appropriate next step.",
    Icon: MessageCircle,
  },
  {
    number: "03",
    title: "Review approved materials",
    description:
      "Where appropriate, review the current formal materials carefully with your independent professional advisers.",
    Icon: FileSearch,
  },
];

export default function InvestPage() {
  return (
    <>
      <PageHero
        eyebrow="INVEST WITH REDDEV"
        title="A relationship-led way to learn more."
        description="Explore RedDev’s approach, ask considered questions and review current information at the right pace."
        breadcrumbLabel="Invest With Us"
        image={{
          src: "/brand/edmonton-bridge.jpg",
          alt: "Walterdale Bridge in Edmonton, Alberta",
        }}
      />

      <section
        className="page-section"
        aria-labelledby="investment-introduction"
      >
        <div className="container page-split">
          <div className={styles.introductionHeading}>
            <p className="eyebrow">
              <span />A CONVERSATION FIRST
            </p>
            <h2 id="investment-introduction">
              Investing is more than a transaction.
            </h2>
            <span className={styles.goldRule} aria-hidden="true" />
          </div>
          <div className="copy-flow">
            <p className={styles.lead}>
              We work with people who want to understand the approach behind an
              opportunity before deciding whether it may be right for them.
            </p>
            <p>
              Start by getting to know RedDev, our multifamily focus and the
              people involved. Then bring the questions that matter to you. A
              direct conversation gives our team the chance to clarify what is
              currently available and whether further information may be
              appropriate.
            </p>
            <div className={styles.inlineLinks}>
              <Link className="text-link" href="/our-approach/">
                Explore our approach{" "}
                <ArrowUpRight size={18} aria-hidden="true" />
              </Link>
              <Link className="text-link" href="/student-housing/">
                Learn about student housing{" "}
                <ArrowUpRight size={18} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section
        id="opportunities"
        className="page-section page-section-warm page-anchor"
        aria-labelledby="opportunities-heading"
      >
        <div className="container">
          <div className={styles.sectionHeading}>
            <div>
              <p className="eyebrow">
                <span />
                PROJECT INFORMATION
              </p>
              <h2 id="opportunities-heading">
                Opportunities are confirmed with our team.
              </h2>
            </div>
            <p>
              Information on a project page does not indicate that an
              opportunity is currently open or available.
            </p>
          </div>

          <article className={styles.opportunityFeature}>
            <div className={styles.projectMark} aria-hidden="true">
              <span>01</span>
              <i />
            </div>
            <div className={styles.opportunityCopy}>
              <p className={styles.projectEyebrow}>
                <MapPin size={15} aria-hidden="true" /> EDMONTON, ALBERTA
              </p>
              <h3>Edmonton Multiplex Limited Partnership 1</h3>
              <p>
                This project page is retained as a place to learn about the
                Edmonton Multiplex Limited Partnership 1. Its presence here is
                informational only. Please speak with our team to confirm the
                project’s current status, availability and any next steps.
              </p>
            </div>
            <Link
              className="button button-primary"
              href="/edmonton-multiplex-lp-1/"
            >
              View project information{" "}
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </article>
        </div>
      </section>

      <section
        id="next-steps"
        className="page-section page-anchor"
        aria-labelledby="next-steps-heading"
      >
        <div className="container">
          <div className={styles.stepsIntro}>
            <div>
              <p className="eyebrow">
                <span />
                PRACTICAL NEXT STEPS
              </p>
              <h2 id="next-steps-heading">
                Take the time to understand the details.
              </h2>
            </div>
            <p>
              The process is designed for questions, current information and
              careful review—not online investment execution.
            </p>
          </div>

          <ol className={styles.stepsList}>
            {nextSteps.map(({ number, title, description, Icon }) => (
              <li key={number}>
                <div className={styles.stepNumber} aria-hidden="true">
                  {number}
                </div>
                <Icon
                  className={styles.stepIcon}
                  size={25}
                  strokeWidth={1.35}
                  aria-hidden="true"
                />
                <div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className={styles.informationGrid}>
            <PageNote title="Important information">
              <p>
                This website provides general information only. It is not
                financial, legal or tax advice, and it is not an offer to sell
                or a solicitation to buy securities or participate in an
                investment.
              </p>
              <p>
                If an opportunity is available, it is subject to current
                eligibility requirements and the applicable formal offering
                materials. Real estate investments involve risk. Consider the
                information with independent professional advisers before making
                any decision.
              </p>
            </PageNote>
            <aside
              className={styles.contactAside}
              aria-labelledby="questions-heading"
            >
              <p className={styles.contactKicker}>QUESTIONS ABOUT INVESTING?</p>
              <h3 id="questions-heading">Start with the right information.</h3>
              <p>
                Use our contact page to prepare an investment email draft. It
                opens in your email app for review and is not submitted through
                this website.
              </p>
              <Link
                className="button button-outline"
                href="/contact/?type=investment"
              >
                Prepare an investment email{" "}
                <ArrowUpRight size={18} aria-hidden="true" />
              </Link>
            </aside>
          </div>
        </div>
      </section>

      <PageCallout
        title="The right partnership starts with a conversation."
        description="In this preview, the contact page prepares an email draft for your review. It does not submit an inquiry, open an account or execute an investment."
        href="/contact/?type=investment"
        label="Prepare an investment email"
      />
    </>
  );
}
