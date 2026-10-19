import Image from "next/image";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Building2,
  ChartNoAxesCombined,
  Download,
  FileCheck2,
  Handshake,
  KeyRound,
  MapPin,
  Search,
  ShieldCheck,
} from "lucide-react";
import { approach } from "@/content/approach";
import {
  accreditedAcknowledgement,
  brochure,
  homeCopy,
  opportunity,
} from "@/content/company";
import { team } from "@/content/team";
import { insights } from "@/content/insights";
import { media } from "@/content/media";
import { site } from "@/config/site";

const processIcons = [Search, Handshake, Building2, KeyRound, FileCheck2];

export default function HomePage() {
  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-backdrop">
          <Image
            src={media.hero.src}
            alt={media.hero.alt}
            fill
            priority
            sizes="100vw"
            className="hero-image"
          />
        </div>
        <div className="hero-treatment" aria-hidden="true">
          <div className="hero-image-shade" />
        </div>
        <div className="hero-copy">
          <p className="eyebrow hero-eyebrow">
            <span /> {homeCopy.kicker}
          </p>
          <h1 id="hero-title">
            Invest in places.
            <br />
            Build{" "}
            <em>
              lasting
              <br className="hero-break" /> value.
            </em>
          </h1>
          <p className="hero-description">{homeCopy.lead}</p>
          <div className="hero-actions">
            <Link href="/invest/" className="button button-gold">
              View Opportunities <ArrowUpRight size={19} />
            </Link>
            <Link href="/about-us/" className="button button-light-outline">
              About Us <ArrowRight size={18} />
            </Link>
          </div>
          <div className="hero-bottom">
            <span>
              BUILT ON EXPERIENCE.
              <br />
              FOCUSED ON PEOPLE.
            </span>
            <a href="#about" aria-label="Discover RedDev">
              <ArrowDown size={21} />
            </a>
          </div>
        </div>
        <div className="hero-visual">
          <div className="hero-location">
            <MapPin size={16} /> EDMONTON, ALBERTA
          </div>
          <div className="hero-visual-note">
            <span>OUR FOCUS</span>
            <strong>
              Places to live.
              <br />
              Room to grow.
            </strong>
            <span className="hero-note-rule" />
          </div>
        </div>
      </section>

      <div className="focus-strip" aria-label="RedDev areas of expertise">
        <div className="container">
          <span>MULTIFAMILY INVESTMENT</span>
          <i />
          <span>PURPOSEFUL DEVELOPMENT</span>
          <i />
          <span>HANDS-ON MANAGEMENT</span>
          <i />
          <span>LONG-TERM PERSPECTIVE</span>
        </div>
      </div>

      <section id="about" className="section about-section">
        <div className="container about-layout">
          <div>
            <p className="eyebrow">
              <span className="eyebrow-line" /> WELCOME
            </p>
            <h2>
              More than properties.
              <br />
              <span className="text-red">Partnerships.</span>
            </h2>
            <figure className="oc-figure oc-figure-contain home-syndication">
              <Image
                src={homeCopy.syndicationGraphic.src}
                alt={homeCopy.syndicationGraphic.alt}
                width={homeCopy.syndicationGraphic.width}
                height={homeCopy.syndicationGraphic.height}
                sizes="(max-width: 900px) 60vw, 30vw"
              />
            </figure>
          </div>
          <div className="about-copy">
            <p className="lead">{homeCopy.lead}</p>
            {homeCopy.welcome.map((paragraph) => (
              <p key={paragraph.slice(0, 40)}>{paragraph}</p>
            ))}
            <div className="home-inline-actions">
              <Link href="/about-us/" className="button button-primary">
                Learn More <ArrowRight size={18} />
              </Link>
              <Link href="/invest/" className="text-link">
                Invest with Us <ArrowUpRight size={19} />
              </Link>
            </div>
          </div>
        </div>
        <div className="container principles-row">
          <div>
            <Building2 size={25} />
            <span>Vertically integrated</span>
            <p>From investment strategy to property operations.</p>
          </div>
          <div>
            <Handshake size={25} />
            <span>Partner-focused</span>
            <p>Built around clear communication and shared goals.</p>
          </div>
          <div>
            <ShieldCheck size={25} />
            <span>Thoughtful by design</span>
            <p>Thorough due diligence. Purposeful development.</p>
          </div>
        </div>
      </section>

      <section id="approach" className="section approach-section">
        <div className="container">
          <div className="section-heading">
            <div>
              <p className="eyebrow">
                <span className="eyebrow-line" /> OUR APPROACH
              </p>
              <h2>Discipline at every step.</h2>
            </div>
            <p>
              One connected process.
              <br />
              From the first analysis to ongoing reporting.
            </p>
          </div>
          <div className="home-approach-intro">
            <p className="oc-lead">{homeCopy.approachIntro}</p>
            <article className="oc-doc">
              <figure className="oc-figure">
                <Image
                  src={brochure.image.src}
                  alt={brochure.image.alt}
                  width={brochure.image.width}
                  height={brochure.image.height}
                  sizes="150px"
                />
              </figure>
              <div>
                <h3>{brochure.title}</h3>
                <p>{brochure.blurb}</p>
                <a href={brochure.href} className="button button-primary">
                  {brochure.label} <Download size={17} aria-hidden="true" />
                </a>
                <span className="oc-doc-note">{brochure.note}</span>
              </div>
            </article>
          </div>
          <div className="process-list">
            {approach.map((step, index) => {
              const Icon = processIcons[index];
              return (
                <div className="process-step" key={step.number}>
                  <div className="step-top">
                    <span>{step.number}</span>
                    <Icon size={27} strokeWidth={1.4} />
                  </div>
                  <h3>{step.title}</h3>
                  <p>{homeCopy.stageBlurbs[step.title] ?? step.description}</p>
                  <span className="step-detail">{step.detail}</span>
                </div>
              );
            })}
          </div>
          <div className="approach-bottom">
            <p>Connected expertise. Clear accountability.</p>
            <Link href="/our-approach/" className="text-link">
              Learn more about our approach <ArrowUpRight size={19} />
            </Link>
          </div>
        </div>
      </section>

      <section id="student-housing" className="student-section">
        <div className="student-image">
          <Image
            src={media.student.src}
            alt={media.student.alt}
            fill
            sizes="(max-width: 900px) 100vw, 52vw"
          />
          <div className="image-label">
            <span className="label-dot" /> STUDENT-FOCUSED. COMMUNITY-MINDED.
          </div>
        </div>
        <div className="student-copy">
          <p className="eyebrow">
            <span className="eyebrow-line" /> STUDENT HOUSING
          </p>
          <h2>
            Better places to live.
            <br />
            <span className="text-red">
              A stronger place
              <br />
              to start.
            </span>
          </h2>
          <p className="lead">
            High-quality, affordable student accommodations in Edmonton,
            Alberta.
          </p>
          <p>
            RedDev’s mission is to develop accessible and affordable
            purpose-built student housing that meets the growing demand for
            quality off-campus living. By strategically investing in high-growth
            university towns, we aim to provide students with safe,
            well-designed, and fully furnished housing solutions that ease
            financial burdens while fostering a sense of community.
          </p>
          <p>
            Three modern student-focused multiplexes in Garneau, Edmonton, each
            with eight fully furnished units within walking distance of the
            University of Alberta.
          </p>
          <Link href="/student-housing/" className="button button-primary">
            Explore student housing <ArrowUpRight size={18} />
          </Link>
        </div>
      </section>

      <section id="invest" className="section invest-section">
        <div className="container invest-layout">
          <div>
            <p className="eyebrow">
              <span className="eyebrow-line" /> INVEST WITH US
            </p>
            <h2>
              A shared vision.
              <br />
              <span className="text-red">A thoughtful investment.</span>
            </h2>
            <p className="lead">{homeCopy.investLine}</p>
            <p>{opportunity.intro}</p>
            <Link href="/invest/" className="button button-primary">
              View current opportunities <ArrowUpRight size={18} />
            </Link>
          </div>
          <article className="investment-panel">
            <div className="panel-top">
              <ChartNoAxesCombined size={29} strokeWidth={1.4} />
              <span>CURRENT OPPORTUNITY</span>
            </div>
            <p className="home-opportunity-location">
              <MapPin size={14} aria-hidden="true" /> {opportunity.location}
            </p>
            <h3 className="home-opportunity-title">{opportunity.title}</h3>
            {opportunity.paragraphs.map((paragraph) => (
              <p className="home-opportunity-copy" key={paragraph.slice(0, 40)}>
                {paragraph}
              </p>
            ))}
            <p className="home-opportunity-eligibility">
              {opportunity.eligibility}
            </p>
            <a href="#accredited" className="text-link">
              Learn more <ArrowDown size={17} aria-hidden="true" />
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
              <span className="eyebrow-line" /> BEFORE YOU CONTINUE
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
            <p className="oc-small home-gate-note">
              Please also read the{" "}
              <Link href="/investment-disclosures/">
                Investment Disclosures
              </Link>
              .
            </p>
          </div>
        </div>
      </section>

      <section id="team" className="section team-section">
        <div className="container">
          <div className="section-heading">
            <div>
              <p className="eyebrow">
                <span className="eyebrow-line" /> THE PEOPLE BEHIND REDDEV
              </p>
              <h2>Experience is personal.</h2>
            </div>
            <Link href="/contact/" className="text-link">
              Connect with our team <ArrowUpRight size={19} />
            </Link>
          </div>
          <p className="team-intro">
            Investment, finance, construction and operations. Different
            perspectives, working toward the same goal.
          </p>
          <div className="leadership-row">
            {team.slice(0, 4).map((person) => {
              const portrait = media.team[person.name];
              return (
                <article className="team-member" key={person.name}>
                  {portrait ? (
                    <div className="team-photo">
                      <Image
                        src={portrait}
                        alt={person.name}
                        fill
                        sizes="(max-width: 600px) 45vw, 25vw"
                      />
                    </div>
                  ) : (
                    <div className="team-initials" aria-hidden="true">
                      <span>{person.initials}</span>
                      <i />
                    </div>
                  )}
                  <h3>{person.name}</h3>
                  <p>{person.role}</p>
                </article>
              );
            })}
          </div>
          <details className="full-team">
            <summary>
              <span>Meet the wider RedDev team</span>
              <span className="team-count">
                Our people <span aria-hidden="true">+</span>
              </span>
            </summary>
            <div className="wider-team">
              {team.slice(4).map((person) => (
                <div key={person.name}>
                  <h3>{person.name}</h3>
                  <p>{person.role}</p>
                </div>
              ))}
            </div>
          </details>
        </div>
      </section>

      <section id="insights" className="section insights-section">
        <div className="container">
          <div className="section-heading">
            <div>
              <p className="eyebrow">
                <span className="eyebrow-line" /> NEWS & INSIGHTS
              </p>
              <h2>A more informed perspective.</h2>
            </div>
            <Link href="/blog/" className="text-link">
              View all <ArrowUpRight size={19} />
            </Link>
          </div>
          <p className="team-intro">{homeCopy.insightsIntro}</p>
          <div className="insight-list">
            {insights.map((article) => (
              <article className="insight" key={article.href}>
                <Link href={article.href} className="insight-image">
                  <Image
                    src={`/brand/${article.image}`}
                    alt={article.alt}
                    fill
                    sizes="(max-width: 600px) 100vw, 33vw"
                  />
                </Link>
                <div className="insight-category">{article.category}</div>
                <h3>
                  <Link href={article.href}>{article.title}</Link>
                </h3>
                <div className="insight-meta">
                  {article.date}
                  <span />
                  {article.author}
                </div>
                <Link href={article.href} className="insight-read">
                  Read more <ArrowUpRight size={17} />
                  <span className="sr-only">: {article.title}</span>
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="closing-cta">
        <div className="container">
          <div>
            <p className="eyebrow">HAVE A QUESTION?</p>
            <h2>
              Get in touch
              <br />
              with us today.
            </h2>
          </div>
          <Link href="/contact/" className="button button-gold">
            Contact Us <ArrowUpRight size={20} />
          </Link>
        </div>
      </section>
      <section id="disclosures" className="disclosures">
        <div className="container">
          <p>
            <strong>Disclaimers.</strong> Material on this website is not
            financial advice. Please consult a certified financial advisor. The
            content and information on this website is not an investment offer,
            and any offer will be made in the form of a private placement
            memorandum. Opportunities shared on this website are only open to
            accredited investors. Real estate investments involve risk; returns
            are not guaranteed.
          </p>
          <p>
            <strong>Contact.</strong> Messages sent from this website open in
            your own email application. For current project information, contact{" "}
            <a href={`mailto:${site.email}`}>{site.email}</a> or call{" "}
            <a href={site.phoneHref}>{site.phone}</a>.
          </p>
        </div>
      </section>
    </>
  );
}
