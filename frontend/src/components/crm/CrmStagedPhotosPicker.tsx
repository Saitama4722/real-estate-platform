"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** A photo chosen on the create form, held in memory until the property exists. */
export interface StagedPhoto {
  key: string;
  file: File;
  name: string;
  previewUrl: string;
}

/** Maximum number of photos that can be staged before the property is created. */
export const MAX_STAGED_PHOTOS = 10;

let stagedKeySeq = 0;

/** Build a StagedPhoto (with an object-URL preview) from a picked File. */
export function makeStagedPhoto(file: File): StagedPhoto {
  return {
    key: `staged-${stagedKeySeq++}`,
    file,
    name: file.name,
    previewUrl: URL.createObjectURL(file),
  };
}

/**
 * Create-mode photo picker. Photos are NOT uploaded here — there is no property
 * id yet. The picked files are lifted into the parent form (`items` / `onChange`)
 * and uploaded by the form right after the property is created.
 *
 * The first photo in the list is uploaded as the main one (badge "Главное").
 * At most MAX_STAGED_PHOTOS may be staged.
 */
export function CrmStagedPhotosPicker({
  items,
  onChange,
  disabled = false,
}: {
  items: StagedPhoto[];
  onChange: (next: StagedPhoto[]) => void;
  disabled?: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [limitMsg, setLimitMsg] = useState("");

  // Keep a ref to the latest items so the unmount cleanup revokes the URLs that
  // are actually live, without re-subscribing the effect on every change (which
  // would revoke still-displayed previews and blank out the thumbnails).
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const onFilesPicked = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      // Snapshot the files BEFORE clearing the input: `files` is a live reference
      // to input.files, and resetting input.value empties that same FileList — so
      // the copy must happen first or `picked` would come back empty.
      const picked = Array.from(files);
      // Clear the input so re-picking the same file fires onChange again.
      if (fileInputRef.current) fileInputRef.current.value = "";

      const room = MAX_STAGED_PHOTOS - items.length;
      if (room <= 0) {
        setLimitMsg(`Максимум ${MAX_STAGED_PHOTOS} фотографий`);
        return;
      }

      // Only create previews for files within the remaining room; the rest are
      // dropped before any object URL is made, so there is nothing to leak.
      const accepted = picked.slice(0, room).map(makeStagedPhoto);
      setLimitMsg(picked.length > room ? `Максимум ${MAX_STAGED_PHOTOS} фотографий` : "");
      onChange([...items, ...accepted]);
    },
    [items, onChange],
  );

  const removeItem = useCallback(
    (key: string) => {
      const target = items.find((i) => i.key === key);
      if (target) URL.revokeObjectURL(target.previewUrl);
      setLimitMsg("");
      onChange(items.filter((i) => i.key !== key));
    },
    [items, onChange],
  );

  // Revoke any leftover object URLs only when the picker truly unmounts.
  useEffect(() => {
    return () => {
      itemsRef.current.forEach((i) => URL.revokeObjectURL(i.previewUrl));
    };
  }, []);

  const atLimit = items.length >= MAX_STAGED_PHOTOS;

  // Open the native file dialog by programmatically clicking the hidden input.
  // A real <button> is used for the trigger so the click target is unambiguous
  // (the browser's own file-input button is inconsistent to style/click).
  const openFileDialog = useCallback(() => {
    if (disabled || atLimit) return;
    fileInputRef.current?.click();
  }, [disabled, atLimit]);

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-slate-700">
        Обязательно <span className="text-red-500">*</span> (минимум 1, максимум{" "}
        {MAX_STAGED_PHOTOS} фото)
      </p>

      <div className="flex flex-wrap items-center gap-3">
        {/* Visually hidden — triggered by the button below. Not display:none so
            assistive tech can still reach it. */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          disabled={disabled || atLimit}
          className="sr-only"
          onChange={(e) => onFilesPicked(e.target.files)}
        />
        <button
          type="button"
          onClick={openFileDialog}
          disabled={disabled || atLimit}
          className="rounded-md border border-slate-300 bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Выбрать файлы
        </button>
        <span className="text-xs text-slate-500">
          Можно выбрать несколько файлов. Они загрузятся после создания объекта.
          {" "}({items.length}/{MAX_STAGED_PHOTOS})
        </span>
      </div>

      {limitMsg && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {limitMsg}
        </p>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-slate-500">Фотографии пока не выбраны.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {items.map((item, idx) => (
            <li
              key={item.key}
              className="relative overflow-hidden rounded-md border border-slate-200 bg-white"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.previewUrl} alt="" className="aspect-square w-full object-cover" />
              {idx === 0 && (
                <span className="absolute left-1 top-1 rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  Главное
                </span>
              )}
              <div className="flex items-center justify-end p-1.5">
                <button
                  type="button"
                  onClick={() => removeItem(item.key)}
                  disabled={disabled}
                  className="rounded px-1.5 py-1 text-[11px] font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  Удалить
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
