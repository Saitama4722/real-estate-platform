/**
 * CRM property photos: the limit, file validation and the uploader (2026-10-25).
 *
 * ⭐ ONE source of truth on the frontend, used by BOTH the create form (staged
 * files) and the edit form (live uploads) through `CrmPropertyPhotos`.
 *
 * ⛔ `MAX_PROPERTY_PHOTOS` MUST equal `MAX_PHOTOS_PER_PROPERTY` in
 * `backend/properties/property_photo_images.py`. The server is the enforcer (a
 * row lock makes the count exact); this copy only drives the counter, the
 * disabled drop zone and the pre-flight trimming.
 */

import { xhrUpload, extractUploadError, type XhrUploadResult } from "@/lib/xhrUpload";

export const MAX_PROPERTY_PHOTOS = 10;

/**
 * Parallel uploads. 2, not more: production runs 3 SYNC gunicorn workers
 * (`docker-compose.prod.yml`, `--workers 3 --timeout 60`) and a slow 12 MiB body
 * holds a worker for the whole transfer, so 3-4 parallel uploads from one
 * realtor could occupy every worker and stall the site for everybody. The
 * endpoint takes one file per request. Raising this needs gthread/async workers.
 */
export const UPLOAD_CONCURRENCY = 2;

/** Server limit per original (`MAX_IMAGE_UPLOAD_BYTES`, 12 MiB). */
export const MAX_PHOTO_BYTES = 12 * 1024 * 1024;

/** `accept` for the file input. HEIC is NOT here: the server has no pillow-heif. */
export const ACCEPTED_PHOTO_ATTR = "image/jpeg,image/png,image/webp";

export const PHOTO_LIMIT_MESSAGE = `Можно загрузить не более ${MAX_PROPERTY_PHOTOS} фотографий для одного объекта`;

const OK_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const OK_EXT = new Set(["jpg", "jpeg", "png", "webp"]);
const HEIC_EXT = new Set(["heic", "heif"]);

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

function isHeic(f: File): boolean {
  return /hei[cf]/i.test(f.type) || HEIC_EXT.has(extOf(f.name));
}

/** Server CrmPropertyPhoto JSON (`CrmPropertyPhotoSerializer`). */
export interface CrmPropertyPhoto {
  id: number;
  original_file: string | null;
  image_large?: string | null;
  image_medium: string | null;
  image_thumb: string | null;
  is_main: boolean;
  sort_order: number;
}

/** Best available URL for a grid tile: derivatives may not exist yet (celery). */
export function photoThumbSrc(p: CrmPropertyPhoto): string {
  return p.image_thumb || p.image_medium || p.original_file || "";
}

/** A photo chosen on the create form, held in memory until the property exists. */
export interface StagedPhoto {
  key: string;
  file: File;
  name: string;
  previewUrl: string;
}

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

export interface ClassifiedFiles {
  /** Within the room left, valid — safe to upload / stage. */
  accepted: File[];
  /** Not a photo, or a format the server cannot read. */
  rejectedType: File[];
  /** Over MAX_PHOTO_BYTES. */
  rejectedSize: File[];
  /** Valid, but there is no room left (the first `room` files are kept). */
  overflow: File[];
  /** Subset of rejectedType that is HEIC/HEIF (gets its own hint). */
  heic: File[];
}

/**
 * Sort picked/dropped files into "upload", "reject with a reason" and "no room".
 * Pure, so it is shared by the file dialog, drag-and-drop and the tests.
 */
export function classifyFiles(files: File[], room: number): ClassifiedFiles {
  const out: ClassifiedFiles = {
    accepted: [],
    rejectedType: [],
    rejectedSize: [],
    overflow: [],
    heic: [],
  };
  for (const f of files) {
    if (isHeic(f)) {
      out.rejectedType.push(f);
      out.heic.push(f);
      continue;
    }
    const typeOk = OK_TYPES.has(f.type) || (f.type === "" && OK_EXT.has(extOf(f.name)));
    if (!typeOk) {
      out.rejectedType.push(f);
      continue;
    }
    if (f.size > MAX_PHOTO_BYTES) {
      out.rejectedSize.push(f);
      continue;
    }
    if (out.accepted.length < Math.max(0, room)) out.accepted.push(f);
    else out.overflow.push(f);
  }
  return out;
}

function names(files: File[], max = 3): string {
  const shown = files.slice(0, max).map((f) => f.name);
  const rest = files.length - shown.length;
  return rest > 0 ? `${shown.join(", ")} и ещё ${rest}` : shown.join(", ");
}

/** Russian, human messages for everything `classifyFiles` turned away. */
export function describeRejections(c: ClassifiedFiles): string[] {
  const msgs: string[] = [];
  const plainType = c.rejectedType.filter((f) => !c.heic.includes(f));
  if (plainType.length)
    msgs.push(`Не фотографии, пропущены: ${names(plainType)}. Подходят JPG, PNG и WEBP.`);
  if (c.heic.length)
    msgs.push(`Формат HEIC не поддерживается, сохраните фото как JPG: ${names(c.heic)}.`);
  if (c.rejectedSize.length)
    msgs.push(`Больше 12 МБ, пропущены: ${names(c.rejectedSize)}.`);
  if (c.overflow.length)
    msgs.push(
      `Лимит ${MAX_PROPERTY_PHOTOS} фотографий: не добавлено ${c.overflow.length} (${names(c.overflow)}).`,
    );
  return msgs;
}

