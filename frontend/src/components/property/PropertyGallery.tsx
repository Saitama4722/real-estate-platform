"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isPropertyImageUrl } from "@/lib/propertyMedia";

interface PropertyGalleryProps {
  gallery?: string[];
  videoUrl?: string;
  mainImage: string;
}

function MediaPreview({
  value,
  className,
  loading,
}: {
  value: string;
  className?: string;
  loading?: "lazy" | "eager";
}) {
  if (isPropertyImageUrl(value)) {
    const blockContextMenu = (e: React.MouseEvent) => e.preventDefault();
    return (
      <div className="relative h-full w-full">
        <img
          src={value}
          alt=""
          className={cn("h-full w-full object-cover", className)}
          loading={loading ?? "lazy"}
          decoding="async"
          draggable={false}
          onContextMenu={blockContextMenu}
          // Block selection and direct pointer interactions with the bitmap.
          // Clicks/navigation are handled by the parent container/button, which
          // sits above this element in the event path.
          style={{ userSelect: "none", pointerEvents: "none" }}
        />
        {/* Transparent overlay on top of the image to swallow the right-click
            "save image" menu and drag-start, while letting left-clicks fall
            through (pointer-events: none) so carousel navigation still works. */}
        <span
          aria-hidden="true"
          onContextMenu={blockContextMenu}
          onDragStart={blockContextMenu}
          className="pointer-events-none absolute inset-0 select-none"
        />
      </div>
    );
  }
  return <div className={cn("flex h-full items-center justify-center text-gray-500", className)}>{value}</div>;
}

export function PropertyGallery({ gallery, videoUrl, mainImage }: PropertyGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  const allMedia = gallery && gallery.length > 0 ? gallery : [mainImage];
  const hasVideo = !!videoUrl;

  const handleThumbnailClick = (index: number) => {
    setActiveIndex(index);
  };

  const handleMainImageClick = () => {
    setIsLightboxOpen(true);
  };

  const handleVideoClick = () => {
    if (videoUrl) {
      window.open(videoUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div>
      <div
        className="aspect-[16/10] w-full cursor-pointer overflow-hidden rounded-xl border border-gray-200 bg-gray-200"
        onClick={handleMainImageClick}
        onContextMenu={(e) => e.preventDefault()}
      >
        <MediaPreview value={allMedia[activeIndex]} className="text-sm" loading="eager" />
      </div>

      {(allMedia.length > 1 || hasVideo) && (
        <div className="mt-4 flex gap-2 overflow-x-auto">
          {allMedia.map((image, index) => (
            <button
              key={index}
              type="button"
              onClick={() => handleThumbnailClick(index)}
              onContextMenu={(e) => e.preventDefault()}
              className={cn(
                "aspect-[16/10] w-24 flex-shrink-0 overflow-hidden rounded-lg border-2 bg-gray-200 transition-all",
                activeIndex === index
                  ? "border-blue-600"
                  : "border-gray-200 hover:border-gray-300",
              )}
            >
              <MediaPreview value={image} className="text-xs" loading="lazy" />
            </button>
          ))}
          {hasVideo && (
            <button
              type="button"
              onClick={handleVideoClick}
              className="aspect-[16/10] w-24 flex-shrink-0 overflow-hidden rounded-lg border-2 border-gray-200 bg-gray-100 transition-all hover:border-gray-300"
            >
              <div className="flex h-full flex-col items-center justify-center text-xs text-gray-600">
                <svg
                  className="mb-1 h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>Видео</span>
              </div>
            </button>
          )}
        </div>
      )}

      <Modal
        isOpen={isLightboxOpen}
        onClose={() => setIsLightboxOpen(false)}
        className="max-w-4xl"
      >
        <div className="mt-4">
          <div
            className="aspect-[16/10] w-full overflow-hidden rounded-lg bg-gray-200"
            onContextMenu={(e) => e.preventDefault()}
          >
            <MediaPreview value={allMedia[activeIndex]} className="text-sm" loading="eager" />
          </div>
          {allMedia.length > 1 && (
            <div className="mt-4 flex justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveIndex((prev) => (prev > 0 ? prev - 1 : allMedia.length - 1))}
              >
                Предыдущее
              </Button>
              <span className="flex items-center px-3 text-sm text-gray-600">
                {activeIndex + 1} / {allMedia.length}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveIndex((prev) => (prev < allMedia.length - 1 ? prev + 1 : 0))}
              >
                Следующее
              </Button>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
