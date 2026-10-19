import { strict as assert } from "node:assert";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const routes = JSON.parse(readFileSync("out/manus-routes.json", "utf8")).routes;
const problems = [];
const seenTitles = new Set();
const htmlFor = (path) => {
  const clean = decodeURIComponent(path).replace(/^\//, "");
  const file =
    path === "/" ? "out/index.html" : join("out", clean, "index.html");
  return existsSync(file) ? readFileSync(file, "utf8") : undefined;
};
for (const route of routes) {
  const html = htmlFor(route.path);
  if (!html) {
    problems.push(`${route.path}: missing exported page`);
    continue;
  }
  const title = html.match(/<title>(.*?)<\/title>/s)?.[1];
  if (!title || seenTitles.has(title))
    problems.push(`${route.path}: missing or duplicate title`);
  seenTitles.add(title);
  if (!/<meta name="description" content="[^"]+"/.test(html))
    problems.push(`${route.path}: missing initial description`);
  if ((html.match(/<h1(?:\s|>)/g) || []).length !== 1)
    problems.push(`${route.path}: expected exactly one H1`);
  if ((html.match(/<main(?:\s|>)/g) || []).length !== 1)
    problems.push(`${route.path}: expected exactly one main landmark`);
  for (const match of html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)) {
    const href = match[1].replace(/&amp;/g, "&");
    if (!href.startsWith("/") && !href.startsWith("#")) continue;
    if (href.startsWith("//")) continue;
    const url = new URL(href, `https://review.invalid${route.path}`);
    const path = url.pathname;
    if (path.startsWith("/manus-storage/") || path.startsWith("/_next/"))
      continue;
    if (["/contact-us-2", "/contact-us-2/"].includes(path)) continue;
    const target = htmlFor(path);
    if (
      !target &&
      !existsSync(join("out", decodeURIComponent(path).replace(/^\//, "")))
    )
      problems.push(`${route.path}: missing local destination ${href}`);
    if (url.hash && target) {
      const id = decodeURIComponent(url.hash.slice(1)).replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&",
      );
      if (!new RegExp(`\\bid=["']${id}["']`).test(target))
        problems.push(`${route.path}: missing section anchor ${href}`);
    }
  }
  for (const match of html.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g)) {
    const src = match[1].replace(/&amp;/g, "&");
    const imageUrl = new URL(src, "https://review.invalid");
    const imagePath = decodeURIComponent(imageUrl.pathname);
    if (
      imageUrl.origin === "https://review.invalid" &&
      imagePath.startsWith("/brand/") &&
      !existsSync(join("out", imagePath.slice(1)))
    )
      problems.push(`${route.path}: missing packaged image ${src}`);
  }
}
assert.equal(problems.length, 0, problems.join("\n"));
console.log(
  `Initial HTML, metadata, local links, anchors and images verified across ${routes.length} public pages.`,
);
