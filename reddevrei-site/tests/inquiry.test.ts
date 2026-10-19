import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  buildInquiryEmailDraft,
  INQUIRY_LIMITS,
  isInquiryType,
  validateInquiry,
  validateInquiryField,
  type InquiryValues,
} from "../src/lib/inquiry.js";

const valid: InquiryValues = {
  name: "Preview Tester",
  email: "tester@example.com",
  company: "",
  phone: "",
  inquiryType: "investment",
  message: "I would like to learn about your approach.",
};

test("valid inquiry accepts optional blank company and phone", () => {
  assert.deepEqual(validateInquiry(valid), {});
});

test("empty required fields have explicit error messages", () => {
  assert.deepEqual(
    validateInquiry({ ...valid, name: "  ", email: "", message: "\n" }),
    {
      name: "Enter your name.",
      email: "Enter your email address.",
      message: "Enter a message.",
    },
  );
});

test("invalid emails cannot prepare a draft through the form", () => {
  for (const email of [
    "bad",
    "a@",
    "a b@example.com",
    "a@example",
    "a\n@example.com",
  ]) {
    assert.equal(
      validateInquiryField("email", email),
      "Enter a valid email address.",
    );
  }
});

test("declared field limits are enforced", () => {
  for (const field of ["name", "company", "phone", "message"] as const) {
    assert.ok(
      validateInquiryField(field, "a".repeat(INQUIRY_LIMITS[field] + 1)),
    );
    assert.equal(
      validateInquiryField(field, "a".repeat(INQUIRY_LIMITS[field])),
      undefined,
    );
  }
});

test("only the approved inquiry type values are recognized", () => {
  assert.equal(isInquiryType("student-housing"), true);
  assert.equal(isInquiryType("admin"), false);
});

test("user text stays in the encoded body and never becomes email headers", () => {
  const message =
    "Hello &bcc=other@example.com\nSubject: injected\n<example> ✓";
  const draft = buildInquiryEmailDraft(
    { ...valid, name: "Name & Co", message },
    "info@reddevrei.com",
  );
  const url = new URL(draft.mailtoUri);
  assert.equal(url.pathname, "info@reddevrei.com");
  assert.deepEqual([...url.searchParams.keys()], ["subject", "body"]);
  assert.equal(
    url.searchParams.get("subject"),
    "Website inquiry from RedDev Real Estate Investments",
  );
  assert.equal(url.searchParams.get("body"), draft.body);
  assert.ok(draft.body.includes(message));
});

test("draft content normalizes newlines, omits empty optional fields and preserves inquiry context", () => {
  const draft = buildInquiryEmailDraft(
    { ...valid, message: "  First\r\nSecond\rThird  " },
    "info@reddevrei.com",
  );
  assert.ok(draft.body.includes("Inquiry type: Investment"));
  assert.ok(draft.body.endsWith("First\nSecond\nThird"));
  assert.ok(!draft.body.includes("Company:"));
  assert.ok(!draft.body.includes("Phone:"));
});
