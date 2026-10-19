"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Search } from "lucide-react";
import { useMemo, useState } from "react";

import type { Article } from "@/content/articles";

import styles from "./insights-index.module.css";

type InsightsIndexProps = {
  articles: Article[];
};

export function InsightsIndex({ articles }: InsightsIndexProps) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All articles");
  const categories = useMemo(
    () => [
      "All articles",
      ...Array.from(new Set(articles.map((article) => article.category))),
    ],
    [articles],
  );

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleArticles = articles.filter((article) => {
    const matchesCategory =
      activeCategory === "All articles" || article.category === activeCategory;
    const searchable =
      `${article.title} ${article.author} ${article.category} ${article.excerpt}`.toLocaleLowerCase();
    return (
      matchesCategory &&
      (!normalizedQuery || searchable.includes(normalizedQuery))
    );
  });

  return (
    <div className={styles.index}>
      <div className={styles.controls}>
        <div className={styles.searchField}>
          <label className="sr-only" htmlFor="insights-search">
            Search archived articles
          </label>
          <Search size={18} aria-hidden="true" />
          <input
            id="insights-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search the archive"
            autoComplete="off"
          />
        </div>

        <div
          className={styles.filters}
          aria-label="Filter articles by category"
        >
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              className={styles.filterButton}
              aria-pressed={activeCategory === category}
              onClick={() => setActiveCategory(category)}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      <p className={styles.resultCount} role="status" aria-live="polite">
        {visibleArticles.length}{" "}
        {visibleArticles.length === 1 ? "article" : "articles"}
        {activeCategory !== "All articles" ? ` in ${activeCategory}` : ""}
        {normalizedQuery ? ` matching “${query.trim()}”` : ""}
      </p>

      {visibleArticles.length > 0 ? (
        <div className={styles.articleList}>
          {visibleArticles.map((article, index) => (
            <article className={styles.article} key={article.slug}>
              <span className={styles.sequence} aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              {article.image && (
                <Image
                  className={styles.image}
                  src={article.image}
                  alt={article.imageAlt || ""}
                  width={420}
                  height={328}
                  sizes="(max-width: 620px) 330px, (max-width: 850px) 30vw, 280px"
                />
              )}
              <div className={styles.articleCopy}>
                <p className={styles.category}>{article.category}</p>
                <h3>
                  <Link href={`/${article.slug}/`}>{article.title}</Link>
                </h3>
                <p className={styles.meta}>
                  By {article.author} <span aria-hidden="true">·</span>{" "}
                  <time dateTime={article.publishedAt}>{article.date}</time>
                </p>
                <p className={styles.excerpt}>{article.excerpt}</p>
                <div className={styles.links}>
                  <Link className="text-link" href={`/${article.slug}/`}>
                    Read archived article{" "}
                    <ArrowUpRight size={17} aria-hidden="true" />
                  </Link>
                  <a
                    className={styles.sourceLink}
                    href={article.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Original source{" "}
                    <ArrowUpRight size={15} aria-hidden="true" />
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className={styles.emptyState} role="status">
          <p className="eyebrow">
            <span />
            NO MATCHES
          </p>
          <h3>No archived articles match that search.</h3>
          <p>Try another phrase or return to all articles.</p>
          <button
            type="button"
            className={styles.resetButton}
            onClick={() => {
              setQuery("");
              setActiveCategory("All articles");
            }}
          >
            Clear search and filters
          </button>
        </div>
      )}
    </div>
  );
}
