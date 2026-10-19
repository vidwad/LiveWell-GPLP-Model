"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, ClipboardCopy, ExternalLink } from "lucide-react";

import {
  buildInquiryEmailDraft,
  INQUIRY_LIMITS,
  isInquiryType,
  type InquiryDraft,
  type InquiryErrors,
  type InquiryField,
  type InquiryValues,
  validateInquiry,
  validateInquiryField,
} from "@/lib/inquiry";

import styles from "./contact.module.css";

type ContactFormProps = {
  recipient: string;
};

const initialValues: InquiryValues = {
  name: "",
  email: "",
  company: "",
  phone: "",
  inquiryType: "general-question",
  message: "",
};

const fieldOrder: InquiryField[] = [
  "name",
  "email",
  "company",
  "phone",
  "message",
];

function describedBy(helpId: string, errorId: string, hasError: boolean) {
  return hasError ? `${helpId} ${errorId}` : helpId;
}

export function ContactForm({ recipient }: ContactFormProps) {
  return (
    <Suspense
      fallback={
        <ContactFormBody recipient={recipient} initialType="general-question" />
      }
    >
      <QueryAwareContactForm recipient={recipient} />
    </Suspense>
  );
}

function QueryAwareContactForm({ recipient }: ContactFormProps) {
  const searchParams = useSearchParams();
  const requestedType = searchParams.get("type");
  const initialType =
    requestedType && isInquiryType(requestedType)
      ? requestedType
      : "general-question";
  return (
    <ContactFormBody
      key={initialType}
      recipient={recipient}
      initialType={initialType}
    />
  );
}

