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

console.log(
  "Static export verified: four original portraits, no native form submission, direct email fallback, exact public routes.",
);
