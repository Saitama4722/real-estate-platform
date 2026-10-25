"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PhotoDropZone } from "@/components/crm/PhotoDropZone";
import { fetchWithCrmAuthRetry } from "@/lib/crmAuth";
import {
  MAX_PROPERTY_PHOTOS,
  UPLOAD_CONCURRENCY,
  classifyFiles,
  describeRejections,
  makeStagedPhoto,
  photoThumbSrc,
  summarizeUploads,
  uploadOnePropertyPhoto,
  type CrmPropertyPhoto,
  type PhotoUploadResult,
  type StagedPhoto,
} from "@/lib/crmPropertyPhotos";
import { cn } from "@/lib/utils";

/**
 * THE photo section of the CRM property form — one component for both modes
 * (2026-10-25). It replaced `CrmStagedPhotosPicker` (create) and
 * `CrmPropertyPhotosManager` (edit), which had drifted apart: the edit copy
 * lost the "snapshot the FileList before clearing the input" fix, so adding
 * photos to an existing property silently did nothing.
 *
 *  - `mode="staged"` (create): there is no property yet. Files are held in the
 *    parent form (`items`/`onChange`) and uploaded by the form right after the
 *    property is created. The sale request's owner photos (`reservedCount`) are
 *    copied server-side and count against the limit.
 *  - `mode="live"` (edit): files upload immediately, `UPLOAD_CONCURRENCY` at a
 *    time, each with its own progress tile. A finished photo is appended from
 *    the server's response — no refetch, no flicker.
 *
 * The server enforces the limit (row lock); the numbers here only drive the
 * counter, the disabled zone and trimming a pick to the room left.
 */
export type CrmPropertyPhotosProps =
  | {
      mode: "staged";
      items: StagedPhoto[];
      onChange: (next: StagedPhoto[]) => void;
      /** Photos that will be added server-side (the owner's, in the convert flow). */
      reservedCount?: number;
      disabled?: boolean;
    }
  | { mode: "live"; propertyId: string };

type QueueStatus = "queued" | "uploading" | "error";

interface QueueItem {
  key: string;
  file: File;
  previewUrl: string;
  status: QueueStatus;
  percent: number;
  message?: string;
  sortOrder: number;
}

let queueKeySeq = 0;

export function CrmPropertyPhotos(props: CrmPropertyPhotosProps) {
  return props.mode === "staged" ? (
    <StagedPhotos {...props} />
  ) : (
    <LivePhotos propertyId={props.propertyId} />
  );
}

/* ----------------------------- shared pieces ----------------------------- */

