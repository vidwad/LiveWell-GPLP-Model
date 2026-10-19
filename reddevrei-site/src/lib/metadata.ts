import type { Metadata } from "next";
import { site } from "@/config/site";

function conciseDescription(value: string) {
  const limit = 160;
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= limit) return clean;
  const cut = clean.slice(0, limit - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${lastSpace > 0 ? cut.slice(0, lastSpace) : cut}…`;
}

export function pageMetadata({
  title,
  description,
  path,
  article,
}: {
  title: string;
  description: string;
  path: string;
  article?: { publishedTime?: string; author?: string };
}): Metadata {
  const url = site.publicOrigin
    ? new URL(path, site.publicOrigin).toString()
    : undefined;
  const images = site.publicOrigin
    ? [
        {
          url: new URL(
            "/brand/logo-wide-light.png",
            site.publicOrigin,
          ).toString(),
          alt: site.name,
        },
      ]
    : undefined;
  const displayTitle = `${title} | RedDev`;
  const metadataDescription = conciseDescription(description);
  return {
    title,
    description: metadataDescription,
    ...(url ? { alternates: { canonical: url } } : {}),
    openGraph: {
      title: displayTitle,
      description: metadataDescription,
      siteName: site.name,
      type: article ? "article" : "website",
      ...(url ? { url } : {}),
      ...(images ? { images } : {}),
      ...(article
        ? {
            publishedTime: article.publishedTime,
            authors: article.author ? [article.author] : undefined,
          }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: displayTitle,
      description: metadataDescription,
      ...(images ? { images: images.map((image) => image.url) } : {}),
    },
  };
}
