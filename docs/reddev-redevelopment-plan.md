# RedDevREI.com redevelopment plan

Build RedDev as a **new public-facing Next.js application inside `vidwad/LiveWell-GPLP-Model`**, alongside—not inside—the existing dashboard. Keep the FastAPI backend as the shared operational platform. Adapt Pookt’s public navigation patterns to RedDev’s existing identity, without importing its business content, branding, or operations application.

This is a redevelopment of the presentation and public inquiry journey, not a change to RedDev’s people or services. The first delivery should establish the public-site foundation, homepage, navigation, and contact flow. Additional pages and future brand websites can then use the same controlled backend boundary.

*Prepared by Manus AI · 18 October 2026. Planning review only; neither repository, production data, hosting, nor DNS was changed.*

## What the current RedDev site tells us

RedDev’s existing proposition is multifamily real estate investment through syndication, acquisition, development and value enhancement, property management, and investor reporting. The five-step process—**Analyze → Acquire → Enhance → Manage → Report & Comply**—is worth keeping. Student housing is already a distinct part of the public site, so it should remain prominent rather than disappear into a generic services page. [1] [2] [3]

The existing team page identifies Vid Wadhwani, David Carkeek, Mark Kauhane, Nathan Wadhwani, Michael Polan, Jacob Wadhwani, Reid Muller, Kaden Moravek, Aidan Carkeek, Cory Reddekopp, and Brandon Reddekopp. Preserve all these people, their approved roles, portraits, biographies, and contact links. Review dated biographical details with the team; do not replace the team with abbreviated or invented profiles. [4]

Several current-site issues should be corrected during migration:

- The investment page still contains an RSVP confirmation for November 29, 2024. Its offering status and dated event content need review before they are presented as current. [5]
- Footer social destinations include Alerio Gold accounts, and extracted page source contains unrelated Solair Energies material. Remove inherited template material and publish only confirmed RedDev social links. [1] [4]
- The homepage repeats its introduction and contains wording such as “News & Insites” and “Have a Questions.” Reorganize and edit the copy while retaining its meaning. [1]
- Public copy includes “guaranteeing” rental income and targeted annual returns. These should not be carried forward automatically as current promises; have the company and its legal advisers approve investment language, risks, eligibility, and disclosures. [1] [5]
- Student housing content describes both three Garneau multiplexes and a Queen Alexandra flagship with a different accommodation configuration. Establish which project each description belongs to and its latest approved facts before migration. This is a reconciliation task, not a conclusion that the projects are incorrect. [3]

The current Contact page uses name, email, company, and message fields. Preserve this simple route to the company. It publicly lists Maple Ridge, B.C., `info@reddevrei.com`, and `604-729-7077`. [6]

## Preserve the brand; improve the design system

Use the original RedDev RD emblem and wordmark. The existing light wordmark assets have been located and retained for implementation; there is no need to redesign the logo. Keep original team photography, approved project images, and corporate materials. Review image rights and project-image accuracy during migration rather than substituting stock buildings or generated portraits. [7] [8]

**Design movement:** a contemporary architectural and investment-company editorial website, using RedDev’s established red-and-gold identity rather than a new aesthetic borrowed from Pookt.

**Core principles:** recognizable branding, clear investor information, evidence-backed project presentation, and easy access to the team. Reduce the current long introductory passages and inconsistent section treatments.

**Color philosophy:** preserve the existing burgundy `#930011`, gold `#E6B741`, supporting amber `#E09900`, charcoal `#151515`, white `#FFFFFF`, and warm cream `#FEF6E1` found in RedDev’s stylesheet. Treat burgundy as the signature brand color and gold as a selective accent. Do not reproduce every inherited plugin color. Establish named tokens for backgrounds, text, buttons, borders, and focus states, with readable contrast combinations. [1]

**Typography:** retain Public Sans for headings and Open Sans for body text, as specified in the existing stylesheet. Poppins can remain a navigation face where appropriate to the current presentation. Standardize a readable hierarchy instead of copying the current oversized headings and inconsistent spacing. [1]

**Layout:** use a strong architectural hero followed by editorial sections with alternating image and text emphasis. Give project information and the investment process distinct visual roles; do not turn the whole site into an interchangeable card grid.

