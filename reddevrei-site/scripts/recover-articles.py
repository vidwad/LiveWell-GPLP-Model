#!/usr/bin/env python3
"""Recover RedDev's published WordPress posts as static, sanitized Next.js content.

The script deliberately uses public, stateless HTTP only. It treats the WordPress
post sitemap as the canonical list, downloads every listed post in one REST API
batch, sanitizes owner-source HTML with a narrow allowlist, and records any
unreachable or mismatched entry instead of creating a substitute article.

Usage:
  python3 scripts/recover-articles.py
  python3 scripts/recover-articles.py --dry-run
"""

from __future__ import annotations

import argparse
import html
import json
import re
import sys
import xml.etree.ElementTree as ET
from datetime import datetime
from html.parser import HTMLParser
from pathlib import Path
from typing import Any
from urllib.parse import urlparse
from urllib.request import Request, urlopen

SITE_ORIGIN = "https://reddevrei.com"
SITEMAP_URL = f"{SITE_ORIGIN}/post-sitemap.xml"
POSTS_URL = f"{SITE_ORIGIN}/wp-json/wp/v2/posts?per_page=100&_embed=1"
USER_AGENT = "RedDevREI archive recovery/1.0 (+https://reddevrei.com/)"
ROOT = Path(__file__).resolve().parents[1]
ARTICLES_OUTPUT = ROOT / "src/content/articles.ts"
ARCHIVE_OUTPUT = ROOT / "public/brand/archive"
REPORT_OUTPUT = Path("/home/ubuntu/jobs/39da5a580b5e_a4/article-recovery-report.json")

# Preserve only semantic content. Divi/page-builder wrappers, scripts, forms,
# embeds, inline styling, and anonymous tracking markup are intentionally lost.
ALLOWED_TAGS = {"p", "h2", "h3", "h4", "ul", "ol", "li", "strong", "em", "a", "blockquote", "br"}
VOID_TAGS = {"br"}
BLOCKED_TAGS = {
    "script", "style", "iframe", "form", "input", "button", "textarea", "select",
    "noscript", "svg", "canvas", "video", "audio", "object", "embed",
}


