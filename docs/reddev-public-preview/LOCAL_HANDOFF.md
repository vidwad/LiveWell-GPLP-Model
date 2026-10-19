# RedDev — VS Code, Vercel and Claude handoff

The RedDev public website is a separate Next.js application at `reddevrei-site/` in `vidwad/LiveWell-GPLP-Model`. Continue from `feat/reddev-public-preview`; do not start again or replace the existing dashboard. The approved site has the full-width/full-height photo hero, gradual burgundy-to-charcoal wash, wireframe texture, a combined decorative opacity cap of 95%, and a mobile homepage hero that fits the visible viewport.

## Open the existing work in VS Code

Install Git, Node 24 and VS Code. The app pins pnpm 11.25.0; `npx` commands below avoid depending on a separately installed global pnpm or Corepack.

```bash
git config --global user.email "51514966+vidwad@users.noreply.github.com"
git clone https://github.com/vidwad/LiveWell-GPLP-Model.git
cd LiveWell-GPLP-Model
git fetch origin
git switch --track origin/feat/reddev-public-preview
code .
cd reddevrei-site
npx --yes pnpm@11.25.0 install --frozen-lockfile
```

If you already have this repository, use its existing working copy, inspect `git status`, preserve uncommitted work and switch to the existing branch rather than clone or overwrite it again. After installing dependencies, copy `.env.example` to `.env.local`: `cp .env.example .env.local` on macOS/Linux, or `Copy-Item .env.example .env.local` in PowerShell. Leave the public origin blank and indexing false during review. Do not copy a production database URL or other secrets into the public app.

```bash
npx --yes pnpm@11.25.0 dev
# Open http://localhost:3000
```

The default dev command binds to loopback for local use. `dev:cloud` is available only when deliberately running an isolated Cloud preview. To check the actual static export, stop the dev server, then run:

```bash
npx --yes pnpm@11.25.0 typecheck
npx --yes pnpm@11.25.0 lint
npx --yes pnpm@11.25.0 test
npx --yes pnpm@11.25.0 build
npx --yes pnpm@11.25.0 preview:local
```

`preview:local` serves the built pages at localhost:3000, with real 404s and legacy contact redirects. Rebuild after edits; it is not a hot-reload server. The build generates the real route inventory and checks page metadata, local links, anchors, portraits/images, main/H1 landmarks and the homepage overlay cap. Browser checks also belong in the workflow for changes to navigation, forms or responsive layout; do not ask the company owner to debug the UI.

## Separate Vercel project

The new project is **reddev-public**, under **vidwad's projects** (`vidwads-projects`). Its project ID is `prj_R0ZKUTUfxCm227k8HI1PpfyGq0nJ`; team ID is `team_OTw8Nc7J80njGM7rHYYwEvYv`. It is connected to the existing GitHub repository, not a new repository and not Pookt's deployment.

Use root directory `reddevrei-site`, framework Next.js, Node 24, install command `npx --yes pnpm@11.25.0 install --frozen-lockfile` and build command `npx --yes pnpm@11.25.0 build`. Leave Vercel's Output Directory override unset/default: the native Next.js adapter needs its `.next` framework manifest and automatically handles `output: export`; do not override that field to `out`. The application's local static export and checks still use `out`. Keep the existing GitHub default branch `master` and private platform untouched. Review work stays on `feat/reddev-public-preview`; do not merge merely to make a deployment work. Vercel preview builds can deploy this branch independently. A future approved merge can promote the frontend through the production-branch workflow, but confirm that setting in Vercel first.

Deployment protection is intentionally retained: current project settings require Vercel authentication on review/default deployment URLs. No RedDev domain has been attached or DNS/mail changed. Noindex is not access control, so keep this protection while project/legal information is under review. The completed deployment URL and status will be recorded in `VERCEL_DEPLOYMENT.md` beside this handoff.

The only intended browser-safe settings are `NEXT_PUBLIC_SITE_ORIGIN`, `NEXT_PUBLIC_SITE_INDEXABLE` and `NEXT_PUBLIC_DASHBOARD_LOGIN_URL`. Keep indexing false on previews. Do not enable indexing or set the public canonical domain until the website and policies are approved and domain cutover is intentional. Never add `DATABASE_URL`, JWT signing keys, mail credentials or private API tokens as `NEXT_PUBLIC_*` variables. Environment changes require a new build.

## Dashboard login menu

Dashboard Login is visible in the desktop header, grouped mobile menu and footer, following Pookt's public/private separation. If `NEXT_PUBLIC_DASHBOARD_LOGIN_URL` is configured with a confirmed HTTPS address, all three links open the existing dashboard in a new tab with `noopener noreferrer`. Otherwise they open the local `/dashboard-login/` gateway, which truthfully says the live address is awaiting confirmation. This does not create a second authentication system or claim that a guessed host works.

The verified existing login route is `/login`; successful login navigates to `/dashboard`. The repository does not establish a current deployed dashboard host. In particular, `https://livingwell-app.vercel.app` is only an example in deployment documentation. Obtain the actual host from the owner before setting `NEXT_PUBLIC_DASHBOARD_LOGIN_URL`. Supply a bare sign-in URL, not a tokenized link or credential-bearing URL; the helper rejects query/fragment tokens, embedded credentials and non-HTTPS public URLs.

