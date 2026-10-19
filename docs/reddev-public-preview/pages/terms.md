# Terms page review — `/terms/`

## Status

Preview implementation only. This route is intentionally a **Website Use Notice**, not a final legal Terms of Use agreement. Final production copy requires RedDev/company and legal review.

## Written files

- `reddevrei-site/src/app/terms/page.tsx`
- `reddevrei-site/src/app/terms/page.module.css`

## Source basis

- `/home/ubuntu/reddev-review/research/reddev-findings.md` — source notes reviewed 18 October 2026. Relevant findings: public website should support inquiry and approved information rather than investment execution; legal/investment language requires approval; public contact is `info@reddevrei.com`, 604-729-7077, Maple Ridge, B.C.; formal documents and opportunity status require review.
- `/home/ubuntu/reddev-review/plan.md` — policy/disclosure pages should be approved and should not copy business-specific terms or invent a legal policy.
- Existing shared `PageShell`, metadata helper, and page styles — route composition and metadata conventions.

No external research was needed. No original approved company terms were found in the supplied archive/source notes.

## Content and safety decisions

- States that website information is general and dated, not investment, legal, tax, accounting, or professional advice.
- Explicitly says the website is not an offer or solicitation and does not process investments, accept funds, create accounts, or provide online subscription/payment.
- Directs questions to `/contact/` without implying direct submission, account creation, or investor onboarding.
- Links local `/privacy/` and `/disclosures/` destinations as related pages; those routes must exist and receive their own approved content before production.
- Preserves original materials rights in general terms without asserting a specific legal enforcement regime.
- Avoids invented jurisdiction, arbitration, contractual obligations, liability waivers, regulated status, or guaranteed outcomes.
- Uses October 2026 preview-review dating because the supplied source notes are dated October 18, 2026; confirm final site date at approval.

## Pending approvals

1. Company/legal approval of final Terms, Privacy, and disclosure language before production.
2. Confirm whether `/privacy/` and `/disclosures/` routes are implemented and approved before linking them in the live footer/site.
3. Confirm final website effective/review date and whether a separate version/effective-date treatment is required.
