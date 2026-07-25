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

/**
 * Hard cap on how long a section may stay hidden waiting to be scrolled to.
 *
 * WHY THIS EXISTS. "Visible only after you scroll to it" is fine for a human and
 * broken for everything else. Measured on the homepage at 1440x900 `[measured]`:
 * a full-page screenshot taken WITHOUT scrolling came out **2080px of 3306px
 * blank — 63% of the page** — one flat band from y=940 to y=3020, because 5 of
 * the 6 sections were still at opacity 0. Any consumer that renders at a normal
 * viewport and does not scroll like a person — screenshot tools, PDF/archive
 * jobs, preview crawlers, a link unfurler — captures that blank page.
 *
 * So this failsafe reveals whatever is still pending after the delay, and the
 * invariant becomes: content is never hidden for longer than this, ever.
 *
 * THE TRADE-OFF IS REAL, and it is deliberately resolved in favour of the
 * content: a reader who lingers past this on the hero gets no fade-in when they
 * finally scroll, because everything below the fold has already been revealed.
 * That costs a decoration in a minority of sessions; the alternative costs a
 * correct page in every automated one. Raise the number to favour the animation,
 * lower it to favour capture tools — but do not remove it.
 */
const REVEAL_FAILSAFE_MS = 2500;

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

    // Reveal everything still waiting, in one pass. Idempotent: `is-in` is a
    // class add, and draining `pending` means the sweep skips the work forever
    // after (same "drops to header-only" path as reading the page through).
    const revealAll = () => {
      if (!pending.length) return;
      for (const el of pending) el.classList.add("is-in");
      pending = [];
    };

    // See REVEAL_FAILSAFE_MS: nothing may stay invisible indefinitely.
    const failsafe = revealEnabled
      ? window.setTimeout(revealAll, REVEAL_FAILSAFE_MS)
      : 0;

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
      if (failsafe) clearTimeout(failsafe);
      root.classList.remove("ctr-reveal-on");
    };
  }, []);

  return null;
}
