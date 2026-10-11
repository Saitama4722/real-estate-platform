"use client";

import { useEffect, useLayoutEffect } from "react";

/**
 * ⚠ LAYOUT effect in the browser, passive on the server.
 *
 * The registration MUST land before `NavigationProgress`'s pathname effect asks
 * whether anything is loading. Layout effects flush synchronously inside the
 * commit; passive effects are flushed later in a scheduler task that can run
 * AFTER a `requestAnimationFrame` callback. With a passive effect here the
 * holder registered too late, the indicator read a count of 0 and finished at
 * commit anyway — measured: the fix appeared to do nothing at all.
 *
 * `useLayoutEffect` warns when it runs during SSR, and Next server-renders
 * client components, so the server branch uses `useEffect` (which never runs
 * there). This is the standard isomorphic-layout-effect shim.
 */
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * "This page is still loading its content" — a signal the global navigation
 * indicator waits on.
 *
 * ⚠ WHY THIS EXISTS. `NavigationProgress` used to stop on `usePathname()`
 * changing, i.e. on ROUTE COMMIT. For a server-rendered route that is fine —
 * with no `loading.tsx` anywhere in the app, App Router does not commit until
 * the RSC payload has arrived, so commit and content coincide (`[measured]`:
 * /districts with the RSC response delayed 2500ms — commit 2891ms, content in
 * the DOM the same frame).
 *
 * It is NOT fine for a page that fetches AFTER it mounts. `[measured]` on
 * /favorites with its per-slug API call delayed 4000ms: route committed at
 * 297ms, the indicator was gone by 776ms, and the real content appeared at
 * 4524ms — **3748ms of a contentless page with no indicator at all**. That is
 * the reported symptom, and route commit is the reason for it.
 *
 * ⚠ THIS IS NOT A TIMER AND MUST NEVER BECOME ONE. A holder is tied to the
 * page's own loading state (`!ready || loading`), so the indicator's lifetime
 * is the load's lifetime. Do not "fix" a future mismatch here by adding a
 * minimum duration — that moves the mismatch instead of removing it.
 *
 * Why a module-level store rather than context: the holder is a leaf page and
 * the consumer is mounted in the root layout, so a context would have to wrap
 * the whole tree to let a child push state upward during its own render pass.
 * A tiny external store keeps both sides independent and re-render-free.
 */

type Listener = (count: number) => void;

let holders = 0;
const listeners = new Set<Listener>();

function emit(): void {
  for (const listener of listeners) listener(holders);
}

/** Current number of components declaring "my content is not ready yet". */
export function getPageLoadingCount(): number {
  return holders;
}

/** Subscribe to holder-count changes. Returns an unsubscribe function. */
export function subscribePageLoading(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Hold the global navigation indicator open while `active` is true.
 *
 * Call it unconditionally from a page/component that loads its content after
 * mount, passing that component's real loading flag:
 *
 *     usePageLoading(!ready || loading);
 *
 * The cleanup always releases, so a page that unmounts mid-load (the user
 * navigated away again) can never leave the indicator held.
 */
export function usePageLoading(active: boolean): void {
  useIsomorphicLayoutEffect(() => {
    if (!active) return;
    holders += 1;
    emit();
    return () => {
      holders -= 1;
      emit();
    };
  }, [active]);
}
