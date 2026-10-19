# RedDev Vercel deployment

The new separate project is `reddev-public` (`prj_R0ZKUTUfxCm227k8HI1PpfyGq0nJ`), under `vidwad's projects` / `team_OTw8Nc7J80njGM7rHYYwEvYv`. Its Git connection points to `vidwad/LiveWell-GPLP-Model`; the public root is `reddevrei-site/`, separate from `backend/` and `livingwell-frontend/`.

Confirmed READY review build: `dpl_EEYaz17APAENeTy9ga5Zxq745wkh`, source commit `69f706304715ddb0bf92f178e79002ecc388759f` on `feat/reddev-public-preview`. Vercel readiness and alias assignment were confirmed on 18 October 2026. Build URL: https://reddev-public-qbptrl4iu-vidwads-projects.vercel.app . Stable branch review alias: https://reddev-public-git-feat-reddev-public-preview-vidwads-projects.vercel.app . Authorized protected-deployment fetches returned HTTP 200 for the homepage and dashboard gateway, including correct initial HTML, noindex metadata and the honest login-address-pending state. No credentials or email were submitted.

## Correct build settings

Use the Next.js framework preset and Node 24. Set install to `npx --yes pnpm@11.25.0 install --frozen-lockfile`, build to `npx --yes pnpm@11.25.0 build`, and root to `reddevrei-site`. Leave Vercel Output Directory and Development Command overrides unset/default. Native Next.js handling needs its `.next` manifest; the app still uses `output: export` and writes static HTML to `out` for local preview and assertions. Do not set Vercel's override to `out` or bypass failed checks.

`NEXT_PUBLIC_SITE_INDEXABLE=false` is configured for production, preview and development in this new project. Canonical origin and dashboard login address remain unset until their respective approvals. Review deployment authentication is enabled (`all_except_custom_domains`); access normally requires the authorized Vercel account. No custom domain has been attached, no RedDev/Pookt production project repointed, no master merge made and no DNS/mail modified.

## Checks and deliberate boundaries

All 18 pages pass initial HTML, unique metadata, main/H1, local link, anchor, packaged-image and original portrait checks. All 15 inquiry/navigation/dashboard URL regressions, typecheck and lint pass. A local deployment-ID regression also passes: Vercel appends `?dpl=...` to images, so the checker now validates the parsed pathname rather than treating a query as a file name. The first build failed that checker; the next passed app checks but failed because of the now-corrected Output Directory override. See `vercel-build-notes.md` for evidence.

Dashboard Login is implemented on desktop, mobile and footer, but the existing LiveWell host remains unconfirmed. Only the `/login` route is verified. Unconfigured links show the honest gateway; a confirmed HTTPS `NEXT_PUBLIC_DASHBOARD_LOGIN_URL` switches them to external login, never a new public password form. Contact still prepares an email draft, not a stored/sent backend submission. Policy/project/security and domain-cutover work remains for local VS Code development and owner approval, as described in `LOCAL_HANDOFF.md`.

## Approved public temporary address — 18 October 2026

The owner explicitly approved public access at https://reddev-public.vercel.app . Production deployment `dpl_7vbEairRocdYtbkUsoLvApVtRZjR` is READY, uses the exact current source `2e6d58b7f765839db4071ba20a71ae71352be50b`, and has that configured domain assigned. No authentication settings needed disabling: the existing Standard Protection scope allows the configured production domain while keeping review URLs protected.

A fresh unauthenticated HTTP session, with no authorization, cookies, protection-bypass headers or environment proxy, returned 200 for `/`, `/contact/`, `/dashboard-login/` and `/manus-routes.json`; the manifest contains all 18 pages. The preview branch URL still returns a 302 sign-in redirect. Homepage metadata remains `noindex, nofollow`. RedDevREI.com, DNS/mail, backend/dashboard code, GitHub default branch and the unresolved dashboard-login host remain unchanged. The initial 404 was caused by the lack of a production deployment behind the short domain, not a broken homepage.
