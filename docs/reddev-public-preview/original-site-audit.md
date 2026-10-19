# reddevrei.com content audit: original site vs. the new RedDev site

**Audited:** 18 October 2026, against the live WordPress site at https://reddevrei.com (page, post, project, team, testimonial and attachment sitemaps; the WordPress REST API for pages, posts, media and post types; and the rendered HTML of every public page) and against the static export of `reddevrei-site/` at commit `07d88a1`.

**Purpose:** find every piece of content, image, graphic and downloadable document on the original site that the new site does not yet carry, and record what was brought across afterwards and what deliberately was not.

## Summary

| Area | Original | New site before this audit | Gap |
|---|---|---|---|
| Public pages | 31 WordPress pages, of which 14 carry real content | 18 routes | Five stage pages (`/analyze/` etc., four are clones), LP landing page, investor-info page, careers |
| Blog posts | 5 | 5, full text preserved with original dates, bylines and images | None |
| Project portfolio | 11 `project` posts (BC townhome/multifamily builds) | None | Titles only in the original; the project pages themselves are empty |
| Team | 11 people on About Us; 5 demo "team member" posts | 8 on About Us (3 removed on 18 Oct at the owner's request) | Demo posts are not RedDev people |
| Media library | 142 attachments | 20 brand files | ~60 page images and graphics were not carried; 85 have now been recovered |
| Documents | 6 PDFs, 5 videos, 2 Canva embeds, 1 YouTube embed | None | All |
| Investment specifics | Offering terms, returns illustrations, cash-flow examples, FAQ (22 questions), investor documents | Deliberately omitted pending approval | All |

The earlier rebuild kept the site's structure and tone but stripped nearly all investment, student-housing and document content, replacing it with "confirm with the team" language. Everything below is listed so it can be restored deliberately.

## Page by page

### Home (`/`)

Original sections, in order:

1. **Hero.** Full-width background video `BMHeader.mp4` (25.7 MB, a Black Maple Construction construction reel, 2022) with the headline "Helping you invest in multifamily real estate", the line "RedDev Real Estate Investments specializes in creating exceptional real estate investment opportunities through strategic syndication and development projects", and buttons *About Us* and *View Opportunities*.
2. **Welcome.** Three paragraphs ("With a strong foundation built on decades of combined expertise…", "Explore how we work…") with buttons *Learn More* and *Invest with Us*, beside the syndication graphic `Untitled-design-e1724887700618.png`.
3. **Our Approach.** Intro paragraph, the corporate brochure card (flyer mockup image, blurb "RedDev REI is a premier syndicator and vertically integrated owner and operator of multifamily apartments…", **Download** button to `RedDev-Real-Estate-Investments-Corporate-Profile-For-email.pdf`, 4.8 MB, 11 pages), and five stage blurbs with icons (Analyze, Acquire, Enhance, Manage, Report & Comply).
4. **Invest With Us.** "RedDev invests alongside our partners to preserve wealth and secure financial freedom through cash-flowing multifamily real estate investments."
5. **Current Opportunities.** Intro paragraph and the Edmonton Multiplex Limited Partnership 1 summary (three properties in Garneau, 8-plex units under the new zoning bylaws, "Available for accredited investors only"), with a *Learn More* link to the acknowledgement.
6. **Accredited Investor Acknowledgement.** Two risk paragraphs and the button *I Confirm I am an Accredited Investor* leading to the LP page.
7. **Video band.** `BlackMapleSample.mp4` (71.9 MB) with "We believe that exceeding investor expectations is the fastest path to our success."
8. **News & Insights.** Intro paragraph, five article cards with the original featured photos, *View All*.
9. **Have a question?** Contact band.
10. **Footer.** Light logo, disclaimer, menu, social links, Maple Ridge address, phone and email, "Website by Vidalcom Solutions Inc."

New site before the audit: new hero copy over the Edmonton skyline still, a short About block, the five stages (short blurbs only), student housing teaser, "Invest With Us" next steps, team grid, three insight cards, closing CTA, disclosure. Missing: the welcome copy, the corporate brochure download, the Current Opportunities block, the accredited-investor acknowledgement, the "invests alongside our partners" line, the syndication graphic, both videos.

### About Us (`/about-us/`)

Original: "Company Profile" hero; **About Us** (two paragraphs, first person); **Our Vision** and **Our Mission** (full text); full logo image; **Core Values & Principles** (intro plus five values); **Meet Our Team** (intro, then eleven profiles with portrait, title, biography, phone and email; Vid's card also shows a LinkedIn logo with no link).

New site: all of this is present, but the company, vision and mission copy was rewritten into reported speech ("RedDev describes its work as…", "Its stated vision is…"). The five values are verbatim. Eight profiles remain (Aidan Carkeek, Cory Reddekopp and Brandon Reddekopp were removed at the owner's request on 18 October). Contact details are inside each profile's expander.

Gap: restore the first-person company, vision and mission copy.

### Our Approach (`/our-approach/`)

Original: "Investment Approach" hero; **Our Investment Approach** paragraph; syndication graphic and the caption "We do all the necessary Due Diligence"; the **investment funnel** graphic (`Investment-funnel.png`); a long paragraph on syndication, general and limited partners, the Securities Act and the Offering Memorandum; then **Analyze, Acquire, Enhance, Manage, Report & Comply**, each with two paragraphs, with two stock videos between them (`sign-contract…mp4` 13.3 MB and `the-employee-prepare-a-report…mp4` 4.1 MB); **Our Advantages** paragraph and six blurbs (Experienced Team, Strategic Partnerships, Thorough Due Diligence, Investor Transparency, Value-Add Strategy, Access to Capital). The Strategic Partnerships blurb still reads "The joint venture between Redline Building and Deviser Capital Partners…".

New site: five stages with one-sentence blurbs, generic "across the work" and "context matters" sections. Missing: the full stage copy, the syndication explanation, the funnel graphic, the advantages.

### Stage pages (`/analyze/`, `/acquire/`, `/enhance/`, `/manage/`, `/report/`)

Only **Analyze** has its own content: "Comprehensive Analysis for Potential Acquisitions", an intro (which still says "At Deviser…"), the `growthFinancing.jpg` image, six steps each with a paragraph and five bullets (Market Analysis, Property Identification, Preliminary Due Diligence, Financial Modeling, Risk Assessment, Investment Committee Review), a closing quotation, and a contact form. The other four pages are byte-for-byte clones of Analyze, including the "Analyze" breadcrumb and headings. They were never written.

New site: none of these routes exist. The approach page links its five stages to in-page anchors.

### Invest (`/invest/`)

Original: "Current Opportunities" hero; **Current Opportunities** intro; **Edmonton Multiplex Limited Partnership 1** summary (as on Home); **Accredited Investor Acknowledgement** with the confirm button; **Seminar Invitation RSVP** for 29 November 2024 with a stale "Success!" message and a subscribe form; a Canva embed of the investor presentation (`DAGW2Tb0U8A`); **Next Steps to Invest** (Review & Due Diligence with text, Connect With Our Team, Commit To Invest); **Creating the Best Real Estate Investing Experience** ("Our goal is to get premium returns for our Canadian investors and help you build mega wealth", "We provide first class service…"); **monthly distributions** paragraph with the 15–20%+ annual return target and the $200 million by 2030 vision; the brochure books mockup image.

New site: relationship-led copy, a qualified link to the project page, three generic next steps, an important-information box. Missing: the opportunity summary, the acknowledgement gate, the presentation embed, the investing-experience copy, the targets paragraph, the images. The seminar RSVP is obsolete and should not return.

### Student Housing (`/student-housing/`)

The most image-rich page on the original site. Sections:

- Hero "High-quality, Affordable Student Accommodations in Edmonton, Alberta" with a *Book a Call* button.
- **Mission Statement** paragraph, two design renders.
- **Market Demand** paragraph (2.2 million students, ~200,000 purpose-built beds).
- **MultiPlex Housing** paragraph, magazine mockup, "Designed for International Success" paragraph, **Download** of `Multiplex-Housing-Email.pdf` (56 MB, 19 pages).
- **Current Projects**: Walterdale Bridge photo; "Edmonton, Alberta" paragraph (three multiplexes in Garneau, 8 units each, 3–4 bedrooms); render; **24 Units – 84 Bedrooms** paragraph; map image; **Distance to Local Universities** (six bullets).
- **Purpose built Student Housing / Typical Unit Features**: unit mix, 28 bedrooms and ensuites, flooring, basement ceiling, appliances, heating; floor-plan graphic.
- **Floor Plans**: three renders.
- **Kitchen & Living Room** paragraph.
- **Private Bedroom & Bathroom**: four renders.
- **Modular Furniture** paragraph.
- **Tenant Portal** paragraph (the Multiplex Housing App) with two app images.
- **Features & Amenities** paragraph with two images.
- **Modern Infrastructure**: three blurbs (Modern & Functional Design, Smart Living with Property Tech, Turnkey Student Living) with two images.
- **Referral Program** paragraph and image.
- **Smart Housing, Smarter Investing**: the 7318 105A Street NW flagship, 28 suites, Queen Alexandra; **Why Invest?** five bullets including the $4.5 million Newmark 2025 valuation and 1.9% vacancy.
- **Find Your Home Away from Home**: "Pre-leasing is now open for the fall 2025 semester" (stale) and an image.

New site: a short, hedged page with two photos and an FAQ that answers every question with "ask the team". Missing: everything above, 24 images, one PDF.

### Edmonton Multiplex LP 1 (`/edmonton-multiplex-lp-1/`)

The longest page on the original site:

- Information-only banner and preliminary-information paragraph.
- **Introduction** (three paragraphs), "Available to accredited investors only".
- **Financing Proceeds Raised** progress bar (28% of a $2,500,000 target) and **Indication of Interest** bar (54%), with *Invest* and *Register Interest* buttons to `Indication-of-Interest-Edmonton-MultiPlex-LP-I.pdf` (130 KB).
- **Investment Summary** paragraph and the `Intro2` graphic.
- **The Deal: Offering Summary & Investment Returns** gallery: `Proj-Returns.png`, two site photos, `Prop-App.png`, two `Spec-Graphic` images, the corporate-profile cover.
- **Edmonton Multiplex: 8 Unit Student Housing Developments** paragraph.
- **Project Highlights** graphic and the Edmonton day-to-night time-lapse video (53 MB).
- **Why Edmonton, Alberta** (six bullets: population growth, occupancy, affordability, economy, zoning, enrolment).
- **Investor Cash Flow** (four bullets: 73% return of capital on refinancing, yearly distributions, year-5 sale, 36% annualised ROI illustration).
- **Investment Highlights**: `CashFlow-Summary.png` and `Projected-Returns-on-100k.png`.
- **Financing Terms** table (issuer, listing, reporting status, securities offered, currency, staged issue prices $900/$1,000/$1,100, minimum and maximum offering, $50,000 minimum subscription, use of proceeds, resale restrictions, NI 45-106 private placement, finder's fee up to 8%, closing dates).
- **More Information**: books mockup, "Current Opportunity" graphic, *Download Investment Summary*, and an **Investor Package Request Form**.
- **Investor Presentation**: Canva embed `DAGIoZtMhEM` ("Edmonton MultiPlex LP 1 by Vid Wadhwani").
- **Investor FAQs**: 22 questions with full answers (what the LP is, strategy, property selection, target ROI 8–12%, $50,000 minimum, property type, zoning, demographic, 5–7 year horizon, risks, who manages, tax benefits, distributions, RRSP/TFSA eligibility, underperformance, 90–95% occupancy, fees, structure and LP rights, due diligence, transfers, communication, team experience).
- **Next Steps to Invest** (three cards).
- **Our Investment Team** graphic (`people.png`).
- **Cover 100% of Your Child's University Education Costs**: paragraph, PDF (119 KB, 2 pages), title-page image.
- **Sub-Contractors: Maximize Your Contract Profits by Investing in What You Build**: paragraphs, PDF (27.8 MB, 13 pages), title-page image.

New site: a "legacy project overview" with one photo and no specifics. Missing: all of the above, 18 images, three PDFs, one video, one embed.

### Landing page (`/landing-page-edmonton-multiplex-lp-1/`) and investment-info page (`/edit-page-edmonton-multiplex-lp-investment-info/`)

Both are working copies of the LP page: the landing page adds **The Problem & the Solution** paragraph, three social-media graphics, the seminar countdown and RSVP; the investment-info page adds a **Step-by-Step Process** (register, review the Offering Documents, invest, receive updates, receive distributions). Neither is linked from the menu. The reusable pieces are the problem/solution paragraph, the three graphics and the step-by-step list.

### Blog (`/blog/`) and the five articles

Original and new are equivalent: same five posts, same titles, bylines, dates, featured images and body text (paragraph counts match on every article). The new site adds an archive notice. The original blog index shows the three newest posts plus a "Recent Posts" list; the new index lists all five with search and category filtering.

### Contact Us (`/contact-us-2/`)

Original: address (Maple Ridge, B.C.), telephone, email, and a form (name, email, company, message, captcha). New site: equivalent, with the form producing an email draft instead of a server submission, plus an accessibility note. No gap in content. The original footer's social links point to Alerio Gold Corp accounts and a LinkedIn company page `75619922`; they were carried over from another site and need the correct RedDev handles before any social links are added.

### Privacy Policy (`/privacy-policy/`) and Terms of Use (`/terms-of-use/`)

Both are Black Maple Construction boilerplate: the privacy text names `blackmapleconstruction.com` and insurance "claims", and the terms name Black Maple Construction of Mission, BC, refer to "renewable sector services", point to `www.solairinc.com`, and choose United States law and California courts. They should not be ported. The new site's preview notices are the better placeholder until counsel supplies real policies.

### Careers (`/careers/`)

Placeholder: "Build All Supply, Miami, Florida" with a US phone number and a contact form, plus a forward-looking-statements disclaimer. Not RedDev content; nothing to port except the disclaimer wording, which the new Investment Disclosures page already covers in substance.

### Projects (`/project/` and 11 project pages)

Eleven `project` posts dated 2020–2022, bylined Nathan Wadhwani and "stephcho": Ledgeview (North Surrey), Yorkson Park Townhomes, Central, East and West, Yorkson Creek Parkside 2, Yorkson Downs (Langley Township), Preston on Fourteenth (Mission), The Trails (North Vancouver), Forest Ridge (South Surrey), Mackenzie Park (Port Coquitlam). Every project page is empty apart from the heading "About this Project". Together with the Quadra Homes testimonial, these are Black Maple Construction's build record. They could become a "Track record" section if RedDev wants to present that history, but there is no content to port today.

### Team Members (`/teams/`) and Testimonials (`/jvt-testimonials/`)

Five "team member" posts (Daniel Harris, Cameron King, Venkat Kumar Tangirala, John R. Owen, Dan Bates) are energy-industry biographies from a theme or another company, one of them using Jacob Wadhwani's portrait. Three testimonials are from Quadra Homes and others about Black Maple Construction. None of this is RedDev content.

### VR Hud (`/vr-hud/`)

A single YouTube embed (`Aev9IPUFX8A`). Unlinked; purpose unknown.

### WooCommerce and membership pages

Shop, Cart, Checkout, My account, Login, Register, Members, Account, Logout, Password Reset, User, Special Login: empty plugin scaffolding. Nothing to port.

## Documents and media

| File | Size | Where used | Decision |
|---|---|---|---|
| RedDev Corporate Profile (for email) PDF | 4.8 MB, 11 pp | Home brochure card | Carry into the site |
| RedDev Corporate Profile PDF (2024) | 24.8 MB, 10 pp | Media library only | Superseded by the email version |
| Indication of Interest, Edmonton MultiPlex LP I | 130 KB, 1 p | LP page | Carry into the site |
| Cover 100% of Your Child's University Education Costs | 119 KB, 2 pp | LP page | Carry into the site |
| SubContractor Partnership PDF | 27.8 MB, 13 pp | LP page | Link to the original host for now; too large for the repo |
| Multiplex Housing Email PDF | 56 MB, 19 pp | Student Housing | Link to the original host for now; too large for the repo |
| BMHeader.mp4 | 25.7 MB | Home hero | Black Maple construction footage; not RedDev. Not ported |
| BlackMapleSample.mp4 | 71.9 MB | Home video band | Same. Not ported |
| Edmonton day-to-night time-lapse | 53 MB | LP page | Stock footage; link to the original host |
| Two stock clips on Our Approach | 13.3 MB, 4.1 MB | Our Approach | Stock footage; not ported |
| Canva investor presentation `DAGIoZtMhEM` | embed | LP page | Embed |
| Canva presentation `DAGW2Tb0U8A` | embed | Invest, landing page | Embed on the LP page |
| YouTube `Aev9IPUFX8A` | embed | VR Hud | Not ported; purpose unknown |

Images: 85 page images and graphics were recovered at full size (17 MB) and converted to web-sized WebP under `public/brand/original/`. The three large PDFs and the videos stay on the WordPress host until it is retired; the audit flags them so they can be moved to object storage before cutover.

## Content that should not return as it was

- The 29 November 2024 seminar RSVP, its countdown, and the "Success!" confirmation.
- "Pre-leasing is now open for the fall 2025 semester."
- The fundraising progress bars (28% of $2.5 million, 54% indications of interest); the values are a snapshot with no date.
- "At Deviser" and "Redline Building and Deviser Capital Partners" wording left from earlier entities.
- Black Maple privacy and terms, the Alerio Gold social links, the careers placeholder, the demo team posts, the testimonials about Black Maple.
- "guaranteeing a reliable source of rental income" on the LP summary: carried over as "designed to provide", with the original risk acknowledgement kept beside it.

## What was restored after this audit

See the commit that follows this document. In short: full original copy on Home, About, Our Approach and Invest; the Analyze stage page at its original URL; the complete Student Housing page with its renders, plans, app images and PDF; the complete LP page with the offering summary graphics, Why Edmonton, investor cash-flow illustration, financing terms, the 22-question FAQ, presentation embed, investor documents and the education-costs and sub-contractor programmes; the corporate brochure download on Home. Every return figure is presented with the original site's own acknowledgement that it is a projection and not a guarantee, and the Investment Disclosures page remains linked from each investment section.
