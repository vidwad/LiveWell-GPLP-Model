import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { notFound } from "next/navigation";

import { PageHero, PageNote } from "@/components/marketing/PageShell";
import { articles, getArticle } from "@/content/articles";
import { pageMetadata } from "@/lib/metadata";
import { archiveImage } from "@/lib/archive-image";

import styles from "./page.module.css";

type ArticlePageProps = {
  params: Promise<{ articleSlug: string }>;
};

export const dynamicParams = false;

export function generateStaticParams() {
  return articles.map((article) => ({ articleSlug: article.slug }));
}

export async function generateMetadata({
  params,
}: ArticlePageProps): Promise<Metadata> {
  const { articleSlug } = await params;
  const article = getArticle(articleSlug);

  if (!article) {
    return pageMetadata({
      title: "Article Not Found",
      description: "The requested RedDev archive article could not be found.",
      path: `/${articleSlug}/`,
    });
  }

  return pageMetadata({
    title: article.title,
    description: article.excerpt,
    path: `/${article.slug}/`,
    article: { publishedTime: article.publishedAt, author: article.author },
  });
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { articleSlug } = await params;
  const article = getArticle(articleSlug);

  if (!article) notFound();

  return (
    <>
      <PageHero
        eyebrow={`${article.category.toUpperCase()} · ARCHIVE`}
        title={article.title}
        description={`Originally published ${article.date} by ${article.author}.`}
        parent={{ label: "Insights", href: "/blog/" }}
        image={
          article.image
            ? {
                src: archiveImage(article.image) || article.image,
                alt: article.imageAlt || "",
              }
            : undefined
        }
      />

      <article className={`prose ${styles.article}`}>
        <header className={styles.articleHeader}>
          <Link className="text-link" href="/blog/">
            <ArrowLeft size={17} aria-hidden="true" /> Back to Insights
          </Link>
          <p className={styles.byline}>
            <span>{article.category}</span>
            <time dateTime={article.publishedAt}>{article.date}</time>
            <span>By {article.author}</span>
          </p>
        </header>

        <PageNote title="Archived publication context">
          <p>
            This is an archived RedDev article. Its observations, claims and
            linked sources reflect the original publication date and are not
            current investment information, an offer or a promise of
            availability.
          </p>
          <p>
            <a
              href={article.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              View the original WordPress source{" "}
              <ArrowUpRight size={14} aria-hidden="true" />
            </a>
          </p>
        </PageNote>

        {article.contentHtml && (
          <div
            className={styles.content}
            dangerouslySetInnerHTML={{ __html: article.contentHtml }}
          />
        )}
      </article>
    </>
  );
}
