# Accessibility page review

- **Route:** `/accessibility/`
- **Owner:** accessibility
- **Implemented:** 18 October 2026

## Source material

- [RedDev current-site findings](/home/ubuntu/reddev-review/research/reddev-findings.md), especially the approved-plan notes on accessibility/contact statements and the confirmed public contact details.
- [Approved redevelopment plan](/home/ubuntu/reddev-review/plan.md), especially navigation expectations (semantic structure, keyboard focus, Escape-to-close, reduced motion, and 44px controls) and policy/disclosure guidance.
- Shared implementation contracts in `src/components/marketing/PageShell.tsx`, `src/lib/metadata.ts`, and `src/styles/pages.css`.

## Scope and factual basis

The page describes features explicitly requested for the current public site: semantic headings, skip link, keyboard menus, Escape/focus return, responsive layouts, reduced-motion handling, and direct email/phone contact. It gives the confirmed public contact details from the source notes: `info@reddevrei.com`, `604-729-7077`, Maple Ridge, B.C. It does not claim WCAG certification, universal compatibility, a compliance guarantee, or a response SLA.

Feedback guidance asks for the page/feature, attempted task, browser/device, and preferred contact method, while explicitly discouraging sensitive personal data. The contact route is `/contact/` and is described as an email-draft/inquiry route only.

## Pending approvals / caveats

- Confirm the final deployed header implementation matches the stated keyboard-menu, Escape, focus-return, skip-link and reduced-motion behavior before publication.
- Verify browser/device behavior with the actual production header and all public routes; assistive-technology behavior varies by setup.
- Have the company approve any future formal accessibility policy language or legal compliance statement. No certification or legal guarantee is included here.
