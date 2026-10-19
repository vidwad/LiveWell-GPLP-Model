# Our Approach — page review

## Scope completed

Implemented the public `/our-approach/` route as an editorial five-step process page. The page uses the shared `PageHero`, `PageNote`, and `PageCallout` components; one page H1; in-page process links; a responsive five-stage timeline; a link to the team route; and email-draft contact CTAs for a general question.

The sequence is preserved exactly as:

1. Analyze
2. Acquire
3. Enhance
4. Manage
5. Report & Comply

## Sources used

1. `src/content/approach.ts` — primary implementation source for the five stage names, short descriptions, and responsibility labels.
2. `/home/ubuntu/reddev-review/research/reddev-findings.md` — confirms the published multifamily investment/development/management positioning, integrated approach, process sequence, approved contact details, core typography/colour evidence, and cautions about unsupported investment language.
3. `/home/ubuntu/reddev-review/plan.md` — public-page direction for explaining five stages, value-add activity, reporting and risk context; states the corporate brochure requires current approval.
4. `/home/ubuntu/reddev-review/research/our-approach.html` — archive returned `403 - Forbidden`, so it was not used as copy evidence.
5. Existing homepage approach presentation in `src/app/page.tsx` — checked only for internally consistent terminology and established local routes.

## Content choices and qualifications

- The operational descriptions preserve the local source content: market/property due diligence; acquisition and capital structuring; development/value creation; property and operational management; regular reporting and professional-adviser compliance work.
- The page explicitly says that a process does not remove uncertainty and does not promise outcomes. It makes no return, offering, opportunity-status, event, role, project-capacity or performance claim.
- No corporate brochure is linked or characterized as current. Visitors are directed to the team for current materials, project details, eligibility, and disclosure information.
- CTAs use only local routes: `/about-us/#team` and `/contact/?type=general-question`. The latter is compatible with the approved email-draft-only contact flow.

## Pending approval / integration dependencies

- Confirm `/about-us/#team` is retained as the final team anchor when the About page is integrated; if not, update this local CTA target.
- Company/legal review is still required before adding any offering-specific materials, investor eligibility/disclosure language, project details, or stronger risk disclosure.
- The archived original Approach page could not be directly verified due to the saved 403 response. If material differences are found in a company-approved original source, revise this page against that source.

## Validation

- `pnpm typecheck` passed on 18 October 2026.
- Targeted ESLint found no errors in `page.tsx`; the standalone CSS module was skipped because the existing ESLint configuration does not supply a CSS matcher.
