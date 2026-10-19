import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import {
  PageCallout,
  PageHero,
  PageNote,
} from "@/components/marketing/PageShell";
import { aboutCopy } from "@/content/company";
import { teamProfiles } from "@/content/team-profiles";
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

function initialsFor(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("");
}

function phoneHref(phone: string) {
  return `tel:+1${phone.replace(/\D/g, "")}`;
}

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

          <div className={styles.teamGrid}>
            {teamProfiles.map((profile, index) => (
              <article className={styles.profile} key={profile.name}>
                <div className={styles.profileMedia}>
                  {profile.image ? (
                    <Image
                      src={profile.image}
                      alt={`Portrait of ${profile.name}`}
                      fill
                      sizes="(max-width: 620px) 42vw, (max-width: 980px) 28vw, 20vw"
                    />
                  ) : (
                    <div className={styles.initials} aria-hidden="true">
                      {initialsFor(profile.name)}
                    </div>
                  )}
                </div>
                <div className={styles.profileBody}>
                  <p className={styles.profileNumber} aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </p>
                  <h3>{profile.name}</h3>
                  <p className={styles.role}>{profile.role}</p>
                  <details className={styles.profileDetails}>
                    <summary>
                      <span>Read profile</span>
                      <ChevronDown size={18} aria-hidden="true" />
                    </summary>
                    <div className={styles.profileExpanded}>
                      {profile.bio.map((paragraph) => (
                        <p key={paragraph}>{paragraph}</p>
                      ))}
                      {(profile.email || profile.phone) && (
                        <div
                          className={styles.profileContact}
                          aria-label={`Public contact details for ${profile.name}`}
                        >
                          {profile.email && (
                            <a href={`mailto:${profile.email}`}>
                              {profile.email}
                            </a>
                          )}
                          {profile.phone && (
                            <a href={phoneHref(profile.phone)}>
                              {profile.phone}
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  </details>
                </div>
              </article>
            ))}
          </div>
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
