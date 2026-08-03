"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  ImageOff,
  Maximize2,
  Play,
  TrendingDown,
  X,
} from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { isPropertyImageUrl } from "@/lib/propertyMedia";

/**
 * Property gallery + full-screen lightbox.
 *
 * ⚠ Deliberately does NOT use ui/modal.tsx. The lightbox is an edge-to-edge dark
 * viewer, nothing like the white centred card Modal renders, and Modal is shared
 * with three CRM modals — bending it here would have restyled those. A dedicated
 * overlay keeps the blast radius at this file.
 *
 * ⚠ z-[1000] in the ARBITRARY-VALUE BRACKET FORM. Leaflet paints its map panes
 * at z-index 400–600 and the property page renders a 2GIS map, so the overlay
 * has to clear those. Do NOT let an editor "canonicalize" this to z-1000 — see
 * the Tailwind z-index note in CLAUDE.md.
 */

/** Thumbnails shown under the hero before collapsing into a "+N" tile. */
const MAX_STRIP_THUMBS = 7;
/** Horizontal travel (px) that counts as a swipe rather than a tap. */
const SWIPE_THRESHOLD_PX = 40;

interface PropertyGalleryProps {
  gallery?: string[];
  videoUrl?: string;
  mainImage: string;
  /** Drives the «Цена снижена» badge. Derived upstream from price history. */
  isPriceReduced?: boolean;
  /** Short label shown in the lightbox header (falls back to nothing). */
  title?: string;
}

function MediaImage({
  value,
  className,
  loading,
  contain,
}: {
  value: string;
  className?: string;
  loading?: "lazy" | "eager";
  contain?: boolean;
}) {
  const blockContextMenu = (e: React.MouseEvent) => e.preventDefault();
  return (
    <img
      src={value}
      alt=""
      className={cn(
        "h-full w-full",
        contain ? "object-contain" : "object-cover",
        className,
      )}
      loading={loading ?? "lazy"}
      decoding="async"
      draggable={false}
      onContextMenu={blockContextMenu}
      onDragStart={blockContextMenu}
      // Selection/right-click are blocked on the bitmap; clicks are handled by
      // the parent button, which sits above this element in the event path.
      style={{ userSelect: "none", pointerEvents: "none" }}
    />
  );
}