**Signature elements:** the existing RD emblem, restrained gold rules and active-navigation accents, and a consistent five-step investment-process treatment.

**Interactions and animation:** keep links and dropdowns predictable. Use short opacity and position transitions of approximately 150–250 ms for menus and header compaction. Avoid scroll-jacking, mandatory autoplay video, or decorative motion that delays access to information. Respect reduced-motion preferences.

**Brand essence:** RedDev connects investment partners with thoughtfully developed multifamily real estate opportunities through an integrated investment and operating approach. Personality: experienced, transparent, practical.

**Brand voice:** direct and measured. Example headline: “Multifamily real estate. A disciplined approach to creating value.” Example action: “Speak with our investment team.” Avoid unsupported guarantees or fabricated track-record statistics.

## Adapt Pookt’s navigation, not its entire frontend

Pookt’s live desktop header places the logo left, direct links and compact dropdowns in the middle, and a distinct primary CTA and account-access action on the right. It begins transparent over the hero and becomes a more compact solid surface on scroll. Its mobile menu opens as a full-width grouped panel below the header, rather than a side flyout. The footer mirrors the site’s main categories. These are the right patterns to reuse. [9] [10]

For RedDev, I recommend this first navigation:

**Home · About Us ▾ · Our Approach · Student Housing · Invest With Us ▾ · Insights · Contact CTA**

The logo also links home. “About Us” contains Company and Team, initially as sections of `/about-us/`. “Invest With Us” contains the investment overview, approved opportunities, and the next-steps section. Keep dropdowns short; do not add acquisition criteria, careers, new housing services, or other pages unless the business actually needs and approves them.

Use **“Speak with Our Team”** as the primary desktop CTA and a short **“Contact”** label on mobile. Keep Contact in the footer and mobile menu. An **Investor Login** utility link should appear only once the actual investor-facing dashboard destination and access experience are confirmed. Do not send prospective investors into the internal operating dashboard by default.

Implement the Pookt-like mobile panel with clearly labeled groups and one prominent contact action. Add reliable Escape-to-close, focus return, accessible expanded-state labels, visible keyboard focus, and at least 44-pixel touch targets. If implemented as an overlay, use modal focus management and prevent background interaction; do not apply modal behavior to an ordinary in-flow navigation panel.

Use semantic breadcrumbs on inner pages and enough top clearance that the fixed header never hides headings or anchor destinations. Keep the header visible while a menu is open or keyboard focus is inside it. Header retraction while scrolling down is optional; the first version can stay visible for predictability.

The relevant Pookt sources are:

- `public-site/client/src/components/layout/SiteHeader.tsx` and `src/lib/site-config.ts` for navigation configuration and header behavior. [10]
- `public-site/client/src/components/layout/PageShell.tsx` and `SiteFooter.tsx` for page structure, hero/CTA hierarchy, and footer organization. [11]
- `apps/big-red-bins-web/` for a separate branded Next.js public-site example, particularly server-delivered metadata. [12]

Pookt’s public app uses React/Vite/Wouter/Tailwind 4, whereas the existing LiveWell dashboard uses Next.js 14/React 18/Tailwind 3. Adapt the component contracts and behavior rather than copying package files, routing, stylesheets, or UI-library assumptions. The new site can use supported Next.js dependencies without upgrading the dashboard as a prerequisite. [13] [14]

## Public pages for the first release

**Home — `/`.** A concise investment proposition, the existing five-step process, student housing emphasis, an approved project or opportunity overview, a team introduction, selected insights, and a clear contact action. Do not duplicate the introductory paragraph or display unverified statistics.

**About Us — `/about-us/`.** Company positioning, mission and principles, followed by all existing team members. Use a consistent portrait and biography presentation, with expandable longer biographies where useful. Separate `/team/` pages are optional, not necessary for the first release.

**Our Approach — `/our-approach/`.** Explain the same five stages with clear responsibilities, value-add activity, reporting, and relevant risk context. Retain the corporate brochure only after confirming that it remains the approved version.

**Student Housing — `/student-housing/`.** Preserve the existing service and housing proposition. Distinguish investor information from accommodation inquiries where the company wants both audiences served. Use approved project facts rather than combining configurations from different developments.