For isolated local dashboard work, the existing `livingwell-frontend` package can use a different port, for example `npm run dev -- --hostname 127.0.0.1 --port 3001`, with its own correctly configured local API. The public app's local `pnpm dev` may point to `http://localhost:3001/login`; local HTTP is accepted only in development. This is not proof that the dashboard/backend is ready or deployed. Do not point the RedDev link at Pookt's dashboard or a public `/dashboard` page.

## What remains deliberately unfinished

Contact validates user input and prepares an email draft; it does not POST, store or send a message. All eleven source team biographies and five original articles are preserved. The company must approve policy wording, project configurations and current availability before launch. The original Privacy link returned another company's material, so the new Privacy/Terms pages are clearly scoped preview notices rather than copied or falsely approved legal policies. Confirm individual contact spellings, including the original-source Jacob email noted in the README.

Source review identified risks in the existing platform that must be addressed before public backend integration: caller-selected roles in `POST /api/auth/register` (`backend/app/routes/auth.py`, `backend/app/schemas/auth.py`); a public static `/uploads` mount (`backend/app/main.py`, `backend/app/services/storage.py`); missing property/LP scope authorization in the property document download handler (`backend/app/routes/documents.py`); and broad CORS derivation (`backend/app/core/config.py`). These are source-review findings, not live penetration-test claims. The dashboard also lacks a verified universal anonymous-user redirect in its current layout; do not treat its visible shell as an authorization boundary. Backend checks must remain authoritative.

Any future anonymous inquiry integration should use a narrow `POST /api/public/v1/sites/{site_key}/inquiries` contract. Add separate Website/PublicInquiry records, validate/allowlist site keys, minimize fields and implement spam/rate/duplicate handling. Dashboard staff may deliberately promote an inquiry into CRM; a website form must not create privileged users, investor relationships, subscriptions or LP interests. Preserve LP/community/property scopes and by-unit/by-bedroom/by-bed/shared-room economics. Do not add generic tenant IDs throughout the financial model or expose private dashboard responses as website content. Revisit static export only if a deliberate server handler is introduced; keep credentials server-side and use explicit migrations against an isolated test database before production.

## Paste this into Claude in VS Code

```text
Continue the existing RedDev public website in this repository. Do not rebuild it.

Start by reading reddevrei-site/README.md, docs/reddev-public-preview/LOCAL_HANDOFF.md, docs/reddev-public-preview/VERCEL_DEPLOYMENT.md, docs/reddev-redevelopment-plan.md and the available page-review notes. Inspect git status and preserve all local work. Our working branch is feat/reddev-public-preview; the repository's existing default branch is master. Use Git email 51514966+vidwad@users.noreply.github.com for new commits. Do not rewrite history or merge, deploy production, run production migrations, change DNS/mail or publish financial/legal copy without explicit approval.

The public frontend is reddevrei-site/. The existing private dashboard is livingwell-frontend/ and the FastAPI system of record is backend/. Vercel reddev-public is a separate project rooted at reddevrei-site, using Node 24 and pnpm 11.25.0. Leave Vercel's Output Directory override unset/default so its native Next.js adapter reads the .next manifest; the application's local static export and assertions still use out. Image integrity checks must parse URL pathnames because Vercel adds deployment-ID queries; do not disable the checks or remove those queries from actual markup. No Pookt project or dashboard may be repointed. Keep review protection and noindex until launch approval.

Preserve the approved RedDev logos, burgundy/gold palette, Public Sans/Open Sans, Pookt-inspired navigation, full-photo homepage hero, smooth broad burgundy-to-charcoal wash, shared 95% decoration-opacity cap, and fullscreen mobile homepage hero. Preserve all eleven people, their source biographies/services and the five dated original articles. Do not generate replacement portraits, invented opportunities, returns, capacities, dates or authors. Use the existing optimized original assets.

First confirm the actual existing LiveWell dashboard hostname with the owner, then set NEXT_PUBLIC_DASHBOARD_LOGIN_URL to its HTTPS /login route. Use the existing shared desktop/mobile/footer DashboardLoginLink; it opens externally with noopener/noreferrer. Do not invent a host, use Pookt's URL, collect passwords in RedDev or create a second authentication system. Until confirmed, keep the honest gateway state.

Then identify the next smallest approved change. The public contact currently prepares a local email draft only. If backend inquiry integration is requested, first review and harden caller-selected registration roles, private /uploads exposure, property/LP document scope authorization and exact-origin CORS. Add isolated tests and explicit Alembic migrations. Use a narrow site-key-scoped anonymous PublicInquiry API; never expose private portfolio/investor/document routes, grant roles from caller input, alter LP/community/property economics or automatically create investors/subscriptions from a contact action. Do not read or reuse a production database for tests.

For any change run pnpm typecheck, pnpm lint, pnpm test and pnpm build. Fix confirmed errors rather than suppress TypeScript/lint or fabricate successful states. Test affected desktop/mobile navigation, focus, disclosures/search or form interactions in a real browser yourself. Retain true 404s, redirects, local link integrity, initial metadata and route/sitemap generation. Contact tests must not send real mail. Document exactly what changed, what passed and what approvals remain. Commit focused changes to the feature branch with the required author email; push only when authorized.

Before launch, obtain approved Privacy/Terms/disclosure wording, current project/offer status and contact details. Set the canonical origin and indexing only for the approved production build. Verify the Vercel project/root/branch/env values, deliberate domain cutover, original-URL redirects and email DNS preservation, and keep rollback available. If the dashboard is not deployed, propose a separate dashboard deployment and its required auth/API/security checks; do not deploy it blindly or claim it already exists.
```
