import { PageHero, PageNote } from "@/components/marketing/PageShell";
import { InsightsIndex } from "@/components/marketing/InsightsIndex";
import { articles } from "@/content/articles";
import { pageMetadata } from "@/lib/metadata";
import { archiveImage } from "@/lib/archive-image";

import styles from "./page.module.css";

export const metadata = pageMetadata({
  title: "Insights",
  description:
    "Read RedDev’s archived articles, with original titles, bylines, publication dates and source links retained.",
  path: "/blog/",
});

export default function BlogPage() {
  return (
    <>
      <PageHero
        eyebrow="REDDEV INSIGHTS"
        title="Articles from the RedDev archive."
        description="Original bylines, dates and source links are retained so each article can be read in its published context."
        breadcrumbLabel="Insights"
      />

      <section
        className="page-section page-section-warm"
        aria-labelledby="archive-heading"
      >
        <div className="container">
          <div className={styles.introduction}>
            <div>
              <p className="eyebrow">
                <span />
                PUBLISHED ARCHIVE
              </p>
              <h2 id="archive-heading">
                Perspective, retained with its original date.
              </h2>
            </div>
            <p>
              These articles were recovered from RedDev’s public WordPress
              archive. They are presented as archived editorial material, rather
              than current investment information or an offer of any kind.
            </p>
          </div>

          <InsightsIndex
            articles={articles.map((article) => ({
              slug: article.slug,
              title: article.title,
              author: article.author,
              date: article.date,
              publishedAt: article.publishedAt,
              category: article.category,
              excerpt: article.excerpt,
              image: archiveImage(article.image),
              imageAlt: article.imageAlt,
              sourceUrl: article.sourceUrl,
            }))}
          />

          <div className={styles.archiveNote}>
            <PageNote title="About this archive">
              <p>
                Article claims and market commentary reflect their original
                publication dates. Please contact RedDev to discuss current
                information; this archive does not state that an opportunity is
                available.
              </p>
            </PageNote>
          </div>
        </div>
      </section>
    </>
  );
}
