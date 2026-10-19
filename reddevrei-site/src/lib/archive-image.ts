import { existsSync } from "node:fs";
import { join } from "node:path";

export function archiveImage(source?: string): string | undefined {
  if (!source || !source.startsWith("/brand/archive/")) return source;
  const optimized = source
    .replace("/brand/archive/", "/brand/archive/optimized/")
    .replace(/\.(jpe?g|png)$/i, ".webp");
  return existsSync(join(process.cwd(), "public", optimized.slice(1)))
    ? optimized
    : source;
}
