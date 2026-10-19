# Insights / Blog review

## Scope completed

- Built the public archive index at `/blog/` and the static original-slug article route at `/{articleSlug}/`.
- Recovered **all five** URLs in the public WordPress `post-sitemap.xml`, retaining each source title, author, original publication date, category, excerpt, full sanitized article body, featured image and source URL.
- Added `scripts/recover-articles.py`, a deterministic public-HTTP batch recovery script. It reads the public post sitemap, requests the posts REST endpoint once, sanitizes the owner-source HTML using a semantic allowlist, downloads only original featured images, and writes the typed static article module. It reports unavailable sitemap entries rather than inserting a placeholder.
- Original featured images are local static assets in `public/brand/archive/`; no stock or generated media was used.

## Sources

1. Local archive capture: `/home/ubuntu/reddev-review/research/blog.html` — this capture contains only `403 - Forbidden`, so it was retained as the first-source availability finding rather than treated as article copy.
2. Public archive index: [https://reddevrei.com/blog/](https://reddevrei.com/blog/) — identified the visible archive, first-page entries, dates/categories and page-two pagination.
3. Public archive page 2: [https://reddevrei.com/blog/page/2/?et_blog](https://reddevrei.com/blog/page/2/?et_blog) — confirmed the two older entries.
4. Public post sitemap: [https://reddevrei.com/post-sitemap.xml](https://reddevrei.com/post-sitemap.xml) — canonical source list of five WordPress posts at recovery time.
5. Public WordPress REST API batch: [https://reddevrei.com/wp-json/wp/v2/posts?per_page=100&_embed=1](https://reddevrei.com/wp-json/wp/v2/posts?per_page=100&_embed=1) — provided the full body, author, date, category, canonical source URL and original featured-media URL for all five sitemap entries.
6. Recovery manifest: `/home/ubuntu/jobs/39da5a580b5e_a4/article-recovery-report.json` — all five sitemap entries recovered; `unreachable` and `mismatched` are empty.

## Content and approval notes

- The archive is explicitly labelled as dated material. Article claims, market commentary, linked sources and any investment-related language remain historical owner-source copy, not current offers, promises, suitability guidance or availability statements.
- The recovered archive includes dated statistics and investment commentary. Legal/business review is still required before treating any article claim, external source link, eligibility reference or investment implication as current.
- The archive source and WordPress API were publicly accessible at recovery time, despite the local `blog.html` archive capture being a 403 response. No browser session, form submission or WordPress stateful action was used.
- No source entries were unreachable in this recovery run. If the public sitemap changes, rerun `python3 scripts/recover-articles.py`; the script will log any listed entry that no longer has a full public API response instead of fabricating content.
