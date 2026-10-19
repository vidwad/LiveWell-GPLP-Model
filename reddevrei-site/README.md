# RedDev public website — first-slice preview

A separate Next.js public application intended to live at `reddevrei-site/` in `vidwad/LiveWell-GPLP-Model`. It does not replace or import the existing FastAPI backend or `livingwell-frontend/` dashboard.

## Run

Node 22 and pnpm 11.25.0 are used. From this folder run `pnpm install --frozen-lockfile`, then `pnpm dev`. The development server listens on `0.0.0.0:3000`. `pnpm typecheck`, `pnpm lint` and `pnpm build` provide the focused checks; the static build is emitted to `out/`.

For the shared review Preview, use `pnpm build && pnpm preview` instead of the development server. This serves the production export on the same port and avoids the development hot-reload connection interfering with client hydration through the Preview proxy. Rebuild after source changes; this is still a preview, not production publication.

`tests/responsive-hero.mjs` contains targeted browser checks for desktop preservation, four phone viewport sizes, full-screen hero height, clipping, complete-photo coverage, the 95% opacity cap and mobile menu open/Escape/focus behavior. The mobile hero uses dynamic viewport height so it follows the currently visible screen as browser controls change.

## Current scope

The homepage and contact page use the original RedDev wordmark, palette, typography, investment process, team roster and existing-site imagery. Navigation to unfinished inner pages targets the corresponding homepage sections. Existing insights link to the original RedDev articles and keep their original dates. No opportunity is advertised as open; investor eligibility and current project details are handled directly with the company.

The contact form is deliberately isolated: it validates inputs and prepares an encoded email draft for `info@reddevrei.com`. The user must open and send that draft through their own email application. The preview never claims delivery, calls the backend, creates an investor/user/subscription, stores personal information, or opts someone into marketing. Working direct email and telephone links are provided.

## Later integration

Replace the email-draft adapter with a narrow contract to `/api/public/v1/sites/{site_key}/inquiries` only after the public backend endpoint, durable Website/PublicInquiry models, spam/rate/duplicate controls and required access fixes are ready. If a same-origin Next route handler is introduced, remove static-export-only assumptions and deploy the new public app separately. Do not proxy private dashboard routes or share the dashboard API client. The website attribution identity is not a platform tenant ID.

Before public backend traffic, address caller-selected privileged registration, private upload exposure and property/LP document scope checks noted in the approved plan. Existing unit/bed/shared-room economics and LP/community/property authorization scopes are out of this preview's scope.

## Assets and content

`public/brand/asset-sources.json` records original-source provenance and recovery constraints. Original image selections are reused rather than generated; city and interior imagery do not establish that a specific building is a RedDev-owned property. Full team biography and additional page migration remain later work. The original article dates are retained and should not be read as newly written investment commentary.

## Indexing and cutover

The preview is `noindex` and robots-disallowed by default. Set `NEXT_PUBLIC_SITE_ORIGIN=https://reddevrei.com` and `NEXT_PUBLIC_SITE_INDEXABLE=true` only for the approved production build. Canonical metadata and sitemap entries depend on that explicit origin. Complete remaining page routes, approved policies/disclosures, project facts, redirects and investor portal destination before domain cutover. `noindex` does not make confidential content private.

The managed preview is a review workspace; the same app source is copied into a dedicated feature branch of the selected GitHub repository. The production default branch, hosting, domain DNS, mail DNS and current WordPress website remain unchanged.

## Focused checks added in this slice

Run `pnpm test` for the seven framework-independent inquiry regression tests. `pnpm build` also verifies that the emitted homepage contains all four original leadership portraits, all portrait assets are copied, the contact draft UI has no native network-submit fallback, and the page route manifest remains correct.

The draft UI intentionally uses an accessible form role without native HTML form submission. No-JavaScript users can follow the direct email link instead. Sharing images are self-hosted only when the explicit public origin is configured; an unset origin does not invent a share URL.

ESLint 9 is pinned for compatibility with the current Next.js lint-plugin peer ranges. A move to ESLint 10 should be coordinated with compatible plugin releases before production hardening.
