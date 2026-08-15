"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Top-of-page progress bar for client-side route changes.
 *
 * WHY IT EXISTS. App Router navigation to a server-rendered route blocks with no
 * visual feedback: the OLD page stays on screen until the RSC payload arrives,
 * then swaps in one frame. Reported as «страница как будто не грузится, а потом
 * резко переходит». There is not one `loading.tsx` in the app (0 files across 33
 * pages), so nothing else fills that gap.
 *
 * ⚠ THIS BAR REPORTS THE WAIT, IT DOES NOT SHORTEN IT. Shortening it is
 * `loading.tsx` + `Suspense`, which is separate work. Do not treat this file as
 * having closed that gap.
 *
 * ── Start signal: CLICK, never `history.pushState` ───────────────────────────
 * Patching pushState looks like the obvious hook and is WRONG here. CLAUDE.md
 * records the measurement: `router.push` inside `startTransition` defers its
 * `history.pushState` until the transition COMMITS — i.e. pushState fires at the
 * END of the navigation, which is the opposite of what a start signal needs.
 * (`CatalogExplorer.navigate()` exists precisely because of that deferral.) So
 * the start is a capture-phase click on an internal `<a>`, plus `popstate` for
 * the back/forward buttons.
 *
 * ── End signal: `usePathname()` ──────────────────────────────────────────────
 * A pathname change means the new route committed.
 *
 * ⚠ DELIBERATELY NOT `useSearchParams()`. Reading it here would opt the whole
 * tree out of static rendering, and the homepage IS statically prerendered
 * (`x-nextjs-prerender: 1` on production `[measured]` 2026-08-15). Consequence,
 * and it is intended: a search-ONLY change (catalog filters, pagination, sort)
 * does not drive this bar — those surfaces already render their own skeletons
 * from `isPending`. This bar is for pathname changes, where nothing else speaks.
 *
 * ── Reduced motion ──────────────────────────────────────────────────────────
 * The fill's width is written from rAF as an inline style — NOT a keyframe. The
 * global `prefers-reduced-motion: reduce` block in globals.css sets
 * `animation: none` on `*`, so a keyframe-driven bar would be dead for exactly
 * the users who most need a calm, legible signal. The spinner in the hint is the
 * one keyframe here, and it is `motion-reduce:hidden` rather than left frozen.
 *
 * If JS never runs, nothing renders and behaviour is today's behaviour — this
 * can only add feedback, never remove content.
 */

/** Below this, a navigation shows NOTHING. A prefetched route commits in ~50ms
 *  and a bar that flashes for one frame reads as a glitch — worse than silence. */
const DELAY_MS = 180;

/** The trickle asymptote. The bar must never reach 100% before the page does:
 *  a full bar with no page is a lie the reader notices. */
const CEILING = 0.9;

/** Trickle time constant. Fast to ~half, then visibly slowing. */
const TAU_MS = 900;

/** 90 → 100 once the route commits, then a beat at full before fading, so the
 *  completion lands on the NEW page rather than the old one. */
const FINISH_MS = 180;
const LINGER_MS = 120;
const FADE_MS = 200;

/** Past this the wait stops being "a moment" and deserves words, not just
 *  movement. Also when the polite announcement fires for screen readers. */
const HINT_AFTER_MS = 900;

/** Backstop. A click we mistook for a navigation (one Next cancels, a route that
 *  throws) must not leave the bar stuck on screen forever. */
const SAFETY_MS = 10_000;

type Run = {
  active: boolean;
  shown: boolean;
  progress: number;
  startedAt: number;
  raf: number;
  showTimer: ReturnType<typeof setTimeout> | null;
  hintTimer: ReturnType<typeof setTimeout> | null;
  safetyTimer: ReturnType<typeof setTimeout> | null;
  fadeTimer: ReturnType<typeof setTimeout> | null;
};

