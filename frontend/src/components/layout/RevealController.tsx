"use client";

import { useEffect } from "react";

/**
 * Drives the section scroll-reveal and the header's compact-on-scroll state.
 *
 * Renders nothing. Mounted once from the root layout.
 *
 * ── Reveal ───────────────────────────────────────────────────────────────────
 * Adds `ctr-reveal-on` to <html>, which is what ARMS the CSS in globals.css —
 * without it every section renders visible. So a JS failure degrades to "no
 * animation", never to "invisible page". Sections then get `is-in` once each.
 *
 * ⚠ NO IntersectionObserver, deliberately. IO only fires when an intersection
 * RATIO CROSSES A THRESHOLD, and a viewport jump — an in-page anchor, a
 * browser-restored scroll position, a fast flick — can take a section from
 * below the viewport to above it without ever crossing one. IO then never fires
 * for that section and it stays at opacity 0 permanently. (Observed: jumping
 * straight to the page bottom left three mid-page sections invisible.) A
 * position sweep has no such blind spot: "is its top above the viewport bottom"
 * is true whether the section is on screen or already scrolled past.
 *
 * The sweep is cheap — it shares the one rAF-throttled scroll handler with the
 * compact header, and each revealed section is removed from the pending list, so
 * the work shrinks to nothing once the page has been read through.
 *
 * Safe against React re-renders: `is-in` is added with classList, and React only
 * rewrites an element's class attribute when the className *prop* it renders
 * changes. Section classNames here are static strings, so React never touches
 * them and the imperative class survives (e.g. the category filter re-rendering
 * PropertiesSection). If you ever make a section's className dynamic, move its
 * reveal state into React instead.
 *
 * ── Compact header ───────────────────────────────────────────────────────────
 * Toggles `is-compact` on the <header> past 24px of scroll. rAF-throttled: the
 * scroll listener only records that a frame is needed, and at most one
 * measurement + one class write happen per frame.
 */
const COMPACT_AFTER_PX = 24;

export function RevealController() {
  useEffect(() => {
    const root = document.documentElement;
    const header = document.querySelector("header");
    const revealEnabled = !window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches;

    let pending: Element[] = [];
    if (revealEnabled) {
      root.classList.add("ctr-reveal-on");
      pending = Array.from(document.querySelectorAll(".ctr-sec"));
    }

    let frame = 0;
    const measure = () => {
      frame = 0;

      if (header) {
        header.classList.toggle(
          "is-compact",
          window.scrollY > COMPACT_AFTER_PX,
        );
      }

      if (pending.length) {
        const limit = window.innerHeight;
        // Keep only what is still below the fold; everything else is revealed.
        pending = pending.filter((el) => {
          if (el.getBoundingClientRect().top < limit) {
            el.classList.add("is-in");
            return false;
          }
          return true;
        });
      }
    };

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(measure);
    };

    // Run once immediately so a deep link or restored scroll position is handled
    // before the user touches anything.
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
      root.classList.remove("ctr-reveal-on");
    };
  }, []);

  return null;
}
