import { strict as assert } from "node:assert";
import { readFileSync, existsSync } from "node:fs";

const home = readFileSync("out/index.html", "utf8");
const contact = readFileSync("out/contact/index.html", "utf8");
const portraits = [
  "vid-wadhwani",
  "david-carkeek",
  "mark-kauhane",
  "nathan-wadhwani",
];

for (const person of portraits) {
  const image = `/brand/${person}.png`;
  assert.ok(home.includes(image), `Homepage export must render ${image}`);
  assert.ok(existsSync(`out${image}`), `Export must include ${image}`);
}

assert.ok(
  !/<form\b/i.test(contact),
  "Preview must have no native GET/POST form submission fallback",
);
assert.ok(
  contact.includes('role="form"'),
  "Inquiry fields retain an accessible form landmark",
);
assert.ok(
  contact.includes("Creating a draft requires JavaScript"),
  "A truthful no-JavaScript email fallback is required",
);
assert.ok(
  contact.includes("mailto:info@reddevrei.com"),
  "Direct email must remain available",
);

const routes = JSON.parse(readFileSync("out/manus-routes.json", "utf8"));
assert.deepEqual(
  routes.routes.map((route) => route.path),
  ["/", "/contact/"],
);

const heroCSS = readFileSync("src/app/globals.css", "utf8");
const capMatch = heroCSS.match(/--hero-overlay-cap:\s*([\d.]+)\s*;/);
assert.ok(capMatch, "Hero must declare its decorative overlay cap");
const cap = Number(capMatch[1]);
assert.ok(
  cap > 0 && cap <= 0.95,
  "Combined decorative opacity cannot exceed 95%",
);
assert.ok(
  [...heroCSS.matchAll(/\.hero-treatment\s*\{([^}]+)\}/g)].some((match) =>
    match[1].includes("opacity: var(--hero-overlay-cap)"),
  ),
  "Cap must be applied to the whole decorative group, not individual gradient stops",
);
assert.ok(
  !/\.hero-copy::(?:before|after)/.test(heroCSS),
  "Grain and globe must not stack as uncapped overlays outside the treatment group",
);
assert.ok(
  /class="hero-backdrop"><img[^>]+class="hero-image"/.test(home),
  "Photo must be in its own complete-hero backdrop, not the right foreground panel",
);
assert.ok(
  home.includes(
    'class="hero-treatment" aria-hidden="true"><div class="hero-image-shade"',
  ),
  "Gradient must be nested inside the capped decorative group",
);

console.log(
  "Static export verified: original portraits, safe inquiry fallback, public routes, full-hero photo and 95% combined overlay cap.",
);