**Invest With Us — `/invest/`.** Explain how an interested investor can learn more and speak with the team. Display only opportunities approved for publication, with explicit status. Preserve the existing `/edmonton-multiplex-lp-1/` path if that project remains part of the approved content, but do not label it open or current until confirmed.

**Insights — `/blog/` initially.** Improve the visible label while preserving existing article URLs, titles, authors, and dates. Refresh article claims only with approval. A URL change to `/insights/` is optional and must include redirects; it is not required for a modern design.

**Contact — `/contact/`.** Name, email, optional company, message, and optional inquiry category. Add phone only as an optional field if useful. Give visitors a real submission result, clear error handling, and a privacy notice. Redirect `/contact-us-2/` permanently to the new page.

**Policy and disclosure pages.** Provide approved Privacy and Terms content, applicable investment disclosures, and an accessibility/contact statement. Add cookie-preference controls if the chosen tracking tools require them; do not invent a legal policy or copy Pookt’s business-specific terms.

## Fit the new site into LiveWell’s repository

The repository already contains a substantial FastAPI/SQLAlchemy backend and a separate Next.js dashboard in `livingwell-frontend/`. Its homepage redirects to `/dashboard`. The documented frontend/backend deployment separation makes a sibling public application a natural fit. [14] [15]

Recommended structure below is **proposed**, not already implemented:

```text
LiveWell-GPLP-Model/
├── backend/                         # Existing shared platform
│   └── app/
│       ├── routes/public_site.py    # New narrow anonymous website API
│       ├── schemas/public_site.py   # Public request/response contracts
│       └── services/public_site.py  # Inquiry handling and safe projections
├── livingwell-frontend/             # Existing private dashboard; preserved
├── reddevrei-site/                  # New independently deployed public app
│   ├── src/app/(marketing)/         # Public pages and marketing layout
│   ├── src/app/api/inquiries/       # Optional narrow same-origin form handler
│   ├── src/components/marketing/    # Header, mobile menu, hero, footer, process
│   ├── src/content/                 # Approved copy, team, articles, projects
│   ├── src/config/site.ts           # Site key, navigation, contacts, metadata
│   ├── src/styles/                  # RedDev-only brand tokens
│   ├── src/lib/public-api.ts        # Public API adapter, never dashboard client
│   └── public/brand/                # Original, deliberately public brand assets
└── docs/reddev-redevelopment.md     # Approved implementation/design plan
```

Use a marketing route group **inside the new application**. Do not put RedDev’s public homepage inside the dashboard’s global authentication providers or dashboard shell. Public pages must not inherit dashboard navigation, private API clients, financial state, or authentication cookies.

Start with approved content in version-controlled files. This supports launch without first building a complete content-management system. If central editing through the existing dashboard is needed, add a small Website Content area later with draft/publish permissions and explicit website attribution. That can remain part of this backend; a separate CMS is not required by this plan.

## Shared backend and future public websites

There is no implemented public website CMS or marketing lead endpoint in the inspected backend. Its existing investor CRM is useful downstream, but creating an investor is a protected internal operation. Existing property endpoints return operational and financial information and are not suitable public feeds. [16] [17]

Add a narrow public contract beginning with:

`POST /api/public/v1/sites/{site_key}/inquiries`

A small `Website` identity can hold a stable site key, domain, display name, and active status. `PublicInquiry` should record that website, inquiry type, contact details, message, attribution, consent information where applicable, and review status. These are additive records, not changes to the property or investor economics models.

The flow should be **visitor → validated inquiry → dashboard review → intentional CRM promotion if appropriate**. An anonymous submission must not automatically create a privileged user, investor, investment subscription, or LP relationship. Do not subscribe someone to marketing merely because they sent a contact message.

Validate site keys server-side. Add spam controls, rate limits, bounded inputs, duplicate protection, and a minimal public response. A same-origin Next.js handler may forward only this specific inquiry contract to FastAPI; it must not become a general proxy to private APIs. Store the inquiry durably before treating email notification as successful, and confirm the operational notification destination during implementation.

