"use client";

import { useEffect } from "react";
import { useMap } from "react-leaflet";

/**
 * ⛔ RENDER THIS INSIDE EVERY `<MapContainer>` IN THE PROJECT. No exceptions.
 *
 * It fixes "Cannot read properties of undefined (reading '_leaflet_pos')" —
 * an unhandled runtime error the owner hit, reproduced here 6/6.
 *
 * ⭐ THE MECHANISM, read out of `leaflet-src.js`, not guessed:
 *
 * 1. Any animated zoom (`fitBounds`, `setView`, the ± control) ends up in
 *    `Map._animateZoom`, which sets `this._animatingZoom = true` and schedules
 *    `setTimeout(this._onZoomTransitionEnd, 250)` — a hard-coded workaround for
 *    WebKit not always firing `transitionend` (Leaflet issues #3689 / #2693).
 * 2. If the map is unmounted inside that 250 ms, react-leaflet calls
 *    `map.remove()`. `remove()` calls `_stop()`, which cancels ONLY the flyTo
 *    frame and the pan animation — it never touches `_animatingZoom` and cannot
 *    cancel that anonymous timeout — and then does `delete this._mapPane`.
 * 3. The timer fires anyway. `_onZoomTransitionEnd` opens with
 *    `if (!this._animatingZoom) { return; }` — still true — then guards exactly
 *    one line (`if (this._mapPane) removeClass(...)`) and walks straight into
 *    the UNGUARDED `this._move(...)` → `_getNewPixelOrigin` → `_getMapPanePos`
 *    → `getPosition(undefined)` → the crash.
 *
 * So the guard is one line: clear the flag on unmount and Leaflet's OWN early
 * return does the work. Nothing is monkey-patched and no Leaflet behaviour is
 * replaced — a private field is written because Leaflet exposes no public way
 * to cancel a pending zoom animation.
 *
 * ⚠ DO NOT "improve" this to `map.stop()`. `Map.stop()` is
 * `this.setZoom(this._limitZoom(this._zoom)); … this._stop()` — it can START a
 * fresh animation, which is the opposite of what an unmount needs.
 *
 * ⚠ ORDER-INDEPENDENT ON PURPOSE. React cleans children up before parents, so
 * this runs before `MapContainer` removes the map — but it would work either
 * way, because the pending callback reads the flag at FIRE time, and the timer
 * always outlives both cleanups.
 */
export function MapUnmountGuard() {
  const map = useMap();

  useEffect(() => {
    return () => {
      // Leaflet has no public API for this; `_animatingZoom` is the exact field
      // `_onZoomTransitionEnd` tests on entry.
      (map as unknown as { _animatingZoom?: boolean })._animatingZoom = false;
    };
  }, [map]);

  return null;
}
