"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Icon, Icons } from "@/components/ui/icon";
import { ACCEPTED_PHOTO_ATTR } from "@/lib/crmPropertyPhotos";
import { cn } from "@/lib/utils";

/**
 * The photo INPUT for CRM property forms (create and edit): a large dashed
 * drop zone that is also a button for the file dialog. It only hands the picked
 * files to `onFiles`; validation, staging and uploading live in
 * `CrmPropertyPhotos`, so the dialog and drag-and-drop take exactly the same
 * path.
 *
 * ⛔ THE BUG THIS REPLACES (2026-10-25): the old edit-mode input cleared
 * `input.value` BEFORE copying `input.files`. `files` is a LIVE FileList —
 * clearing the value empties it — so the copy came back empty and every pick
 * after the first batch was a silent no-op. Here the files are snapshotted with
 * `Array.from` FIRST, and only then is the input reset (which also lets the
 * same file be picked again).
 *
 * Design notes:
 *  - A real <button>: focusable, Enter/Space open the picker, tap works on
 *    mobile. The hidden input is `sr-only`, NOT display:none.
 *  - `pointer-events-none` on the children: without it, dragging across a child
 *    fires dragleave on the button and the highlight flickers.
 *  - `bg-[var(--field-bg)]`, never `bg-[--field-bg]` (Tailwind v3 shorthand that
 *    v4 compiles to invalid CSS, so the zone rendered transparent).
 *  - While mounted, a window-level handler cancels file drops that MISS the
 *    zone: otherwise the browser navigates to the dropped image and the
 *    realtor loses an unsaved create form.
 */
export function PhotoDropZone({
  onFiles,
  count,
  max,
  disabled = false,
  hint,
}: {
  onFiles: (files: File[]) => void;
  /** Photos already counted against the limit (existing + staged + queued). */
  count: number;
  max: number;
  /** Externally disabled (e.g. the form is saving). */
  disabled?: boolean;
  /** Extra line under the zone (e.g. how many owner photos are reserved). */
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const zoneRef = useRef<HTMLButtonElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const hintId = useId();

  const atLimit = count >= max;
  const inert = disabled || atLimit;

  const hasFiles = (e: { dataTransfer: DataTransfer | null }) =>
    Array.from(e.dataTransfer?.types ?? []).includes("Files");

  const onDragOver = (e: React.DragEvent<HTMLButtonElement>) => {
    if (!hasFiles(e)) return; // dragged text/links: leave them alone
    // Required: without preventDefault the browser refuses the drop and opens
    // the file in the tab instead.
    e.preventDefault();
    if (inert) {
      e.dataTransfer.dropEffect = "none";
      return;
    }
    e.dataTransfer.dropEffect = "copy";
    if (!dragActive) setDragActive(true);
  };

  const onDrop = (e: React.DragEvent<HTMLButtonElement>) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    setDragActive(false);
    if (inert) return;
    onFiles(Array.from(e.dataTransfer.files));
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    // ⚠ Snapshot BEFORE clearing the input — see the component comment.
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (picked.length > 0) onFiles(picked);
  };

  // Keep a file dropped next to the zone from navigating away from the form.
  const guard = useCallback((e: DragEvent) => {
    if (!Array.from(e.dataTransfer?.types ?? []).includes("Files")) return;
    if (zoneRef.current?.contains(e.target as Node)) return; // the zone handles it
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "none";
  }, []);
  useEffect(() => {
    window.addEventListener("dragover", guard);
    window.addEventListener("drop", guard);
    return () => {
      window.removeEventListener("dragover", guard);
      window.removeEventListener("drop", guard);
    };
  }, [guard]);

  // A drag that leaves the window never fires dragleave on the zone.
  useEffect(() => {
    if (!dragActive) return;
    const reset = () => setDragActive(false);
    window.addEventListener("dragend", reset);
    window.addEventListener("drop", reset);
    return () => {
      window.removeEventListener("dragend", reset);
      window.removeEventListener("drop", reset);
    };
  }, [dragActive]);

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_PHOTO_ATTR}
        multiple
        disabled={inert}
        tabIndex={-1}
        aria-hidden
        onChange={onPick}
        className="sr-only"
      />
      <button
        ref={zoneRef}
        type="button"
        disabled={inert}
        onClick={() => inputRef.current?.click()}
        onDragEnter={onDragOver}
        onDragOver={onDragOver}
        onDragLeave={() => setDragActive(false)}
        onDrop={onDrop}
        aria-label={`Добавить фотографии. Загружено ${count} из ${max}`}
        aria-describedby={hintId}
        className={cn(
          "flex min-h-36 w-full flex-col items-center justify-center gap-3 rounded-[14px] border-2 border-dashed p-5 text-center sm:p-6",
          // Colour only, so it stays right under prefers-reduced-motion.
          "transition-[background-color,border-color] duration-200 ease-out",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
          "disabled:cursor-not-allowed disabled:opacity-60",
          dragActive
            ? "border-brand bg-brand-tint"
            : "border-border-strong bg-[var(--field-bg)] hover:border-brand hover:bg-brand-tint disabled:hover:border-border-strong disabled:hover:bg-[var(--field-bg)]",
        )}
      >
        <span className="pointer-events-none flex size-12 items-center justify-center rounded-xl bg-brand-tint">
          <Icon icon={Icons.PhotoUpload} size={24} className="text-brand" />
        </span>
        <span className="pointer-events-none block max-w-md">
          <span className="block text-[15px] font-semibold text-fg">
            {atLimit
              ? "Достигнут лимит фотографий"
              : dragActive
                ? "Отпустите, чтобы добавить"
                : "Перетащите фотографии сюда или нажмите, чтобы выбрать"}
          </span>
          <span className="mt-1 block text-[13px] text-fg-muted">
            {atLimit
              ? "Удалите лишние, чтобы добавить другие"
              : "Можно выбрать сразу несколько файлов"}
          </span>
        </span>
      </button>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <p id={hintId} className="text-xs text-fg-muted">
          До {max} фотографий. JPG, PNG, WEBP. Фото больше 1 МБ сжимаются автоматически без
          заметной потери качества.
        </p>
        <span
          className={cn(
            "text-xs font-semibold tabular-nums",
            atLimit ? "text-danger" : "text-fg-secondary",
          )}
          aria-live="polite"
        >
          {count} / {max}
        </span>
      </div>
      {hint ? <p className="mt-1 text-xs text-fg-muted">{hint}</p> : null}
    </div>
  );
}
