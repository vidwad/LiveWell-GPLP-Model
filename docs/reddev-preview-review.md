# First-slice validation review — RedDev public preview

**Scope reviewed:** `/home/ubuntu/reddevrei/reddevrei-site` against `TODO.md` and the approved redevelopment plan. This is a **read-only static/source review** of the homepage and contact slice only. No browser screenshots, live-site browsing, form submission, backend access, build rerun, dependency change, Git operation, or implementation change was performed. Parent-provided typecheck, lint, build, route-manifest, and HTTP-200 evidence was accepted and not repeated.

## Confirmed defects (ordered by severity)

### Medium — emitted static export omits Nathan Wadhwani’s original leadership portrait

The current source is correct: `src/content/media.ts` maps all four leadership names, and `public/brand/nathan-wadhwani.png` is a valid 367×367 original-source portrait with provenance in `public/brand/asset-sources.json`. However, the currently emitted preview is stale relative to that source:

- `src/content/media.ts` and `public/brand/nathan-wadhwani.png` are newer than `out/index.html`.
- `out/brand/nathan-wadhwani.png` is absent.
- `out/index.html` renders Nathan as the `NW` initials fallback, while Vid, David, and Mark render portrait images.

This fails the first-slice requirement to preserve the four leadership portraits **in the actual static preview artifact**, even though the source now contains the correct fourth asset.

**Necessary fix:** regenerate and deploy the static export from the current source/assets; verify the emitted `out/index.html` references `/brand/nathan-wadhwani.png` and that all four portrait files are present in `out/brand/`. Add this as a small export-artifact assertion so source/output drift is caught before preview handoff.

### Medium — no-JavaScript contact submission defaults to a GET request despite the “nothing is submitted or stored” promise

The emitted contact HTML has `<form ... novalidate>` with neither `action` nor `method`. If client JavaScript is unavailable or fails before hydration, standard HTML form behavior is a GET to the current contact URL using the named fields (`name`, `email`, `company`, `phone`, `inquiryType`, `message`). That can put inquiry text in the URL and in ordinary web-server/proxy/browser-history logs; it does **not** open the stated email draft.

The hydrated React path is otherwise correct: it prevents default submission and only builds a `mailto:` URI; static review found no `fetch`, XHR, beacon, storage API, route handler, or backend client.

**Necessary fix:** provide a non-network fallback that is truthful (for example, a clearly labeled direct `mailto:` option) or change the interaction so the unhydrated control cannot perform an implicit GET. Preserve the current client-side `mailto:` draft path and ensure the fallback never claims storage or successful sending.

### Low — small visible process/investment labels do not meet normal-text contrast

Opaque foreground/background calculations from the reviewed CSS show:

| Location | CSS pair | Calculated contrast | Why it matters |
|---|---:|---:|---|
| Five-step ordinal (`.step-top span`) | `#92867b` on `#faf8f3` | **3.34:1** | 16px visible process text is below the 4.5:1 normal-text target. |
| Investment next-step ordinal (`.investment-panel li > span`) | `#a18b64` on white | **3.29:1** | 14px visible text is below the 4.5:1 normal-text target. |
| Investment note (`.investment-note`) | `#7e766c` on white | **4.47:1** | Marginally below 4.5:1 and rendered at 9px. |

**Necessary fix:** darken these text tokens/instances to at least 4.5:1 against their fixed backgrounds (and preferably increase the tiny note size). This is limited to the affected secondary text; primary RedDev burgundy/gold/cream combinations reviewed were readable.

### Low — share metadata still depends on a live production WordPress asset

Both initial HTML documents emit `og:image` and `twitter:image` as `https://reddevrei.com/wp-content/uploads/2023/02/Logo-Full-Wide-Light.png`, even though the equivalent original logo is already packaged at `public/brand/logo-full-light.png`. The visible preview itself uses packaged local assets, but a shared preview still causes social crawlers to retrieve an asset from the unchanged live production site.

**Necessary fix:** point social metadata at the packaged logo through the configured preview/public origin, so the export is self-contained and share cards do not depend on the current WordPress asset. Do not make the preview indexable while doing so.

## Confirmed first-slice outcomes

