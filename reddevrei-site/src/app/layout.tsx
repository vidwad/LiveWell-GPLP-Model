import type { Metadata } from "next";
import "@fontsource-variable/public-sans";
import "@fontsource-variable/open-sans";
import "./globals.css";
import "@/styles/pages.css";
import SiteHeader from "@/components/marketing/SiteHeader";
import SiteFooter from "@/components/marketing/SiteFooter";
import RouteScrollReset from "@/components/marketing/RouteScrollReset";
import BackToTop from "@/components/marketing/BackToTop";
import { site } from "@/config/site";
import { articles } from "@/content/articles";

export const metadata: Metadata = {
  title: {
    default: "RedDev | Multifamily Real Estate Investments",
    template: "%s | RedDev Real Estate Investments",
  },
  description:
    "A disciplined approach to multifamily real estate investment, development and management. Get to know RedDev and speak with our team.",
  ...(site.publicOrigin ? { metadataBase: new URL(site.publicOrigin) } : {}),
  ...(site.publicOrigin
    ? { alternates: { canonical: `${site.publicOrigin}/` } }
    : {}),
  robots: { index: site.indexable, follow: site.indexable },
  openGraph: {
    type: "website",
    siteName: site.name,
    title: "RedDev | Multifamily Real Estate Investments",
    description:
      "Invest in places. Build lasting value. Multifamily real estate investment, development and management.",
    ...(site.publicOrigin ? { url: `${site.publicOrigin}/` } : {}),
    images: site.publicOrigin
      ? [
          {
            url: `${site.publicOrigin}/brand/logo-full-light.png`,
            alt: site.name,
          },
        ]
      : [],
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <SiteHeader
          articlePaths={articles.map((article) => `/${article.slug}/`)}
        />
        <main id="main-content" tabIndex={-1}>
          {children}
        </main>
        <SiteFooter />
        <RouteScrollReset />
        <BackToTop />
      </body>
    </html>
  );
}
