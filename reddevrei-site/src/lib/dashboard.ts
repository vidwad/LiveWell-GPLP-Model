/** A public sign-in address, never a token or a private API credential. */
export function getDashboardLoginUrl(
  value: string | undefined,
  { allowLocalHTTP = false }: { allowLocalHTTP?: boolean } = {},
): string | undefined {
  if (!value?.trim()) return undefined;
  try {
    const url = new URL(value.trim());
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (
      url.protocol !== "https:" &&
      !(url.protocol === "http:" && local && allowLocalHTTP)
    )
      return undefined;
    if (url.username || url.password || url.search || url.hash)
      return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}
