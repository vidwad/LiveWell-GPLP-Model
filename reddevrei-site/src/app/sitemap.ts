import type { MetadataRoute } from "next";
import { site } from "@/config/site";
import manifest from "../../public/manus-routes.json";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  if (!site.indexable || !site.publicOrigin) return [];
  return manifest.routes.map((route) => ({
    url: new URL(route.path, site.publicOrigin).toString(),
    changeFrequency: "monthly" as const,
    priority: route.path === "/" ? 1 : 0.7,
  }));
}
