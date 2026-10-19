"use client";

import { ArrowUp } from "lucide-react";
import { useEffect, useState } from "react";
import styles from "./navigation.module.css";

/**
 * Back-to-top control, bottom right, matching the Pookt public site: absent
 * near the top of the page, present once the visitor has read down, one press
 * returns to the top and puts keyboard focus on the main landmark so the next
 * Tab lands in the page, not in the footer.
 *
 * The scroll listener is passive and coalesced onto animation frames, like
 * useScrollDirection. The control is rendered only while it is needed, so it
 * never sits in the tab order invisibly. Smooth scrolling is switched off
 * under reduced motion.
 */
const SHOW_AFTER_PX = 480;

export function BackToTop() {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    let ticking = false;
    const update = () => {
      setShown(window.scrollY > SHOW_AFTER_PX);
      ticking = false;
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(update);
      }
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!shown) return null;

  const toTop = () => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    const main = document.getElementById("main-content");
    if (main instanceof HTMLElement) main.focus({ preventScroll: true });
  };

  return (
    <button
      type="button"
      onClick={toTop}
      aria-label="Back to top"
      className={styles.backToTop}
    >
      <ArrowUp size={20} aria-hidden="true" />
    </button>
  );
}

export default BackToTop;
