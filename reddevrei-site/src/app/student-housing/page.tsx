import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Download } from "lucide-react";

import { PageCallout, PageHero } from "@/components/marketing/PageShell";
import { studentHousing as sh, type Picture } from "@/content/student-housing";
import { pageMetadata } from "@/lib/metadata";
import styles from "./page.module.css";

export const metadata = pageMetadata({
  title: "Student Housing",
  description:
    "High-quality, affordable purpose-built student accommodations in Edmonton, Alberta: furnished suites near the University of Alberta, floor plans, amenities and the tenant portal.",
  path: "/student-housing/",
});

function Figure({
  picture,
  sizes,
  contain = false,
  caption,
}: {
  picture: Picture;
  sizes: string;
  contain?: boolean;
  caption?: string;
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
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}

export default function StudentHousingPage() {
  return (
    <>
      <PageHero
        eyebrow="STUDENT HOUSING"
        title={sh.hero.subtitle}
        description={sh.mission.body}
        breadcrumbLabel="Student Housing"
        image={{
          src: "/brand/student-housing-exterior.jpg",
          alt: "Two people tending grounds outside a multi-unit residential building",
        }}
      />

      <section
        className={`page-section ${styles.introduction}`}
        aria-labelledby="mission-heading"
      >
        <div className="container oc-split">
          <div className="oc-copy">
            <p className="eyebrow">
              <span /> MISSION STATEMENT
            </p>
            <h2 id="mission-heading">
              Accessible, affordable, purpose-built student housing.
            </h2>
            <p>{sh.mission.body}</p>
            <div className={styles.audienceLinks}>
              <Link href={sh.hero.cta.href} className="button button-gold">
                {sh.hero.cta.label} <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <Link href="/contact/?type=investment" className="text-link">
                Investment Questions{" "}
                <ArrowUpRight size={18} aria-hidden="true" />
              </Link>
            </div>
          </div>
          <div className="oc-gallery oc-gallery-2">
            {sh.mission.images.map((picture) => (
              <Figure key={picture.src} picture={picture} sizes="(max-width: 900px) 50vw, 25vw" />
            ))}
          </div>
        </div>
      </section>

      <section className="oc-section oc-section-warm" aria-labelledby="demand-heading">
        <div className="container oc-split">
          <div className="oc-copy">
            <p className="eyebrow">
              <span /> MARKET DEMAND
            </p>
            <h2 id="demand-heading">
              2.2 million students. About 200,000 purpose-built beds.
            </h2>
            <p>{sh.demand.body}</p>
          </div>
          <div className="oc-copy">
            <p className="eyebrow">
              <span /> MULTIPLEX HOUSING
            </p>
            <h2>{sh.multiplex.title}</h2>
            <p>{sh.multiplex.body}</p>
          </div>
        </div>
      </section>

      <section className="oc-section" aria-labelledby="multiplex-heading">
        <div className="container oc-split oc-split-reverse">
          <Figure picture={sh.multiplex.image} sizes="(max-width: 900px) 100vw, 45vw" />
          <div className="oc-copy">
            <h2 id="multiplex-heading">{sh.multiplex.subtitle}</h2>
            <p>{sh.multiplex.detail}</p>
            <div className="oc-actions">
              <a
                href={sh.multiplex.document.href}
                className="button button-primary"
                target="_blank"
                rel="noopener noreferrer"
              >
                {sh.multiplex.document.label}{" "}
                <Download size={17} aria-hidden="true" />
              </a>
            </div>
            <p className="oc-small">{sh.multiplex.document.note}</p>
          </div>
        </div>
      </section>

      <section
        id="projects"
        className="oc-section oc-section-warm page-anchor"
        aria-labelledby="projects-heading"
      >
        <div className="container">
          <div className="oc-heading">
            <p className="eyebrow">
              <span /> CURRENT PROJECTS
            </p>
            <h2 id="projects-heading">{sh.projects.edmonton.title}</h2>
          </div>
          <div className="oc-split oc-split-wide">
            <Figure picture={sh.projects.photo} sizes="(max-width: 900px) 100vw, 45vw" />
            <div className="oc-copy">
              <p>{sh.projects.edmonton.body}</p>
              <h3>{sh.projects.units.title}</h3>
              <p>{sh.projects.units.body}</p>
            </div>
          </div>
          <div className={`oc-split oc-split-wide ${styles.projectDetails}`}>
            <Figure picture={sh.projects.edmonton.image} sizes="(max-width: 900px) 100vw, 45vw" />
            <div className="oc-split">
              <Figure picture={sh.projects.units.map} sizes="(max-width: 900px) 100vw, 22vw" contain />
              <div className="oc-copy">
                <h3>{sh.projects.distances.title}</h3>
                <ul className="oc-check-list">
                  {sh.projects.distances.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="oc-section" aria-labelledby="features-heading">
        <div className="container oc-split oc-split-wide">
          <div className="oc-copy">
            <p className="eyebrow">
              <span /> {sh.unitFeatures.kicker.toUpperCase()}
            </p>
            <h2 id="features-heading">{sh.unitFeatures.title}</h2>
            {sh.unitFeatures.groups.map((group) => (
              <div key={group.title}>
                <h4>{group.title}</h4>
                <ul className="oc-check-list">
                  {group.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <Figure picture={sh.unitFeatures.graphic} sizes="(max-width: 900px) 100vw, 55vw" contain />
        </div>
      </section>

      <section className="oc-section oc-section-warm" aria-labelledby="plans-heading">
        <div className="container">
          <div className="oc-heading">
            <p className="eyebrow">
              <span /> LAYOUTS
            </p>
            <h2 id="plans-heading">{sh.floorPlans.title}</h2>
          </div>
          <div className="oc-gallery oc-gallery-3 oc-gallery-natural">
            {sh.floorPlans.images.map((picture) => (
              <Figure key={picture.src} picture={picture} sizes="(max-width: 600px) 100vw, 33vw" contain />
            ))}
          </div>
        </div>
      </section>

      <section className="oc-section" aria-labelledby="kitchen-heading">
        <div className="container oc-split">
          <div className="oc-copy">
            <h2 id="kitchen-heading">{sh.kitchen.title}</h2>
            <p>{sh.kitchen.body}</p>
          </div>
          <div className="oc-copy">
            <h2>{sh.furniture.title}</h2>
            <p>{sh.furniture.body}</p>
          </div>
        </div>
      </section>

      <section className="oc-section oc-section-warm" aria-labelledby="bedroom-heading">
        <div className="container">
          <div className="oc-heading">
            <h2 id="bedroom-heading">{sh.bedroom.title}</h2>
          </div>
          <div className="oc-gallery oc-gallery-4">
            {sh.bedroom.images.map((picture) => (
              <Figure key={picture.src} picture={picture} sizes="(max-width: 600px) 100vw, 25vw" />
            ))}
          </div>
        </div>
      </section>

      <section className="oc-section" aria-labelledby="portal-heading">
        <div className="container oc-split oc-split-reverse">
          <div className="oc-gallery oc-gallery-2">
            {sh.portal.images.map((picture) => (
              <Figure key={picture.src} picture={picture} sizes="(max-width: 900px) 50vw, 25vw" />
            ))}
          </div>
          <div className="oc-copy">
            <p className="eyebrow">
              <span /> MULTIPLEX HOUSING APP
            </p>
            <h2 id="portal-heading">{sh.portal.title}</h2>
            <p>{sh.portal.body}</p>
          </div>
        </div>
      </section>

      <section className="oc-section oc-section-warm" aria-labelledby="amenities-heading">
        <div className="container oc-split">
          <div className="oc-copy">
            <h2 id="amenities-heading">{sh.amenities.title}</h2>
            <p>{sh.amenities.body}</p>
          </div>
          <div className="oc-gallery oc-gallery-2 oc-gallery-natural">
            {sh.amenities.images.map((picture) => (
              <Figure key={picture.src} picture={picture} sizes="(max-width: 900px) 50vw, 25vw" contain />
            ))}
          </div>
        </div>
      </section>

      <section className="oc-section" aria-labelledby="infrastructure-heading">
        <div className="container">
          <div className="oc-heading">
            <h2 id="infrastructure-heading">{sh.infrastructure.title}</h2>
          </div>
          <div className="oc-blurbs">
            {sh.infrastructure.blurbs.map((blurb) => (
              <div className="oc-blurb" key={blurb.title}>
                <h3>{blurb.title}</h3>
                <p>{blurb.body}</p>
              </div>
            ))}
          </div>
          <div className={`oc-gallery oc-gallery-2 ${styles.infrastructureGallery}`}>
            {sh.infrastructure.images.map((picture) => (
              <Figure key={picture.src} picture={picture} sizes="(max-width: 900px) 100vw, 50vw" />
            ))}
          </div>
        </div>
      </section>

      <section className="oc-section oc-section-warm" aria-labelledby="referral-heading">
        <div className="container oc-split">
          <div className="oc-copy">
            <h2 id="referral-heading">{sh.referral.title}</h2>
            <p>{sh.referral.body}</p>
          </div>
          <Figure picture={sh.referral.image} sizes="(max-width: 900px) 100vw, 45vw" />
        </div>
      </section>

      <section
        id="investing"
        className="oc-section oc-section-dark page-anchor"
        aria-labelledby="investing-heading"
      >
        <div className="container oc-split">
          <div className="oc-copy">
            <p className="eyebrow">
              <span /> SMART HOUSING, SMARTER INVESTING
            </p>
            <h2 id="investing-heading">{sh.investing.lead}</h2>
            <p>{sh.investing.body}</p>
            <div className="oc-actions">
              <Link href={sh.investing.cta.href} className="button button-gold">
                {sh.investing.cta.label}{" "}
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <Link href="/contact/?type=investment" className="button button-light-outline">
                Speak with the team{" "}
                <ArrowUpRight size={18} aria-hidden="true" />
              </Link>
            </div>
          </div>
          <div className="oc-copy">
            <h3>{sh.investing.whyTitle}</h3>
            <ul className="oc-check-list">
              {sh.investing.why.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="oc-small">
              Valuation and vacancy figures are as stated on RedDev’s original
              page. Investment information is subject to the{" "}
              <Link href="/investment-disclosures/">
                Investment Disclosures
              </Link>{" "}
              and the formal offering documents.
            </p>
          </div>
        </div>
      </section>

      <section className="oc-section" aria-labelledby="leasing-heading">
        <div className="container oc-split oc-split-reverse">
          <Figure picture={sh.leasing.image} sizes="(max-width: 900px) 100vw, 45vw" />
          <div className="oc-copy">
            <p className="eyebrow">
              <span /> PRE-LEASING
            </p>
            <h2 id="leasing-heading">{sh.leasing.title}</h2>
            <p>{sh.leasing.body}</p>
            <div className="oc-actions">
              <Link href={sh.leasing.cta.href} className="button button-primary">
                {sh.leasing.cta.label} <ArrowRight size={18} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <PageCallout
        title="Have a question? Get in touch with us today."
        description="Ask about units, pre-leasing availability or the investment opportunity behind RedDev’s student housing."
        href="/contact/?type=student-housing"
        label="Contact Us"
      />
    </>
  );
}
