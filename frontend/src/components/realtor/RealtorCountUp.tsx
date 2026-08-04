"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

/**
 * Counts 0 → `value` over 900ms with an ease-out cubic as the tile scrolls in.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠ READ THIS BEFORE CHANGING ANYTHING HERE. The previous version of this file
 * shipped a bug that displayed **0** in the browser while its own no-JS test
 * passed — i.e. the "enhancement" actively destroyed correct server output.
 *
 * What it did: set a `startedRef` flag at the START of the animation, kept a
 * `cancelAnimationFrame` in the effect cleanup, and had no completion guarantee.
 * So the moment anything interrupted the rAF chain — a Fast Refresh (which
 * re-runs effects while PRESERVING refs, so the flag survived), a StrictMode
 * remount, a backgrounded tab, a dropped frame — the cleanup killed the chain
 * and the setup returned early on the flag. Nothing could ever restart it.
 * Reproduced `[measured]`: cancelling the in-flight frame once, ~120ms in, left
 * the four tiles reading **0,1,2,1** forever, and scrolling away and back did
 * not recover them.
 *
 * THE INVARIANT NOW: the element shows the true value unless an animation is
 * actively running toward it. Three independent things enforce it:
 *
 *   1. **The final value is what React renders.** `{value}` is the JSX output,
 *      so SSR, no-JS, hydration failure, print and crawlers all get the real
 *      number. The animation is a temporary imperative overwrite, never the
 *      source of truth.
 *   2. **A failsafe snaps to the final value after REVEAL_FAILSAFE_MS**, the
 *      same 2500ms budget RevealController uses for the same reason. `setTimeout`
 *      keeps firing in a backgrounded tab even when rAF is paused, so this also
 *      covers the tab-switch case that rAF alone cannot.
 *   3. **Cleanup writes the final value.** Whatever the teardown reason, the DOM
 *      is left correct rather than mid-count. This is what makes a Fast Refresh
 *      or StrictMode remount harmless: worst case the count simply replays.
 *
 * There is deliberately NO "already started" guard. `done` is set only once the
 * element is actually showing the final value, so a restart is always safe and
 * an interruption is always recoverable — the exact inversion of the old bug.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ⚠ NO IntersectionObserver, for the reason documented on RevealController: IO
 * fires on a threshold CROSSING, and a viewport jump (anchor link, restored
 * scroll position, fast flick) can move an element from below the fold to above
 * it without ever crossing one. A position check has no such blind spot.
 */
const DURATION_MS = 900;

/** Mirrors REVEAL_FAILSAFE_MS in RevealController — same guarantee, same budget:
 *  nothing may show a wrong/placeholder value for longer than this. */
const FAILSAFE_MS = 2500;

/* useLayoutEffect warns when it runs during SSR; useEffect is the right shim
   there. The layout variant matters on the client: when the tile is already in
   view at mount, dropping to 0 must happen BEFORE the browser paints, or the
   number visibly flashes final → 0 → count. */
const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

export function RealtorCountUp({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useIsomorphicLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const final = String(value);
    /* Writing textContent directly rather than through state: React only
       rewrites this node when the `value` PROP changes, and it never does, so
       the imperative write survives re-renders. Same reasoning as
       RevealController's classList writes. It also means the component renders
       exactly once, so a 900ms count costs zero React work. */
    const settle = () => {
      el.textContent = final;
    };

    if (!Number.isFinite(value) || value <= 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    let failsafe = 0;
    let scheduled = 0;
    let done = false;

    const stopScroll = () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (scheduled) cancelAnimationFrame(scheduled);
      scheduled = 0;
    };

    /* The ONLY place `done` is set — and it is set together with the final
       value being on screen, never before it. */
    const finish = () => {
      done = true;
      if (frame) cancelAnimationFrame(frame);
      if (failsafe) clearTimeout(failsafe);
      frame = 0;
      failsafe = 0;
      stopScroll();
      settle();
    };

    const start = () => {
      if (done) return;
      const t0 = performance.now();
      // Armed BEFORE the first frame, so a chain that never starts is covered
      // too (a tab backgrounded during hydration pauses rAF but not timers).
      failsafe = window.setTimeout(finish, FAILSAFE_MS);
      const step = (now: number) => {
        const p = Math.min(1, (now - t0) / DURATION_MS);
        if (p >= 1) {
          finish();
          return;
        }
        el.textContent = String(Math.round(value * (1 - Math.pow(1 - p, 3))));
        frame = requestAnimationFrame(step);
      };
      el.textContent = "0";
      frame = requestAnimationFrame(step);
    };

    const inView = () => el.getBoundingClientRect().top < window.innerHeight;

    const measure = () => {
      scheduled = 0;
      if (done || !inView()) return;
      stopScroll();
      start();
    };

    function onScroll() {
      if (!scheduled) scheduled = requestAnimationFrame(measure);
    }

    if (inView()) {
      start();
    } else {
      /* Below the fold: the DOM still holds the real number (nothing has been
         overwritten yet), so a visitor who never scrolls here simply sees it. */
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll, { passive: true });
    }

    return () => {
      if (frame) cancelAnimationFrame(frame);
      if (failsafe) clearTimeout(failsafe);
      stopScroll();
      // ⚠ THE LINE THAT FIXES THE BUG. Teardown must never leave a partial
      // count painted; a re-run then either replays or no-ops, both correct.
      settle();
    };
  }, [value]);

  return (
    <span ref={ref} className={className}>
      {value}
    </span>
  );
}
