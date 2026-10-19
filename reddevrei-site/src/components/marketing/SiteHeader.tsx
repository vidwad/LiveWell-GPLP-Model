"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronDown, Menu, X } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { usePathname } from "next/navigation";
import { navigation, site } from "@/config/site";
import styles from "./navigation.module.css";

type NavigationItem = (typeof navigation)[number];
type NavigationChild = { readonly label: string; readonly href: string };

function childrenFor(item: NavigationItem): readonly NavigationChild[] {
  return "children" in item ? item.children : [];
}

function sectionIsActive(pathname: string, hash: string, href: string) {
  if (href === "/") {
    return pathname === "/" && !hash;
  }

  return pathname === "/" && hash === href.slice(1);
}

function focusableElements(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => !element.hasAttribute("disabled"));
}

type DesktopDisclosureProps = {
  item: NavigationItem;
  isActive: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onHoverChange: (isOpen: boolean) => void;
  onNavigate: () => void;
  registerTrigger: (element: HTMLButtonElement | null) => void;
};

function DesktopDisclosure({
  item,
  isActive,
  isOpen,
  onToggle,
  onHoverChange,
  onNavigate,
  registerTrigger,
}: DesktopDisclosureProps) {
  const children = childrenFor(item);
  const menuId = `desktop-disclosure-${item.label.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <div
      className={styles.disclosure}
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
    >
      <button
        ref={registerTrigger}
        type="button"
        className={`${styles.desktopNavLink} ${styles.disclosureButton} ${isActive ? styles.active : ""}`}
        aria-expanded={isOpen}
        aria-controls={menuId}
        onClick={onToggle}
      >
        <span>{item.label}</span>
        <ChevronDown
          aria-hidden="true"
          className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ""}`}
        />
      </button>

      {isOpen && (
        <div id={menuId} className={styles.disclosurePanel}>
          <ul className={styles.disclosureList}>
            {children.map((child) => (
              <li key={child.href}>
                <Link
                  href={child.href}
                  className={styles.disclosureLink}
                  onClick={onNavigate}
                >
                  {child.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

type HeaderContentProps = {
  pathname: string;
};

function HeaderContent({ pathname }: HeaderContentProps) {
  const [hash, setHash] = useState("");
  const [scrolled, setScrolled] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const desktopNavRef = useRef<HTMLElement | null>(null);
  const mobileDialogRef = useRef<HTMLDivElement | null>(null);
  const mobileTriggerRef = useRef<HTMLButtonElement | null>(null);
  const desktopTriggers = useRef(new Map<string, HTMLButtonElement>());

  useEffect(() => {
    const updateHash = () => setHash(window.location.hash);
    const updateScroll = () => setScrolled(window.scrollY > 18);

    updateHash();
    updateScroll();
    window.addEventListener("hashchange", updateHash);
    window.addEventListener("scroll", updateScroll, { passive: true });

    return () => {
      window.removeEventListener("hashchange", updateHash);
      window.removeEventListener("scroll", updateScroll);
    };
  }, []);

  useEffect(() => {
    if (!openMenu) return;

    const closeFromOutsidePointer = (event: PointerEvent) => {
      if (!desktopNavRef.current?.contains(event.target as Node)) {
        setOpenMenu(null);
      }
    };

    document.addEventListener("pointerdown", closeFromOutsidePointer);
    return () =>
      document.removeEventListener("pointerdown", closeFromOutsidePointer);
  }, [openMenu]);

  useEffect(() => {
    if (!mobileOpen) return;

    const backgroundElements = [
      document.querySelector<HTMLElement>("#main-content"),
      document.querySelector<HTMLElement>("footer"),
      document.querySelector<HTMLElement>("header"),
      document.querySelector<HTMLElement>(".skip-link"),
    ].filter((element): element is HTMLElement => element !== null);
    const previousInertState = backgroundElements.map((element) => ({
      element,
      hadInertAttribute: element.hasAttribute("inert"),
      inertValue: element.getAttribute("inert"),
    }));
    backgroundElements.forEach((element) => element.setAttribute("inert", ""));

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => {
      const firstElement = mobileDialogRef.current
        ? focusableElements(mobileDialogRef.current)[0]
        : undefined;
      firstElement?.focus();
    }, 0);

    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      previousInertState.forEach(
        ({ element, hadInertAttribute, inertValue }) => {
          if (hadInertAttribute) {
            element.setAttribute("inert", inertValue ?? "");
          } else {
            element.removeAttribute("inert");
          }
        },
      );
    };
  }, [mobileOpen]);

  useEffect(() => {
    const desktopBreakpoint = window.matchMedia("(min-width: 70rem)");
    const closeOnDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) setMobileOpen(false);
    };

    desktopBreakpoint.addEventListener("change", closeOnDesktop);
    return () =>
      desktopBreakpoint.removeEventListener("change", closeOnDesktop);
  }, []);

  const restoreDesktopTrigger = (label: string) => {
    window.requestAnimationFrame(() =>
      desktopTriggers.current.get(label)?.focus(),
    );
  };

  const closeDesktopDisclosure = (restoreFocus = false) => {
    if (!openMenu) return;
    const menuToClose = openMenu;
    setOpenMenu(null);
    if (restoreFocus) restoreDesktopTrigger(menuToClose);
  };

  const closeMobile = (restoreFocus = false) => {
    setMobileOpen(false);
    if (restoreFocus) {
      window.requestAnimationFrame(() => mobileTriggerRef.current?.focus());
    }
  };

  const handleHeaderKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape" && openMenu) {
      event.preventDefault();
      event.stopPropagation();
      closeDesktopDisclosure(true);
    }
  };

  const handleMobileKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeMobile(true);
      return;
    }

    if (event.key !== "Tab" || !mobileDialogRef.current) return;
    const elements = focusableElements(mobileDialogRef.current);
    if (!elements.length) return;

    const first = elements[0];
    const last = elements[elements.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const toggleMobile = () => {
    if (mobileOpen) {
      closeMobile(true);
    } else {
      setOpenMenu(null);
      setMobileOpen(true);
    }
  };

  return (
    <>
      <header
        className={`${styles.header} ${scrolled ? styles.isScrolled : ""}`}
        onKeyDown={handleHeaderKeyDown}
      >
        <div className={`container ${styles.headerInner}`}>
          <Link
            href="/"
            className={styles.logoLink}
            aria-label={`${site.name} home`}
          >
            <Image
              src="/brand/logo-wide-light.png"
              alt={site.name}
              width={2202}
              height={363}
              priority
              className={styles.logo}
            />
          </Link>

          <nav
            ref={desktopNavRef}
            className={styles.desktopNav}
            aria-label="Primary navigation"
          >
            {navigation.map((item) => {
              const hasChildren = childrenFor(item).length > 0;
              const isActive = sectionIsActive(pathname, hash, item.href);

              if (!hasChildren) {
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={`${styles.desktopNavLink} ${isActive ? styles.active : ""}`}
                    onClick={() => setOpenMenu(null)}
                  >
                    {item.label}
                  </Link>
                );
              }

              return (
                <DesktopDisclosure
                  key={item.href}
                  item={item}
                  isActive={isActive}
                  isOpen={openMenu === item.label}
                  onToggle={() =>
                    setOpenMenu((current) =>
                      current === item.label ? null : item.label,
                    )
                  }
                  onHoverChange={(shouldOpen) =>
                    setOpenMenu((current) => {
                      if (shouldOpen) return item.label;
                      return current === item.label ? null : current;
                    })
                  }
                  onNavigate={() => setOpenMenu(null)}
                  registerTrigger={(element) => {
                    if (element)
                      desktopTriggers.current.set(item.label, element);
                    else desktopTriggers.current.delete(item.label);
                  }}
                />
              );
            })}
          </nav>

          <div className={styles.headerActions}>
            <Link href="/contact/" className={styles.contactCta}>
              <span className={styles.desktopCtaLabel}>
                Speak with Our Team
              </span>
              <span className={styles.mobileCtaLabel}>Contact</span>
            </Link>
            <button
              ref={mobileTriggerRef}
              type="button"
              className={styles.mobileToggle}
              aria-expanded={mobileOpen}
              aria-controls="mobile-site-navigation"
              aria-label={
                mobileOpen ? "Close navigation menu" : "Open navigation menu"
              }
              onClick={toggleMobile}
            >
              {mobileOpen ? (
                <X aria-hidden="true" />
              ) : (
                <Menu aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </header>

      {mobileOpen && (
        <div
          className={`${styles.mobileOverlay} ${scrolled ? styles.mobileOverlayScrolled : ""}`}
        >
          <button
            type="button"
            className={styles.mobileScrim}
            aria-label="Close navigation menu"
            tabIndex={-1}
            onClick={() => closeMobile(true)}
          />
          <div
            ref={mobileDialogRef}
            id="mobile-site-navigation"
            className={styles.mobilePanel}
            role="dialog"
            aria-modal="true"
            aria-label="Site navigation"
            onKeyDown={handleMobileKeyDown}
          >
            <div className={styles.mobilePanelHeader}>
              <p className={styles.mobilePanelLabel}>Explore RedDev</p>
              <button
                type="button"
                className={styles.mobileClose}
                aria-label="Close navigation menu"
                onClick={() => closeMobile(true)}
              >
                <X aria-hidden="true" />
              </button>
            </div>

            <nav
              className={styles.mobileNav}
              aria-label="Mobile primary navigation"
            >
              {navigation.map((item) => {
                const children = childrenFor(item);
                const isActive = sectionIsActive(pathname, hash, item.href);

                return children.length ? (
                  <section className={styles.mobileGroup} key={item.href}>
                    <Link
                      href={item.href}
                      className={`${styles.mobileGroupHeading} ${isActive ? styles.active : ""}`}
                      onClick={() => closeMobile()}
                    >
                      {item.label}
                      <span aria-hidden="true">Overview</span>
                    </Link>
                    <ul className={styles.mobileSubnav}>
                      {children.map((child) => (
                        <li key={child.href}>
                          <Link href={child.href} onClick={() => closeMobile()}>
                            {child.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={`${styles.mobileNavLink} ${isActive ? styles.active : ""}`}
                    onClick={() => closeMobile()}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className={styles.mobileContactBlock}>
              <p>Looking to discuss an investment?</p>
              <Link
                href="/contact/?type=investment"
                className={styles.mobileContactCta}
                onClick={() => closeMobile()}
              >
                Speak with our team
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function SiteHeader() {
  const pathname = usePathname() ?? "/";

  return <HeaderContent key={pathname} pathname={pathname} />;
}

export default SiteHeader;
