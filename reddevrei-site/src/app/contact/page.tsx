import type { Metadata } from "next";
import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";

import { ContactForm } from "@/components/marketing/ContactForm";
import styles from "@/components/marketing/contact.module.css";
import { site } from "@/config/site";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Connect with RedDev Real Estate Investments in Maple Ridge, British Columbia.",
  ...(site.publicOrigin
    ? { alternates: { canonical: `${site.publicOrigin}/contact/` } }
    : {}),
  openGraph: {
    title: "Contact RedDev Real Estate Investments",
    description:
      "Discuss multifamily investment, student housing or partnerships with our team in Maple Ridge, British Columbia.",
    type: "website",
    siteName: site.name,
    ...(site.publicOrigin ? { url: `${site.publicOrigin}/contact/` } : {}),
    images: site.publicOrigin
      ? [
          {
            url: `${site.publicOrigin}/brand/logo-full-light.png`,
            alt: site.name,
          },
        ]
      : [],
  },
};

export default function ContactPage() {
  return (
    <div className={styles.page}>
      <div className="container">
        <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
          <ol>
            <li>
              <Link className={styles.breadcrumbLink} href="/">
                Home
              </Link>
            </li>
            <li aria-current="page" className={styles.breadcrumbCurrent}>
              Contact
            </li>
          </ol>
        </nav>

        <section className={styles.hero} aria-labelledby="contact-heading">
          <div className={styles.intro}>
            <p className="eyebrow">LET’S CONNECT</p>
            <h1 id="contact-heading">
              A conversation is a good place to start.
            </h1>
            <p className={styles.lede}>
              Whether you have a question about RedDev, multifamily investment,
              or student housing, our team is available to connect directly.
            </p>
          </div>
        </section>

        <div className={styles.contentGrid}>
          <aside
            className={styles.contactPanel}
            aria-labelledby="direct-contact-heading"
          >
            <div>
              <p className={styles.sectionKicker}>DIRECT CONTACT</p>
              <h2 id="direct-contact-heading">Reach our team</h2>
              <p>
                Prefer to connect directly? Use the details below and we will be
                pleased to hear from you.
              </p>
            </div>

            <dl className={styles.contactList}>
              <div>
                <dt>
                  <Mail aria-hidden="true" size={19} strokeWidth={1.8} />
                  Email
                </dt>
                <dd>
                  <a href={`mailto:${site.email}`}>{site.email}</a>
                </dd>
              </div>
              <div>
                <dt>
                  <Phone aria-hidden="true" size={19} strokeWidth={1.8} />
                  Phone
                </dt>
                <dd>
                  <a href={site.phoneHref}>{site.phone}</a>
                </dd>
              </div>
              <div>
                <dt>
                  <MapPin aria-hidden="true" size={19} strokeWidth={1.8} />
                  Location
                </dt>
                <dd>{site.location}</dd>
              </div>
            </dl>

            <section
              id="accessibility"
              className={styles.accessibilityNote}
              aria-labelledby="accessibility-heading"
            >
              <h2 id="accessibility-heading">Accessibility</h2>
              <p>
                If a barrier makes this form difficult to use, please call us at{" "}
                <a href={site.phoneHref}>{site.phone}</a> or email{" "}
                <a href={`mailto:${site.email}`}>{site.email}</a>. We will work
                with you to find a suitable way to connect.
              </p>
            </section>
          </aside>

          <ContactForm recipient={site.email} />
        </div>
      </div>
    </div>
  );
}
