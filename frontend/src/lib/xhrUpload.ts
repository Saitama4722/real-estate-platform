/**
 * XMLHttpRequest-based multipart upload with real progress events.
 *
 * `fetch` cannot report upload progress, so file uploads that need a progress
 * bar go through this helper. It attaches the same Bearer auth as the rest of
 * the app and, on a 401, refreshes the access token once and retries — mirroring
 * `fetchWithCrmAuthRetry` in crmAuth.ts.
 */
import { getCrmAccessToken, refreshCrmAccessToken } from "@/lib/crmAuth";
import { crmBrowserApiUrl } from "@/lib/crmAuthConstants";

export interface XhrUploadOptions {
  url: string;
  method?: "POST" | "PATCH" | "PUT";
  body: FormData;
  /** Called with an integer 0–100 as the upload streams to the server. */
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}

export interface XhrUploadResult {
  status: number;
  ok: boolean;
  /** Parsed JSON body when the response is JSON, else null. */
  data: unknown;
  rawText: string;
}

function send(opts: XhrUploadOptions): Promise<XhrUploadResult> {
  const { url, method = "POST", body, onProgress, signal } = opts;
  return new Promise<XhrUploadResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, crmBrowserApiUrl(url));

    const token = getCrmAccessToken();
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    // Do NOT set Content-Type — the browser sets the multipart boundary itself.

    if (onProgress && xhr.upload) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(Math.min(100, Math.round((e.loaded / e.total) * 100)));
        }
      };
    }

    xhr.onload = () => {
      const rawText = xhr.responseText ?? "";
      let data: unknown = null;
      const ct = xhr.getResponseHeader("Content-Type") ?? "";
      if (ct.includes("application/json") && rawText) {
        try {
          data = JSON.parse(rawText);
        } catch {
          data = null;
        }
      }
      resolve({
        status: xhr.status,
        ok: xhr.status >= 200 && xhr.status < 300,
        data,
        rawText,
      });
    };

    xhr.onerror = () => reject(new Error("network"));
    xhr.ontimeout = () => reject(new Error("timeout"));

    if (signal) {
      if (signal.aborted) {
        xhr.abort();
        reject(new DOMException("Aborted", "AbortError"));
        return;
      }
      signal.addEventListener("abort", () => xhr.abort(), { once: true });
      xhr.onabort = () => reject(new DOMException("Aborted", "AbortError"));
    }

    xhr.send(body);
  });
}

/**
 * Upload `body` to `url`, reporting progress. On a 401, refresh the token once
 * and retry (the retry re-reads the freshly-stored access token).
 *
 * NOTE: a retried request re-streams the FormData, so progress restarts from 0 —
 * acceptable since 401-retry is rare and the bar simply animates again.
 */
export async function xhrUpload(opts: XhrUploadOptions): Promise<XhrUploadResult> {
  const first = await send(opts);
  if (first.status !== 401) return first;
  const refreshed = await refreshCrmAccessToken();
  if (!refreshed) return first;
  return send(opts);
}

/** Best-effort extraction of a human-readable error message from a DRF response. */
export function extractUploadError(result: XhrUploadResult, fallback: string): string {
  const d = result.data;
  if (d && typeof d === "object") {
    const obj = d as Record<string, unknown>;
    if (typeof obj.detail === "string") return obj.detail;
    // DRF field errors: { original_file: ["..."] } / { avatar: ["..."] }
    for (const key of Object.keys(obj)) {
      const v = obj[key];
      if (Array.isArray(v) && v.length && typeof v[0] === "string") return v[0];
      if (typeof v === "string") return v;
    }
  }
  return fallback;
}