/** Result of one file's upload. */
export interface PhotoUploadResult {
  file: File;
  ok: boolean;
  photo?: CrmPropertyPhoto;
  message?: string;
  /** Machine code from the server's 400 (`photo_limit`). */
  code?: string;
  status?: number;
}

/** Russian message for an upload failure, by HTTP status. */
export function uploadFailureMessage(res: XhrUploadResult | null, error?: unknown): string {
  if (!res) {
    const timedOut = error instanceof Error && error.message === "timeout";
    return timedOut
      ? "Превышено время ожидания, попробуйте ещё раз"
      : "Нет соединения с сервером";
  }
  if (res.status === 403) return "Недостаточно прав для изменения фотографий";
  if (res.status === 404) return "Объект недоступен";
  if (res.status === 413) return "Файл слишком большой";
  if (res.status >= 500) return "Ошибка сервера, попробуйте ещё раз";
  return extractUploadError(res, "Не удалось загрузить");
}

export interface UploadOneOptions {
  /** Send `is_main=true` (staged index 0 only; the server decides otherwise). */
  isMain?: boolean;
  /** Explicit position, so the user's pick order survives parallel uploads. */
  sortOrder?: number;
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}

/** Upload ONE photo. Never throws: failures come back as `ok: false`. */
export async function uploadOnePropertyPhoto(
  propertyId: string | number,
  file: File,
  opts: UploadOneOptions = {},
): Promise<PhotoUploadResult> {
  const fd = new FormData();
  fd.append("original_file", file);
  if (opts.isMain) fd.append("is_main", "true");
  if (opts.sortOrder !== undefined) fd.append("sort_order", String(opts.sortOrder));
  try {
    const res = await xhrUpload({
      url: `/api/crm/properties/${propertyId}/photos/`,
      method: "POST",
      body: fd,
      onProgress: opts.onProgress,
      signal: opts.signal,
    });
    if (res.ok) {
      return { file, ok: true, photo: res.data as CrmPropertyPhoto, status: res.status };
    }
    const code =
      res.data && typeof res.data === "object"
        ? ((res.data as Record<string, unknown>).code as string | undefined)
        : undefined;
    return {
      file,
      ok: false,
      message: uploadFailureMessage(res),
      code: typeof code === "string" ? code : undefined,
      status: res.status,
    };
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      return { file, ok: false, message: "Загрузка отменена" };
    }
    return { file, ok: false, message: uploadFailureMessage(null, e) };
  }
}

export interface UploadPoolOptions {
  /** Index 0 is sent with `is_main=true`. */
  firstIsMain?: boolean;
  /** `sort_order` of file 0; file i gets base + i. Omit to let the server append. */
  sortOrderBase?: number;
  concurrency?: number;
  signal?: AbortSignal;
  onStart?: (index: number) => void;
  onProgress?: (index: number, percent: number) => void;
  onResult?: (index: number, result: PhotoUploadResult) => void;
}

/**
 * Upload `files` with at most `concurrency` requests in flight, in pick order.
 * A `photo_limit` answer stops the pool: every file not yet started is reported
 * as failed with the limit message instead of hammering a full property.
 * Returns one result per file, in the same order.
 */
export async function uploadPropertyPhotos(
  propertyId: string | number,
  files: File[],
  opts: UploadPoolOptions = {},
): Promise<PhotoUploadResult[]> {
  const results: PhotoUploadResult[] = new Array(files.length);
  const width = Math.max(1, Math.min(opts.concurrency ?? UPLOAD_CONCURRENCY, files.length || 1));
  let next = 0;
  let limitHit = false;

  const worker = async () => {
    for (;;) {
      const i = next++;
      if (i >= files.length) return;
      const file = files[i];
      let result: PhotoUploadResult;
      if (limitHit) {
        result = { file, ok: false, message: PHOTO_LIMIT_MESSAGE, code: "photo_limit" };
      } else if (opts.signal?.aborted) {
        result = { file, ok: false, message: "Загрузка отменена" };
      } else {
        opts.onStart?.(i);
        result = await uploadOnePropertyPhoto(propertyId, file, {
          isMain: opts.firstIsMain === true && i === 0,
          sortOrder: opts.sortOrderBase !== undefined ? opts.sortOrderBase + i : undefined,
          onProgress: (p) => opts.onProgress?.(i, p),
          signal: opts.signal,
        });
        if (!result.ok && result.code === "photo_limit") limitHit = true;
      }
      results[i] = result;
      opts.onResult?.(i, result);
    }
  };

  await Promise.all(Array.from({ length: width }, worker));
  return results;
}

/** «Загружено 7 из 8, не удалось: a.jpg» / «Все 8 фотографий загружены». */
export function summarizeUploads(results: PhotoUploadResult[]): {
  text: string;
  failed: PhotoUploadResult[];
  allOk: boolean;
} {
  const failed = results.filter((r) => !r.ok);
  const okCount = results.length - failed.length;
  if (failed.length === 0) {
    const n = results.length;
    // «фото» does not decline, so one form is right for every count.
    return { text: n === 1 ? "Фото загружено" : `Все ${n} фото загружены`, failed, allOk: true };
  }
  const limit = failed.find((r) => r.code === "photo_limit");
  const reason = limit ? ` ${PHOTO_LIMIT_MESSAGE}.` : "";
  return {
    text: `Загружено ${okCount} из ${results.length}, не удалось: ${names(failed.map((r) => r.file))}.${reason}`,
    failed,
    allOk: false,
  };
}
