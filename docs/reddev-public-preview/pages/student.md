# Student Housing page review

**Route:** `/student-housing/`
**Owner:** `student`
**Status:** Preview content assembled from retained original-page evidence; current project details remain unapproved.

## Source basis

- `/home/ubuntu/reddev-review/research/reddev-findings.md` records a browser review of the original page on 18 October 2026. It supports the following retained themes: accessible, affordable, purpose-built student housing; furnished housing; utilities and Wi-Fi; an Edmonton university-community context; and the presence of distinct Garneau and Queen Alexandra descriptions.
- `/home/ubuntu/reddev-review/research/student-housing.html` is a 403 placeholder and does not provide usable page copy.
- `https://reddevrei.com/student-housing/` was retried with stateless extraction on 18 October 2026 and returned a cookie/security challenge rather than article content.
- Public search results for the original route provided a current indexed snippet, but no numeric, suite, bathroom, availability, ownership, or investment claims from that snippet were carried into the preview.
- `/home/ubuntu/reddevrei/reddevrei-site/public/brand/asset-sources.json` identifies `/brand/student-kitchen.jpg` and `/brand/student-housing-exterior.jpg` as original-page image recoveries. They are explicitly captioned/positioned as illustrative, not evidence of current ownership, configuration, availability or a live offer.

## Implemented content decisions

The page preserves the original furnished-housing, utilities/Wi-Fi, amenities, and Edmonton university-community positioning. It offers an accommodation path at `/contact/?type=student-housing` and keeps investment questions distinct at `/contact/?type=investment`. Both are public contact routes; the page does not imply a form submission, account creation, investment execution, current availability, or a current opportunity.

The page uses native `details` disclosures for source-supported service questions. Answers direct visitors to the team to confirm current furnishing details, inclusions, and location information.

## Pending approval / reconciliation

1. Confirm which source description belongs to the Garneau multiplexes and which belongs to the Queen Alexandra flagship. The preview intentionally does not merge their configurations or publish capacities, unit/bedroom counts, address details, suite types, bathroom arrangements, pricing, availability, or status.
2. Confirm current accommodation locations, included services, amenity details, and availability before publishing them as current facts.
3. Confirm that retained original images remain approved for public use in this context and whether a location-specific caption is appropriate.
4. Confirm the metadata wording once current service and project details have been approved.

## Verification

`npx eslint src/app/student-housing/page.tsx` passed with no output. An earlier combined ESLint invocation reported only that the CSS module has no matching lint configuration. No shared build was run because integration/build is owned by the parent agent.
