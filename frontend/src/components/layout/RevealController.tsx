"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Drives the section scroll-reveal and the header's compact-on-scroll state.
 *
 * Renders nothing. Mounted once from the root layout, but its effect RE-ARMS on
 * every route change — the root layout survives client-side navigation, so a
 * once-only effect would leave every soft-navigated page's sections hidden. See
 * the pathname note on the component below.
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
  /**
   * ⚠ THE EFFECT BELOW IS KEYED ON PATHNAME, NOT `[]`. Do not "simplify" it back.
   *
   * This component is mounted from the ROOT LAYOUT, which Next.js keeps mounted
   * across client-side navigations. With an empty dependency array the effect ran
   * exactly ONCE per full page load: it armed `ctr-reveal-on` on <html> and
   * snapshotted the `.ctr-sec` list of whichever page happened to be first. Every
   * soft navigation afterwards swapped in a NEW set of sections that were never in
   * `pending`, never reached by the failsafe timer (long since fired), and still
   * hidden by the CSS — which stays armed because the controller never unmounted.
   *
   * Result `[measured]`: reaching the homepage by clicking a link (e.g. the header
   * logo, the usual way back after landing on /account post-login) left all 6
   * sections at opacity 0 permanently, with content fully present in the DOM
   * (heights 298-580px, cards rendered) and zero console errors. Scrolling could
   * not fix it — the shared scroll handler was still alive and toggling the
   * compact header, but `pending` was empty — while a manual F5 remounted the
   * controller and rendered correctly, which is what made it look auth-related.
   * It never was: it reproduces logged out.
   */
  const pathname = usePathname();

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
    //
    // Re-queries the DOM rather than draining only the snapshot taken above, so
    // the "nothing stays hidden longer than REVEAL_FAILSAFE_MS" invariant also
    // covers sections that appeared AFTER this effect ran (streamed/Suspense
    // content). Today's homepage awaits all its data and commits in one pass, so
    // the snapshot is complete — this keeps the guarantee true if that changes.
    const revealAll = () => {
      for (const el of document.querySelectorAll(".ctr-sec:not(.is-in)")) {
        el.classList.add("is-in");
      }
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
    // Re-arm per route: see the note on `pathname` above. React runs this
    // cleanup and the next setup in the same commit, with no paint in between,
    // so disarming and re-arming `ctr-reveal-on` cannot flash the page.
  }, [pathname]);

  return null;
}