For future sites, repeat the public-app boundary and give each site its own configuration, domain, brand assets, and attribution. Share the backend contract from the start. Extract a reusable frontend package only when the second site establishes what is genuinely common; do not introduce a monorepo framework or generic page-builder before that need exists.

A **website ID is not a tenant ID**. RedDev being one marketing website does not justify changing every LP, property, community, user, or document table. True organizational tenancy would be a separate platform decision involving isolation across the whole data and authorization model. Existing LP/community/property scopes should retain their current meaning. [18]

If projects later come from the dashboard, expose only deliberately published fields through a separate public projection: approved title, location, narrative, images, status, and permitted public details. Never publish raw rent rolls, bed occupancy, underwriting, debt terms, investor records, or private documents.

Keep existing by-unit/by-bedroom/by-bed rent inputs and shared-room models untouched. The public website project must not alter baseline or redevelopment cash-flow behavior. [18]

## Security items before backend integration

Source review identified three concrete items that warrant attention before connecting public traffic to the platform:

1. **Open registration accepts a caller-selected role.** The inspected registration route passes the requested role into user creation, and its schema includes privileged roles. Remove open privileged registration, use invitations, or enforce a server-selected unprivileged role pending approval. [19]
2. **The backend mounts `/uploads` as static files.** Do not use this directory as the public media library without separating public assets from private documents. Private material should require authorized retrieval. [20]
3. **A property-document download handler lacks an explicit property/LP scope check in the inspected code.** Correct the access check independently of the marketing rebuild. [21]

These are source findings, not a live penetration test or confirmation of the current deployment’s exposure. Verify deployment configuration when implementing the fixes. Also replace the single-origin CORS assumptions with an exact origin allowlist where browser-to-backend calls are used; public requests should not need dashboard credentials. CORS is not a substitute for authorization. [22]

Use explicit Alembic migrations for new tables, rather than relying on startup schema fallback. Keep production data out of development fixtures. Add focused build/type/lint checks for the new app; do not inherit the dashboard configuration that suppresses build errors. [23]

## Rendering, deployment, and migration

Generate meaningful public page HTML with Next.js static generation or server rendering. Use small client components only for navigation, forms, and other interactions. Deliver page-specific titles, descriptions, canonical URLs, social previews, and real not-found responses in the initial HTML. Do not copy Pookt’s SPA catch-all and client-only metadata approach. [13]

A separate Vercel project with `reddevrei-site/` as its root fits the existing documented deployment pattern, while the FastAPI backend continues on its current infrastructure. This is a recommendation, not a confirmed hosting change; confirm the actual hosting and deployment ownership before configuring it. Keep the dashboard on its own existing destination. No separate operational database is needed. [15]

Use `https://reddevrei.com` as the intended canonical production origin, with a consistent redirect from the alternate hostname. Maintain existing article and service URLs where possible. Produce an explicit redirect map for paths that change, preserve approved downloadable resources or redirect their old locations, and generate sitemap/robots from the public route set.

Keep staging out of indexing, and protect it if it contains unapproved or confidential material; `noindex` alone is not access control. Keep the current WordPress site intact until the replacement is approved. Launch should involve an intentional domain cutover that leaves mail records unchanged and retains a rollback route to the old site.

## How I suggest we proceed

**1. Approve the architecture and content direction.** Confirm the sibling public-app approach, navigation, primary contact CTA, and whether an investor login should be visible. Resolve the current opportunity status, student-housing project descriptions, and approved brochure/disclosures. The default is public company information plus inquiries, not online investment execution.

**2. Build the RedDev foundation and homepage preview.** Create a dedicated feature branch in `LiveWell-GPLP-Model`, retain the existing applications, and implement the RedDev tokens, Pookt-style header/mobile navigation, footer, homepage, and contact page. Use original assets. Review this meaningful first slice before completing every inner page.

**3. Connect the inquiry flow and complete public pages.** Address the identified backend access issues, add the small public inquiry contract, and connect dashboard review. Migrate the team, approach, student housing, approved opportunity content, and insights into the new public app. Keep public fields separate from operational records.

**4. Release RedDev without disrupting the platform.** Complete the approved URL migration and production configuration. Use a pull request and the repository’s actual default branch rather than assuming `main`; the reviewed LiveWell revision is on `master`. Keep DNS cutover and publication separate from code review. Then add subsequent public websites incrementally using the same backend boundary.

