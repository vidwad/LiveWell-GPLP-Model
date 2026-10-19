export const INQUIRY_LIMITS = {
  name: 100,
  email: 254,
  company: 120,
  phone: 40,
  message: 3000,
} as const;

const inquiryTypes = [
  "investment",
  "student-housing",
  "partnership",
  "general-question",
] as const;

export type InquiryType = (typeof inquiryTypes)[number];

export type InquiryValues = {
  name: string;
  email: string;
  company: string;
  phone: string;
  inquiryType: InquiryType;
  message: string;
};

export type InquiryField = "name" | "email" | "company" | "phone" | "message";
export type InquiryErrors = Partial<Record<InquiryField, string>>;

export type InquiryDraft = {
  subject: string;
  body: string;
  mailtoUri: string;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeText(value: string) {
  return value.replace(/\r\n?/g, "\n").trim();
}

function exceedsLimit(value: string, limit: number) {
  return value.length > limit;
}

export function isInquiryType(value: string): value is InquiryType {
  return inquiryTypes.some((type) => type === value);
}

/** Validates one user-entered field without performing storage or network work. */
export function validateInquiryField(
  field: InquiryField,
  rawValue: string,
): string | undefined {
  const value = normalizeText(rawValue);

  if (field === "name") {
    if (!value) return "Enter your name.";
    if (exceedsLimit(value, INQUIRY_LIMITS.name)) {
      return `Name must be ${INQUIRY_LIMITS.name} characters or fewer.`;
    }
    return undefined;
  }

  if (field === "email") {
    if (!value) return "Enter your email address.";
    if (exceedsLimit(value, INQUIRY_LIMITS.email)) {
      return `Email must be ${INQUIRY_LIMITS.email} characters or fewer.`;
    }
    if (!emailPattern.test(value)) return "Enter a valid email address.";
    return undefined;
  }

  if (field === "company") {
    if (exceedsLimit(value, INQUIRY_LIMITS.company)) {
      return `Company must be ${INQUIRY_LIMITS.company} characters or fewer.`;
    }
    return undefined;
  }

  if (field === "phone") {
    if (exceedsLimit(value, INQUIRY_LIMITS.phone)) {
      return `Phone must be ${INQUIRY_LIMITS.phone} characters or fewer.`;
    }
    return undefined;
  }

  if (!value) return "Enter a message.";
  if (exceedsLimit(value, INQUIRY_LIMITS.message)) {
    return `Message must be ${INQUIRY_LIMITS.message} characters or fewer.`;
  }
  return undefined;
}

/** Returns all current field errors for a complete inquiry draft. */
export function validateInquiry(values: InquiryValues): InquiryErrors {
  const errors: InquiryErrors = {};

  (Object.keys(INQUIRY_LIMITS) as InquiryField[]).forEach((field) => {
    const message = validateInquiryField(field, values[field]);
    if (message) errors[field] = message;
  });

  return errors;
}

export function inquiryTypeLabel(type: InquiryType) {
  switch (type) {
    case "investment":
      return "Investment";
    case "student-housing":
      return "Student housing";
    case "partnership":
      return "Partnership";
    case "general-question":
      return "General question";
  }
}

/**
 * Builds a local mailto draft only. The fixed subject deliberately contains no
 * user-provided content; all user text is kept in the URI-encoded message body.
 */
export function buildInquiryEmailDraft(
  values: InquiryValues,
  recipient: string,
): InquiryDraft {
  const normalized = {
    name: normalizeText(values.name),
    email: normalizeText(values.email),
    company: normalizeText(values.company),
    phone: normalizeText(values.phone),
    message: normalizeText(values.message),
  };
  const subject = "Website inquiry from RedDev Real Estate Investments";
  const lines = [
    "Contact form email draft",
    "",
    `Inquiry type: ${inquiryTypeLabel(values.inquiryType)}`,
    `Name: ${normalized.name}`,
    `Email: ${normalized.email}`,
    ...(normalized.company ? [`Company: ${normalized.company}`] : []),
    ...(normalized.phone ? [`Phone: ${normalized.phone}`] : []),
    "",
    "Message:",
    normalized.message,
  ];
  const body = lines.join("\n");

  return {
    subject,
    body,
    mailtoUri: `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
  };
}
