import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { PageCallout, PageHero } from "@/components/marketing/PageShell";
import { approach } from "@/content/approach";
import { approachDetail } from "@/content/approach-detail";
import { pageMetadata } from "@/lib/metadata";
import styles from "./page.module.css";

export const metadata = pageMetadata({
  title: "Our Approach",
  description:
    "RedDev follows a systematic process to identify, acquire, enhance, manage and report on multifamily investments, using real estate syndication under an Offering Memorandum.",
  path: "/our-approach/",
});

const stageId = (title: string) =>
  title.toLowerCase().replaceAll(" & ", "-").replaceAll(" ", "-");

const anchors = approach.map((step) => ({
  label: `${step.number} ${step.title}`,
  href: `#${stageId(step.title)}`,
}));

export default function OurApproachPage() {
  return (
    <>
      <PageHero
        eyebrow="INVESTMENT APPROACH"
        title="We follow a systematic process."
        description="Identify, acquire, enhance, manage and report. A vertically integrated model that keeps control over quality, costs and performance at every stage."
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
              <span /> OUR INVESTMENT APPROACH
            </p>
            <h2 id="approach-overview">
              Grounded in market understanding and thorough due diligence.
            </h2>
            <figure className={`oc-figure oc-figure-contain ${styles.graphic}`}>
              <Image
                src={approachDetail.graphics.syndication.src}
                alt={approachDetail.graphics.syndication.alt}
                width={approachDetail.graphics.syndication.width}
                height={approachDetail.graphics.syndication.height}
                sizes="(max-width: 900px) 60vw, 30vw"
              />
              <figcaption>{approachDetail.dueDiligenceCaption}</figcaption>
            </figure>
          </div>
          <div className="copy-flow">
            <p>{approachDetail.overview}</p>
            <figure className={`oc-figure oc-figure-contain ${styles.graphic}`}>
              <Image
                src={approachDetail.graphics.funnel.src}
                alt={approachDetail.graphics.funnel.alt}
                width={approachDetail.graphics.funnel.width}
                height={approachDetail.graphics.funnel.height}
                sizes="(max-width: 900px) 100vw, 50vw"
              />
            </figure>
            <p>{approachDetail.syndication}</p>
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
              const detail = approachDetail.stages.find(
                (stage) => stage.title === step.title,
              );
              return (
                <li
                  id={stageId(step.title)}
                  className={`page-anchor ${styles.step}`}
                  key={step.number}
                >
                  <div className={styles.stepNumber} aria-hidden="true">
                    {step.number}
                  </div>
                  <article className={`${styles.stepBody} oc-copy`}>
                    <p className={styles.stepDetail}>{step.detail}</p>
                    <h3>{step.title}</h3>
                    {(detail?.paragraphs ?? [step.description]).map(
                      (paragraph) => (
                        <p key={paragraph.slice(0, 40)}>{paragraph}</p>
                      ),
                    )}
                    {detail?.more && (
                      <Link href={detail.more.href} className="text-link">
                        {detail.more.label}{" "}
                        <ArrowUpRight size={17} aria-hidden="true" />
                      </Link>
                    )}
                  </article>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <section
        id="advantages"
        className="oc-section page-anchor"
        aria-labelledby="advantages-heading"
      >
        <div className="container">
          <div className="oc-heading">
            <p className="eyebrow">
              <span /> WHY REDDEV
            </p>
            <h2 id="advantages-heading">{approachDetail.advantages.title}</h2>
            <p>{approachDetail.advantages.intro}</p>
          </div>
          <div className="oc-blurbs">
            {approachDetail.advantages.items.map((item, index) => (
              <div className="oc-blurb" key={item.title}>
                <span className="oc-blurb-number" aria-hidden="true">
                  0{index + 1}
                </span>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        className={`page-section page-section-warm ${styles.nextSection}`}
        aria-labelledby="next-conversation"
      >
        <div className={`container ${styles.nextLayout}`}>
          <div>
            <p className="eyebrow">
              <span /> START A CONVERSATION
            </p>
            <h2 id="next-conversation">Questions about the approach?</h2>
            <p>
              Connect with the team to discuss the process, current
              opportunities and the formal offering materials.
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
        title="Have a question? Get in touch with us today."
        description="Material on this website is not financial advice and is not an investment offer; any offer will be made in the form of a private placement memorandum."
        href="/contact/?type=general-question"
        label="Contact Us"
      />
    </>
  );
}
