# RedDev public-site dashboard-login references

**Inspection scope:** read-only local source/configuration review on 2026-10-18. No browser, service, server, git, deployment, or real `.env` file was used. The referenced dashboard hostname below is deliberately **not invented**.

## Decision-ready finding

Build/keep **`reddevrei-site/` as a separate public Next.js/Vercel project**; do not turn `livingwell-frontend/` into the public site and do not give the public app credentials or private API data.

If the business approves a visible private-portal utility link, use an external, Pookt-style link with the verified route:

```text
https://<approved-LivingWell-dashboard-host>/login
```

Suggested label: **Investor / Partner Sign In**. Open in a new tab with `target="_blank" rel="noopener noreferrer"`; show it as a quiet desktop utility icon/link and as visible text in the mobile menu/footer. **Do not publish that URL yet:** the host placeholder must be replaced only after the dashboard deployment owner confirms the actual production custom domain or Vercel alias.

This is **not** a recommendation to link to `reddevrei.com/dashboard` or to the dashboard root (`/dashboard`). The exact **route** `/login` is verified in source; the full external URL is only a **candidate construction** because no confirmed deployed dashboard hostname appears in inspected safe docs/configuration/templates.

## What is verified in the Living Well dashboard

| Item | Status | Evidence |
|---|---|---|
| Login page route | **Verified: `/login`** | `livingwell-frontend/src/app/(auth)/login/page.tsx:13-174` is the login page. |
| Successful-login destination | **Verified: `/dashboard`** | The login submit handler calls `login(email, password)` then sets `window.location.href = "/dashboard"` at `.../(auth)/login/page.tsx:20-33`. |
| Root destination | **Verified: `/` redirects to `/dashboard`** | `livingwell-frontend/src/app/page.tsx:1-5`. This is not proof that anonymous users are redirected to `/login`. |
| Client-side guard destination, if `RoleGuard` is mounted | **Verified: `/login`** | `livingwell-frontend/src/components/auth/RoleGuard.tsx:19-26` calls `router.replace("/login")` when no user exists; it redirects unauthorized roles to `/dashboard`. |
| Dashboard-wide frontend guard | **Not verified / absent in inspected composition** | `livingwell-frontend/src/app/(dashboard)/layout.tsx:1-9` renders only `DashboardShell`; `DashboardShell.tsx:10-48` renders its shell for a null user and does not redirect. A search found `RoleGuard` only at its own definition. |
| Middleware guard | **Not present in the inspected frontend tree** | No `livingwell-frontend/**/middleware.*` file was found. `AuthProvider.tsx:27-44` only fetches `/api/auth/me` when `lwc_access_token` exists in local storage. |
| Backend login endpoint | **Verified: `POST /api/auth/login`** | `livingwell-frontend/src/providers/AuthProvider.tsx:46-55`; `backend/app/main.py:52` mounts the auth router at `/api/auth`; `backend/app/routes/auth.py:106-116` defines `/login`. |

**Implication:** link the public site straight to `/login`, not `/dashboard`. The backend remains the authorization boundary; a route guard must not be inferred from the dashboard shell.

## Deployment and hostname evidence

| Finding | Evidence and interpretation |
|---|---|
| Separate RedDev public app exists | `reddevrei-site/README.md:1-3` calls it a separate Next.js public application and says it does not replace/import the FastAPI backend or `livingwell-frontend` dashboard. |
| Separate Vercel project is an endorsed architecture, not a confirmed deployment | `docs/reddev-redevelopment-plan.md:153-173`, especially line 157, recommends a Vercel project rooted at `reddevrei-site/` and explicitly says this is **not a confirmed hosting change**. |
| RedDev production canonical domain is intended, but publication is not confirmed | `docs/reddev-redevelopment-plan.md:159` and `reddevrei-site/README.md:31-35` name `https://reddevrei.com` for an approved production release; the template leaves `NEXT_PUBLIC_SITE_ORIGIN` empty and `NEXT_PUBLIC_SITE_INDEXABLE=false` (`reddevrei-site/.env.example:1-3`). |
| Dashboard Vercel hostname is **not confirmed** | The only dashboard Vercel URL found is the expressly illustrative `https://livingwell-app.vercel.app` example in `docs/production_deployment_plan.md:73-89`. `livingwell-frontend/.env.example:8-17` names only the API URL example `https://livingwell-api.onrender.com`, not a frontend host. `livingwell-frontend/vercel.json:1-7` identifies Next.js build settings only. |
| RedDev Vercel config contains only legacy contact redirects | `reddevrei-site/vercel.json:1-14`; it does not prove a Vercel project, alias, or dashboard destination. |

Therefore, **do not treat `https://livingwell-app.vercel.app/login` as live**. It is documentation sample text only.

## Pookt pattern to copy—structure, not destination

Pookt’s public shell intentionally treats the private portal as a **separate external utility destination**:

