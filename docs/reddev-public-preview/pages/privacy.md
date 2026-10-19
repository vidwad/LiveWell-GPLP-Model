# Privacy policy page review

## Implemented

- Route: `/privacy-policy/`
- The page is explicitly labelled a **Preview notice — not yet approved company-wide policy**.
- It documents the actual current public-app behavior: the contact journey prepares an email draft in the browser; the app does not POST the form to a RedDev server, store a submission, create accounts, accept payments, or provide an investor portal.
- It explains that sending the draft hands the message to the visitor's selected email application and, when sent, to `info@reddevrei.com`.
- It avoids unsupported claims about cookies, tracking, logs, retention periods, certifications, processing rights, or global company practices.
- It notes that hosting, browser, network, security, font, and other platform services may process technical requests under their own policies.
- It includes the allowed inquiry types and links to the general-question email draft, email address, and phone contact.

## Sources

1. RedDev source archive: `/home/ubuntu/reddev-review/research/reddev-findings.md` — confirms public contact details, email-draft-only contact direction, and the instruction not to invent an approved legal policy.
2. Original site privacy route (stateless fetch, 18 October 2026): https://reddevrei.com/privacy-policy/ — returned a page containing unrelated `blackmapleconstruction.com` / Black Maple Construction wording while listing `info@reddevrei.com`. It was not reused as company policy because it is clearly mismatched and unsupported for RedDev.
3. Original RedDev homepage (stateless fetch, 18 October 2026): https://reddevrei.com/ — confirms the existing footer's Privacy Policy link and public contact details, but also contains inherited/unrelated content; it was used only as provenance, not as authoritative policy copy.

## Pending approval

- RedDev/legal review must establish the broader company privacy policy before production publication, including applicable jurisdictional wording, actual service providers, handling of received email inquiries, retention, disclosures, security statements, and any applicable individual rights.
- Confirm whether the static hosting/browser/platform stack adds cookies, request logging, analytics, security monitoring, or other technical processing that should be named.
- Confirm the final production contact and policy effective/review date if the preview is replaced with an approved notice.
