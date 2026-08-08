import { Literata } from "next/font/google";

/**
 * Literata — the article BODY serif (mockup: «Основной текст набран шрифтом
 * Literata… Запасные шрифты: Source Serif 4, PT Serif»). Variable font, full
 * Cyrillic, self-hosted: next/font downloads the files at build time and
 * serves them from our own origin — zero runtime requests to Google.
 *
 * ⚠ Scope: imported ONLY by the article detail page, so the woff2 preload is
 * emitted only there — the header, footer, cards and every other route stay
 * pure Golos Text. The named fallbacks (Source Serif 4, PT Serif) are part of
 * the CSS stack in --font-article-serif but are NOT shipped as files — they
 * resolve only if present locally, then Georgia/serif.
 *
 * Italic is included for real blockquote italics (synthetic oblique Cyrillic
 * reads poorly at 22px).
 */
export const literata = Literata({
  subsets: ["cyrillic", "latin"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-literata",
});
