import Image from "next/image";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Building2,
  ChartNoAxesCombined,
  FileCheck2,
  Handshake,
  KeyRound,
  MapPin,
  Search,
  ShieldCheck,
} from "lucide-react";
import { approach } from "@/content/approach";
import { team } from "@/content/team";
import { insights } from "@/content/insights";
import { media } from "@/content/media";
import { site } from "@/config/site";

const processIcons = [Search, Handshake, Building2, KeyRound, FileCheck2];

export default function HomePage() {
  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow hero-eyebrow">
            <span /> REAL ESTATE. REAL PURPOSE.
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
          <p className="hero-description">
            Multifamily real estate investment, development and management. A
            disciplined approach. A shared vision for what comes next.
          </p>
          <div className="hero-actions">
            <Link
              href="/contact/?type=investment"
              className="button button-gold"
            >
              Speak with Our Team <ArrowUpRight size={19} />
            </Link>
            <a href="#approach" className="button button-light-outline">
              Explore Our Approach <ArrowRight size={18} />
            </a>
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
          <Image
            src={media.hero.src}
            alt={media.hero.alt}
            fill
            priority
            sizes="(max-width: 900px) 100vw, 47vw"
            className="hero-image"
          />
          <div className="hero-image-shade" />
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
              <span className="eyebrow-line" /> ABOUT REDDEV
            </p>
            <h2>
              More than properties.
              <br />
              <span className="text-red">Partnerships.</span>
            </h2>
          </div>
          <div className="about-copy">
            <p className="lead">
              Good real estate starts with a clear vision—and the right people
              to bring it to life.
            </p>
            <p>
              RedDev Real Estate Investments brings together experience in real
              estate, construction and financial management. We identify
              opportunities, develop thoughtfully and stay involved in the
              places we create.
            </p>
            <p>
              Our integrated approach connects investment strategy with the
              realities of building and operating multifamily housing. For our
              partners, that means one team with a shared commitment to
              transparency, quality and long-term value.
            </p>
            <a href="#team" className="text-link">
              Meet the people behind RedDev <ArrowUpRight size={19} />
            </a>
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
                  <p>{step.description}</p>
                  <span className="step-detail">{step.detail}</span>
                </div>
              );
            })}
          </div>
          <div className="approach-bottom">
            <p>Connected expertise. Clear accountability.</p>
            <Link href="/contact/" className="text-link">
              Talk through our approach <ArrowUpRight size={19} />
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
            Thoughtfully designed housing for the next chapter of life.
          </p>
          <p>
            We focus on accessible, purpose-built student housing in university
            communities. Well-designed spaces, furnished living and practical
            amenities help create a place where students can feel at home.
          </p>
          <p>
            Our Edmonton focus brings development experience and hands-on
            management together, with students, investment partners and the
            wider community in mind.
          </p>
          <Link
            href="/contact/?type=student-housing"
            className="button button-primary"
          >
            Let’s talk student housing <ArrowUpRight size={18} />
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
            <p>
              Real estate investing is a relationship, not just a transaction.
              We work with investment partners who value a disciplined process,
              clear communication and the potential of multifamily housing.
            </p>
            <Link
              href="/contact/?type=investment"
              className="button button-primary"
            >
              Start a conversation <ArrowUpRight size={18} />
            </Link>
          </div>
          <div className="investment-panel">
            <div className="panel-top">
              <ChartNoAxesCombined size={29} strokeWidth={1.4} />
              <span>YOUR NEXT STEPS</span>
            </div>
            <ol>
              <li>
                <span>01</span>
                <div>
                  <h3>Get to know RedDev</h3>
                  <p>Understand our approach and the people behind it.</p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <h3>Connect with our team</h3>
                  <p>
                    Discuss your interests and ask the questions that matter.
                  </p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <h3>Review the details</h3>
                  <p>
                    Consider approved project information with your professional
                    advisers.
                  </p>
                </div>
              </li>
            </ol>
            <p className="investment-note">
              Opportunity availability and investor eligibility are confirmed
              directly with our team. This website is not an offer of
              securities.
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
                <span className="eyebrow-line" /> INSIGHTS & PERSPECTIVES
              </p>
              <h2>A more informed perspective.</h2>
            </div>
            <a
              href="https://reddevrei.com/blog/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-link"
            >
              Read our insights <ArrowUpRight size={19} />
              <span className="sr-only">
                {" "}
                on our current website, opens in a new tab
              </span>
            </a>
          </div>
          <div className="insight-list">
            {insights.map((article) => (
              <article className="insight" key={article.href}>
                <a
                  href={article.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="insight-image"
                >
                  <Image
                    src={`/brand/${article.image}`}
                    alt={article.alt}
                    fill
                    sizes="(max-width: 600px) 100vw, 33vw"
                  />
                </a>
                <div className="insight-category">{article.category}</div>
                <h3>
                  <a
                    href={article.href}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {article.title}
                    <span className="sr-only">
                      {" "}
                      — opens on our current website in a new tab
                    </span>
                  </a>
                </h3>
                <div className="insight-meta">
                  {article.date}
                  <span />
                  {article.author}
                </div>
                <a
                  href={article.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="insight-read"
                >
                  Read perspective <ArrowUpRight size={17} />
                  <span className="sr-only">
                    : {article.title}, opens in a new tab
                  </span>
                </a>
              </article>
            ))}
          </div>
          <p className="archive-note">
            From the RedDev archive. Articles open on our current website while
            content migration is underway.
          </p>
        </div>
      </section>

      <section className="closing-cta">
        <div className="container">
          <div>
            <p className="eyebrow">LET’S BUILD WHAT COMES NEXT.</p>
            <h2>
              The right partnership
              <br />
              starts with a conversation.
            </h2>
          </div>
          <Link href="/contact/" className="button button-gold">
            Speak with Our Team <ArrowUpRight size={20} />
          </Link>
        </div>
      </section>
      <section id="disclosures" className="disclosures">
        <div className="container">
          <p>
            <strong>Investment information.</strong> Material on this website is
            not financial advice. Please consult a certified financial advisor.
            This information is not an offer to sell or a solicitation to buy
            securities. Any investment offer will be made through formal
            offering documents and is subject to eligibility requirements. Real
            estate investments involve risk; returns are not guaranteed.
          </p>
          <p>
            <strong>Website preview.</strong> This is the first-stage RedDev
            redevelopment preview. Contact messages open in your own email
            application and are not submitted to or stored by this website. For
            current project information, contact{" "}
            <a href={`mailto:${site.email}`}>{site.email}</a>.
          </p>
        </div>
      </section>
    </>
  );
}
