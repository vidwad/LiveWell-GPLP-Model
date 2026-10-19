"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Every route change starts at the top of the page, including the browser's
 * Back and Forward buttons, which would otherwise reopen the previous page
 * partway down. A link that carries a #fragment (for example
 * /about-us/#team) opens at that element instead. Pages can render a beat
 * after the route changes, so the target is looked for over a short window
 * before giving up at the top. Mirrors the Pookt public site.
 */
export function RouteScrollReset() {
  const pathname = usePathname();

  useEffect(() => {
    // The browser's own restoration runs after the route has rendered and
    // would glide the page back down to the saved position, so Back would
    // never start at the top. Pookt's router hands the browser that job first;
    // here it has to be switched off for the reset below to hold.
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
  }, []);

  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    // "instant" bypasses the stylesheet's smooth scrolling so a new page never
    // visibly glides up from the previous page's scroll position.
    window.scrollTo({ top: 0, behavior: "instant" });
    if (!id) return;
    let tries = 0;
    let timer = 0;
    const find = () => {
      const target = document.getElementById(id);
      if (target) {
        target.scrollIntoView({ block: "start", behavior: "instant" });
        return;
      }
      if (++tries < 20) timer = window.setTimeout(find, 100);
    };
    find();
    return () => window.clearTimeout(timer);
  }, [pathname]);

  return null;
}

export default RouteScrollReset;
