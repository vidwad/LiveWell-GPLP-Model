import { useEffect, useState } from "react";

/**
 * Whether the visitor is scrolling down (retract the header) or up (show it).
 *
 * Ported from the Pookt public site so the two sites behave alike. Near the
 * top of the page the answer is always "show". Movements smaller than
 * `threshold` pixels are ignored so the header cannot flicker on sub-pixel
 * scroll jitter. Scroll events are coalesced onto animation frames and the
 * listener is passive, so it never blocks scrolling.
 */
export function useScrollDirection({
  threshold = 8,
  topOffset = 96,
}: { threshold?: number; topOffset?: number } = {}) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;

    const update = () => {
      const y = window.scrollY;
      const delta = y - lastY;
      if (y <= topOffset) {
        setHidden(false);
      } else if (Math.abs(delta) >= threshold) {
        setHidden(delta > 0);
      }
      lastY = y;
      ticking = false;
    };

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(update);
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold, topOffset]);

  return hidden;
}
