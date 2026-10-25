/**
 * Client-side photo compression (2026-10-26).
 *
 * ⭐ THE size policy. A user must never be blocked by file size: a photo bigger
 * than TARGET_PHOTO_BYTES is shrunk in the browser before it is uploaded, with as
 * little visible loss as possible; a photo that is already small is never touched.
 * Used by the shared CRM uploader (create AND edit) and by the public
 * «Продать недвижимость» form. The server keeps a safety net for clients that did
 * not compress (`common/image_compression.py: compress_property_original`).
 *
 * ⛔ This is the SIZE policy. The photo COUNT limit is a different constant
 * (`MAX_PROPERTY_PHOTOS` in `crmPropertyPhotos.ts` and `MAX_PHOTOS_PER_PROPERTY`
 * on the server): changing one must never touch the other.
 *
 * What it does, in order of how much quality it protects:
 *  1. <= 1 MiB: returned AS IS (never re-encoded).
 *  2. Decode with EXIF orientation applied (the canvas result carries no EXIF, so
 *     the orientation is baked into the pixels).
 *  3. Downscale to a long side <= 2560 px, never upscale, in halving steps so a
 *     big reduction does not alias, with high-quality smoothing, onto a WHITE
 *     background (JPEG has no alpha).
 *  4. Encode JPEG at quality 0.90, then 0.86, then 0.82 at that size; if still too
 *     big, shrink the long side x0.9 per step down to 1920 px at 0.82. If it is
 *     STILL over the target, the last (smallest) result is accepted instead of
 *     degrading further. Every loop is bounded.
 *  5. If the result is not smaller than the original, the original is uploaded.
 */

/** Photos at or below this size are uploaded untouched; it is also the target. */
export const TARGET_PHOTO_BYTES = 1024 * 1024;
export const MAX_LONG_SIDE = 2560;
export const MIN_LONG_SIDE = 1920;
export const START_JPEG_QUALITY = 0.9;
export const MIN_JPEG_QUALITY = 0.82;
/** Hard cap on the ORIGINAL a user picks (server: MAX_PROPERTY_PHOTO_UPLOAD_BYTES). */
export const MAX_ORIGINAL_PHOTO_BYTES = 40 * 1024 * 1024;

/** Quality steps tried at the first (largest) size. */
const QUALITY_STEPS = [START_JPEG_QUALITY, 0.86, MIN_JPEG_QUALITY] as const;
/** Long side multiplier per shrinking step once quality is at its floor. */
const SIDE_SHRINK = 0.9;

export interface EncodeAttempt {
  longSide: number;
  quality: number;
}

/**
 * The ordered list of (long side, quality) attempts for a source whose longer side
 * is `sourceLongSide` px. Pure and bounded; the first entry that fits the target
 * wins, so quality and size are only given up as far as needed.
 */
export function planEncodeAttempts(sourceLongSide: number): EncodeAttempt[] {
  const first = Math.max(1, Math.min(Math.round(sourceLongSide), MAX_LONG_SIDE));
  const plan: EncodeAttempt[] = QUALITY_STEPS.map((quality) => ({ longSide: first, quality }));
  let side = first;
  while (side > MIN_LONG_SIDE) {
    side = Math.max(MIN_LONG_SIDE, Math.round(side * SIDE_SHRINK));
    plan.push({ longSide: side, quality: MIN_JPEG_QUALITY });
  }
  return plan;
}

/**
 * Run `encode` over `attempts` until a result fits `target`; if none does, the
 * LAST result (smallest size at the quality floor) is returned. Generic so the
 * search can be tested without a canvas.
 */
export async function searchEncoding<T extends { size: number }>(
  attempts: EncodeAttempt[],
  encode: (attempt: EncodeAttempt) => Promise<T>,
  target = TARGET_PHOTO_BYTES,
): Promise<{ result: T; attempt: EncodeAttempt; tries: number; fits: boolean }> {
  let last: { result: T; attempt: EncodeAttempt } | null = null;
  let tries = 0;
  for (const attempt of attempts) {
    const result = await encode(attempt);
    tries += 1;
    last = { result, attempt };
    if (result.size <= target) return { ...last, tries, fits: true };
  }
  if (!last) throw new Error("no encode attempts");
  return { ...last, tries, fits: false };
}

/** Per-file failure to decode/encode (corrupt file, a format the browser cannot read). */
export class PhotoProcessingError extends Error {
  readonly fileName: string;
  constructor(fileName: string) {
    super(photoProcessingMessage(fileName));
    this.name = "PhotoProcessingError";
    this.fileName = fileName;
  }
}

export function photoProcessingMessage(fileName: string): string {
  return `Не удалось обработать файл ${fileName}. Загрузите JPG, PNG или WEBP.`;
}

export function photoTooLargeMessage(fileName: string): string {
  return `Файл ${fileName} слишком большой (больше ${MAX_ORIGINAL_PHOTO_BYTES / (1024 * 1024)} МБ)`;
}

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

/** HEIC/HEIF is never valid for the server: it must go through the decoder. */
export function isHeicLike(file: File): boolean {
  return /hei[cf]/i.test(file.type) || extOf(file.name) === "heic" || extOf(file.name) === "heif";
}

/** True when the file has to pass through the compressor before upload. */
export function photoNeedsCompression(file: File): boolean {
  return file.size > TARGET_PHOTO_BYTES || isHeicLike(file);
}

function jpegName(name: string): string {
  const base = name.replace(/\.[^./\\]+$/, "");
  return `${base || "photo"}.jpg`;
}

/* ------------------------------ canvas plumbing ----------------------------- */

type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;
type Ctx2d = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

