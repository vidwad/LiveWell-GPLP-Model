import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

function htmlText(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}
const files = readdirSync("out", { recursive: true });
const routes = files
  .filter((file) => file === "index.html" || file.endsWith("/index.html"))
  .map((file) => {
    const path =
      file === "index.html" ? "/" : `/${file.slice(0, -"index.html".length)}`;
    const html = readFileSync(join("out", file), "utf8");
    const title = htmlText(html.match(/<title>(.*?)<\/title>/s)?.[1] || "");
    return { path, ...(title && title.length <= 256 ? { title } : {}) };
  })
  .filter((route) => route.path !== "/404/" && !route.path.startsWith("/_"))
  .sort((a, b) =>
    a.path === "/" ? -1 : b.path === "/" ? 1 : a.path.localeCompare(b.path),
  );
const manifest = JSON.stringify({ routes }, null, 2) + "\n";
writeFileSync("public/manus-routes.json", manifest);
writeFileSync("out/manus-routes.json", manifest);

const origin = process.env.NEXT_PUBLIC_SITE_ORIGIN;
const indexable = process.env.NEXT_PUBLIC_SITE_INDEXABLE === "true";
const escapeXML = (value) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const entries =
  indexable && origin
    ? routes
        .map(
          (route) =>
            `<url><loc>${escapeXML(new URL(route.path, origin).toString())}</loc></url>`,
        )
        .join("")
    : "";
writeFileSync(
  "out/sitemap.xml",
  `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</urlset>\n`,
);
console.log(
  `Synchronized ${routes.length} real public routes; sitemap indexing ${indexable && origin ? "enabled" : "disabled for preview"}.`,
);
