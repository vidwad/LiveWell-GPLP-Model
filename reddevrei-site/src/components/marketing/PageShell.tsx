import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

type PageHeroProps = {
  eyebrow: string;
  title: string;
  description?: string;
  breadcrumbLabel?: string;
  parent?: { label: string; href: string };
  image?: { src: string; alt: string };
};

export function PageHero({
  eyebrow,
  title,
  description,
  breadcrumbLabel,
  parent,
  image,
}: PageHeroProps) {
  return (
    <section
      className={`inner-hero${image ? " inner-hero-with-image" : ""}`}
      aria-labelledby="page-title"
    >
      {image && (
        <Image
          src={image.src}
          alt={image.alt}
          fill
          priority
          sizes="100vw"
          className="inner-hero-photo"
        />
      )}
      <div className="inner-hero-treatment" aria-hidden="true" />
      <div className="container inner-hero-content">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <ChevronRight size={13} aria-hidden="true" />
          {parent && (
            <>
              <Link href={parent.href}>{parent.label}</Link>
              <ChevronRight size={13} aria-hidden="true" />
            </>
          )}
          <span aria-current="page">{breadcrumbLabel || title}</span>
        </nav>
        <p className="eyebrow">
          <span />
          {eyebrow}
        </p>
        <h1 id="page-title">{title}</h1>
        {description && <p className="inner-hero-description">{description}</p>}
      </div>
    </section>
  );
}

export function PageCallout({
  title = "The right partnership starts with a conversation.",
  description,
  href = "/contact/",
  label = "Speak with Our Team",
}: {
  title?: string;
  description?: string;
  href?: string;
  label?: string;
}) {
  return (
    <section className="page-callout">
      <div className="container">
        <div>
          <p className="eyebrow">
            <span />
            LET’S BUILD WHAT COMES NEXT.
          </p>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        <Link className="button button-gold" href={href}>
          {label}
          <ArrowUpRight size={18} aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}

export function PageNote({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <aside className="page-note">
      <h3>{title}</h3>
      <div>{children}</div>
    </aside>
  );
}
