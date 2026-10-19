import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { PageCallout, PageHero } from "@/components/marketing/PageShell";
import { approach } from "@/content/approach";
import { analyzeDetail } from "@/content/approach-detail";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({
  title: "Analyze",
  description:
    "How RedDev analyzes potential acquisitions: market analysis, property identification, preliminary due diligence, financial modeling, risk assessment and investment committee review.",
  path: "/analyze/",
});

const stageHref = (title: string) =>
  `/our-approach/#${title.toLowerCase().replaceAll(" & ", "-").replaceAll(" ", "-")}`;

export default function AnalyzePage() {
  return (
    <>
      <PageHero
        eyebrow="INVESTMENT APPROACH"
        title={analyzeDetail.title}
        description={analyzeDetail.intro}
        breadcrumbLabel="Analyze"
        parent={{ label: "Our Approach", href: "/our-approach/" }}
      />

      <section className="oc-section" aria-labelledby="analysis-heading">
        <div className="container oc-split oc-split-wide">
          <div className="oc-copy">
            <p className="eyebrow">
              <span /> COMPREHENSIVE ANALYSIS
            </p>
            <h2 id="analysis-heading">{analyzeDetail.heading}</h2>
            <p>{analyzeDetail.intro}</p>
            <p>{analyzeDetail.lead}</p>
            <nav aria-label="The five stages" className="oc-actions">
              {approach.map((step) => (
                <Link
                  key={step.title}
                  href={step.title === "Analyze" ? "/analyze/" : stageHref(step.title)}
                  className={`button ${step.title === "Analyze" ? "button-primary" : "button-outline"}`}
                  aria-current={step.title === "Analyze" ? "page" : undefined}
                >
                  {step.number} {step.title}
                </Link>
              ))}
            </nav>
          </div>
          <figure className="oc-figure">
            <Image
              src={analyzeDetail.image.src}
              alt={analyzeDetail.image.alt}
              width={analyzeDetail.image.width}
              height={analyzeDetail.image.height}
              sizes="(max-width: 900px) 100vw, 50vw"
            />
          </figure>
        </div>
      </section>

      <section className="oc-section oc-section-warm" aria-labelledby="steps-heading">
        <div className="container">
          <h2 id="steps-heading" className="sr-only">
            Step by step
          </h2>
          <ol className="oc-steps">
            {analyzeDetail.steps.map((step) => (
              <li key={step.title}>
                <div className="oc-copy">
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                  <ul className="oc-check-list">
                    {step.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="oc-section" aria-label="A note on analysis">
        <div className="container oc-copy">
          <blockquote className="oc-lead">“{analyzeDetail.quote}”</blockquote>
          <div className="oc-actions">
            <Link href="/our-approach/" className="button button-outline">
              Back to Our Approach <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <Link href="/invest/" className="text-link">
              View current opportunities{" "}
              <ArrowUpRight size={18} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <PageCallout
        title="Ready to accelerate your growth?"
        description="Discover how our approach can work for you. Speak with the RedDev team."
        href="/contact/?type=investment"
        label="Contact Us"
      />
    </>
  );
}
