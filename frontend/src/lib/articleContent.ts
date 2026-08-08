/**
 * Article + guide content assembly — structured fields in, blocks out.
 *
 * STRUCTURE COMES FROM FIELDS, NOT FROM TEXT (product decision, 2026-08-08).
 * The superadmin types into a box labelled «Застройка и жильё» and gets a
 * section under that heading; there is no markup to remember and no way to
 * "forget the convention" and silently lose a heading. Articles carry
 * repeatable `ArticleSection` rows (their headings depend on the subject);
 * district guides carry five fixed named fields (their sections are always the
 * same). Both arrive here as `SectionInput[]` and produce the SAME
 * `ParsedArticleBody`, so rendering, the table of contents and reading time are
 * one code path for both.
 *
 * ⚠ What is NOT here any more: heading detection. A short line without a full
 * stop is now just a paragraph. The old heuristic — plus the `##` marker and
 * the "last section called «Вывод» is the takeaway" rule — was replaced by
 * migrations articles.0005–0007 and locations.0007–0009, which split every
 * existing body into fields. Do not reintroduce it: the whole point is that
 * two authors writing the same text get the same page.
 *
 * What remains is PARAGRAPH-LEVEL ONLY, inside one section's text:
 *   - blank line between paragraphs;
 *   - lines starting with «- », «— », «– » or «• » are list items (and «1. »
 *     for numbered ones); a lead-in line may share the paragraph with them;
 *   - a paragraph starting with «Важно: » is the blue callout;
 *   - «> » is a quote.
 *
 * The Django admin help_text states the same contract to the author
 * (backend/articles/models.py SECTION_TEXT_HELP, and the DistrictGuide field
 * help texts) — change them together.
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
  /** The «Вывод» section, rendered as the «Главное» card. */
  takeaway: { id: string; title: string; blocks: ArticleBlock[] } | null;
  /** h2-level entries in document order; includes the takeaway heading. */
  toc: ArticleTocEntry[];
}

/**
 * One authored section. `heading: null` means the text renders with NO
 * subheading and contributes no TOC entry — that is the article's «Вступление»
 * and the guide's «Что за район», both of which sit directly under the H1.
 */
export interface SectionInput {
  heading: string | null;
  text: string;
}

/**
 * Bullet markers. The hyphen is the documented form, but «— » (em dash) is the
 * natural Russian typographic habit: ALL 24 district guides were written with
 * it `[measured]`, so it is accepted rather than requiring 24 text edits and a
 * retrained habit across the ~90 guides still to be written (user decision,
 * 2026-08-08). En dash and • ride along for free.
 *
 * Accepted risk: a line that legitimately OPENS with a dash — dialogue, or a
 * dash-led clause — becomes a list item. No such line exists in any of the 39
 * bodies on record `[measured]`; em dashes there appear only mid-sentence,
 * where this anchored pattern cannot see them.
 */
const LIST_ITEM = /^[-–—•]\s+/;
const ORDERED_ITEM = /^\d+[.)]\s+/;

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
    if (/^Важно:\s+/.test(text)) {
      out.push({ type: "callout", text: text.replace(/^Важно:\s+/, "") });
    } else {
      out.push({ type: "p", text });
    }
  }
  return out;
}

/** Paragraph-level parse of ONE section's text. Never yields a heading. */
export function parseSectionText(text: string): ArticleBlock[] {
  const out: ArticleBlock[] = [];
  for (const para of (text ?? "").replace(/\r\n?/g, "\n").split(/\n{2,}/)) {
    out.push(...blocksFromParagraph(para));
  }
  return out;
}

/**
 * Assemble authored sections into the renderable shape.
 *
 * An empty section is DROPPED — never a heading with nothing under it and
 * never a gap in the table of contents. `takeaway` is passed separately
 * because it is a distinct field on both models, not the last section that
 * happens to be named «Вывод».
 */
export function parsedBodyFromSections(
  sections: SectionInput[],
  takeawayInput?: { title: string; text: string } | null,
): ParsedArticleBody {
  const blocks: ArticleBlock[] = [];
  const toc: ArticleTocEntry[] = [];

  // Stable, deduplicated heading ids — two sections may legitimately share a
  // title («Кому подойдёт» in two different guides is fine, but twice in ONE
  // article would collide and break TOC anchors).
  const seen = new Map<string, number>();
  const idFor = (text: string) => {
    const base = slugifyHeading(text);
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return n === 0 ? base : `${base}-${n + 1}`;
  };

  for (const section of sections) {
    const body = parseSectionText(section.text);
    if (body.length === 0) continue;
    const heading = section.heading?.trim();
    if (heading) {
      const id = idFor(heading);
      blocks.push({ type: "h2", text: heading, id });
      toc.push({ id, label: heading });
    }
    blocks.push(...body);
  }

  let takeaway: ParsedArticleBody["takeaway"] = null;
  const takeawayBlocks = takeawayInput ? parseSectionText(takeawayInput.text) : [];
  if (takeawayInput && takeawayBlocks.length > 0) {
    const title = takeawayInput.title.trim() || "Вывод";
    const id = idFor(title);
    takeaway = { id, title, blocks: takeawayBlocks };
    toc.push({ id, label: title });
  }

  return { blocks, takeaway, toc };
}

/* ---- Reading time ----------------------------------------------------------- */

/**
 * Average Russian silent-reading speed; deliberately conservative.
 *
 * ⚠ THIS FILE IS THE ONLY DEFINITION OF READING TIME. The backend deliberately
 * does NOT compute minutes: `DistrictGuideListSerializer` omits the section
 * texts (too heavy for an index of ~90 guides), so it sends a raw `word_count`
 * summed over the five section fields instead —
 * a MEASUREMENT, not a policy. The rate, the min-1 floor and the rounding mode
 * all live here, once. Do not add a second implementation server-side: a
 * shared constant would still leave the algorithm duplicated, and Python's
 * banker's rounding disagrees with Math.round at exact .5 (user decision,
 * 2026-08-08).
 */
const WORDS_PER_MINUTE = 170;

/** Whitespace-token count — matches Python's `str.split()` exactly. */
export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** The rule. Everything reading-time-shaped goes through this function. */
export function readingTimeFromWordCount(words: number): number {
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

/**
 * Words in everything the page actually renders: each non-empty section's
 * heading AND text, plus the takeaway's title and text.
 *
 * Headings are counted because they are on the page and were counted before
 * the content became structured — with them, reading times are unchanged by
 * that migration. `DistrictGuide.rendered_text_parts()` counts the same parts
 * server-side for the index card, so the card and the page agree.
 */
export function countSectionsWords(
  sections: SectionInput[],
  takeaway?: { title: string; text: string } | null,
): number {
  let words = 0;
  for (const section of sections) {
    if (!section.text.trim()) continue;
    if (section.heading?.trim()) words += countWords(section.heading);
    words += countWords(section.text);
  }
  if (takeaway && takeaway.text.trim()) {
    words += countWords(takeaway.title) + countWords(takeaway.text);
  }
  return words;
}

export function readingTimeFromSections(
  sections: SectionInput[],
  takeaway?: { title: string; text: string } | null,
): number {
  return readingTimeFromWordCount(countSectionsWords(sections, takeaway));
}

/* ---- Shared presentation helpers ------------------------------------------- */

export function formatArticleDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