The next decision is to approve **the separate public app, the proposed navigation, and a homepage/contact preview as the first development slice**. Hosting details and the final approved opportunity facts can be resolved during that foundation work; they should not force a dashboard rewrite or a speculative CMS build.

## References

[1]: https://reddevrei.com/ "RedDev homepage and archived stylesheet"
[2]: https://reddevrei.com/our-approach/ "RedDev investment approach"
[3]: https://reddevrei.com/student-housing/ "RedDev student housing page"
[4]: https://reddevrei.com/about-us/ "RedDev company and team profiles"
[5]: https://reddevrei.com/invest/ "RedDev investment overview and current published opportunity copy"
[6]: https://reddevrei.com/contact-us-2/ "RedDev current contact page"
[7]: https://reddevrei.com/wp-content/uploads/2023/02/Logo-Full-Wide-Light.png "Original RedDev wide light wordmark"
[8]: https://reddevrei.com/wp-content/uploads/2023/02/Logo-2-Full-Light.png "Original RedDev light logo asset"
[9]: https://pookt.com/ "Pookt live public navigation reference"
[10]: https://github.com/vidwad/pookt-operations/blob/a638fa873bc9c436e9ad160debd5c70c617da24a/public-site/client/src/components/layout/SiteHeader.tsx "Pookt public site header implementation"
[11]: https://github.com/vidwad/pookt-operations/tree/a638fa873bc9c436e9ad160debd5c70c617da24a/public-site/client/src/components/layout "Pookt public marketing shell and footer"
[12]: https://github.com/vidwad/pookt-operations/tree/a638fa873bc9c436e9ad160debd5c70c617da24a/apps/big-red-bins-web "Big Red Bins separate branded Next.js public app"
[13]: https://github.com/vidwad/pookt-operations/tree/a638fa873bc9c436e9ad160debd5c70c617da24a/public-site "Pookt public frontend stack and rendering configuration"
[14]: https://github.com/vidwad/LiveWell-GPLP-Model/tree/9940b42716bc25df642e07948705314cdd85f37c/livingwell-frontend "Existing LiveWell Next.js dashboard frontend"
[15]: https://github.com/vidwad/LiveWell-GPLP-Model/blob/9940b42716bc25df642e07948705314cdd85f37c/docs/production_deployment_plan.md "LiveWell frontend and backend deployment plan"
[16]: https://github.com/vidwad/LiveWell-GPLP-Model/blob/9940b42716bc25df642e07948705314cdd85f37c/backend/app/routes/investor.py#L262-L274 "Protected internal investor creation"
[17]: https://github.com/vidwad/LiveWell-GPLP-Model/blob/9940b42716bc25df642e07948705314cdd85f37c/backend/app/routes/portfolio.py#L41-L133 "Authenticated operational property listing API"
[18]: https://github.com/vidwad/LiveWell-GPLP-Model/blob/9940b42716bc25df642e07948705314cdd85f37c/backend/app/db/models.py "LiveWell LP, property, investor, unit and bed data models"
[19]: https://github.com/vidwad/LiveWell-GPLP-Model/blob/9940b42716bc25df642e07948705314cdd85f37c/backend/app/routes/auth.py#L90-L103 "LiveWell registration role assignment"
[20]: https://github.com/vidwad/LiveWell-GPLP-Model/blob/9940b42716bc25df642e07948705314cdd85f37c/backend/app/main.py#L92-L95 "Backend static uploads mount"
[21]: https://github.com/vidwad/LiveWell-GPLP-Model/blob/9940b42716bc25df642e07948705314cdd85f37c/backend/app/routes/documents.py#L315-L335 "Property document download handler"
[22]: https://github.com/vidwad/LiveWell-GPLP-Model/blob/9940b42716bc25df642e07948705314cdd85f37c/backend/app/core/config.py#L25-L77 "Current backend origin configuration"
[23]: https://github.com/vidwad/LiveWell-GPLP-Model/blob/9940b42716bc25df642e07948705314cdd85f37c/livingwell-frontend/next.config.mjs#L1-L11 "Dashboard build-check suppression configuration"
