import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  FileSearch,
  MapPin,
  MessageCircle,
} from "lucide-react";

const stepIcons = [FileSearch, MessageCircle, BookOpen];

import {
  PageCallout,
  PageHero,
  PageNote,
} from "@/components/marketing/PageShell";
import {
  accreditedAcknowledgement,
  investCopy,
  opportunity,
} from "@/content/company";
import { pageMetadata } from "@/lib/metadata";

import styles from "./page.module.css";

export const metadata = pageMetadata({
  title: "Invest With Us",
  description:
    "Explore RedDev’s current opportunities, including the Edmonton Multiplex Limited Partnership 1, and the next steps to invest.",
  path: "/invest/",
});

export default function InvestPage() {
  return (
    <>
      <PageHero
        eyebrow="CURRENT OPPORTUNITIES"
        title="Explore our current opportunities for a unique blend of income and growth potential."
        description={opportunity.intro}
        breadcrumbLabel="Invest With Us"
        image={{
          src: "/brand/edmonton-bridge.jpg",
          alt: "Walterdale Bridge in Edmonton, Alberta",
        }}
      />

      <section
        id="opportunities"
        className="page-section page-anchor"
        aria-labelledby="opportunities-heading"
      >
        <div className="container">
          <div className={styles.sectionHeading}>
            <div>
              <p className="eyebrow">
                <span />
                CURRENT OPPORTUNITIES
              </p>
              <h2 id="opportunities-heading">{opportunity.title}</h2>
            </div>
            <p>{opportunity.eligibility}</p>
          </div>

          <article className={styles.opportunityFeature}>
            <div className={styles.projectMark} aria-hidden="true">
              <span>01</span>
              <i />
            </div>
            <div className={`${styles.opportunityCopy} oc-copy`}>
              <p className={styles.projectEyebrow}>
                <MapPin size={15} aria-hidden="true" />{" "}
                {opportunity.location.toUpperCase()}
              </p>
              {opportunity.paragraphs.map((paragraph) => (
                <p key={paragraph.slice(0, 40)}>{paragraph}</p>
              ))}
            </div>
            <a className="button button-primary" href="#accredited">
              Learn more <ArrowRight size={18} aria-hidden="true" />
            </a>
          </article>
        </div>
      </section>

      <section
        id="accredited"
        className="oc-section oc-section-warm page-anchor"
        aria-labelledby="accredited-heading"
      >
        <div className="container">
          <div className="oc-heading">
            <p className="eyebrow">
              <span /> BEFORE YOU CONTINUE
            </p>
            <h2 id="accredited-heading">{accreditedAcknowledgement.title}</h2>
          </div>
          <div className="oc-gate">
            {accreditedAcknowledgement.paragraphs.map((paragraph) => (
              <p key={paragraph.slice(0, 40)}>{paragraph}</p>
            ))}
            <p className="oc-gate-statement">
              {accreditedAcknowledgement.statement}
            </p>
            <Link
              href={accreditedAcknowledgement.href}
              className="button button-primary"
            >
              {accreditedAcknowledgement.buttonLabel}{" "}
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <section
        className="oc-section"
        aria-labelledby="presentation-heading"
      >
        <div className="container oc-split oc-split-wide">
          <div className="oc-copy">
            <p className="eyebrow">
              <span /> INVESTOR PRESENTATION
            </p>
            <h2 id="presentation-heading">
              {investCopy.presentation.title}
            </h2>
            <p>
              An overview of the Edmonton Multiplex Limited Partnership
              opportunity. The full project page carries the offering summary,
              financing terms, documents and investor FAQs.
            </p>
            <div className="oc-actions">
              <Link
                href="/edmonton-multiplex-lp-1/"
                className="button button-primary"
              >
                View the project page{" "}
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
            </div>
          </div>
          <div>
            <div className="oc-embed">
              <iframe
                loading="lazy"
                src={investCopy.presentation.embed}
                title="RedDev investor presentation"
                allowFullScreen
              />
            </div>
            <p className="oc-embed-link">
              <a
                href={investCopy.presentation.link}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open the presentation in a new tab{" "}
                <ArrowUpRight size={13} aria-hidden="true" />
              </a>
            </p>
          </div>
        </div>
      </section>

      <section
        id="next-steps"
        className="page-section page-section-warm page-anchor"
        aria-labelledby="next-steps-heading"
      >
        <div className="container">
          <div className={styles.stepsIntro}>
            <div>
              <p className="eyebrow">
                <span />
                NEXT STEPS TO INVEST
              </p>
              <h2 id="next-steps-heading">
                Review, connect, and commit at your own pace.
              </h2>
            </div>
            <p>
              Each step keeps you in control: read the materials, ask the
              questions that matter, and decide with your own advisers.
            </p>
          </div>

          <ol className={styles.stepsList}>
            {investCopy.nextSteps.map(({ number, title, description }, index) => {
              const Icon = stepIcons[index];
              return (
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
              );
            })}
          </ol>
        </div>
      </section>

      <section className="oc-section" aria-labelledby="experience-heading">
        <div className="container oc-split">
          <div className="oc-copy">
            <p className="eyebrow">
              <span /> WHY REDDEV
            </p>
            <h2 id="experience-heading">{investCopy.experience.title}</h2>
            <p className="oc-lead">{investCopy.experience.lead}</p>
            <p>{investCopy.experience.body}</p>
            <h3>{investCopy.distributions.title}</h3>
            <p>{investCopy.distributions.body}</p>
            <p className="oc-caveat">{investCopy.distributions.caveat}</p>
            <div className="oc-actions">
              <Link
                href="/contact/?type=investment"
                className="button button-primary"
              >
                Invest with RedDev <ArrowUpRight size={18} aria-hidden="true" />
              </Link>
            </div>
          </div>
          <figure className="oc-figure oc-figure-contain">
            <Image
              src={investCopy.distributions.image.src}
              alt={investCopy.distributions.image.alt}
              width={investCopy.distributions.image.width}
              height={investCopy.distributions.image.height}
              sizes="(max-width: 900px) 100vw, 45vw"
            />
          </figure>
        </div>
      </section>

      <section className="page-section page-section-warm">
        <div className={`container ${styles.informationGrid}`}>
          <PageNote title="Important information">
            <p>
              Material on this website is not financial advice. Please consult a
              certified financial advisor. The content and information on this
              website is not an investment offer, and any offer will be made in
              the form of a private placement memorandum. Opportunities shared
              on this website are only open to accredited investors.
            </p>
            <p>
              Real estate investments involve risk. Consider the information with
              independent professional advisers before making any decision, and
              read the{" "}
              <Link href="/investment-disclosures/">
                Investment Disclosures
              </Link>
              .
            </p>
          </PageNote>
          <aside
            className={styles.contactAside}
            aria-labelledby="questions-heading"
          >
            <p className={styles.contactKicker}>QUESTIONS ABOUT INVESTING?</p>
            <h3 id="questions-heading">Speak with the investment team.</h3>
            <p>
              Ask about the Edmonton Multiplex LP, request the investor package
              or discuss your eligibility.
            </p>
            <Link
              className="button button-outline"
              href="/contact/?type=investment"
            >
              Contact the team <ArrowUpRight size={18} aria-hidden="true" />
            </Link>
          </aside>
        </div>
      </section>

      <PageCallout
        title="Have a question? Get in touch with us today."
        description="The RedDev team is available to discuss our opportunities and the next steps to invest."
        href="/contact/?type=investment"
        label="Contact Us"
      />
    </>
  );
}
