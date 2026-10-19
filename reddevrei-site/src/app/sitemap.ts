import type { MetadataRoute } from "next";
import { site } from "@/config/site";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  if (!site.indexable || !site.publicOrigin) return [];
  return [
    { url: `${site.publicOrigin}/`, changeFrequency: "monthly", priority: 1 },
    {
      url: `${site.publicOrigin}/contact/`,
      changeFrequency: "monthly",
      priority: 0.7,
    },
  ];
}
