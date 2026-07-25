"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchWithCrmAuthRetry } from "@/lib/crmAuth";
import { UploadProgressBar, useUploadProgress } from "@/components/ui/upload-progress";

interface PropertyPhoto {
  id: number;
  original_file: string;
  image_thumb: string | null;
  image_medium: string | null;
  is_main: boolean;
  sort_order: number;
}

/** One file currently uploading, rendered with its own progress bar. */
interface UploadingItem {
  key: string;
  file: File;
  name: string;
  previewUrl: string;
  /** First-ever photo for this property → upload as main. */
  asMain: boolean;
}

let uploadKeySeq = 0;

function photoSrc(p: PropertyPhoto): string {
  return p.image_thumb || p.image_medium || p.original_file;
}

/**
 * CRM property photo manager: lists existing photos, uploads new ones (each with
 * its own progress bar showing Сжатие… / percent / Готово! / Ошибка загрузки),
 * lets the user set the main photo and delete photos.
 *
 * Requires a saved property (`propertyId`) — photos attach via
 * POST /api/crm/properties/{id}/photos/.
 */
export function CrmPropertyPhotosManager({ propertyId }: { propertyId: string }) {
  const [photos, setPhotos] = useState<PropertyPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [uploads, setUploads] = useState<UploadingItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const res = await fetchWithCrmAuthRetry(`/api/crm/properties/${propertyId}/photos/`);
      if (!res.ok) {
        setListError("Не удалось загрузить фотографии.");
        return;
      }
      const raw = await res.json();
      const list = Array.isArray(raw) ? (raw as PropertyPhoto[]) : [];
      list.sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
      setPhotos(list);
    } catch {
      setListError("Ошибка соединения при загрузке фотографий.");
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const onFilesPicked = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      if (fileInputRef.current) fileInputRef.current.value = "";
      // The very first photo (no existing photos and nothing else queued) becomes main.
      const noPhotosYet = photos.length === 0 && uploads.length === 0;
      const items: UploadingItem[] = Array.from(files).map((file, i) => ({
        key: `up-${uploadKeySeq++}`,
        file,
        name: file.name,
        previewUrl: URL.createObjectURL(file),
        asMain: noPhotosYet && i === 0,
      }));
      setUploads((prev) => [...prev, ...items]);
    },
    [photos.length, uploads.length],
  );

  // When an upload row finishes: drop it from the queue, free its preview URL,
  // and refresh the gallery to show the newly stored photo.
  const handleUploadDone = useCallback(
    (key: string) => {
      setUploads((prev) => {
        const done = prev.find((u) => u.key === key);
        if (done) URL.revokeObjectURL(done.previewUrl);
        return prev.filter((u) => u.key !== key);
      });
      void load();
    },
    [load],
  );

  // Revoke any leftover object URLs on unmount.
  useEffect(() => {
    return () => {
      setUploads((prev) => {
        prev.forEach((u) => URL.revokeObjectURL(u.previewUrl));
        return prev;
      });
    };
  }, []);

  const setMain = useCallback(
    async (id: number) => {
      setBusyId(id);
      setListError(null);
      try {
        const res = await fetchWithCrmAuthRetry(
          `/api/crm/properties/${propertyId}/photos/set_main/`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id }),
          },
        );
        if (res.ok) await load();
        else setListError("Не удалось назначить главное фото.");
      } catch {
        setListError("Ошибка соединения.");
      } finally {
        setBusyId(null);
      }
    },
    [propertyId, load],
  );

  const remove = useCallback(
    async (id: number) => {
      if (!window.confirm("Удалить эту фотографию?")) return;
      setBusyId(id);
      setListError(null);
      try {
        const res = await fetchWithCrmAuthRetry(
          `/api/crm/properties/${propertyId}/photos/${id}/`,
          { method: "DELETE" },
        );
        if (res.ok || res.status === 204) {
          setPhotos((prev) => prev.filter((p) => p.id !== id));
        } else {
          setListError("Не удалось удалить фотографию.");
        }
      } catch {
        setListError("Ошибка соединения.");
      } finally {
        setBusyId(null);
      }
    },
    [propertyId],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="block text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-800 hover:file:bg-slate-200"
          onChange={(e) => onFilesPicked(e.target.files)}
        />
        <span className="text-xs text-slate-500">
          Можно выбрать несколько файлов. Большие изображения сжимаются автоматически.
        </span>
      </div>

      {listError && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {listError}
        </p>
      )}

      {/* Active uploads — each row owns its own progress bar */}
      {uploads.length > 0 && (
        <ul className="space-y-3">
          {uploads.map((item) => (
            <li
              key={item.key}
              className="flex items-center gap-3 rounded-md border border-slate-200 bg-white p-3"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.previewUrl}
                alt=""
                className="h-14 w-14 flex-shrink-0 rounded object-cover ring-1 ring-slate-200"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs text-slate-600">{item.name}</p>
                <UploadRow
                  propertyId={propertyId}
                  file={item.file}
                  asMain={item.asMain}
                  onDone={() => handleUploadDone(item.key)}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Existing photos gallery */}
      {loading ? (
        <p className="text-sm text-slate-500">Загрузка фотографий…</p>
      ) : photos.length === 0 && uploads.length === 0 ? (
        <p className="text-sm text-slate-500">Фотографий пока нет.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {photos.map((p) => (
            <li
              key={p.id}
              className="relative overflow-hidden rounded-md border border-slate-200 bg-white"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoSrc(p)} alt="" className="aspect-square w-full object-cover" />
              {p.is_main && (
                <span className="absolute left-1 top-1 rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  Главное
                </span>
              )}
              <div className="flex items-center justify-between gap-1 p-1.5">
                {!p.is_main ? (
                  <button
                    type="button"
                    onClick={() => setMain(p.id)}
                    disabled={busyId !== null}
                    className="rounded px-1.5 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                  >
                    Сделать главным
                  </button>
                ) : (
                  <span className="px-1.5 py-1 text-[11px] text-slate-400">—</span>
                )}
                <button
                  type="button"
                  onClick={() => remove(p.id)}
                  disabled={busyId !== null}
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

/**
 * A single in-flight upload. Owns its own progress hook so each file shows an
 * independent Сжатие… → percent → Готово! / Ошибка bar. Runs once on mount and
 * calls `onDone` when the upload settles (success or error).
 */
function UploadRow({
  propertyId,
  file,
  asMain,
  onDone,
}: {
  propertyId: string;
  file: File;
  asMain: boolean;
  onDone: () => void;
}) {
  const upload = useUploadProgress();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      const fd = new FormData();
      fd.append("original_file", file);
      if (asMain) fd.append("is_main", "true");
      await upload.run(
        { url: `/api/crm/properties/${propertyId}/photos/`, method: "POST", body: fd },
        "Ошибка загрузки",
      );
      // Let the "Готово!" / "Ошибка загрузки" state show briefly before the row
      // is removed and the gallery refreshes.
      setTimeout(onDone, 1200);
    })();
    // run-once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <UploadProgressBar state={upload.state} className="mt-1" />;
}
