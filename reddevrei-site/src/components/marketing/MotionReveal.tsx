"use client";

import { useLayoutEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Scroll-in reveal for page content, in the Pookt motion vocabulary: an
 * element fades, lifts and un-blurs the first time it scrolls into view, and
 * siblings arrive in sequence (globals.css, `[data-reveal]`).
 *
 * The page markup is untouched: this component tags elements that match the
 * selectors below with `data-reveal` and a stagger index, then flips them to
 * `data-reveal="in"` through one IntersectionObserver. Once an element has
 * finished arriving the attribute is removed, so its own hover transitions
 * take over and nothing is left transformed or blurred.
 *
 * Progressive: the hidden state applies only under `html.js`, which the
 * inline script in layout.tsx sets before first paint, so a visitor without
 * JavaScript sees everything. On the first load, content already on screen is
 * shown at once rather than re-hidden, because it has already painted; on a
 * client-side route change the new page has not painted yet, so its visible
 * content gets the entrance too. Reduced motion is honoured by the stylesheet
 * and short-circuited here.
 */

/** Deeper, more specific groups first; the generic section fallbacks last. */
const REVEAL_SELECTORS = [
  // Home
  ".about-layout > *",
  ".principles-row > div",
  ".process-list > .process-step",
  ".approach-bottom",
  ".student-image",
  ".student-copy",
  ".invest-layout > *",
  ".team-intro",
  ".leadership-row > .team-member",
  ".full-team",
  ".insight-list > .insight",
  ".archive-note",
  ".closing-cta .container > *",
  ".disclosures p",
  ".section-heading",
  // Inner pages (CSS-module classes keep their local name in the hash)
  "[class*='teamGrid'] > article",
  "[class*='directionLayout'] > *",
  "[class*='valuesList'] > *",
  "[class*='timeline'] > li",
  "[class*='opportunityFeature']",
  "[class*='livingLayout'] > *",
  "[class*='articleList'] > article",
  ".prose [class*='articleHeader']",
  ".prose [class*='content'] > *",
  "[class*='contentGrid'] > *",
  ".page-callout .container > *",
  ".page-note",
  ".page-split > *",
  // Generic fallback: direct children of any page section container
  ".page-section > .container > *",
  ".page-section-warm > .container > *",
  ".section > .container > *",
];

const MAX_STAGGER = 6;
const STAGGER_MS = 90;
const SETTLE_MS = 750;

export function MotionReveal() {
  const pathname = usePathname();
  const firstLoad = useRef(true);

  useLayoutEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const main = document.getElementById("main-content");
    if (!main) return;

    const alreadyPainted = firstLoad.current;
    firstLoad.current = false;
    const timers: number[] = [];

    // Elements that arrive together stagger; one arriving alone plays at
    // once. So the stagger index is assigned per batch, in top-to-bottom
    // order, not from the element's position in the markup.
    const settle = (batch: HTMLElement[]) => {
      batch
        .sort(
          (a, b) =>
            a.getBoundingClientRect().top - b.getBoundingClientRect().top,
        )
        .forEach((element, position) => {
          const index = Math.min(position, MAX_STAGGER);
          element.style.setProperty("--reveal-i", String(index));
          element.setAttribute("data-reveal", "in");
          timers.push(
            window.setTimeout(() => {
              element.removeAttribute("data-reveal");
              element.style.removeProperty("--reveal-i");
            }, SETTLE_MS + index * STAGGER_MS),
          );
        });
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const arrived: HTMLElement[] = [];
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          observer.unobserve(entry.target);
          arrived.push(entry.target as HTMLElement);
        }
        if (arrived.length) settle(arrived);
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );

    const viewportBottom = window.innerHeight * 0.92;
    const pending: HTMLElement[] = [];

    for (const selector of REVEAL_SELECTORS) {
      const matches = Array.from(main.querySelectorAll<HTMLElement>(selector));
      for (const element of matches) {
        // One reveal per subtree: skip anything already tagged, inside a
        // tagged element, or wrapping one.
        if (
          element.hasAttribute("data-reveal") ||
          element.parentElement?.closest("[data-reveal]") ||
          element.querySelector("[data-reveal]")
        ) {
          continue;
        }

        const rect = element.getBoundingClientRect();
        const onScreen = rect.top < viewportBottom && rect.bottom > 0;
        if (onScreen && alreadyPainted) {
          // Already visible to the visitor: leave it alone, no re-hiding.
          continue;
        }
        element.setAttribute("data-reveal", "");
        if (onScreen) {
          pending.push(element);
        } else {
          observer.observe(element);
        }
      }
    }

    // Visible content on a freshly rendered route: let the hidden state paint
    // for one frame, then play the entrance.
    let frame = 0;
    if (pending.length) {
      frame = window.requestAnimationFrame(() => {
        frame = window.requestAnimationFrame(() => settle(pending));
      });
    }

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      timers.forEach((timer) => window.clearTimeout(timer));
      main
        .querySelectorAll<HTMLElement>("[data-reveal]")
        .forEach((element) => {
          element.removeAttribute("data-reveal");
          element.style.removeProperty("--reveal-i");
        });
    };
  }, [pathname]);

  return null;
}

export default MotionReveal;
