"use client";

import { useMemo, useState } from "react";
import { formatPriceRub, formatPriceCompactRub } from "@/lib/formatPrice";

interface PricePoint {
  price: number;
  changedAt: string;
}

interface PriceHistoryChartProps {
  history?: { price: number; changedAt: string }[];
}

const WIDTH = 640;
const HEIGHT = 220;
const PAD = { top: 16, right: 16, bottom: 28, left: 64 };

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Lightweight inline-SVG price-over-time chart — no charting dependency (keeps
 * the bundle lean and avoids the flaky-npm-on-pCloud install risk per CLAUDE.md).
 * Renders NOTHING when there are fewer than 2 points (a single dot isn't a trend).
 *
 * Collapsed by default: only the heading + a price-range hint + a chevron show;
 * clicking reveals the chart with a grid-rows height transition (the project's
 * existing collapse idiom, see PropertyDescription.tsx). State is not persisted —
 * it resets to collapsed on every visit.
 */
export function PriceHistoryChart({ history }: PriceHistoryChartProps) {
  const [expanded, setExpanded] = useState(false);

  const points: PricePoint[] = useMemo(
    () => (history ?? []).filter((h) => Number.isFinite(h.price)),
    [history],
  );

  const geometry = useMemo(() => {
    if (points.length < 2) return null;

    const prices = points.map((p) => p.price);
    const times = points.map((p) => new Date(p.changedAt).getTime());
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);

    const innerW = WIDTH - PAD.left - PAD.right;
    const innerH = HEIGHT - PAD.top - PAD.bottom;
    // Pad the price axis by 8% so the line never hugs the top/bottom edge.
    const span = maxPrice - minPrice || maxPrice || 1;
    const yMin = minPrice - span * 0.08;
    const yMax = maxPrice + span * 0.08;
    const timeSpan = maxTime - minTime || 1;

    const xOf = (t: number) => PAD.left + ((t - minTime) / timeSpan) * innerW;
    const yOf = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin)) * innerH;

    const coords = points.map((p) => ({
      x: xOf(new Date(p.changedAt).getTime()),
      y: yOf(p.price),
      ...p,
    }));

    const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
    // Area fill down to the baseline.
    const baseline = PAD.top + innerH;
    const areaPath =
      `M${coords[0].x.toFixed(1)},${baseline.toFixed(1)} ` +
      coords.map((c) => `L${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ") +
      ` L${coords[coords.length - 1].x.toFixed(1)},${baseline.toFixed(1)} Z`;

    // Three Y gridline ticks: min, mid, max (actual data range, not padded).
    const yTicks = [minPrice, (minPrice + maxPrice) / 2, maxPrice].map((v) => ({
      v,
      y: yOf(v),
    }));

    return { coords, linePath, areaPath, yTicks, baseline };
  }, [points]);

  if (!geometry) return null;

  const first = points[0];
  const last = points[points.length - 1];
  const dropped = last.price < first.price;

  return (
    <section className="mt-6">
      {/* Clickable header — collapsed by default. Shows the price-range hint and
          a chevron that rotates 180° when open. */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="flex flex-wrap items-baseline gap-x-3">
          <span className="text-xl font-semibold text-gray-900">История цены</span>
          <span className={dropped ? "text-sm font-medium text-red-600" : "text-sm text-gray-500"}>
            {dropped ? "↓ " : ""}
            {formatPriceRub(first.price)} → {formatPriceRub(last.price)}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1 text-sm text-gray-500">
          {expanded ? "Скрыть график" : "Показать график"}
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
            className={`transition-transform ${expanded ? "rotate-180" : ""}`}
          >
            <path
              d="M4 6l4 4 4-4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>

      {/* grid-rows 0fr→1fr animates the chart between collapsed and its natural
          height (same idiom as PropertyDescription.tsx). */}
      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
            <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-auto w-full"
          role="img"
          aria-label={`График изменения цены: от ${formatPriceRub(first.price)} до ${formatPriceRub(last.price)}`}
        >
          {/* Y gridlines + labels */}
          {geometry.yTicks.map((t, i) => (
            <g key={i}>
              <line
                x1={PAD.left}
                x2={WIDTH - PAD.right}
                y1={t.y}
                y2={t.y}
                stroke="#f1f5f9"
                strokeWidth={1}
              />
              <text
                x={PAD.left - 8}
                y={t.y}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-gray-400"
                fontSize={11}
              >
                {formatPriceCompactRub(t.v)}
              </text>
            </g>
          ))}

          {/* Area + line */}
          <path d={geometry.areaPath} fill="rgb(37 99 235 / 0.08)" />
          <path
            d={geometry.linePath}
            fill="none"
            stroke="#2563eb"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Data points */}
          {geometry.coords.map((c, i) => (
            <circle key={i} cx={c.x} cy={c.y} r={3.5} fill="#2563eb" stroke="#fff" strokeWidth={1.5}>
              <title>{`${formatDate(c.changedAt)}: ${formatPriceRub(c.price)}`}</title>
            </circle>
          ))}
            </svg>

            <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
              <span>{formatDate(first.changedAt)}</span>
              <span>{formatDate(last.changedAt)}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
