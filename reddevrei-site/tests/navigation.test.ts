import test from "node:test";
import assert from "node:assert/strict";
import { normalizePublicPath, sectionIsActive } from "../src/lib/navigation";

test("public paths normalize trailing slashes and query strings", () => {
  assert.equal(normalizePublicPath("/about-us/?source=nav"), "/about-us");
  assert.equal(normalizePublicPath("/"), "/");
});

test("Home remains active for homepage section anchors", () => {
  assert.equal(sectionIsActive("/", "#about", "/"), true);
  assert.equal(sectionIsActive("/about-us/", "", "/"), false);
});

test("inner-page navigation is active with or without a trailing slash", () => {
  assert.equal(sectionIsActive("/our-approach", "", "/our-approach/"), true);
  assert.equal(
    sectionIsActive("/student-housing/", "", "/our-approach/"),
    false,
  );
});

test("section links require the correct pathname and hash", () => {
  assert.equal(sectionIsActive("/about-us/", "#team", "/about-us/#team"), true);
  assert.equal(
    sectionIsActive("/about-us/", "#company", "/about-us/#team"),
    false,
  );
  assert.equal(sectionIsActive("/", "#team", "/about-us/#team"), false);
});

test("Insights stays active only for its own known article routes", () => {
  const articles = ["/existing-article/"];
  assert.equal(
    sectionIsActive("/existing-article/", "", "/blog/", articles),
    true,
  );
  assert.equal(sectionIsActive("/about-us/", "", "/blog/", articles), false);
  assert.equal(
    sectionIsActive("/unknown-page/", "", "/blog/", articles),
    false,
  );
});
