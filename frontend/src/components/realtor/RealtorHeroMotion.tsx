"use client";

import { useEffect, useRef } from "react";

/**
 * Cursor parallax for the hero's drifting shapes + the portrait's 3D tilt.
 *
 * WHAT IT ACTUALLY DOES: writes four unitless CSS custom properties on ONE
 * element (its own root) per pointer frame — `--ctr-rp-px/py` drive every
 * shape's `translate`, `--ctr-rp-tx/ty` drive the portrait's `rotateX/rotateY`.
 * The maths lives in CSS (see `.ctr-rp-shape` / `.ctr-rp-tilt` in globals.css),
 * so a 60fps pointer costs one style write per frame regardless of how many
 * shapes are on screen. The mockup instead wrote `marginLeft`/`marginTop` on
 * each of the seven layers individually, which is seven layout-affecting writes
 * per frame for the same visual result.
 *
 * ⚠ IT RENDERS NOTHING ITSELF AND OWNS NO CONTENT. Everything visible is passed
 * through as `children` from the server component, so the hero is complete in
 * the SSR HTML. If this component never hydrates, the custom properties keep
 * their `0` defaults and the hero renders exactly as it does at rest — no
 * content is gated on JS.
 *
 * Disabled entirely under `prefers-reduced-motion: reduce` and below 900px
 * (the mockup's own threshold — there is no hover pointer to track on a phone,
 * and the shapes it would move are display:none there anyway).
 */
export function RealtorHeroMotion({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // rAF-throttled like RevealController's scroll handler: the pointer event
    // only records the latest position, and at most one style write happens per
    // frame no matter how fast the mouse moves.
    let frame = 0;
    let px = 0;
    let py = 0;

    const write = () => {
      frame = 0;
      stage.style.setProperty("--ctr-rp-px", px.toFixed(4));
      stage.style.setProperty("--ctr-rp-py", py.toFixed(4));
      stage.style.setProperty("--ctr-rp-tx", px.toFixed(4));
      stage.style.setProperty("--ctr-rp-ty", py.toFixed(4));
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(write);
    };

    const onMove = (e: PointerEvent) => {
      // Coarse pointers (touch) fire this on tap; tracking them would make the
      // hero lurch on every scroll-start. Fine pointers only.
      if (e.pointerType !== "mouse") return;
      if (window.innerWidth < 900) return;
      const r = stage.getBoundingClientRect();
      if (!r.width || !r.height) return;
      px = (e.clientX - r.left) / r.width - 0.5;
      py = (e.clientY - r.top) / r.height - 0.5;
      schedule();
    };

    const onLeave = () => {
      px = 0;
      py = 0;
      schedule();
    };

    stage.addEventListener("pointermove", onMove);
    stage.addEventListener("pointerleave", onLeave);

    return () => {
      stage.removeEventListener("pointermove", onMove);
      stage.removeEventListener("pointerleave", onLeave);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={stageRef} className={className}>
      {children}
    </div>
  );
}
