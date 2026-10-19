# About Us page review

## Sources used

- **Primary:** [RedDev About Us](https://reddevrei.com/about-us/) — stateless extraction on 18 October 2026. Used for the company profile, vision, mission, five stated values, all 11 listed people, roles, two-paragraph biographies, individual public phone/email links, and four portrait associations.
- **Corroboration:** [RedDev home](https://reddevrei.com/) — used only to corroborate high-level positioning and the public contact pattern.
- **Corroboration:** [RedDev contact page](https://reddevrei.com/contact-us-2/) — public office location, `info@reddevrei.com`, and `604-729-7077`.
- **Provided source notes:** `/home/ubuntu/reddev-review/research/reddev-findings.md` — roster preservation, brand palette/type guidance, and migration cautions.
- **Provided archive:** `/home/ubuntu/reddev-review/research/about-us.html` — file contains only a 403 response; it was not used as biography evidence.

## Implementation notes

- Created `/about-us/` and `src/content/team-profiles.ts` with **all 11 people from `src/content/team.ts`** preserved in the same order, with original roles and source-derived two-paragraph biographies.
- Reused only the four existing, source-labelled leadership portraits in `media.team` / `public/brand`. The remaining seven profiles show initials rather than a fabricated or unverified portrait.
- Individual public contacts are retained exactly as published on the original About page, including the source spelling of `jacobwadhwan@reddevrei.com`.
- The page uses native `<details>` controls for readable, keyboard-accessible long biographies. Contact and summary controls meet the 44px target at narrow widths.
- No new current-project, offering, or legal claims are presented. Source-derived historical biography wording is preserved as requested and is qualified by the preview/reconfirmation note; it is not presented as an approved current investment statement. The local CTA goes to the approved email-draft contact route.

## Pending approvals / checks

1. Confirm each individual biography, role, direct email, and telephone number remains current before production. In particular, verify the published Jacob Wadhwani email spelling.
2. Confirm that the company’s current vision/mission/values language remains approved for the new site; this page uses a restrained migration of its public About-page text, not legal-approved investment language.
3. Confirm whether additional original portraits for the seven non-leadership profiles may be published. None were recovered because no source-labelled original file was available.
4. Parent integration should update the navigation and footer destinations from homepage anchors to `/about-us/#company` and `/about-us/#team` as appropriate; this agent did not touch shared navigation or footer files.