function ContactFormBody({
  recipient,
  initialType,
}: ContactFormProps & { initialType: InquiryValues["inquiryType"] }) {
  const [values, setValues] = useState<InquiryValues>(() => ({
    ...initialValues,
    inquiryType: initialType,
  }));
  const [errors, setErrors] = useState<InquiryErrors>({});
  const [draft, setDraft] = useState<InquiryDraft | null>(null);
  const [status, setStatus] = useState("");
  const [copyStatus, setCopyStatus] = useState("");

  function updateValue<K extends keyof InquiryValues>(
    field: K,
    value: InquiryValues[K],
  ) {
    setValues((current) => ({ ...current, [field]: value }));
    setDraft(null);
    setCopyStatus("");
    setStatus("");
  }

  function handleBlur(field: InquiryField) {
    const message = validateInquiryField(field, values[field]);

    setErrors((current) => {
      const next = { ...current };
      if (message) {
        next[field] = message;
      } else {
        delete next[field];
      }
      return next;
    });
  }

  function handleInquiryType(value: string) {
    if (isInquiryType(value)) {
      updateValue("inquiryType", value);
    }
  }

  function handleCreateDraft() {
    const nextErrors = validateInquiry(values);
    setErrors(nextErrors);

    const firstInvalidField = fieldOrder.find((field) => nextErrors[field]);
    if (firstInvalidField) {
      setDraft(null);
      setStatus(
        "Please correct the highlighted fields before creating an email draft.",
      );
      document.getElementById(`contact-${firstInvalidField}`)?.focus();
      return;
    }

    setDraft(buildInquiryEmailDraft(values, recipient));
    setStatus("Your draft is ready. Send it from your email app.");
  }

  async function copyToClipboard(text: string, label: string) {
    try {
      if (!navigator.clipboard) {
        throw new Error("Clipboard API unavailable");
      }
      await navigator.clipboard.writeText(text);
      setCopyStatus(`${label} copied to your clipboard.`);
    } catch {
      setCopyStatus(
        `Copy is unavailable in this browser. You can email ${recipient} directly.`,
      );
    }
  }

  return (
    <section className={styles.formCard} aria-labelledby="contact-form-heading">
      <div className={styles.formHeader}>
        <p className={styles.sectionKicker}>SEND AN EMAIL DRAFT</p>
        <h2 id="contact-form-heading">Tell us how we can help.</h2>
        <p>
          This preview is not connected to an inquiry system. Complete the form
          to prepare a message in your email app.
        </p>
      </div>

      <div className={styles.previewNote}>
        <strong>Preview only</strong>
        <p>
          In this preview, your message opens as an email draft. Nothing is
          submitted or stored on this website.
        </p>
      </div>

      <noscript>
        <p className={styles.previewNote}>
          Creating a draft requires JavaScript. No form data will be sent from
          this page. Please{" "}
          <a href={`mailto:${recipient}`}>email {recipient} directly</a>{" "}
          instead.
        </p>
      </noscript>

      <div
        className={styles.form}
        role="form"
        aria-label="Prepare an email inquiry"
      >
        <div className={styles.fieldGrid}>
          <div className={styles.field}>
            <label htmlFor="contact-name">
              Name <span aria-hidden="true">*</span>
              <span className={styles.requiredText}>Required</span>
            </label>
            <input
              id="contact-name"
              name="name"
              type="text"
              autoComplete="name"
              required
              maxLength={INQUIRY_LIMITS.name}
              value={values.name}
              onBlur={() => handleBlur("name")}
              onChange={(event) => updateValue("name", event.target.value)}
              aria-invalid={Boolean(errors.name)}
              aria-describedby={describedBy(
                "contact-name-help",
                "contact-name-error",
                Boolean(errors.name),
              )}
            />
            <p id="contact-name-help" className={styles.fieldHelp}>
              {INQUIRY_LIMITS.name} characters maximum.
            </p>
            {errors.name && (
              <p id="contact-name-error" className={styles.fieldError}>
                {errors.name}
              </p>
            )}
          </div>

          <div className={styles.field}>
            <label htmlFor="contact-email">
              Email <span aria-hidden="true">*</span>
              <span className={styles.requiredText}>Required</span>
            </label>
            <input
              id="contact-email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              maxLength={INQUIRY_LIMITS.email}
              value={values.email}
              onBlur={() => handleBlur("email")}
              onChange={(event) => updateValue("email", event.target.value)}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={describedBy(
                "contact-email-help",
                "contact-email-error",
                Boolean(errors.email),
              )}
            />
            <p id="contact-email-help" className={styles.fieldHelp}>
              We use this only in the email draft you create.
            </p>
            {errors.email && (
              <p id="contact-email-error" className={styles.fieldError}>
                {errors.email}
              </p>
            )}
          </div>

          <div className={styles.field}>
            <label htmlFor="contact-company">Company</label>
            <input
              id="contact-company"
              name="company"
              type="text"
              autoComplete="organization"
              maxLength={INQUIRY_LIMITS.company}
              value={values.company}
              onBlur={() => handleBlur("company")}
              onChange={(event) => updateValue("company", event.target.value)}
              aria-invalid={Boolean(errors.company)}
              aria-describedby={describedBy(
                "contact-company-help",
                "contact-company-error",
                Boolean(errors.company),
              )}
            />
            <p id="contact-company-help" className={styles.fieldHelp}>
              Optional · {INQUIRY_LIMITS.company} characters maximum.
            </p>
            {errors.company && (
              <p id="contact-company-error" className={styles.fieldError}>
                {errors.company}
              </p>
            )}
          </div>

          <div className={styles.field}>
            <label htmlFor="contact-phone">Phone</label>
            <input
              id="contact-phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              maxLength={INQUIRY_LIMITS.phone}
              value={values.phone}
              onBlur={() => handleBlur("phone")}
              onChange={(event) => updateValue("phone", event.target.value)}
              aria-invalid={Boolean(errors.phone)}
              aria-describedby={describedBy(
                "contact-phone-help",
                "contact-phone-error",
                Boolean(errors.phone),
              )}
            />
            <p id="contact-phone-help" className={styles.fieldHelp}>
              Optional · {INQUIRY_LIMITS.phone} characters maximum.
            </p>
            {errors.phone && (
              <p id="contact-phone-error" className={styles.fieldError}>
                {errors.phone}
              </p>
            )}
          </div>
        </div>

        <div className={styles.field}>
          <label htmlFor="contact-inquiry-type">
            What would you like to discuss?
          </label>
          <select
            id="contact-inquiry-type"
            name="inquiryType"
            value={values.inquiryType}
            onChange={(event) => handleInquiryType(event.target.value)}
          >
            <option value="investment">Investment</option>
            <option value="student-housing">Student housing</option>
            <option value="partnership">Partnership</option>
            <option value="general-question">General question</option>
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="contact-message">
            Message <span aria-hidden="true">*</span>
            <span className={styles.requiredText}>Required</span>
          </label>
          <textarea
            id="contact-message"
            name="message"
            required
            maxLength={INQUIRY_LIMITS.message}
            rows={7}
            value={values.message}
            onBlur={() => handleBlur("message")}
            onChange={(event) => updateValue("message", event.target.value)}
            aria-invalid={Boolean(errors.message)}
            aria-describedby={describedBy(
              "contact-message-help",
              "contact-message-error",
              Boolean(errors.message),
            )}
          />
          <p id="contact-message-help" className={styles.fieldHelp}>
            {INQUIRY_LIMITS.message} characters maximum. This text stays in your
            browser until you choose to open your email app.
          </p>
          {errors.message && (
            <p id="contact-message-error" className={styles.fieldError}>
              {errors.message}
            </p>
          )}
        </div>

        <div className={styles.formActions}>
          <button
            className="button button-primary"
            type="button"
            onClick={handleCreateDraft}
          >
            Create email draft
          </button>
          <p className={styles.requiredLegend}>
            <span aria-hidden="true">*</span> Required fields
          </p>
        </div>

        {status && (
          <p className={styles.liveStatus} role="status" aria-live="polite">
            {status}
          </p>
        )}
      </div>

      {draft && (
        <div className={styles.draftActions} aria-label="Email draft options">
          <a className="button button-primary" href={draft.mailtoUri}>
            Open email draft <ExternalLink aria-hidden="true" size={16} />
          </a>
          <div className={styles.copyActions}>
            <button
              type="button"
              className={styles.copyButton}
              onClick={() => copyToClipboard(draft.body, "Message")}
            >
              <ClipboardCopy aria-hidden="true" size={16} />
              Copy message
            </button>
            <button
              type="button"
              className={styles.copyButton}
              onClick={() => copyToClipboard(recipient, "Email address")}
            >
              <ClipboardCopy aria-hidden="true" size={16} />
              Copy email
            </button>
          </div>
          <p className={styles.draftFinePrint}>
            Opening the draft does not send it. Review and send it from your
            email app when you are ready.
          </p>
          {copyStatus && (
            <p className={styles.copyStatus} role="status" aria-live="polite">
              <Check aria-hidden="true" size={15} />
              {copyStatus}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