function makeCanvas(width: number, height: number): AnyCanvas {
  if (typeof OffscreenCanvas !== "undefined") {
    try {
      const c = new OffscreenCanvas(width, height);
      if (c.getContext("2d")) return c;
    } catch {
      /* fall through to a DOM canvas */
    }
  }
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  return c;
}

function releaseCanvas(canvas: AnyCanvas): void {
  // Frees the pixel buffer right away instead of waiting for the garbage collector.
  canvas.width = 0;
  canvas.height = 0;
}

/** Draw `src` scaled into a NEW opaque (white-backed) canvas. */
function drawScaled(src: CanvasImageSource, tw: number, th: number): AnyCanvas {
  const canvas = makeCanvas(tw, th);
  const ctx = canvas.getContext("2d") as Ctx2d | null;
  if (!ctx) throw new Error("no 2d context");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, tw, th);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, tw, th);
  return canvas;
}

/**
 * Downscale `src` (sw x sh) to tw x th by repeated halving, then one final draw.
 * One big step from 6000 px to 2560 px aliases; halving keeps it clean.
 * Intermediate canvases are released as soon as the next step has read them.
 */
function downscaleStepwise(
  src: CanvasImageSource,
  sw: number,
  sh: number,
  tw: number,
  th: number,
): AnyCanvas {
  let cur: CanvasImageSource = src;
  let cw = sw;
  let ch = sh;
  let curIsTemp = false;
  while (cw / tw >= 2 && ch / th >= 2) {
    const nw = Math.max(tw, Math.floor(cw / 2));
    const nh = Math.max(th, Math.floor(ch / 2));
    const next = drawScaled(cur, nw, nh);
    if (curIsTemp) releaseCanvas(cur as AnyCanvas);
    cur = next;
    curIsTemp = true;
    cw = nw;
    ch = nh;
  }
  const out = drawScaled(cur, tw, th);
  if (curIsTemp) releaseCanvas(cur as AnyCanvas);
  return out;
}

function encodeJpeg(canvas: AnyCanvas, quality: number): Promise<Blob> {
  if ("convertToBlob" in canvas) {
    return canvas.convertToBlob({ type: "image/jpeg", quality });
  }
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob returned null"))),
      "image/jpeg",
      quality,
    );
  });
}

interface Decoded {
  source: CanvasImageSource;
  width: number;
  height: number;
  close: () => void;
}

/** Decode with EXIF orientation applied; falls back to an <img> element. */
async function decode(file: File): Promise<Decoded> {
  if (typeof createImageBitmap === "function") {
    const attempts: Array<ImageBitmapOptions | undefined> = [
      { imageOrientation: "from-image" } as unknown as ImageBitmapOptions,
      undefined, // modern browsers apply EXIF orientation by default
    ];
    for (const options of attempts) {
      try {
        const bmp = options ? await createImageBitmap(file, options) : await createImageBitmap(file);
        return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
      } catch {
        /* try the next way of decoding */
      }
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode(); // an <img> honours EXIF orientation (image-orientation: from-image)
    return {
      source: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      close: () => URL.revokeObjectURL(url),
    };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

export interface PreparedPhoto {
  /** The file to upload: the original, or a new `.jpg`. */
  file: File;
  compressed: boolean;
  originalBytes: number;
  bytes: number;
  /** Long side / quality of the chosen encoding (only when `compressed`). */
  longSide?: number;
  quality?: number;
  /** True when even the last attempt stayed over TARGET_PHOTO_BYTES. */
  overTarget?: boolean;
}

/**
 * Make `file` ready for upload: untouched when it is already <= 1 MiB, otherwise
 * compressed as described at the top of this file. Throws `PhotoProcessingError`
 * (with a Russian message naming the file) when the image cannot be decoded.
 * Processes ONE file; callers decide how many run at once, so decoded bitmaps are
 * never all held in memory together.
 */
export async function preparePhotoForUpload(file: File): Promise<PreparedPhoto> {
  const untouched = (): PreparedPhoto => ({
    file,
    compressed: false,
    originalBytes: file.size,
    bytes: file.size,
  });
  if (!photoNeedsCompression(file)) return untouched();

  let decoded: Decoded | null = null;
  let base: AnyCanvas | null = null;
  try {
    decoded = await decode(file);
    const { width, height } = decoded;
    if (!(width > 0 && height > 0)) throw new Error("empty image");

    const plan = planEncodeAttempts(Math.max(width, height));
    const firstSide = plan[0].longSide;
    const dims = (side: number, w: number, h: number) => {
      const s = side / Math.max(w, h);
      return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) };
    };

    const first = dims(firstSide, width, height);
    base = downscaleStepwise(decoded.source, width, height, first.w, first.h);
    decoded.close(); // the full-size bitmap is no longer needed
    decoded = null;

    const baseCanvas = base;
    const baseW = first.w;
    const baseH = first.h;
    const { result, attempt, fits } = await searchEncoding(plan, async (a) => {
      if (a.longSide === firstSide) return encodeJpeg(baseCanvas, a.quality);
      const d = dims(a.longSide, baseW, baseH);
      const scaled = drawScaled(baseCanvas, d.w, d.h); // always from the base, never cascaded
      try {
        return await encodeJpeg(scaled, a.quality);
      } finally {
        releaseCanvas(scaled);
      }
    });

    // Never make the upload bigger than what the user picked.
    if (result.size >= file.size && !isHeicLike(file)) return untouched();

    return {
      file: new File([result], jpegName(file.name), {
        type: "image/jpeg",
        lastModified: file.lastModified,
      }),
      compressed: true,
      originalBytes: file.size,
      bytes: result.size,
      longSide: attempt.longSide,
      quality: attempt.quality,
      overTarget: !fits,
    };
  } catch {
    throw new PhotoProcessingError(file.name);
  } finally {
    decoded?.close();
    if (base) releaseCanvas(base);
  }
}