function Notices({
  warnings,
  summary,
  error,
  onDismiss,
}: {
  warnings: string[];
  summary: { text: string; ok: boolean } | null;
  error: string | null;
  onDismiss: () => void;
}) {
  if (warnings.length === 0 && !summary && !error) return null;
  return (
    <div className="space-y-2">
      {error ? (
        <p role="alert" className="rounded-lg border border-danger/30 bg-danger-tint px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {summary ? (
        <p
          role={summary.ok ? "status" : "alert"}
          className={cn(
            "flex items-start justify-between gap-3 rounded-lg border px-3 py-2 text-sm",
            summary.ok
              ? "border-success/30 bg-success-tint text-success"
              : "border-danger/30 bg-danger-tint text-danger",
          )}
        >
          <span>{summary.text}</span>
          <button type="button" onClick={onDismiss} className="shrink-0 text-xs font-medium underline-offset-2 hover:underline">
            Скрыть
          </button>
        </p>
      ) : null}
      {warnings.length > 0 ? (
        <ul role="status" className="space-y-1 rounded-lg border border-warning/40 bg-warning-tint px-3 py-2 text-sm text-fg">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

const TILE = "relative overflow-hidden rounded-lg border border-border bg-surface-raised";
const GRID = "grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5";

function MainBadge() {
  return (
    <span className="absolute left-1.5 top-1.5 rounded bg-success px-1.5 py-0.5 text-[10px] font-semibold text-fg-inverse">
      Главное
    </span>
  );
}

const LINK_BTN =
  "rounded px-1.5 py-1 text-[11px] font-medium disabled:cursor-not-allowed disabled:opacity-50";

/* -------------------------------- staged --------------------------------- */

function StagedPhotos({
  items,
  onChange,
  reservedCount = 0,
  disabled = false,
}: Extract<CrmPropertyPhotosProps, { mode: "staged" }>) {
  const [warnings, setWarnings] = useState<string[]>([]);

  // Latest items for the unmount cleanup, without re-subscribing the effect on
  // every change (which would revoke still-displayed previews).
  const itemsRef = useRef(items);
  itemsRef.current = items;
  useEffect(() => {
    return () => itemsRef.current.forEach((i) => URL.revokeObjectURL(i.previewUrl));
  }, []);

  const count = reservedCount + items.length;

  const onFiles = (files: File[]) => {
    const classified = classifyFiles(files, MAX_PROPERTY_PHOTOS - count);
    setWarnings(describeRejections(classified));
    if (classified.accepted.length > 0) {
      onChange([...itemsRef.current, ...classified.accepted.map(makeStagedPhoto)]);
    }
  };

  const removeItem = (key: string) => {
    const target = items.find((i) => i.key === key);
    if (target) URL.revokeObjectURL(target.previewUrl);
    setWarnings([]);
    onChange(items.filter((i) => i.key !== key));
  };

  return (
    <div className="space-y-4">
      {reservedCount === 0 ? (
        <p className="text-sm font-medium text-fg-secondary">
          Обязательно <span className="text-danger">*</span>: минимум одно фото
        </p>
      ) : null}
      <PhotoDropZone
        onFiles={onFiles}
        count={count}
        max={MAX_PROPERTY_PHOTOS}
        disabled={disabled}
        hint={
          reservedCount > 0
            ? `Фото собственника (${reservedCount}) прикрепятся автоматически, будут первыми и входят в лимит.`
            : "Фотографии загрузятся после создания объекта. Первая станет главной."
        }
      />
      <Notices warnings={warnings} summary={null} error={null} onDismiss={() => setWarnings([])} />

      {items.length === 0 ? (
        <p className="text-sm text-fg-muted">Фотографии пока не выбраны.</p>
      ) : (
        <ul className={GRID}>
          {items.map((item, idx) => (
            <li key={item.key} className={TILE}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.previewUrl}
                alt=""
                loading="lazy"
                decoding="async"
                className="aspect-square w-full object-cover"
              />
              {idx === 0 && reservedCount === 0 ? <MainBadge /> : null}
              <div className="flex items-center justify-end p-1.5">
                <button
                  type="button"
                  onClick={() => removeItem(item.key)}
                  disabled={disabled}
                  className={cn(LINK_BTN, "text-danger hover:bg-danger-tint")}
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

/* --------------------------------- live ---------------------------------- */

function LivePhotos({ propertyId }: { propertyId: string }) {
  const [photos, setPhotos] = useState<CrmPropertyPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [summary, setSummary] = useState<{ text: string; ok: boolean } | null>(null);

  // Mirrors of state for the upload engine, which must read the CURRENT values
  // from callbacks (a stale closure here is how `is_main` once went wrong).
  const photosRef = useRef<CrmPropertyPhoto[]>([]);
  const queueRef = useRef<QueueItem[]>([]);
  const nextSortRef = useRef(0);
  const activeRef = useRef(0);
  const batchRef = useRef<PhotoUploadResult[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const setPhotosBoth = useCallback((next: CrmPropertyPhoto[]) => {
    photosRef.current = next;
    setPhotos(next);
  }, []);

  const updateQueue = useCallback((fn: (q: QueueItem[]) => QueueItem[]) => {
    queueRef.current = fn(queueRef.current);
    setQueue(queueRef.current);
  }, []);

  /** `silent`: re-read without swapping the gallery for «Загрузка…». */
  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const res = await fetchWithCrmAuthRetry(`/api/crm/properties/${propertyId}/photos/`);
        if (!res.ok) {
          setActionError("Не удалось загрузить фотографии.");
          return;
        }
        const raw = await res.json();
        const list = Array.isArray(raw) ? (raw as CrmPropertyPhoto[]) : [];
        list.sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
        setPhotosBoth(list);
        const maxSort = list.reduce((m, p) => Math.max(m, p.sort_order), -1);
        nextSortRef.current = Math.max(nextSortRef.current, maxSort + 1);
        setActionError(null);
        setLoaded(true);
      } catch {
        setActionError("Ошибка соединения при загрузке фотографий.");
      } finally {
        setLoading(false);
      }
    },
    [propertyId, setPhotosBoth],
  );

  useEffect(() => {
    void load();
  }, [load]);

  // One AbortController per mount (re-created after React StrictMode's
  // simulated unmount), so leaving the page cancels in-flight uploads.
  useEffect(() => {
    abortRef.current = new AbortController();
    return () => {
      abortRef.current?.abort();
      queueRef.current.forEach((q) => URL.revokeObjectURL(q.previewUrl));
    };
  }, []);

  const pending = queue.filter((q) => q.status !== "error").length;

  // Leaving mid-upload loses the files still waiting in the queue — warn.
  useEffect(() => {
    if (pending === 0) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [pending]);

  const finishBatchIfIdle = useCallback(() => {
    const q = queueRef.current;
    if (q.some((x) => x.status === "queued" || x.status === "uploading")) return;
    const results = batchRef.current;
    batchRef.current = [];
    if (results.length === 0) return;
    const s = summarizeUploads(results);
    setSummary({ text: s.text, ok: s.allOk });
    // A failed photo keeps its tile (with «Повторить»), so the user can act on it.
    void load(true); // pick up server-side facts (a promoted main, derivative URLs)
  }, [load]);

  const pump = useCallback(() => {
    while (activeRef.current < UPLOAD_CONCURRENCY) {
      const item = queueRef.current.find((q) => q.status === "queued");
      if (!item) break;
      activeRef.current += 1;
      updateQueue((q) =>
        q.map((x) => (x.key === item.key ? { ...x, status: "uploading", percent: 0 } : x)),
      );
      void (async () => {
        const result = await uploadOnePropertyPhoto(propertyId, item.file, {
          // The server decides who is main (the first photo of an empty property);
          // the client never sends is_main from here.
          sortOrder: item.sortOrder,
          onProgress: (percent) =>
            updateQueue((q) => q.map((x) => (x.key === item.key ? { ...x, percent } : x))),
          signal: abortRef.current?.signal,
        });
        activeRef.current -= 1;
        if (abortRef.current?.signal.aborted) return; // unmounted
        batchRef.current.push(result);
        if (result.ok && result.photo) {
          URL.revokeObjectURL(item.previewUrl);
          updateQueue((q) => q.filter((x) => x.key !== item.key));
          const added = result.photo;
          const base = photosRef.current.map((p) =>
            added.is_main ? { ...p, is_main: false } : p,
          );
          const next = [...base, added].sort(
            (a, b) => a.sort_order - b.sort_order || a.id - b.id,
          );
          setPhotosBoth(next);
        } else {
          const limitHit = result.code === "photo_limit";
          updateQueue((q) =>
            q.map((x) => {
              if (x.key === item.key) return { ...x, status: "error", message: result.message };
              // The property is full: don't send the rest, report them.
              if (limitHit && x.status === "queued")
                return { ...x, status: "error", message: result.message };
              return x;
            }),
          );
          if (limitHit) {
            queueRef.current
              .filter((x) => x.status === "error" && x.key !== item.key && x.message === result.message)
              .forEach((x) =>
                batchRef.current.push({ file: x.file, ok: false, message: x.message, code: "photo_limit" }),
              );
          }
        }
        pump();
        finishBatchIfIdle();
      })();
    }
  }, [propertyId, setPhotosBoth, updateQueue, finishBatchIfIdle]);

  const onFiles = (files: File[]) => {
    setSummary(null);
    const used = photosRef.current.length + queueRef.current.filter((q) => q.status !== "error").length;
    const classified = classifyFiles(files, MAX_PROPERTY_PHOTOS - used);
    setWarnings(describeRejections(classified));
    if (classified.accepted.length === 0) return;
    const items: QueueItem[] = classified.accepted.map((file) => ({
      key: `up-${queueKeySeq++}`,
      file,
      previewUrl: URL.createObjectURL(file),
      status: "queued",
      percent: 0,
      sortOrder: nextSortRef.current++,
    }));
    updateQueue((q) => [...q, ...items]);
    pump();
  };

  const retry = (key: string) => {
    setSummary(null);
    updateQueue((q) =>
      q.map((x) => (x.key === key ? { ...x, status: "queued", percent: 0, message: undefined } : x)),
    );
    pump();
  };

  const dismiss = (key: string) => {
    const item = queueRef.current.find((x) => x.key === key);
    if (item) URL.revokeObjectURL(item.previewUrl);
    updateQueue((q) => q.filter((x) => x.key !== key));
  };

  const setMain = useCallback(
    async (id: number) => {
      setBusyId(id);
      setActionError(null);
      try {
        const res = await fetchWithCrmAuthRetry(`/api/crm/properties/${propertyId}/photos/set_main/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
        if (res.ok) await load(true);
        else setActionError("Не удалось назначить главное фото.");
      } catch {
        setActionError("Ошибка соединения.");
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
      setActionError(null);
      const before = photosRef.current;
      setPhotosBoth(before.filter((p) => p.id !== id)); // optimistic
      try {
        const res = await fetchWithCrmAuthRetry(`/api/crm/properties/${propertyId}/photos/${id}/`, {
          method: "DELETE",
        });
        if (res.ok || res.status === 204) {
          void load(true); // the server promotes another photo if this was the main one
        } else {
          setPhotosBoth(before);
          setActionError(
            res.status === 403 ? "Недостаточно прав для изменения фотографий" : "Не удалось удалить фотографию.",
          );
        }
      } catch {
        setPhotosBoth(before);
        setActionError("Ошибка соединения.");
      } finally {
        setBusyId(null);
      }
    },
    [propertyId, load, setPhotosBoth],
  );

  const count = photos.length + queue.filter((q) => q.status !== "error").length;

  return (
    <div className="space-y-4">
      <PhotoDropZone
        onFiles={onFiles}
        count={count}
        max={MAX_PROPERTY_PHOTOS}
        disabled={!loaded}
      />
      <Notices
        warnings={warnings}
        summary={summary}
        error={actionError}
        onDismiss={() => setSummary(null)}
      />
      {!loaded && !loading ? (
        <button
          type="button"
          onClick={() => void load()}
          className="text-sm font-medium text-brand underline-offset-2 hover:underline"
        >
          Повторить загрузку списка
        </button>
      ) : null}

      {loading ? (
        <p className="text-sm text-fg-muted">Загрузка фотографий…</p>
      ) : photos.length === 0 && queue.length === 0 ? (
        <p className="text-sm text-fg-muted">Фотографий пока нет.</p>
      ) : (
        <ul className={GRID} aria-label="Фотографии объекта">
          {photos.map((p) => (
            <li key={p.id} className={TILE}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoThumbSrc(p)}
                alt=""
                loading="lazy"
                decoding="async"
                className="aspect-square w-full object-cover"
              />
              {p.is_main ? <MainBadge /> : null}
              <div className="flex items-center justify-between gap-1 p-1.5">
                {!p.is_main ? (
                  <button
                    type="button"
                    onClick={() => void setMain(p.id)}
                    disabled={busyId !== null}
                    className={cn(LINK_BTN, "text-brand hover:bg-brand-tint")}
                  >
                    Сделать главным
                  </button>
                ) : (
                  <span className="px-1.5 py-1 text-[11px] text-fg-muted">—</span>
                )}
                <button
                  type="button"
                  onClick={() => void remove(p.id)}
                  disabled={busyId !== null}
                  className={cn(LINK_BTN, "text-danger hover:bg-danger-tint")}
                >
                  Удалить
                </button>
              </div>
            </li>
          ))}
          {queue.map((item) => (
            <li key={item.key} className={TILE}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.previewUrl}
                alt=""
                decoding="async"
                className={cn(
                  "aspect-square w-full object-cover",
                  item.status !== "error" && "opacity-60",
                )}
              />
              <div className="space-y-1 p-1.5" role={item.status === "error" ? "alert" : "status"}>
                <p className="truncate text-[11px] text-fg-secondary" title={item.file.name}>
                  {item.file.name}
                </p>
                {item.status === "error" ? (
                  <>
                    <p className="text-[11px] font-medium text-danger">{item.message ?? "Не удалось загрузить"}</p>
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => retry(item.key)}
                        className={cn(LINK_BTN, "text-brand hover:bg-brand-tint")}
                      >
                        Повторить
                      </button>
                      <button
                        type="button"
                        onClick={() => dismiss(item.key)}
                        className={cn(LINK_BTN, "text-fg-secondary hover:bg-surface-inset")}
                      >
                        Убрать
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-[11px] text-fg-secondary">
                      {item.status === "queued"
                        ? "В очереди…"
                        : item.percent >= 100
                          ? "Обработка на сервере…"
                          : `Загрузка… ${item.percent}%`}
                    </p>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-inset">
                      <div
                        className={cn(
                          "h-full rounded-full bg-brand transition-[width] duration-200 ease-out",
                          item.status === "uploading" && item.percent >= 100 && "motion-safe:animate-pulse",
                        )}
                        style={{ width: `${item.status === "queued" ? 0 : item.percent}%` }}
                      />
                    </div>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
