# RedDev public website — complete page preview

This is the separate Next.js public application at `reddevrei-site/` in `vidwad/LiveWell-GPLP-Model`. It does not replace or import the FastAPI backend or `livingwell-frontend/` dashboard. The approved RedDev homepage, logos, colours, typography, full-photo gradient and 100%-screen-height mobile hero are retained.

## Run and check

Use Node 22 and pnpm 11.25.0. Run `pnpm install --frozen-lockfile`, then `pnpm dev` for local development. For the shared review Preview use `pnpm build && pnpm preview`; the production export is served on `0.0.0.0:3000`, avoiding development hot-reload hydration issues through the Preview proxy. Rebuild after changing source. This is a preview, not production publication.

Run `pnpm typecheck`, `pnpm lint` and `pnpm test`. The twelve inquiry/navigation regressions cover validation, safe draft encoding and active-route behaviour. `pnpm build` generates static HTML, synchronizes the complete route manifest/sitemap and checks every page's initial metadata, H1/main landmarks, local links, section anchors and packaged images. It also preserves the original leadership portraits and 95% grouped hero-decoration cap. `tests/responsive-hero.mjs` is a reusable browser check for the approved desktop and four phone layouts.

## Implemented public pages

The site has Home, About Us and all eleven source-supported team biographies, Our Approach, Student Housing, Invest With Us, Edmonton Multiplex LP 1 information, Insights, Contact, Privacy information, Website Use/Terms, Investment Disclosures and Accessibility. About and Invest include their intended section anchors. The five original archive posts have full sanitized source copy, original root URLs, titles, bylines, publication dates, images and visible historical-context notices. The archive supports search and category filtering.

Navigation and footer links point to actual local pages. `scripts/sync-routes.mjs` derives `public/manus-routes.json` and the exported sitemap from the actual static page output. The legacy `/contact-us-2/` path is permanently redirected to `/contact/` by `serve.json` in the review server and by `vercel.json` for a future approved Vercel deployment. Other hosting must apply the equivalent redirect; no meta-refresh substitute is represented as an HTTP redirect.

## Contact and platform boundary

The contact UI validates inputs and prepares an encoded email draft for `info@reddevrei.com`. Investment/student-housing/partnership/general-question deep links preselect their approved category; invalid or missing categories fall back to General question. Users review and send drafts through their own email application. There is no contact POST, backend call, personal-information store, account creation, investment execution, subscription or marketing opt-in. Direct email and telephone paths remain available. No-JavaScript visitors can use direct email.

A later backend integration must use the narrow `/api/public/v1/sites/{site_key}/inquiries` contract after durable Website/PublicInquiry records, validation, spam/rate/duplicate controls and access fixes are ready. Address caller-selected privileged registration, private-upload exposure and property/LP document authorization first. Do not expose private dashboard APIs or change LP/community/property scopes or unit/bed/shared-room economics. Static-export assumptions must be revisited if a server inquiry handler is introduced.

## Original content and approval status

`public/brand/asset-sources.json` records original asset provenance. `src/content/team-profiles.ts` retains source-transcribed biographies and contacts; the four confirmed leadership portraits are reused and other profiles use initials rather than invented portraits. Confirm individual contacts before launch, including the original-source `jacobwadhwan@reddevrei.com` spelling.

`scripts/recover-articles.py` performs deterministic public-WordPress archive recovery and sanitization. Downloaded original featured photos are retained in `public/brand/archive/`; smaller aspect-preserving WebP copies live in `optimized/` and are selected on the server when available. If refreshed source photographs change, regenerate their optimized copies before publishing. Original titles, dates and source material are not silently rewritten as fresh financial commentary.

Student housing and LP pages deliberately avoid treating conflicting historic configurations or availability as current. City/interior images are clearly illustrative, not proof of ownership. No opportunity is labelled open or returns guaranteed. The original Privacy link returned another company's content, so it was not copied: Privacy and Terms are clearly scoped preview notices, not falsely approved company legal policies. Company/legal approval remains necessary for policy wording, brochure/disclosures, current offering status, project configurations and investor-portal destination.

## Indexing and release

The preview remains noindex and robots-disallowed. Set `NEXT_PUBLIC_SITE_ORIGIN=https://reddevrei.com` and `NEXT_PUBLIC_SITE_INDEXABLE=true` only for an approved production build. Canonical/sharing metadata and sitemap entries depend on that explicit origin. No confidential platform information is included; noindex is not access control.

The managed review workspace and the public app's feature branch are saved separately. Do not merge into the production default branch, publish, change domain/mail DNS or replace WordPress until approvals and the intended launch configuration are complete. A domain cutover must preserve email records and the rollback route. ESLint 9 is intentionally pinned to the current Next lint-plugin peer range.
