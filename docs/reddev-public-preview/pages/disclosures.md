# Investment disclosures page review

- **Route:** `/investment-disclosures/`
- **Owner:** disclosures
- **Implemented:** `src/app/investment-disclosures/page.tsx`, `src/app/investment-disclosures/page.module.css`

## Sources reviewed

- `/home/ubuntu/reddev-review/research/reddev-findings.md` (reviewed 2026-10-18): current-site business description, stale RSVP/event material, targeted-return language, contact details, and instruction not to treat archived/current opportunity status as verified.
- `/home/ubuntu/reddev-review/plan.md`: public-site content boundary, approved investment inquiry journey, and requirement to avoid online investment execution.
- Shared `PageShell.tsx`, `metadata.ts`, and `pages.css` for page contracts and visual system.

## Content decisions

- Keeps general-information, not-financial-advice, not-an-offer, and no-guaranteed-return context explicit.
- Distinguishes website/archive information from current approved offering documents.
- States that availability and eligibility must be confirmed with the team; no opportunity is labeled open/current.
- Links to `/invest/`, `/contact/?type=investment`, and `/terms/`.
- Describes contact as an email-draft inquiry path, not a submission, account-creation, transfer-of-funds, or securities-transaction flow.
- Uses no invented project facts, roles, statistics, returns, events, or regulatory checklist.

## Pending approvals / uncertainties

1. Legal/business review of final disclosure wording and the eventual approved Terms content.
2. Confirm the current availability/eligibility language and which offering documents, if any, may be linked from `/invest/`.
3. Confirm whether any jurisdiction-specific securities notices or adviser-disclosure language should be added.
4. Confirm final current-status copy once the investment team approves an opportunity publication state.
