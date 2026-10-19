import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Download, Film } from "lucide-react";

import { PageCallout, PageHero } from "@/components/marketing/PageShell";
import { TeamProfiles } from "@/components/marketing/TeamProfiles";
import { edmontonLp as lp } from "@/content/edmonton-lp";
import { edmontonLpFaq } from "@/content/edmonton-lp-faq";
import type { Picture } from "@/content/student-housing";
import { pageMetadata } from "@/lib/metadata";

import styles from "./page.module.css";

export const metadata = pageMetadata({
  title: "Edmonton Multiplex LP 1",
  description:
    "Edmonton MultiPlex Limited Partnership 1: an 8-unit purpose-built student housing development near the University of Alberta. Offering summary, financing terms, documents and investor FAQs.",
  path: "/edmonton-multiplex-lp-1/",
});

function Figure({
  picture,
  sizes,
  contain = false,
}: {
  picture: Picture;
  sizes: string;
  contain?: boolean;
}) {
  return (
    <figure className={`oc-figure${contain ? " oc-figure-contain" : ""}`}>
      <Image
        src={picture.src}
        alt={picture.alt}
        width={picture.width}
        height={picture.height}
        sizes={sizes}
      />
    </figure>
  );
}

/** Renders FAQ answer lines: runs of "- " lines become one list. */
function FaqBody({ lines }: { lines: string[] }) {
  const blocks: Array<{ type: "p"; text: string } | { type: "ul"; items: string[] }> = [];
  for (const line of lines) {
    if (line.startsWith("- ")) {
      const last = blocks[blocks.length - 1];
      if (last && last.type === "ul") last.items.push(line.slice(2));
      else blocks.push({ type: "ul", items: [line.slice(2)] });
    } else {
      blocks.push({ type: "p", text: line });
    }
  }
  return (
    <div className="oc-faq-body">
      {blocks.map((block, index) =>
        block.type === "p" ? (
          <p key={index}>{block.text}</p>
        ) : (
          <ul key={index}>
            {block.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ),
      )}
    </div>
  );
}

export default function EdmontonMultiplexLpPage() {
  return (
    <>
      <PageHero
        eyebrow="CURRENT OPPORTUNITIES"
        title="Edmonton MultiPlex Limited Partnership 1"
        description="An 8-unit purpose-built student housing development within walking distance of the University of Alberta. Available to accredited investors only."
        breadcrumbLabel="Edmonton Multiplex LP 1"
        parent={{ label: "Invest With Us", href: "/invest/" }}
        image={{
          src: "/brand/edmonton-bridge.jpg",
          alt: "Walterdale Bridge in Edmonton, Alberta",
        }}
      />

      <section className="oc-section" aria-labelledby="introduction-heading">
        <div className="container">
          <p className="oc-notice">{lp.notice}</p>
          <div className={`oc-split oc-split-wide ${styles.introGrid}`}>
            <div className="oc-copy">
              <p className="eyebrow">
                <span /> INTRODUCTION
              </p>
              <h2 id="introduction-heading">{lp.introduction.title}</h2>
              {lp.introduction.paragraphs.map((paragraph) => (
                <p key={paragraph.slice(0, 40)}>{paragraph}</p>
              ))}
              <p>
                <strong>{lp.introduction.eligibility}</strong>
              </p>
              <div className="oc-actions">
                <a
                  href={lp.documents.indicationOfInterest.href}
                  className="button button-primary"
                >
                  Register Interest <Download size={17} aria-hidden="true" />
                </a>
                <Link
                  href="/contact/?type=investment"
                  className="button button-outline"
                >
                  Speak with the team{" "}
                  <ArrowUpRight size={18} aria-hidden="true" />
                </Link>
              </div>
              <p className="oc-small">
                {lp.documents.indicationOfInterest.label} (
                {lp.documents.indicationOfInterest.note}).
              </p>
            </div>
            <div className="oc-copy">
              <p className="oc-small">{lp.preliminary}</p>
            </div>
          </div>
        </div>
      </section>

      <section
        id="summary"
        className="oc-section oc-section-warm page-anchor"
        aria-labelledby="summary-heading"
      >
        <div className="container">
          <div className="oc-heading">
            <p className="eyebrow">
              <span /> INVESTMENT SUMMARY
            </p>
            <h2 id="summary-heading">{lp.summary.title}</h2>
            <p>{lp.summary.body}</p>
          </div>
          <Figure picture={lp.summary.graphic} sizes="(max-width: 900px) 100vw, 1200px" contain />
        </div>
      </section>

      <section id="deal" className="oc-section page-anchor" aria-labelledby="deal-heading">
        <div className="container">
          <div className="oc-heading">
            <p className="eyebrow">
              <span /> {lp.deal.subtitle.toUpperCase()}
            </p>
            <h2 id="deal-heading">{lp.deal.title}</h2>
          </div>
          <div className="oc-split oc-split-wide">
            <div className="oc-copy">
              <h3>{lp.project.title}</h3>
              <p className="oc-lead">{lp.project.subtitle}</p>
              <p>{lp.project.body}</p>
              <p>{lp.project.problemSolution}</p>
              <div className={styles.dealFigures}>
                <ul className={styles.statTiles}>
                  {lp.deal.stats.map((stat) => (
                    <li
                      key={stat.label}
                      className={`${styles.statTile} ${stat.tone === "red" ? styles.statRed : styles.statBrown}`}
                    >
                      <span className={styles.statValue}>{stat.value}</span>
                      <span className={styles.statLabel}>{stat.label}</span>
                    </li>
                  ))}
                </ul>
                <table className={styles.returnsTable}>
                  <caption>{lp.deal.projectedReturns.title}</caption>
                  <tbody>
                    {lp.deal.projectedReturns.rows.map((row) => (
                      <tr key={row.term}>
                        <th scope="row">{row.term}</th>
                        <td>{row.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className={styles.returnsNote}>
                  Projections, not guarantees. See the{" "}
                  <a href="#returns">investor cash flow illustration</a> and
                  the Offering Documents.
                </p>
              </div>
            </div>
            <div>
              <Figure picture={lp.project.highlights} sizes="(max-width: 900px) 100vw, 45vw" contain />
              <p className="oc-small">
                <a
                  href={lp.project.video.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Film size={13} aria-hidden="true" /> {lp.project.video.label}
                </a>{" "}
                ({lp.project.video.note})
              </p>
            </div>
          </div>
          <div className={`oc-gallery oc-gallery-3 ${styles.dealGallery}`}>
            {lp.deal.gallery.map((picture) => (
              <Figure key={picture.src} picture={picture} sizes="(max-width: 600px) 100vw, 33vw" />
            ))}
          </div>
        </div>
      </section>

      <section className="oc-section oc-section-warm" aria-labelledby="why-edmonton-heading">
        <div className="container">
          <div className="oc-heading">
            <p className="eyebrow">
              <span /> {lp.whyEdmonton.subtitle.toUpperCase()}
            </p>
            <h2 id="why-edmonton-heading">{lp.whyEdmonton.title}</h2>
          </div>
          <dl className="oc-facts">
            {lp.whyEdmonton.items.map((item) => (
              <div key={item.term}>
                <dt>{item.term}</dt>
                <dd>{item.detail}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section id="returns" className="oc-section page-anchor" aria-labelledby="cash-flow-heading">
        <div className="container">
          <div className="oc-heading">
            <p className="eyebrow">
              <span /> {lp.cashFlow.subtitle.toUpperCase()}
            </p>
            <h2 id="cash-flow-heading">{lp.cashFlow.title}</h2>
          </div>
          <div className="oc-split oc-split-wide">
            <dl className="oc-facts" style={{ gridTemplateColumns: "1fr" }}>
              {lp.cashFlow.items.map((item) => (
                <div key={item.term}>
                  <dt>{item.term}</dt>
                  <dd>{item.detail}</dd>
                </div>
              ))}
            </dl>
            <div>
              <h3 className={styles.subheading}>Investment Highlights</h3>
              <div className="oc-gallery oc-gallery-2 oc-gallery-natural">
                {lp.cashFlow.graphics.map((picture) => (
                  <Figure key={picture.src} picture={picture} sizes="(max-width: 900px) 50vw, 25vw" contain />
                ))}
              </div>
            </div>
          </div>
          <p className="oc-caveat">{lp.cashFlow.caveat}</p>
        </div>
      </section>

      <section
        id="terms"
        className="oc-section oc-section-warm page-anchor"
        aria-labelledby="terms-heading"
      >
        <div className="container">
          <div className="oc-heading">
            <p className="eyebrow">
              <span /> SUMMARY OF TERMS
            </p>
            <h2 id="terms-heading">{lp.terms.title}</h2>
            <p>{lp.terms.body}</p>
          </div>
          <dl className="oc-terms">
            {lp.terms.rows.map((row) => (
              <div key={row.term}>
                <dt>{row.term}</dt>
                <dd>{row.detail}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section id="documents" className="oc-section page-anchor" aria-labelledby="documents-heading">
        <div className="container oc-split oc-split-wide">
          <div>
            <div className="oc-heading">
              <p className="eyebrow">
                <span /> {lp.moreInformation.title.toUpperCase()}
              </p>
              <h2 id="documents-heading">Documents and investor package</h2>
            </div>
            <div className="oc-doc-list">
              {[
                lp.documents.indicationOfInterest,
                lp.documents.corporateProfile,
                lp.documents.educationCosts,
                lp.documents.subcontractor,
              ].map((doc) => (
                <article className="oc-doc oc-doc-compact" key={doc.href}>
                  <div>
                    <h3>{doc.label}</h3>
                    <a
                      href={doc.href}
                      className="button button-outline"
                      {...(doc.href.startsWith("http")
                        ? { target: "_blank", rel: "noopener noreferrer" }
                        : {})}
                    >
                      Download <Download size={16} aria-hidden="true" />
                    </a>
                    <span className="oc-doc-note">{doc.note}</span>
                  </div>
                </article>
              ))}
              <article className="oc-doc oc-doc-compact">
                <div>
                  <h3>{lp.moreInformation.packageRequest.title}</h3>
                  <p>{lp.moreInformation.packageRequest.body}</p>
                  <Link
                    href={lp.moreInformation.packageRequest.cta.href}
                    className="button button-primary"
                  >
                    {lp.moreInformation.packageRequest.cta.label}{" "}
                    <ArrowUpRight size={17} aria-hidden="true" />
                  </Link>
                </div>
              </article>
            </div>
          </div>
          <div className="oc-gallery oc-gallery-2 oc-gallery-natural">
            {lp.moreInformation.images.map((picture) => (
              <Figure key={picture.src} picture={picture} sizes="(max-width: 900px) 50vw, 25vw" contain />
            ))}
          </div>
        </div>
      </section>

      <section
        id="presentation"
        className="oc-section oc-section-warm page-anchor"
        aria-labelledby="presentation-heading"
      >
        <div className="container">
          <div className="oc-heading">
            <p className="eyebrow">
              <span /> INVESTOR PRESENTATION
            </p>
            <h2 id="presentation-heading">{lp.presentation.title}</h2>
            <p>{lp.presentation.body}</p>
          </div>
          <div className="oc-embed">
            <iframe
              loading="lazy"
              src={lp.presentation.embed}
              title={lp.presentation.linkLabel}
              allowFullScreen
            />
          </div>
          <p className="oc-embed-link">
            <a href={lp.presentation.link} target="_blank" rel="noopener noreferrer">
              {lp.presentation.linkLabel}{" "}
              <ArrowUpRight size={13} aria-hidden="true" />
            </a>
          </p>
        </div>
      </section>

      <section id="faq" className="oc-section page-anchor" aria-labelledby="faq-heading">
        <div className="container">
          <div className="oc-heading">
            <p className="eyebrow">
              <span /> INVESTOR FAQS
            </p>
            <h2 id="faq-heading">Questions investors ask about the Edmonton Multiplex LP.</h2>
            <p>
              Below are answers to the most common questions. For more detailed
              information or personalized assistance, please contact a RedDev
              Real Estate Investments representative.
            </p>
          </div>
          <div className="oc-faq">
            {edmontonLpFaq.map((item) => (
              <details key={item.question}>
                <summary>{item.question}</summary>
                <FaqBody lines={item.lines} />
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="oc-section oc-section-warm" aria-labelledby="process-heading">
        <div className="container oc-split oc-split-wide">
          <div className="oc-copy">
            <p className="eyebrow">
              <span /> NEXT STEPS TO INVEST
            </p>
            <h2 id="process-heading">{lp.process.title}</h2>
            <p>{lp.process.intro}</p>
            <p>{lp.closing}</p>
          </div>
          <ol className="oc-steps">
            {lp.process.steps.map((step) => (
              <li key={step.title}>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="oc-section" aria-labelledby="team-heading">
        <div className="container">
          <div className="oc-heading">
            <p className="eyebrow">
              <span /> THE PEOPLE BEHIND THE PARTNERSHIP
            </p>
            <h2 id="team-heading">{lp.team.title}</h2>
            <p>{lp.team.intro}</p>
          </div>
          <TeamProfiles />
          <p className="oc-small">
            <Link href="/about-us/#team">
              Meet the full RedDev team <ArrowUpRight size={13} aria-hidden="true" />
            </Link>
          </p>
        </div>
      </section>

      <section className="oc-section oc-section-warm" aria-labelledby="programmes-heading">
        <div className="container">
          <h2 id="programmes-heading" className="sr-only">
            Investor programmes
          </h2>
          <div className="oc-split">
            <article className="oc-doc">
              <Figure picture={lp.education.image} sizes="150px" />
              <div>
                <h3>{lp.education.title}</h3>
                <p>{lp.education.body}</p>
                <a href={lp.documents.educationCosts.href} className="button button-primary">
                  Learn more <Download size={16} aria-hidden="true" />
                </a>
                <span className="oc-doc-note">{lp.documents.educationCosts.note}</span>
              </div>
            </article>
            <article className="oc-doc">
              <Figure picture={lp.subcontractors.image} sizes="150px" />
              <div>
                <h3>{lp.subcontractors.title}</h3>
                {lp.subcontractors.paragraphs.map((paragraph) => (
                  <p key={paragraph.slice(0, 30)}>{paragraph}</p>
                ))}
                <a
                  href={lp.documents.subcontractor.href}
                  className="button button-primary"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Learn more <Download size={16} aria-hidden="true" />
                </a>
                <span className="oc-doc-note">{lp.documents.subcontractor.note}</span>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="oc-section" aria-label="Disclaimer">
        <div className="container oc-copy">
          <p className="oc-small">
            Material on this website is not financial advice. Please consult a
            certified financial advisor. The content and information on this
            website is not an investment offer, and any offer will be made in
            the form of a private placement memorandum. Opportunities shared on
            this website are only open to accredited investors. Please read the{" "}
            <Link href="/investment-disclosures/">Investment Disclosures</Link>.
          </p>
        </div>
      </section>

      <PageCallout
        title="Have a question? Get in touch with us today."
        description="Request the investor package, register your interest or speak with the RedDev team about the Edmonton Multiplex LP."
        href="/contact/?type=investment"
        label="Contact Us"
      />
    </>
  );
}
