import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";

import {
  PageCallout,
  PageHero,
  PageNote,
} from "@/components/marketing/PageShell";
import { pageMetadata } from "@/lib/metadata";
import styles from "./page.module.css";

export const metadata = pageMetadata({
  title: "Student Housing",
  description:
    "Explore RedDev’s student-housing focus in Edmonton, including furnished accommodation, utilities, Wi-Fi and a university-community setting.",
  path: "/student-housing/",
});

const accommodationDetails = [
  {
    term: "Furnished living",
    description:
      "The original RedDev page describes fully furnished student housing designed to make the move-in experience more straightforward.",
  },
  {
    term: "Everyday essentials",
    description:
      "Utilities and Wi-Fi are identified in the original material as part of the student-housing service. Please ask the team to confirm current inclusions.",
  },
  {
    term: "Student-oriented setting",
    description:
      "The public page positions the housing near Edmonton university communities, with amenities intended to support student life.",
  },
];

export default function StudentHousingPage() {
  return (
    <>
      <PageHero
        eyebrow="STUDENT HOUSING"
        title="Housing shaped around Edmonton’s student community."
        description="RedDev’s original student-housing material centres on purpose-built, furnished accommodation near Edmonton university communities, with everyday essentials considered together."
        breadcrumbLabel="Student Housing"
        image={{
          src: "/brand/student-housing-exterior.jpg",
          alt: "Two people tending grounds outside a multi-unit residential building",
        }}
      />

      <section
        className={`page-section ${styles.introduction}`}
        aria-labelledby="student-housing-overview"
      >
        <div className="container page-split">
          <div>
            <p className="eyebrow">
              <span /> A STUDENT-CENTRED APPROACH
            </p>
            <h2 id="student-housing-overview">
              A considered place to live while studying.
            </h2>
          </div>
          <div className="copy-flow">
            <p>
              RedDev’s original public material presents accessible,
              purpose-built student housing in Edmonton. Its focus is on a
              practical housing experience for students, from furnished living
              spaces to the services and amenities that support day-to-day life.
            </p>
            <p>
              If you are looking for current accommodation information, the team
              can help direct your question. For investment information, please
              use the separate investment inquiry route.
            </p>
            <div className={styles.audienceLinks}>
              <Link
                href="/contact/?type=student-housing"
                className="button button-gold"
              >
                Ask About Student Housing{" "}
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <Link href="/contact/?type=investment" className="text-link">
                Investment Questions{" "}
                <ArrowUpRight size={18} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section
        className={`page-section page-section-warm ${styles.livingSection}`}
        aria-labelledby="living-heading"
      >
        <div className={`container ${styles.livingLayout}`}>
          <figure className={styles.interiorFigure}>
            <Image
              src="/brand/student-kitchen.jpg"
              alt="Bright kitchen with an island, pendant lights and black appliances"
              width={4269}
              height={2400}
              sizes="(max-width: 900px) 100vw, 52vw"
            />
            <figcaption>
              Illustrative image from the original RedDev student-housing page;
              it does not confirm a current accommodation, configuration or
              availability.
            </figcaption>
          </figure>
          <div className={`copy-flow ${styles.livingCopy}`}>
            <p className="eyebrow">
              <span /> IN EDMONTON
            </p>
            <h2 id="living-heading">A university-community context.</h2>
            <p>
              The student-housing page places its accommodation offering within
              Edmonton’s university communities. The intent is straightforward:
              provide housing that responds to the routines of student life
              while keeping the living experience considered and connected.
            </p>
            <p>
              The exterior and interior images on this page are retained from
              the original RedDev student-housing page as illustrative context
              only. They are not statements of present ownership, project status
              or an active housing offer.
            </p>
          </div>
        </div>
      </section>

      <section
        className={`page-section ${styles.detailsSection}`}
        aria-labelledby="details-heading"
      >
        <div className="container page-split">
          <div>
            <p className="eyebrow">
              <span /> WHAT THE ORIGINAL PAGE DESCRIBES
            </p>
            <h2 id="details-heading">Furnished, connected accommodation.</h2>
          </div>
          <dl className={styles.accommodationList}>
            {accommodationDetails.map((detail) => (
              <div key={detail.term}>
                <dt>{detail.term}</dt>
                <dd>{detail.description}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section
        className={`page-section page-section-warm ${styles.confirmationSection}`}
        aria-labelledby="current-information-heading"
      >
        <div className={`container ${styles.confirmationLayout}`}>
          <div>
            <p className="eyebrow">
              <span /> CURRENT INFORMATION
            </p>
            <h2 id="current-information-heading">
              Ask the team about the details that matter to you.
            </h2>
          </div>
          <PageNote title="Project details are being reconciled">
            <p>
              The original material refers separately to Garneau multiplexes and
              a Queen Alexandra flagship. Their configurations should not be
              combined. Current locations, accommodation details, amenities and
              availability need confirmation directly from the RedDev team.
            </p>
          </PageNote>
        </div>
      </section>

      <section
        className={`page-section ${styles.faqSection}`}
        aria-labelledby="student-faqs"
      >
        <div className={`container ${styles.faqLayout}`}>
          <div>
            <p className="eyebrow">
              <span /> FREQUENTLY ASKED QUESTIONS
            </p>
            <h2 id="student-faqs">Questions about student housing.</h2>
            <p>
              For current details tailored to your question, please contact the
              team directly.
            </p>
          </div>
          <div className={styles.faqs}>
            <details>
              <summary>Is the student housing furnished?</summary>
              <p>
                The original RedDev page describes fully furnished housing.
                Please contact the team to confirm current furnishings for a
                particular location.
              </p>
            </details>
            <details>
              <summary>Are utilities and Wi-Fi included?</summary>
              <p>
                The original material refers to utilities and Wi-Fi. The team
                can confirm what is currently included.
              </p>
            </details>
            <details>
              <summary>Is the housing near university communities?</summary>
              <p>
                The original page positions the housing near Edmonton university
                communities. Ask the team for current location information.
              </p>
            </details>
            <details>
              <summary>
                I have an investment question. Where should I start?
              </summary>
              <p>
                Use the separate investment inquiry route so your question
                reaches the appropriate RedDev team member.
              </p>
              <Link
                href="/contact/?type=investment"
                className={styles.inlineQuestionLink}
              >
                Ask an investment question{" "}
                <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
            </details>
          </div>
        </div>
      </section>

      <PageCallout
        title="Have a student-housing question?"
        description="For current accommodation, inclusion or location information, connect directly with the RedDev team."
        href="/contact/?type=student-housing"
        label="Ask About Student Housing"
      />
    </>
  );
}
