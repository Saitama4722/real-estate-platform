/**
 * Article body parsing — plain text in, structured blocks out.
 *
 * `Article.body` is deliberately plain text (product decision, 2026-08-08):
 * the superadmin writes it in the Django admin textarea following a simple
 * convention, and THIS module — nothing else — turns that convention into
 * headings, lists, callouts and the «Главное» takeaway card. The same parse
 * feeds the table of contents and the reading-time estimate, so the TOC can
 * never drift from the rendered headings.
 *
 * The convention (verified against all 15 seeded articles):
 *   - paragraphs are separated by a blank line;
 *   - a SHORT single line without terminal punctuation, alone in its
 *     paragraph, is a subheading («Вывод», «Как понять, что подходит вам»);
 *     ⚠ a heading may CONTAIN a colon («Новостройка: на что обратить
 *     внимание») — only a line ENDING with «:» is a list lead-in, never
 *     a heading;
 *   - lines starting with "- " are list items; the lead-in line may sit in
 *     the same paragraph (single \n before the items) or its own paragraph —
 *     both occur in real data;
 *   - the final «Вывод»/«Совет»/«Итог» section becomes the takeaway card;
 *   - explicit "## " / "### " / "> " markers are also honored, so future
 *     articles can opt into unambiguous structure with no migration.
 *
 * Django admin help_text documents the authoring side of this contract
 * (backend/articles/models.py ARTICLE_BODY_HELP) — change them together.
 */

export type ArticleBlock =
  | { type: "p"; text: string }
  | { type: "h2"; text: string; id: string }
  | { type: "h3"; text: string; id: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "quote"; text: string }
  | { type: "callout"; text: string };

export interface ArticleTocEntry {
  id: string;
  label: string;
}

export interface ParsedArticleBody {
  /** Main flow, everything before the takeaway section. */
  blocks: ArticleBlock[];
  /** The final «Вывод»-style section, rendered as the «Главное» card. */
  takeaway: { id: string; title: string; blocks: ArticleBlock[] } | null;
  /** h2-level entries in document order; includes the takeaway heading. */
  toc: ArticleTocEntry[];
}

/* ---- Heading detection ----------------------------------------------------- */

const MAX_HEADING_LEN = 90;
/** A line ending with any of these is prose (or a list lead-in), not a heading. */
const TERMINAL_PUNCTUATION = /[.,:;!?…]["»)]?$/;
/** Real headings start with a capital letter, a digit or an opening quote. */
const HEADING_START = /^[А-ЯЁA-Z0-9«"]/;

function isBareHeading(line: string): boolean {
  return (
    line.length >= 2 &&
    line.length <= MAX_HEADING_LEN &&
    HEADING_START.test(line) &&
    !TERMINAL_PUNCTUATION.test(line)
  );
}

const LIST_ITEM = /^[-•]\s+/;
const ORDERED_ITEM = /^\d+[.)]\s+/;

/** Case-normalized titles whose section becomes the takeaway card. */
const TAKEAWAY_TITLES = new Set(["вывод", "совет", "итог", "главное"]);

/* ---- Heading ids ------------------------------------------------------------ */

const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh",
  з: "z", и: "i", й: "j", к: "k", л: "l", м: "m", н: "n", о: "o",
  п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c",
  ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu",
  я: "ya",
};

function slugifyHeading(text: string): string {
  const slug = text
    .toLowerCase()
    .split("")
    .map((ch) => TRANSLIT[ch] ?? ch)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "sec";
}

/* ---- Parsing ---------------------------------------------------------------- */

