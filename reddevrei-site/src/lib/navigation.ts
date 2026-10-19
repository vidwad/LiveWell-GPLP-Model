export function normalizePublicPath(path: string) {
  const clean = path.split("?")[0].replace(/\/+$/, "");
  return clean || "/";
}

export function sectionIsActive(
  pathname: string,
  hash: string,
  href: string,
  articlePaths: readonly string[] = [],
) {
  const [path, targetHash] = href.split("#");
  const currentPath = normalizePublicPath(pathname);
  const targetPath = normalizePublicPath(path);
  if (
    targetPath === "/blog" &&
    articlePaths.some(
      (articlePath) => normalizePublicPath(articlePath) === currentPath,
    )
  )
    return true;
  if (currentPath !== targetPath) return false;
  return !targetHash || hash === `#${targetHash}`;
}