export function PropertyGallery({
  gallery,
  videoUrl,
  mainImage,
  isPriceReduced = false,
  title,
}: PropertyGalleryProps) {
  // Only real image URLs count as photos. The upstream mapper substitutes a
  // placeholder LABEL when a listing has none, and rendering that as a photo is
  // what used to make the empty state look like a broken image.
  const photos = (gallery && gallery.length > 0 ? gallery : [mainImage]).filter(
    isPropertyImageUrl,
  );
  const count = photos.length;

  const [activeIndex, setActiveIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const step = useCallback(
    (delta: number) => {
      if (count === 0) return;
      setActiveIndex((prev) => (prev + delta + count) % count);
    },
    [count],
  );

  // Keyboard control while the lightbox is open. Bound on window rather than the
  // overlay so it works regardless of where focus landed.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, step]);

  // Freeze the page behind the overlay, and restore exactly what was there
  // before (not a hardcoded ""), so we cannot clobber another lock.
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  if (count === 0) {
    return (
      <div className="flex aspect-[16/10] w-full flex-col items-center justify-center gap-3 rounded-2xl bg-surface-raised text-fg-muted shadow-sm">
        <Icon icon={ImageOff} className="size-7" />
        <span className="text-[14.5px] font-medium">Фотографии не добавлены</span>
      </div>
    );
  }

  const many = count > 1;
  const active = photos[Math.min(activeIndex, count - 1)];
  const stripPhotos = photos.slice(0, MAX_STRIP_THUMBS);
  const hiddenCount = count - MAX_STRIP_THUMBS + 1;

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartX.current;
    touchStartX.current = null;
    if (start == null || !many) return;
    const dx = (e.changedTouches[0]?.clientX ?? start) - start;
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return;
    step(dx < 0 ? 1 : -1);
  };

  return (
    <div>
      {/* ---- Hero ---------------------------------------------------------- */}
      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl bg-surface-inset shadow-sm">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          className="absolute inset-0 cursor-zoom-in"
          aria-label="Открыть фотографии во весь экран"
        >
          <MediaImage value={active} loading="eager" />
          <span
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/40"
          />
        </button>

        {isPriceReduced && (
          <span className="pointer-events-none absolute top-4 left-4 inline-flex h-8 items-center gap-1.5 rounded-full bg-accent px-3 text-[13px] font-semibold text-white shadow-md">
            <Icon icon={TrendingDown} className="size-[15px]" />
            Цена снижена
          </span>
        )}

        <span className="pointer-events-none absolute bottom-4 left-4 inline-flex h-[30px] items-center gap-1.5 rounded-full bg-black/55 px-3 text-[12.5px] font-semibold text-white backdrop-blur-sm">
          <Icon icon={ImageIcon} className="size-[14px]" />
          {activeIndex + 1} / {count}
        </span>

        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="absolute right-4 bottom-4 inline-flex h-[38px] items-center gap-2 rounded-[10px] bg-white/95 px-4 text-[13.5px] font-semibold text-fg backdrop-blur-sm transition-[background-color,translate] duration-150 ease-out hover:bg-white hover:-translate-y-px"
        >
          <Icon icon={Maximize2} className="size-[15px]" />
          {many ? `Все фото · ${count}` : "Открыть фото"}
        </button>

        {many && (
          <>
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label="Предыдущее фото"
              className="absolute top-1/2 left-3.5 flex size-[42px] -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-fg shadow-md backdrop-blur transition-colors duration-150 ease-out hover:bg-white"
            >
              <Icon icon={ChevronLeft} className="size-[19px]" />
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label="Следующее фото"
              className="absolute top-1/2 right-3.5 flex size-[42px] -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-fg shadow-md backdrop-blur transition-colors duration-150 ease-out hover:bg-white"
            >
              <Icon icon={ChevronRight} className="size-[19px]" />
            </button>
          </>
        )}
      </div>

      {/* ---- Thumbnail strip ----------------------------------------------- */}
      {(many || videoUrl) && (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-0.5">
          {stripPhotos.map((src, index) => {
            const isOverflowTile =
              index === MAX_STRIP_THUMBS - 1 && count > MAX_STRIP_THUMBS;
            return (
              <button
                key={index}
                type="button"
                onClick={() =>
                  isOverflowTile ? setIsOpen(true) : setActiveIndex(index)
                }
                className={cn(
                  "relative h-[70px] w-[104px] flex-none overflow-hidden rounded-[10px] transition-opacity duration-150 ease-out",
                  index === activeIndex
                    ? "opacity-100 outline outline-2 -outline-offset-2 outline-brand"
                    : "opacity-60 hover:opacity-90",
                )}
                aria-label={
                  isOverflowTile
                    ? `Показать ещё ${hiddenCount} фото`
                    : `Фото ${index + 1}`
                }
              >
                <MediaImage value={src} />
                {isOverflowTile && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/60 text-[15px] font-semibold text-white">
                    +{hiddenCount}
                  </span>
                )}
              </button>
            );
          })}
          {videoUrl && (
            <a
              href={videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-[70px] w-[104px] flex-none flex-col items-center justify-center gap-1 rounded-[10px] bg-surface-inset text-[12px] font-medium text-fg-secondary transition-colors duration-150 ease-out hover:bg-border"
            >
              <Icon icon={Play} className="size-5" />
              Видео
            </a>
          )}
        </div>
      )}

      {/* ---- Lightbox ------------------------------------------------------ */}
      {isOpen && (
        <div
          // z-[1000] bracket form on purpose — clears Leaflet's 400–600 panes.
          // Do NOT rewrite as z-1000.
          className="fixed inset-0 z-[1000] flex flex-col bg-[rgba(9,11,16,.965)] text-white"
          role="dialog"
          aria-modal="true"
          aria-label="Просмотр фотографий"
        >
          <div className="flex h-[68px] flex-none items-center gap-4 pr-5 pl-6">
            <span className="text-[15px] font-semibold">
              {activeIndex + 1} / {count}
            </span>
            {title && (
              <>
                <span className="h-5 w-px bg-white/15" />
                <span className="truncate text-sm text-white/60">{title}</span>
              </>
            )}
            <span className="flex-1" />
            <button
              ref={closeButtonRef}
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Закрыть"
              className="flex size-10 items-center justify-center rounded-[10px] bg-white/10 transition-colors duration-150 ease-out hover:bg-white/20"
            >
              <Icon icon={X} className="size-[19px]" />
            </button>
          </div>

          <div
            className="relative flex min-h-0 flex-1 items-center justify-center px-4 md:px-24"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            <MediaImage value={active} loading="eager" contain />
            {many && (
              <>
                <button
                  type="button"
                  onClick={() => step(-1)}
                  aria-label="Предыдущее фото"
                  className="absolute top-1/2 left-4 hidden size-[54px] -translate-y-1/2 items-center justify-center rounded-full bg-white/10 backdrop-blur transition-colors duration-150 ease-out hover:bg-white/20 md:flex"
                >
                  <Icon icon={ChevronLeft} className="size-6" />
                </button>
                <button
                  type="button"
                  onClick={() => step(1)}
                  aria-label="Следующее фото"
                  className="absolute top-1/2 right-4 hidden size-[54px] -translate-y-1/2 items-center justify-center rounded-full bg-white/10 backdrop-blur transition-colors duration-150 ease-out hover:bg-white/20 md:flex"
                >
                  <Icon icon={ChevronRight} className="size-6" />
                </button>
              </>
            )}
          </div>

          <div className="flex-none pt-4 pb-3.5">
            {many && (
              <div className="flex justify-center gap-2 overflow-x-auto px-6">
                {photos.map((src, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setActiveIndex(index)}
                    aria-label={`Фото ${index + 1}`}
                    className={cn(
                      "h-[62px] w-[92px] flex-none overflow-hidden rounded-lg transition-opacity duration-150 ease-out",
                      index === activeIndex
                        ? "opacity-100 outline outline-2 outline-offset-2 outline-white"
                        : "opacity-45 hover:opacity-75",
                    )}
                  >
                    <MediaImage value={src} />
                  </button>
                ))}
              </div>
            )}
            {/* Keyboard hints are desktop-only: they name keys a touch device
                does not have, and the same gestures are available by swiping. */}
            <div className="mt-3.5 hidden items-center justify-center gap-5 text-xs text-white/40 md:flex">
              {many && (
                <span className="flex items-center gap-1.5">
                  <kbd className="inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-[5px] bg-white/10 px-1.5 text-xs text-white/75">
                    ←
                  </kbd>
                  <kbd className="inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-[5px] bg-white/10 px-1.5 text-xs text-white/75">
                    →
                  </kbd>
                  листать
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <kbd className="inline-flex h-[22px] items-center justify-center rounded-[5px] bg-white/10 px-2 text-xs text-white/75">
                  Esc
                </kbd>
                закрыть
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
