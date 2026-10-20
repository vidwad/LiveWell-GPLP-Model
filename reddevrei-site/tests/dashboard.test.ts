import assert from "node:assert/strict";
import test from "node:test";
import {
  CONFIRMED_DASHBOARD_LOGIN_URL,
  getDashboardLoginUrl,
  resolveDashboardLoginUrl,
} from "../src/lib/dashboard";

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

test("the confirmed live dashboard address is the default and its HTTP is the only exception", () => {
  assert.equal(
    resolveDashboardLoginUrl(undefined, { development: false }),
    CONFIRMED_DASHBOARD_LOGIN_URL,
  );
  assert.equal(
    resolveDashboardLoginUrl("", { development: false }),
    CONFIRMED_DASHBOARD_LOGIN_URL,
  );
  assert.equal(
    resolveDashboardLoginUrl("https://dashboard.example.test/login", {
      development: false,
    }),
    "https://dashboard.example.test/login",
  );
  // Another plain-HTTP address is rejected and falls back to the confirmed one.
  assert.equal(
    resolveDashboardLoginUrl("http://dashboard.example.test/login", {
      development: false,
    }),
    CONFIRMED_DASHBOARD_LOGIN_URL,
  );
  assert.equal(
    getDashboardLoginUrl("http://165.22.226.72:3000/login"),
    undefined,
    "HTTP stays rejected unless explicitly trusted",
  );
});
