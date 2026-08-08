"use client";

import { useEffect } from "react";

/**
 * Appends a copyright notice to the CLIPBOARD when text is copied out of the
 * article/guide reading column. Any length triggers it — one word counts.
 *
 * ⚠ THE PAGE IS NOT TOUCHED. Nothing is rendered, no node is added, no
 * attribute changes: the notice exists only in the clipboard payload — which is
 * what keeps SEO, screen readers and Firefox Reader View unaffected, since they
 * all read the DOM, not the clipboard.
 *
 * Measured against the same pages built without this component: rendered
 * `innerText`, element count (321 article / 214 guide), every `id` and every
 * `aria-controls` token are byte-identical, and so is the server-rendered
 * markup once <script> blocks are excluded (32 198 chars either way). The ONE
 * difference in view-source is +487 chars inside Next's RSC bootstrap payload,
 * where this file is registered as a client module (2 mentions of the module
 * path) — unavoidable for any "use client" component, and not visible content.
 *
 * SCOPE — the listener sits on `document` but bails unless the selection
 * INTERSECTS `#article-body`, the reading column rendered by ArticleReadingPage.
 * That single test is what excludes the header, the site nav, the breadcrumbs,
 * the H1/meta row, the table of contents, the progress bar, the share row, the
 * catalog CTA, «Другие статьи», the footer, every form field on the site, the
 * whole CRM cabinet, and every route that is not an article or a guide (the
 * component is not even mounted there).
 *
 * ⚠ INTERSECTION, NOT CONTAINMENT — deliberate, decided 2026-08-08 after the
 * first version shipped containment. `Ctrl+A` selects the whole document, so a
 * contained-in-the-body test bailed on it and the ENTIRE article left clean
 * [measured: 4864 chars, no notice] — the single most likely bulk-copy path was
 * the one case the feature missed. Intersection catches it. The accepted cost
 * is that a selection spanning nav-or-footer AND body text carries the notice
 * along with that chrome; a selection lying entirely outside the column still
 * does not (header-only and footer-only copies stay clean).
 *
 * `cut` is deliberately NOT listened for: it only fires in editable contexts,
 * and the reading column is not editable. Editing anywhere on the site keeps
 * stock behaviour.
 */

const CONTAINER_ID = "article-body";

/**
 * Legal framing, chosen to be firm and accurate rather than threatening:
 *   - ст. 1259 ГК РФ — written works are protected objects of copyright;
 *   - ст. 1270 ГК РФ — the exclusive right to use and to authorise use;
 *   - ст. 1274 ГК РФ — citation IS lawful with attribution and a source link,
 *     so the notice tells the reader how to comply instead of only forbidding.
 * ст. 1301 (compensation of 10 000–5 000 000 ₽) is deliberately NOT cited — a
 * damages threat on every copied sentence reads as hostile.
 *
 * Plain text only: no markdown, blank-line separated, URL alone on its line, so
 * it survives a paste into a plain-text editor, a messenger, Word and a CMS.
 */
export function buildCopyrightNotice(title: string, url: string): string {
  return [
    "",
    "",
    "© Centreal. Материал защищён авторским правом.",
    "",
    `Источник: «${title.trim()}» — Centreal`,
    url.trim(),
    "",
    "Текст принадлежит Centreal и охраняется как объект авторского права " +
      "(ст. 1259 и 1270 ГК РФ). Цитирование в информационных, научных, учебных " +
      "или полемических целях допускается при условии указания названия " +
      "материала, правообладателя и активной гиперссылки на страницу-источник " +
      "(ст. 1274 ГК РФ). Копирование, переработка и повторная публикация " +
      "материала — полностью или в существенной части — без письменного " +
      "разрешения правообладателя не допускаются.",
  ].join("\n");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** The same notice as HTML, so a paste into Word/a CMS keeps the formatting. */
function noticeHtml(title: string, url: string): string {
  const lines = buildCopyrightNotice(title, url).trim().split("\n");
  return (
    "<br><br>" +
    lines
      .map((line) => (line ? `<p>${escapeHtml(line)}</p>` : "<p><br></p>"))
      .join("")
  );
}

/** True when the node sits inside something the user can type into. */
function inEditable(node: Node | null): boolean {
  let el: HTMLElement | null =
    node instanceof HTMLElement ? node : (node?.parentElement ?? null);
  while (el) {
    const tag = el.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
    if (el.isContentEditable) return true;
    // No code blocks exist in article bodies today (the renderer emits only
    // p/h2/h3/ul/ol/quote/callout), but guard anyway so adding one later
    // cannot silently start appending a notice to copied code.
    if (tag === "PRE" || tag === "CODE") return true;
    el = el.parentElement;
  }
  return false;
}

interface ArticleCopyNoticeProps {
  /** Article or guide title, printed in the notice. */
  title: string;
  /** Canonical URL of THIS page — passed in, never derived from location. */
  url: string;
}

export function ArticleCopyNotice({ title, url }: ArticleCopyNoticeProps) {
  useEffect(() => {
    function onCopy(event: ClipboardEvent) {
      const clipboard = event.clipboardData;
      if (!clipboard) return;

      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
        return;
      }

      const plain = selection.toString();
      if (!plain.trim()) return;

      const container = document.getElementById(CONTAINER_ID);
      if (!container) return;

      // At least one range must touch the reading column; ranges that merely
      // run through the surrounding chrome ride along rather than blocking the
      // notice (see the INTERSECTION note above).
      const ranges: Range[] = [];
      let touchesBody = false;
      for (let i = 0; i < selection.rangeCount; i += 1) {
        const range = selection.getRangeAt(i);
        if (inEditable(range.commonAncestorContainer)) return;
        if (
          typeof range.intersectsNode === "function"
            ? range.intersectsNode(container)
            : container.contains(range.commonAncestorContainer)
        ) {
          touchesBody = true;
        }
        ranges.push(range);
      }
      if (!touchesBody || ranges.length === 0) return;

      try {
        const fragment = document.createElement("div");
        for (const range of ranges) {
          fragment.appendChild(range.cloneContents());
        }
        clipboard.setData("text/plain", plain + buildCopyrightNotice(title, url));
        clipboard.setData(
          "text/html",
          fragment.innerHTML + noticeHtml(title, url),
        );
        event.preventDefault();
      } catch {
        // Never break copying: without preventDefault the browser's own copy
        // stands, so the worst case is a missing notice, not lost text.
      }
    }

    document.addEventListener("copy", onCopy);
    return () => document.removeEventListener("copy", onCopy);
  }, [title, url]);

  return null;
}
