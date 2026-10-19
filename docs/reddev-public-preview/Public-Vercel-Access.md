# Public Vercel access

On 18 October 2026 the owner explicitly approved public access to the current frontend at `https://reddev-public.vercel.app`, while retaining preview protection, noindex and all existing RedDevREI.com/DNS/mail/backend/dashboard boundaries. This is temporary-address publication, not approval of policy wording, offering availability or the final branded-domain cutover.

The existing short project domain returned HTTP 404 because it had no assigned production deployment. Existing review URLs redirected anonymous requests to Vercel authentication. The current ready review was `dpl_EwdmRa86YpqoVAYkEM79pWMLEgGP`, code commit `2e6d58b7f765839db4071ba20a71ae71352be50b` on `feat/reddev-public-preview`.

A production redeployment of that exact version was created only in `reddev-public`: `dpl_7vbEairRocdYtbkUsoLvApVtRZjR`. It is now READY with `reddev-public.vercel.app` assigned and anonymous access verified. No source code or authentication implementation was changed, and no GitHub default-branch merge was needed.

Vercel's Standard Protection preserves access restrictions on review/deployment URLs while allowing configured production domains to be public. Its current project scope remains `all_except_custom_domains`; do not disable protection globally to fix a missing production alias. Official scope documentation: https://vercel.com/docs/deployment-protection .

## Final verified state

Production `dpl_7vbEairRocdYtbkUsoLvApVtRZjR` is READY and Vercel automatically assigned `reddev-public.vercel.app`. Fresh anonymous requests returned HTTP 200 for the homepage, contact page, honest dashboard gateway and the complete 18-route manifest. No authentication/bypass headers, cookies or environment proxy were used. The preview branch remains protected (HTTP 302 to sign-in), and homepage robots metadata is `noindex, nofollow`. The existing Standard Protection setting was retained without any global authentication disablement. No custom-domain/DNS/mail or source-code changes were required.
