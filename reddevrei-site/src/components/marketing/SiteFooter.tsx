import Image from "next/image";
import Link from "next/link";
import { navigation, site } from "@/config/site";
import styles from "./navigation.module.css";

const companyLinks = [
  { label: "About Us", href: navigation[1].href },
  { label: "Our Team", href: navigation[1].children[1].href },
  { label: "Our Approach", href: navigation[2].href },
  { label: "Insights", href: navigation[5].href },
] as const;

const investingLinks = [
  { label: "Student Housing", href: navigation[3].href },
  { label: "Investing with RedDev", href: navigation[4].children[0].href },
  { label: "Speak with Our Team", href: navigation[4].children[1].href },
  { label: "Disclosures", href: "/#disclosures" },
] as const;

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.footerInner}`}>
        <div className={styles.footerTop}>
          <div className={styles.footerBrand}>
            <Link
              href="/"
              className={styles.footerLogoLink}
              aria-label={`${site.name} home`}
            >
              <Image
                src="/brand/logo-wide-light.png"
                alt={site.name}
                width={2202}
                height={363}
                className={styles.footerLogo}
              />
            </Link>
            <p className={styles.footerIntro}>
              A disciplined real estate investment platform focused on
              thoughtful, enduring places to live.
            </p>
            <Link href="/contact/" className={styles.footerContactLink}>
              Get in touch
            </Link>
          </div>

          <div className={styles.footerColumns}>
            <section
              className={styles.footerColumn}
              aria-labelledby="footer-company"
            >
              <h2 id="footer-company">Company</h2>
              <ul>
                {companyLinks.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href}>{link.label}</Link>
                  </li>
                ))}
              </ul>
            </section>

            <section
              className={styles.footerColumn}
              aria-labelledby="footer-investing"
            >
              <h2 id="footer-investing">Investing</h2>
              <ul>
                {investingLinks.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href}>{link.label}</Link>
                  </li>
                ))}
              </ul>
            </section>

            <section
              className={styles.footerColumn}
              aria-labelledby="footer-connect"
            >
              <h2 id="footer-connect">Connect</h2>
              <address className={styles.footerAddress}>
                <a href={`mailto:${site.email}`}>{site.email}</a>
                <a href={site.phoneHref}>{site.phone}</a>
                <span>{site.location}</span>
              </address>
              <Link
                href="/contact/#accessibility"
                className={styles.accessibilityLink}
              >
                Accessibility
              </Link>
            </section>
          </div>
        </div>

        <div className={styles.footerLower}>
          <p className={styles.disclaimer}>
            Material on this website is not financial advice. Please consult a
            certified financial advisor. Information is not an offer to sell or
            a solicitation to buy securities. Any offer will be made through
            formal offering documents.
          </p>
          <p className={styles.copyright}>
            © {year} {site.name}
          </p>
        </div>
      </div>
    </footer>
  );
}

export default SiteFooter;
