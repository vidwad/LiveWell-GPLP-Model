import Link from "next/link";
import { ArrowUpRight, Check } from "lucide-react";
import {
  PageCallout,
  PageHero,
  PageNote,
} from "@/components/marketing/PageShell";
import { pageMetadata } from "@/lib/metadata";
import styles from "./page.module.css";

export const metadata = pageMetadata({
  title: "Accessibility",
  description:
    "Learn about accessibility features on the RedDev public website and how to share feedback about an access barrier.",
  path: "/accessibility/",
});

const features = [
  "Semantic page headings and landmarks to support screen readers and other assistive technology.",
  "A skip link so keyboard users can move directly to the main content.",
  "Keyboard-operable navigation, with Escape closing an open menu and focus returning predictably.",
  "Responsive layouts that adapt across common screen sizes without hiding essential information.",
  "Reduced-motion handling for visitors who have enabled that preference in their operating system or browser.",
  "Direct email and phone options when a visitor would rather speak with the team than use a web form.",
];

export default function AccessibilityPage() {
  return (
    <>
      <PageHero
        eyebrow="ACCESSIBILITY"
        title="A clearer way to reach RedDev."
        description="This page explains the accessibility features currently implemented across the RedDev public website and how to tell us when something is getting in the way."
        breadcrumbLabel="Accessibility"
      />

      <section className="page-section" aria-labelledby="commitment-heading">
        <div className="container page-split">
          <div>
            <p className="eyebrow">
              <span />
              OUR CURRENT APPROACH
            </p>
            <h2 id="commitment-heading">
              Access should be part of the experience, not an afterthought.
            </h2>
          </div>
          <div className={`copy-flow ${styles.intro}`}>
            <p>
              The current RedDev public site is built with a focus on clear
              structure, usable controls, readable content and more than one way
              to contact the team. We continue to review the experience as pages
              and interactions evolve.
            </p>
            <p>
              This is a plain-language statement about the features implemented
              on this site. It is not a claim of certification, a guarantee of
              access for every person or a substitute for testing with the
              browser, device and assistive technology you use.
            </p>
            <p>
              If a page or control does not work for you, please let us know.
              Feedback helps us investigate the specific experience and identify
              practical improvements.
            </p>
          </div>
        </div>
      </section>

      <section
        className={`page-section page-section-warm ${styles.featureSection}`}
        aria-labelledby="features-heading"
      >
        <div className="container">
          <div className={styles.sectionHeading}>
            <p className="eyebrow">
              <span />
              FEATURES IN PLACE
            </p>
            <h2 id="features-heading">
              Designed for different ways of browsing.
            </h2>
          </div>
          <ul className={styles.featureList}>
            {features.map((feature) => (
              <li key={feature}>
                <span className={styles.check} aria-hidden="true">
                  <Check size={16} strokeWidth={2.4} />
                </span>
                <span>{feature}</span>
              </li>
            ))}
          </ul>
          <PageNote title="Browser and device variation matters">
            <p>
              Assistive technology, browser settings, screen size and
              operating-system preferences can change how a page behaves. A
              feature that works in one combination may need adjustment in
              another. Please include those details in feedback where you can.
            </p>
          </PageNote>
        </div>
      </section>

      <section className="page-section" aria-labelledby="feedback-heading">
        <div className="container page-split">
          <div>
            <p className="eyebrow">
              <span />
              SHARE FEEDBACK
            </p>
            <h2 id="feedback-heading">Tell us what happened.</h2>
          </div>
          <div className={`copy-flow ${styles.feedbackCopy}`}>
            <p>
              If you encounter an accessibility barrier, please tell us the page
              or feature, what you were trying to do, the browser or device you
              were using and what happened instead. You may also tell us what
              would have made the task easier.
            </p>
            <p>
              Please do not include sensitive personal information. We will
              review the details and investigate the experience; response timing
              can vary, so we do not promise a particular resolution or response
              time.
            </p>
            <div className={styles.contactLinks}>
              <a
                className="button button-gold"
                href="mailto:info@reddevrei.com?subject=Accessibility%20feedback"
              >
                Email accessibility feedback{" "}
                <ArrowUpRight size={17} aria-hidden="true" />
              </a>
              <a className="text-link" href="tel:+16047297077">
                Call 604-729-7077 <ArrowUpRight size={18} aria-hidden="true" />
              </a>
            </div>
            <p className={styles.contactAddress}>
              RedDev Real Estate Investments · Maple Ridge, B.C.
            </p>
          </div>
        </div>
      </section>

      <section
        className={`page-section page-section-warm ${styles.nextSection}`}
        aria-labelledby="next-heading"
      >
        <div className="container page-split">
          <div>
            <p className="eyebrow">
              <span />
              NEED ANOTHER ROUTE?
            </p>
            <h2 id="next-heading">Reach the team directly.</h2>
          </div>
          <div className="copy-flow">
            <p>
              For a general question, investment inquiry or partnership
              conversation, use the contact page. It explains the available
              inquiry options and provides an email-draft route rather than
              implying an online account or investment submission.
            </p>
            <Link className="text-link" href="/contact/">
              Visit Contact <ArrowUpRight size={18} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <PageCallout
        title="Questions about finding your way around the site?"
        description="We welcome practical feedback about the public RedDev experience."
        href="/contact/"
        label="Contact the Team"
      />
    </>
  );
}