function blocksFromParagraph(para: string): ArticleBlock[] {
  const lines = para
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const out: ArticleBlock[] = [];
  // Group consecutive runs: list items vs everything else. A lead-in line and
  // its "- " items can share one paragraph (single \n) — both spacings occur
  // in the seeded articles, so a run-based walk handles either.
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (LIST_ITEM.test(line) || ORDERED_ITEM.test(line)) {
      const ordered = ORDERED_ITEM.test(line);
      const marker = ordered ? ORDERED_ITEM : LIST_ITEM;
      const items: string[] = [];
      while (i < lines.length && marker.test(lines[i])) {
        items.push(lines[i].replace(marker, "").trim());
        i += 1;
      }
      out.push(ordered ? { type: "ol", items } : { type: "ul", items });
      continue;
    }
    if (line.startsWith("> ")) {
      const quoted: string[] = [];
      while (i < lines.length && lines[i].startsWith("> ")) {
        quoted.push(lines[i].slice(2).trim());
        i += 1;
      }
      out.push({ type: "quote", text: quoted.join(" ") });
      continue;
    }
    // Non-list, non-quote run → joined into one paragraph-ish line.
    const run: string[] = [];
    while (
      i < lines.length &&
      !LIST_ITEM.test(lines[i]) &&
      !ORDERED_ITEM.test(lines[i]) &&
      !lines[i].startsWith("> ")
    ) {
      run.push(lines[i]);
      i += 1;
    }
    const text = run.join(" ");
    if (text.startsWith("## ")) {
      out.push({ type: "h2", text: text.slice(3).trim(), id: "" });
    } else if (text.startsWith("### ")) {
      out.push({ type: "h3", text: text.slice(4).trim(), id: "" });
    } else if (/^Важно:\s+/.test(text)) {
      out.push({ type: "callout", text: text.replace(/^Важно:\s+/, "") });
    } else if (run.length === 1 && lines.length === 1 && isBareHeading(text)) {
      // Bare-heading detection applies ONLY to a line that is its own whole
      // paragraph — a short line inside a mixed lead-in+list paragraph is prose.
      out.push({ type: "h2", text, id: "" });
    } else {
      out.push({ type: "p", text });
    }
  }
  return out;
}

export function parseArticleBody(body: string): ParsedArticleBody {
  const paragraphs = body.replace(/\r\n?/g, "\n").split(/\n{2,}/);
  const blocks: ArticleBlock[] = [];
  for (const para of paragraphs) {
    blocks.push(...blocksFromParagraph(para));
  }

  // Deduplicated, stable heading ids.
  const seen = new Map<string, number>();
  for (const block of blocks) {
    if (block.type !== "h2" && block.type !== "h3") continue;
    const base = slugifyHeading(block.text);
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    block.id = n === 0 ? base : `${base}-${n + 1}`;
  }

  // The final «Вывод»-style h2 section becomes the takeaway card.
  let takeawayStart = -1;
  for (let i = blocks.length - 1; i >= 0; i -= 1) {
    const b = blocks[i];
    if (b.type === "h2") {
      if (TAKEAWAY_TITLES.has(b.text.trim().toLowerCase())) takeawayStart = i;
      break; // only the LAST h2 qualifies
    }
  }

  let takeaway: ParsedArticleBody["takeaway"] = null;
  let main = blocks;
  if (takeawayStart >= 0) {
    const head = blocks[takeawayStart] as Extract<ArticleBlock, { type: "h2" }>;
    takeaway = {
      id: head.id,
      title: head.text,
      blocks: blocks.slice(takeawayStart + 1),
    };
    main = blocks.slice(0, takeawayStart);
  }

  const toc: ArticleTocEntry[] = main
    .filter((b): b is Extract<ArticleBlock, { type: "h2" }> => b.type === "h2")
    .map((b) => ({ id: b.id, label: b.text }));
  if (takeaway) toc.push({ id: takeaway.id, label: takeaway.title });

  return { blocks: main, takeaway, toc };
}

/* ---- Reading time ----------------------------------------------------------- */

/** Average Russian silent-reading speed; deliberately conservative. */
const WORDS_PER_MINUTE = 170;

export function computeReadingTimeMinutes(body: string): number {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

/* ---- Shared presentation helpers ------------------------------------------- */

export function formatArticleDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
