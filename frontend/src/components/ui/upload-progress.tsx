"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  extractUploadError,
  xhrUpload,
  type XhrUploadOptions,
  type XhrUploadResult,
} from "@/lib/xhrUpload";

export type UploadPhase = "idle" | "compressing" | "uploading" | "done" | "error";

/** How long the "Готово!" state stays visible before the bar auto-hides. */
const DONE_VISIBLE_MS = 2000;
/** Brief "Сжатие..." state shown before the real upload starts. */
const COMPRESSING_MS = 450;

export interface UploadProgressState {
  phase: UploadPhase;
  percent: number;
  /** Localized status text for the current phase (or a custom error message). */
  message: string;
  /** True while compressing or uploading — use to disable inputs/buttons. */
  busy: boolean;
}

const PHASE_LABEL: Record<UploadPhase, string> = {
  idle: "",
  compressing: "Сжатие…",
  uploading: "Загрузка…",
  done: "Готово!",
  error: "Ошибка загрузки",
};

/**
 * State machine for an upload with a progress bar:
 *   idle → compressing (brief) → uploading (0–100%) → done (2s) → idle
 *                                                   ↘ error
 *
 * `run()` performs the upload via XHR and drives the phases. It resolves with
 * the XhrUploadResult on success (HTTP 2xx) or null on failure (network/HTTP
 * error), so callers can branch without throwing.
 */
export function useUploadProgress() {
  const [state, setState] = useState<UploadProgressState>({
    phase: "idle",
    percent: 0,
    message: "",
    busy: false,
  });
  const doneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearDoneTimer = useCallback(() => {
    if (doneTimer.current) {
      clearTimeout(doneTimer.current);
      doneTimer.current = null;
    }
  }, []);

  useEffect(() => clearDoneTimer, [clearDoneTimer]);

  const reset = useCallback(() => {
    clearDoneTimer();
    setState({ phase: "idle", percent: 0, message: "", busy: false });
  }, [clearDoneTimer]);

  const run = useCallback(
    async (
      opts: Omit<XhrUploadOptions, "onProgress">,
      errorFallback = "Ошибка загрузки",
    ): Promise<XhrUploadResult | null> => {
      clearDoneTimer();
      // 1. Brief "Сжатие..." state before bytes start moving.
      setState({ phase: "compressing", percent: 0, message: PHASE_LABEL.compressing, busy: true });
      await new Promise((r) => setTimeout(r, COMPRESSING_MS));

      // 2. Upload with live progress.
      setState({ phase: "uploading", percent: 0, message: PHASE_LABEL.uploading, busy: true });
      try {
        const result = await xhrUpload({
          ...opts,
          onProgress: (percent) =>
            setState((s) =>
              s.phase === "uploading" ? { ...s, percent } : s,
            ),
        });

        if (result.ok) {
          // 3. "Готово!" then auto-hide.
          setState({ phase: "done", percent: 100, message: PHASE_LABEL.done, busy: false });
          doneTimer.current = setTimeout(() => {
            setState({ phase: "idle", percent: 0, message: "", busy: false });
          }, DONE_VISIBLE_MS);
          return result;
        }

        setState({
          phase: "error",
          percent: 0,
          message: extractUploadError(result, errorFallback),
          busy: false,
        });
        return null;
      } catch {
        // Network/abort error.
        setState({ phase: "error", percent: 0, message: errorFallback, busy: false });
        return null;
      }
    },
    [clearDoneTimer],
  );

  return { state, run, reset };
}

/**
 * Visual progress bar with status text. Renders nothing while idle.
 * Colors: blue while working, green on done, red on error.
 */
export function UploadProgressBar({
  state,
  className,
}: {
  state: UploadProgressState;
  className?: string;
}) {
  if (state.phase === "idle") return null;

  const isError = state.phase === "error";
  const isDone = state.phase === "done";
  // Compressing has no real percentage yet — show a small indeterminate sliver.
  const width = isError ? 100 : state.phase === "compressing" ? 8 : state.percent;

  return (
    <div className={cn("space-y-1", className)} role="status" aria-live="polite">
      <div className="flex items-center justify-between text-xs font-medium">
        <span
          className={cn(
            isError ? "text-red-700" : isDone ? "text-emerald-700" : "text-slate-700",
          )}
        >
          {state.message}
        </span>
        {state.phase === "uploading" && (
          <span className="tabular-nums text-slate-500">{state.percent}%</span>
        )}
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-200 ease-out",
            isError ? "bg-red-500" : isDone ? "bg-emerald-500" : "bg-blue-600",
            state.phase === "compressing" && "animate-pulse",
          )}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}
