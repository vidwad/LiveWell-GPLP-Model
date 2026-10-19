import assert from "node:assert/strict";
import test from "node:test";
import { getDashboardLoginUrl } from "../src/lib/dashboard";

test("missing or malformed dashboard URLs remain unconfigured", () => {
  assert.equal(getDashboardLoginUrl(undefined), undefined);
  assert.equal(getDashboardLoginUrl(""), undefined);
  assert.equal(getDashboardLoginUrl("not a URL"), undefined);
});

test("production accepts HTTPS; local HTTP requires explicit development opt-in", () => {
  assert.equal(
    getDashboardLoginUrl("https://dashboard.example.test/login"),
    "https://dashboard.example.test/login",
  );
  assert.equal(getDashboardLoginUrl("http://localhost:3001/login"), undefined);
  assert.equal(
    getDashboardLoginUrl("http://localhost:3001/login", {
      allowLocalHTTP: true,
    }),
    "http://localhost:3001/login",
  );
  assert.equal(
    getDashboardLoginUrl("http://dashboard.example.test/login"),
    undefined,
  );
  assert.equal(getDashboardLoginUrl("javascript:alert(1)"), undefined);
});

test("credentials and callback tokens are never published in dashboard links", () => {
  assert.equal(
    getDashboardLoginUrl("https://user:password@example.test/login"),
    undefined,
  );
  assert.equal(
    getDashboardLoginUrl("https://example.test/login?token=private"),
    undefined,
  );
  assert.equal(
    getDashboardLoginUrl("https://example.test/login#access_token=private"),
    undefined,
  );
});