export function NavigationProgress() {
  const pathname = usePathname();

  const barRef = useRef<HTMLDivElement | null>(null);
  const fillRef = useRef<HTMLDivElement | null>(null);
  const hintRef = useRef<HTMLDivElement | null>(null);
  const sayRef = useRef<HTMLSpanElement | null>(null);

  /** Set by the listener effect; called by the route effect below. Declared up
   *  here so the two effects can meet without either depending on the other. */
  const finishRef = useRef<(() => void) | null>(null);

  /** Last pathname this component saw COMMIT.
   *
   *  ⚠ Load-bearing for `popstate`. In App Router a click on a hash link fires
   *  `popstate` (then `hashchange`) `[measured]` — Next intercepts the anchor and
   *  drives history itself. Starting on every popstate therefore armed the bar on
   *  every in-page anchor: the article/guide table of contents is entirely such
   *  links, the pathname never changes, so nothing would ever finish the run and
   *  the bar hung until the safety timer (10s). Comparing against this ref is
   *  what separates a real back/forward from a fragment jump. */
  const lastPathRef = useRef<string | null>(null);

  const run = useRef<Run>({
    active: false,
    shown: false,
    progress: 0,
    startedAt: 0,
    raf: 0,
    showTimer: null,
    hintTimer: null,
    safetyTimer: null,
    fadeTimer: null,
  });

  /* Every listener below is installed once and reads only refs, so the
     first-render closures it captures stay correct — refs are stable. */
  useEffect(() => {
    const r = run.current;

    const clearTimers = () => {
      if (r.showTimer) clearTimeout(r.showTimer);
      if (r.hintTimer) clearTimeout(r.hintTimer);
      if (r.safetyTimer) clearTimeout(r.safetyTimer);
      r.showTimer = r.hintTimer = r.safetyTimer = null;
      if (r.raf) cancelAnimationFrame(r.raf);
      r.raf = 0;
    };

    const hideHint = () => {
      if (hintRef.current) hintRef.current.style.opacity = "0";
      // clearing the live region matters: leaving text in it would re-announce
      // on the next navigation even before the hint is due
      if (sayRef.current) sayRef.current.textContent = "";
    };

    const reset = () => {
      clearTimers();
      r.active = false;
      r.shown = false;
      r.progress = 0;
      hideHint();
      if (barRef.current) barRef.current.style.opacity = "0";
      if (fillRef.current) fillRef.current.style.width = "0%";
    };

    const tick = (now: number) => {
      const since = now - r.startedAt - DELAY_MS;
      if (since > 0) {
        r.progress = CEILING * (1 - Math.exp(-since / TAU_MS));
        if (fillRef.current) {
          fillRef.current.style.width = `${(r.progress * 100).toFixed(2)}%`;
        }
      }
      r.raf = requestAnimationFrame(tick);
    };

    const start = () => {
      if (r.active) return;
      if (r.fadeTimer) {
        clearTimeout(r.fadeTimer);
        r.fadeTimer = null;
      }
      r.active = true;
      r.shown = false;
      r.progress = 0;
      r.startedAt = performance.now();
      if (fillRef.current) fillRef.current.style.width = "0%";

      r.showTimer = setTimeout(() => {
        r.shown = true;
        if (barRef.current) barRef.current.style.opacity = "1";
        r.raf = requestAnimationFrame(tick);
      }, DELAY_MS);

      r.hintTimer = setTimeout(() => {
        if (hintRef.current) hintRef.current.style.opacity = "1";
        if (sayRef.current) sayRef.current.textContent = "Загрузка страницы";
      }, HINT_AFTER_MS);

      r.safetyTimer = setTimeout(reset, SAFETY_MS);
    };

    const finish = () => {
      if (!r.active) return;
      clearTimers();
      hideHint();

      // never showed → the route beat the threshold; leave no trace at all
      if (!r.shown) {
        r.active = false;
        r.progress = 0;
        return;
      }

      const from = r.progress;
      const t0 = performance.now();
      const step = (now: number) => {
        const k = Math.min(1, (now - t0) / FINISH_MS);
        if (fillRef.current) {
          const w = from + (1 - from) * k;
          fillRef.current.style.width = `${(w * 100).toFixed(2)}%`;
        }
        if (k < 1) {
          r.raf = requestAnimationFrame(step);
          return;
        }
        r.raf = 0;
        r.fadeTimer = setTimeout(() => {
          if (barRef.current) barRef.current.style.opacity = "0";
          r.fadeTimer = setTimeout(() => {
            if (fillRef.current) fillRef.current.style.width = "0%";
            r.fadeTimer = null;
          }, FADE_MS + 20);
        }, LINGER_MS);
        r.active = false;
        r.shown = false;
        r.progress = 0;
      };
      r.raf = requestAnimationFrame(step);
    };

    finishRef.current = finish;

    const onClick = (e: MouseEvent) => {
      // let the browser keep its own meanings for modified clicks
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const el = e.target as Element | null;
      const a = el?.closest?.("a");
      if (!a) return;

      const anchor = a as HTMLAnchorElement;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;

      // Same pathname → this bar has no end signal (see the useSearchParams note
      // above), so starting here would hang until the safety timer.
      if (url.pathname === window.location.pathname) return;

      start();
    };

    const onPopState = () => {
      // hash-only jump: same route, no RSC fetch, and no end signal would come
      if (window.location.pathname === lastPathRef.current) return;
      start();
    };
    // A real document unload (external link, reload) should not leave the bar
    // painted over a page that is about to be replaced.
    const onPageHide = () => reset();

    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("pagehide", onPageHide);
      clearTimers();
      if (r.fadeTimer) clearTimeout(r.fadeTimer);
    };
  }, []);

  /* Keyed on the route, never []. The root layout survives client-side
     navigation, so a once-only effect here would fire on the first page and
     never again — the exact bug CLAUDE.md records for RevealController. */
  useEffect(() => {
    lastPathRef.current = pathname;
    finishRef.current?.();
  }, [pathname]);

  return (
    <>
      {/* z-[1001] sits one above the sticky header's z-[1000].
          ⚠ KEEP THE BRACKET FORM. A linter "canonicalising" this to z-1001 has
          twice produced a silently dead stacking context in this project. */}
      <div
        ref={barRef}
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 z-[1001] h-[3px] opacity-0 transition-opacity duration-200"
      >
        <div
          ref={fillRef}
          className="h-full w-0 bg-brand"
          style={{
            boxShadow:
              "0 0 8px 1px color-mix(in srgb, var(--color-brand) 70%, transparent), 0 0 2px 0 var(--color-brand)",
          }}
        />
      </div>

      {/* Sits BELOW the header's z-[1000] on purpose: the mobile nav panel drops
          from the header at that layer and must stay on top of this. */}
      <div
        ref={hintRef}
        aria-hidden="true"
        className="pointer-events-none fixed left-1/2 top-[68px] z-[999] flex -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-surface-raised px-3.5 py-1.5 text-[12.5px] font-medium text-fg opacity-0 shadow-lg transition-opacity duration-200"
      >
        <span
          aria-hidden="true"
          className="size-3 animate-spin rounded-full border-2 border-brand/30 border-t-brand motion-reduce:hidden"
        />
        Загружаем страницу
      </div>

      {/* Announced only once the wait crosses HINT_AFTER_MS — arrival is already
          announced by Next's own route announcer, so this covers the silence
          BEFORE it, not the whole navigation. */}
      <span ref={sayRef} role="status" aria-live="polite" className="sr-only" />
    </>
  );
}