- `public-site/client/src/lib/site-config.ts:15-21` defines `BRAND.portalUrl` as `https://pookt-operations-vidwads-projects.vercel.app/portal`. Its comment says this is the operations app’s canonical production alias and warns that a prior bare Vercel hostname was unassigned.
- `public-site/client/src/components/layout/SiteHeader.tsx:266-288` uses that value as a desktop `Client Sign In` icon, opens a new tab, and applies `noopener noreferrer` plus accessible label/title.
- `SiteHeader.tsx:310-436` renders **Client Sign In** as visible text in the mobile drawer with the same external/new-tab safeguards.
- `public-site/client/src/components/layout/SiteFooter.tsx:86-99` repeats the external link in the footer.

For RedDev, copy this **presentation and separation pattern** only after confirming the dashboard host. The current Living Well source establishes `/login` (not Pookt’s `/portal`) as the appropriate verified route.

## Claude / VSCode handoff: public/private boundary and hazards

### Non-negotiable boundary

- The public RedDev app must not call authenticated/private dashboard routes such as `/api/portfolio`, `/api/investment`, `/api/investor`, or `/api/documents`. See the earlier review at `/home/ubuntu/reddev-review/research/livewell-architecture.md:15-25, 31-33, 108-117`.
- A future public inquiry surface is **proposed, not implemented**: `POST /api/public/v1/sites/{site_key}/inquiries`, with deliberately narrow schemas/services. See `livewell-architecture.md:75-91` and `reddevrei-site/README.md:17-21`.
- Keep `reddevrei-site/` static/public for the present; it currently has no backend call, account creation, subscription, or contact POST (`reddevrei-site/README.md:17-21`).

### Important existing security hazards from the prior local review

| Priority | Hazard | Specific code / endpoint | Handoff action |
|---|---|---|---|
| **Blocker before public backend traffic** | Public registration accepts a caller-selected `UserRole`, and the route writes `payload.role` directly to `User`. | `POST /api/auth/register`; `backend/app/routes/auth.py:90-103`; schema `backend/app/schemas/auth.py:5-10`; router mounting `backend/app/main.py:52`. | Remove open registration, make it invitation-only, or force a server-selected unprivileged role before public integration. |
| **High** | The backend statically mounts all `/uploads`; review identifies this as inappropriate for private documents/public media conflation. | Static mount: `backend/app/main.py:92-95`; path generation/storage: `backend/app/services/storage.py:25-57`; review: `livewell-architecture.md:121-123`. | Never use `/uploads` as RedDev media. Put deliberately public brand assets in a segregated public store/prefix; retain private files behind authorized download handlers. |
| **High** | Property-document download requires an authenticated role but has no explicit property/LP scope check before returning the file. | `GET /api/documents/property-doc/{document_id}/download`; handler `backend/app/routes/documents.py:315-335`; documents router mounted at `backend/app/main.py:62`. | Add the property/LP scope check independently. Do not expose this endpoint or link it from RedDev. |
| **High / deployment review** | CORS is a single `FRONTEND_URL` plus derived localhost/host variants, rather than a parsed exact-origin allowlist; a Vercel wildcard is appended for Vercel hosts. | `backend/app/core/config.py:25-77`; review `livewell-architecture.md:117`. | Use a parsed exact-origin allowlist for the eventual public origin and private app; public inquiries should require no dashboard cookies/credentials. CORS is not authorization. |
| **Release integrity** | Startup invokes/falls back to `Base.metadata.create_all`; frontend build suppresses ESLint and TypeScript errors. | `backend/app/main.py:21-28`; `backend/start.sh:8-45`; `livingwell-frontend/next.config.mjs:1-11`; review `livewell-architecture.md:124-125`. | Use explicit Alembic migrations for any public-inquiry models and give the separate RedDev app real lint/type/build gates. |

These are **source-review findings**, not a live penetration test or confirmation of present deployment exposure. The original synthesis is `/home/ubuntu/reddev-review/research/livewell-architecture.md:119-125`; its RedDev-facing condensed version is `docs/reddev-redevelopment-plan.md:141-151`.

## Safe implementation sequence for the local handoff

1. In VSCode/Claude, work only within `reddevrei-site/` for public presentation/navigation. Do not rewrite `livingwell-frontend/`.
2. Do not add an active portal URL until the dashboard owner supplies the authoritative production host. Record it as a configuration/approval decision, not a guessed Vercel default.
3. Once confirmed, set the public header/mobile/footer utility link to exactly `<confirmed-host>/login`, following Pookt’s `target="_blank" rel="noopener noreferrer"` pattern and using an accessible label.
4. Do not connect RedDev forms to current private APIs. Resolve the three concrete access hazards first, then implement a separate, minimized public inquiry contract with validation, allowlisted site keys, spam/rate controls, audit/source attribution, and no credential issuance.
5. Preserve the backend/dashboard as the private operating system of record; do not expose property operations, occupancy, rent, investor records, documents, financials, or grants.