- **People and source assets:** all 11 approved roster members are present in `src/content/team.ts` and in the homepage’s leadership/wider-team markup. Asset provenance records four original About-derived leadership portraits for Vid Wadhwani, David Carkeek, Mark Kauhane, and Nathan Wadhwani. The emitted-preview exception for Nathan is recorded above.
- **Services/process and investment safety:** the five approved stages are preserved in order: **Analyze → Acquire → Enhance → Manage → Report & Comply**. The homepage retains multifamily positioning and student-housing emphasis. It contains no open/current opportunity claim, return guarantee, or invented offer; it explicitly says availability/eligibility are confirmed with the team and that the site is not an offer of securities.
- **Contact boundary:** direct `mailto:info@reddevrei.com` and `tel:+16047297077` links and Maple Ridge, British Columbia are present. Required name/email/message validation, optional company/phone/type, field errors, and explicit preview/email-draft wording are present. The only network-like defect is the unhydrated native-form fallback above.
- **Navigation/accessibility source review:** the fixed header has desktop compact disclosures and an in-flow full-width mobile panel. Source implements `aria-expanded`/`aria-controls`, Escape close, focus restoration for Escape/close, focus trap plus `inert` background for the modal mobile panel, skip link, visible focus rules, reduced-motion rules, and 44px-or-larger mobile controls/links. Breakpoints switch desktop navigation at 70rem and the form grid at 580px; layout CSS also handles 1150px, 900px, 650px, and 380px views. No browser interaction test was run by instruction.
- **Link and asset integrity:** static inspection found all internal first-slice destinations resolve to `/`, homepage anchors, or `/contact/`; packaged image references resolve except the stale Nathan output described above. Links to existing RedDev articles deliberately remain external and carry `noopener noreferrer` while insight migration is deferred.
- **Public boundary/security:** no source import references the private dashboard, backend, authentication client, or secrets. The only environment reads are `NEXT_PUBLIC_SITE_ORIGIN` and `NEXT_PUBLIC_SITE_INDEXABLE`; no value is embedded as a secret. There are no route handlers or `/api` calls in this app.
- **Static rendering/indexing/404:** emitted `/` and `/contact/` include page-specific title/description/Open Graph metadata and `noindex, nofollow`; `out/robots.txt` disallows all. The emitted 404 variants contain a main landmark, clear “PAGE NOT FOUND” content, return-home link, and noindex metadata. `out/manus-routes.json` lists exactly `/` and `/contact/` for this slice.

## Deferred items — not defects in this approved first slice

- Dedicated About/Team, Our Approach, Student Housing, Invest, Insights/article, policy, disclosure, redirect, and broader migration routes are explicitly later public-page work. Homepage section navigation is an approved temporary destination strategy, not a dead-link defect.
- Backend inquiry persistence, public API work, spam/rate/duplicate controls, CRM promotion, and all dashboard/security remediation are intentionally deferred. The preview must remain email-draft-only until that later boundary is implemented.
- The noindex preview has no emitted canonical URL because no `NEXT_PUBLIC_SITE_ORIGIN` was supplied. This is appropriate for an isolated non-indexable preview, but before any indexable deployment the exact public origin must be configured so canonicals, sitemap, robots allow rules, and self-hosted absolute social metadata are emitted together.

## Resolution after review

Parent applied focused corrections and re-ran affected checks at 00:04 UTC on 19 October 2026. All four original leadership portraits now appear in the emitted homepage and `out/brand/`, verified by the new `scripts/verify-static.mjs` build assertion. The draft UI uses an accessible `role="form"` group, not a native HTML form, with a `type="button"` action; no unhydrated GET/POST or implicit Enter submission can send inquiry fields. A visible no-JavaScript direct-email fallback is supplied.

Affected process and investment text now has calculated contrast of 5.27:1, 5.73:1 and 6.15:1; the investment note was increased to 11px. Share metadata now uses the packaged original logo through an explicitly configured public origin and otherwise omits the image URL, rather than depending on WordPress or inventing an origin. Preview indexing remains disabled.

TypeScript, ESLint, all seven inquiry tests, Next.js static export and export-integrity assertions pass after these corrections. No production/backend/DNS change was made. The original review observations above remain as an audit trail, not unresolved defects.
