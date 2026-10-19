import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import {
  PageCallout,
  PageHero,
  PageNote,
} from "@/components/marketing/PageShell";
import { aboutCopy } from "@/content/company";
import { TeamProfiles } from "@/components/marketing/TeamProfiles";
import { pageMetadata } from "@/lib/metadata";
import styles from "./page.module.css";

export const metadata = pageMetadata({
  title: "About Us",
  description:
    "Learn about RedDev Real Estate Investments, its company principles, and the people behind its work.",
  path: "/about-us/",
});

const values = [
  {
    title: "Integrity",
    copy: "We believe in conducting our business with the highest honesty and transparency. We are committed to maintaining open lines of communication with our investors and partners, and we hold ourselves accountable for delivering on our promises.",
  },
  {
    title: "Excellence",
    copy: "We strive for excellence in everything we do, from the properties we invest in to the service we provide to our investors and tenants. We constantly seek ways to improve and innovate, and we are unsatisfied with nothing less than the best.",
  },
  {
    title: "Value Creation",
    copy: "Our primary goal is to create value for our investors, tenants, and the communities we serve. We achieve this through strategic property investments, value-add strategies, and proactive property management.",
  },
  {
    title: "Collaboration",
    copy: "We believe in the power of collaboration and strategic partnerships. We can leverage our collective strengths and resources to achieve greater success by working together.",
  },
  {
    title: "Community Impact",
    copy: "We are committed to enhancing communities and enriching lives through our investments. We strive to create great places to call home and to make a positive impact on the communities we serve.",
  },
];

export default function AboutUsPage() {
  return (
    <>
      <PageHero
        eyebrow="ABOUT REDDEV"
        title="Experience, brought together."
        description="A RedDev profile, its guiding principles, and the people whose experience informs the work."
        breadcrumbLabel="About Us"
      />

      <section
        id="company"
        className={`page-section ${styles.company} page-anchor`}
      >
        <div className={`container page-split ${styles.companySplit}`}>
          <div>
            <p className="eyebrow">
              <span />
              OUR COMPANY
            </p>
            <h2>Built around thoughtful real estate work.</h2>
            <div className={styles.companyRule} aria-hidden="true" />
          </div>
          <div className="copy-flow">
            <p className={styles.lead}>{aboutCopy.company[0]}</p>
            <p>{aboutCopy.company[1]}</p>
            <Link className="text-link" href="#team">
              Meet the RedDev team <ArrowUpRight size={18} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <section
        className={`page-section-warm ${styles.direction}`}
        aria-labelledby="direction-heading"
      >
        <div className={`container ${styles.directionLayout}`}>
          <div className={styles.directionIntro}>
            <p className="eyebrow">
              <span />
              OUR DIRECTION
            </p>
            <h2 id="direction-heading">A long view of value and community.</h2>
          </div>
          <div className={styles.directionCopy}>
            <section>
              <p className={styles.directionLabel}>VISION</p>
              <p>{aboutCopy.vision}</p>
            </section>
            <section>
              <p className={styles.directionLabel}>MISSION</p>
              <p>{aboutCopy.mission}</p>
            </section>
          </div>
        </div>
      </section>

      <section
        className={`page-section ${styles.values}`}
        aria-labelledby="values-heading"
      >
        <div className="container">
          <div className={styles.valuesHeading}>
            <div>
              <p className="eyebrow">
                <span />
                GUIDING PRINCIPLES
              </p>
              <h2 id="values-heading">What guides the work.</h2>
            </div>
            <p>{aboutCopy.valuesIntro}</p>
          </div>
          <dl className={styles.valuesList}>
            {values.map((value, index) => (
              <div key={value.title}>
                <dt>
                  <span aria-hidden="true">0{index + 1}</span>
                  {value.title}
                </dt>
                <dd>{value.copy}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section
        id="team"
        className={`page-section-warm ${styles.team} page-anchor`}
        aria-labelledby="team-heading"
      >
        <div className="container">
          <div className={styles.teamHeading}>
            <div>
              <p className="eyebrow">
                <span />
                MEET OUR TEAM
              </p>
              <h2 id="team-heading">People behind the perspective.</h2>
            </div>
            <p>{aboutCopy.teamIntro}</p>
          </div>

          <PageNote title="Profile and contact information">
            <p>
              Roles, biographies, and individual contact details below are
              transcribed from RedDev’s current public About page. They are
              provided for reference in this preview and should be reconfirmed
              before publication.
            </p>
          </PageNote>

          <TeamProfiles />
        </div>
      </section>

      <PageCallout
        title="The right partnership starts with a conversation."
        description="For current information about RedDev, its work, or the team, contact us directly."
        href="/contact/?type=general-question"
        label="Contact RedDev"
      />
    </>
  );
}