def request_bytes(url: str) -> bytes:
    request = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json,text/xml,text/html,*/*"})
    with urlopen(request, timeout=30) as response:  # nosec B310: URLs are fixed source URLs.
        return response.read()


def source_slug(url: str) -> str:
    return urlparse(url).path.strip("/").split("/")[-1]


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(value)).strip()


class OwnerHtmlSanitizer(HTMLParser):
    """A tiny, dependency-free sanitizer for owner-supplied WordPress HTML."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.blocked_depth = 0
        self.allowed_stack: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        if self.blocked_depth:
            self.blocked_depth += 1
            return
        if tag in BLOCKED_TAGS:
            self.blocked_depth = 1
            return
        if tag == "h1":
            tag = "h2"  # The Next.js page hero owns the single document H1.
        if tag not in ALLOWED_TAGS:
            return
        if tag == "a":
            href = next((value for key, value in attrs if key.lower() == "href"), "") or ""
            parsed = urlparse(href)
            if parsed.scheme not in {"http", "https", "mailto"}:
                return
            self.parts.append(f'<a href="{html.escape(href, quote=True)}" rel="noopener noreferrer">')
        elif tag in VOID_TAGS:
            self.parts.append("<br />")
            return
        else:
            self.parts.append(f"<{tag}>")
        self.allowed_stack.append(tag)

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.handle_starttag(tag, attrs)

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if self.blocked_depth:
            self.blocked_depth -= 1
            return
        if tag == "h1":
            tag = "h2"
        if tag not in ALLOWED_TAGS or tag in VOID_TAGS:
            return
        # Legacy source wrappers may close around tags we intentionally removed.
        if tag in self.allowed_stack:
            while self.allowed_stack:
                open_tag = self.allowed_stack.pop()
                self.parts.append(f"</{open_tag}>")
                if open_tag == tag:
                    break

    def handle_data(self, data: str) -> None:
        if not self.blocked_depth:
            self.parts.append(html.escape(data))

    def output(self) -> str:
        while self.allowed_stack:
            self.parts.append(f"</{self.allowed_stack.pop()}>")
        value = "".join(self.parts)
        value = re.sub(r"<(p|h[2-4]|li|blockquote)>\s*</\1>", "", value)
        return value.strip()


def sanitize_owner_html(source_html: str) -> str:
    parser = OwnerHtmlSanitizer()
    parser.feed(source_html)
    parser.close()
    return parser.output()


def strip_html(source_html: str) -> str:
    parser = HTMLParser(convert_charrefs=True)
    text: list[str] = []
    parser.handle_data = lambda data: text.append(data)  # type: ignore[method-assign]
    parser.feed(source_html)
    return clean_text(" ".join(text))


def date_values(post: dict[str, Any]) -> tuple[str, str | None]:
    raw = post.get("date") or ""
    try:
        human = datetime.fromisoformat(raw).strftime("%B %-d, %Y")
    except ValueError:
        human = raw or "Archived date unavailable"
    raw_gmt = post.get("date_gmt") or ""
    if raw_gmt and raw_gmt != "0000-00-00T00:00:00":
        return human, f"{raw_gmt}Z"
    return human, raw or None


def article_author(post: dict[str, Any]) -> str:
    authors = post.get("_embedded", {}).get("author", [])
    return clean_text(authors[0].get("name", "")) if authors else "RedDev Real Estate Investments"


def article_category(post: dict[str, Any]) -> str:
    term_groups = post.get("_embedded", {}).get("wp:term", [])
    for group in term_groups:
        for term in group:
            if term.get("taxonomy") == "category" and term.get("name"):
                return clean_text(term["name"])
    return "Blog Articles"


def featured_media(post: dict[str, Any]) -> tuple[str | None, str]:
    media_items = post.get("_embedded", {}).get("wp:featuredmedia", [])
    media = media_items[0] if media_items else {}
    return media.get("source_url"), clean_text(media.get("alt_text", ""))


def media_suffix(url: str) -> str:
    path = urlparse(url).path
    suffix = Path(path).suffix.lower()
    return suffix if suffix in {".jpg", ".jpeg", ".png", ".webp", ".gif"} else ".jpg"


def download_image(url: str, slug: str, dry_run: bool) -> str | None:
    if dry_run:
        return f"/brand/archive/{slug}{media_suffix(url)}"
    ARCHIVE_OUTPUT.mkdir(parents=True, exist_ok=True)
    filename = f"{slug}{media_suffix(url)}"
    destination = ARCHIVE_OUTPUT / filename
    if destination.exists() and destination.stat().st_size > 0:
        return f"/brand/archive/{filename}"
    destination.write_bytes(request_bytes(url))
    return f"/brand/archive/{filename}"


def ts_literal(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2)


def render_module(entries: list[dict[str, Any]]) -> str:
    serialized = ts_literal(entries)
    return f'''// Generated by scripts/recover-articles.py from RedDev's public WordPress archive.\n// Source HTML is restricted to semantic owner-source markup by a narrow allowlist.\n\nexport type Article = {{\n  slug: string;\n  title: string;\n  author: string;\n  date: string;\n  publishedAt?: string;\n  category: string;\n  excerpt: string;\n  contentHtml?: string;\n  sections?: {{ heading?: string; paragraphs: string[] }}[];\n  image?: string;\n  imageAlt?: string;\n  sourceUrl: string;\n}};\n\nexport const articles: Article[] = {serialized};\n\nexport function getArticle(slug: string): Article | undefined {{\n  return articles.find((article) => article.slug === slug);\n}}\n'''


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="Validate source recovery without writing assets or the content module.")
    args = parser.parse_args()

    report: dict[str, Any] = {"sitemap": SITEMAP_URL, "api": POSTS_URL, "recovered": [], "unreachable": [], "mismatched": []}
    try:
        root = ET.fromstring(request_bytes(SITEMAP_URL))
        sitemap_slugs = []
        for url_entry in root:
            if not url_entry.tag.endswith("url"):
                continue
            location = next((child.text for child in url_entry if child.tag.endswith("loc")), None)
            if location:
                sitemap_slugs.append(source_slug(location))
        posts = json.loads(request_bytes(POSTS_URL).decode("utf-8"))
    except Exception as error:  # The report is still useful if a public source is unavailable.
        report["unreachable"].append({"source": "archive feed", "reason": str(error)})
        REPORT_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        REPORT_OUTPUT.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        print(json.dumps(report, indent=2), file=sys.stderr)
        return 1

    posts_by_slug = {post.get("slug"): post for post in posts if post.get("slug")}
    entries: list[dict[str, Any]] = []
    for slug in sitemap_slugs:
        post = posts_by_slug.get(slug)
        if not post:
            report["unreachable"].append({"slug": slug, "reason": "Listed in the public sitemap but unavailable in the public posts API."})
            continue
        title = clean_text(strip_html(post.get("title", {}).get("rendered", "")))
        content = sanitize_owner_html(post.get("content", {}).get("rendered", ""))
        if not title or not content:
            report["unreachable"].append({"slug": slug, "reason": "Public API response did not contain a title and full article body."})
            continue
        human_date, published_at = date_values(post)
        source_url = post.get("link") or f"{SITE_ORIGIN}/{slug}/"
        excerpt = strip_html(post.get("excerpt", {}).get("rendered", ""))
        source_image, original_alt = featured_media(post)
        image: str | None = None
        if source_image:
            try:
                image = download_image(source_image, slug, args.dry_run)
            except Exception as error:
                report["mismatched"].append({"slug": slug, "image": source_image, "reason": f"Featured image unavailable: {error}"})
        entries.append({
            "slug": slug,
            "title": title,
            "author": article_author(post),
            "date": human_date,
            **({"publishedAt": published_at} if published_at else {}),
            "category": article_category(post),
            "excerpt": excerpt,
            "contentHtml": content,
            **({"image": image} if image else {}),
            "imageAlt": original_alt or f"Featured image for the original RedDev article, {title}.",
            "sourceUrl": source_url,
        })
        report["recovered"].append({"slug": slug, "sourceUrl": source_url, "contentCharacters": len(content)})

    extra_api_slugs = sorted(set(posts_by_slug) - set(sitemap_slugs))
    if extra_api_slugs:
        report["mismatched"].append({"reason": "Posts API contained entries absent from the public post sitemap.", "slugs": extra_api_slugs})
    if not entries:
        report["unreachable"].append({"source": "archive feed", "reason": "No full articles were recoverable; no content module was written."})
    elif not args.dry_run:
        ARTICLES_OUTPUT.write_text(render_module(entries), encoding="utf-8")

    REPORT_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    REPORT_OUTPUT.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))
    return 0 if not report["unreachable"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
