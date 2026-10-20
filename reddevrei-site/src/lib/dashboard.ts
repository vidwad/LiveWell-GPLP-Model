/**
 * The live LiveWell dashboard sign-in page, confirmed on 19 October 2026:
 * the production Docker Compose stack on the DigitalOcean droplet serves
 * the dashboard on port 3000 (title "Living Well Communities") and its
 * backend on port 8000 reports environment "production".
 *
 * It is plain HTTP on a bare IP address because no domain or certificate
 * has been set up for the droplet yet (the repository's Caddyfile is still
 * the YOUR_DOMAIN.com template). This exact address is therefore the only
 * non-HTTPS address the site will link to. Once the dashboard has a domain
 * with HTTPS, set NEXT_PUBLIC_DASHBOARD_LOGIN_URL to it (or update this
 * constant) and remove the HTTP allowance.
 */
export const CONFIRMED_DASHBOARD_LOGIN_URL = "http://165.22.226.72:3000/login";

/** A public sign-in address, never a token or a private API credential. */
export function getDashboardLoginUrl(
  value: string | undefined,
  {
    allowLocalHTTP = false,
    trustedHTTP = [],
  }: { allowLocalHTTP?: boolean; trustedHTTP?: readonly string[] } = {},
): string | undefined {
  if (!value?.trim()) return undefined;
  try {
    const url = new URL(value.trim());
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    const trusted = trustedHTTP.some(
      (entry) => new URL(entry).href === url.href,
    );
    if (
      url.protocol !== "https:" &&
      !(url.protocol === "http:" && ((local && allowLocalHTTP) || trusted))
    )
      return undefined;
    if (url.username || url.password || url.search || url.hash)
      return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}

/**
 * The dashboard address the site links to: NEXT_PUBLIC_DASHBOARD_LOGIN_URL
 * when it is set to a valid address, otherwise the confirmed live address.
 */
export function resolveDashboardLoginUrl(
  configured: string | undefined = process.env.NEXT_PUBLIC_DASHBOARD_LOGIN_URL,
  { development = process.env.NODE_ENV === "development" } = {},
): string | undefined {
  const options = {
    allowLocalHTTP: development,
    trustedHTTP: [CONFIRMED_DASHBOARD_LOGIN_URL],
  };
  return (
    getDashboardLoginUrl(configured, options) ??
    getDashboardLoginUrl(CONFIRMED_DASHBOARD_LOGIN_URL, options)
  );
}
