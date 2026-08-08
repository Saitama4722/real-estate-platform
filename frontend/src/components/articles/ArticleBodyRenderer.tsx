import { Icon, Icons } from "@/components/ui/icon";
import type { ArticleBlock, ParsedArticleBody } from "@/lib/articleContent";

/**
 * Server-rendered article body — the serif reading column of the detail page.
 *
 * Typography per the mockup's specimen: Literata stack at
 * clamp(17.5px → 20px)/1.72 on a 680px measure (≈70 characters); headings and
 * chrome stay Golos Text (font-sans). The wrapper carries id="article-body" so
 * the reading-progress bar can track THIS element, not the whole document.
 *
 * Every h2 carries scroll-mt-[76px] — the sticky-COMPACT-header anchor offset
 * the TOC scrolls against; keep the number in sync with ArticleToc's
 * SCROLL_OFFSET (rationale documented there).
 */

const H2_CLASS =
  "clear-left scroll-mt-[76px] font-sans text-[clamp(23px,2vw,28px)] leading-[1.25] font-bold tracking-[-0.015em] text-fg mt-[54px] mb-[18px] first:mt-0";

function Block({ block }: { block: ArticleBlock }) {
  switch (block.type) {
    case "h2":
      return (
        <h2 id={block.id} className={H2_CLASS}>
          {block.text}
        </h2>
      );
    case "h3":
      return (
        <h3
          id={block.id}
          className="clear-left scroll-mt-[76px] font-sans text-[21px] leading-[1.3] font-bold tracking-[-0.01em] text-fg mt-10 mb-3"
        >
          {block.text}
        </h3>
      );
    case "ul":
      return (
        <ul className="mb-[26px] flex list-disc flex-col gap-2.5 pl-[26px]">
          {block.items.map((item, i) => (
            <li key={i} className="pl-1.5">
              {item}
            </li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol className="mb-[26px] flex list-decimal flex-col gap-2.5 pl-[26px]">
          {block.items.map((item, i) => (
            <li key={i} className="pl-1.5">
              {item}
            </li>
          ))}
        </ol>
      );
    case "quote":
      return (
        <blockquote className="mb-[26px]">
          <span
            aria-hidden="true"
            className="block text-[44px] leading-none font-semibold text-brand"
          >
            «
          </span>
          <span className="mt-0.5 block text-[22px] leading-[1.55] text-fg italic">
            {block.text}
          </span>
        </blockquote>
      );
    case "callout":
      return (
        <div className="clear-left mb-[26px] flex gap-3.5 rounded-xl bg-brand-tint-2 px-[22px] py-5 text-[0.86em] leading-[1.62] text-blue-900">
          <Icon
            icon={Icons.Info}
            size={20}
            className="mt-[3px] shrink-0 text-brand"
          />
          <p>
            <strong className="font-sans text-[0.95em]">Важно:</strong>{" "}
            {block.text}
          </p>
        </div>
      );
    case "p":
    default:
      return <p className="mb-[26px] text-pretty">{block.text}</p>;
  }
}

interface ArticleBodyRendererProps {
  parsed: ParsedArticleBody;
}

export function ArticleBodyRenderer({ parsed }: ArticleBodyRendererProps) {
  // Drop cap goes on the first block only when it is a plain paragraph.
  const first = parsed.blocks[0];
  const dropCapFirst = first?.type === "p";

  return (
    <div
      id="article-body"
      className="max-w-[680px] pt-7 font-article-serif text-[clamp(17.5px,1.1vw+13px,20px)] leading-[1.72] text-gray-800 md:pt-11"
    >
      {parsed.blocks.map((block, i) =>
        dropCapFirst && i === 0 && block.type === "p" ? (
          <p key={i} className="ctr-article-dropcap mb-[26px] text-pretty">
            {block.text}
          </p>
        ) : (
          <Block key={i} block={block} />
        ),
      )}

      {parsed.takeaway && (
        <div className="clear-left mt-[50px] rounded-2xl border border-border bg-surface-raised p-6 md:p-9">
          <div className="flex items-center gap-2.5">
            <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-brand-tint text-brand">
              <Icon icon={Icons.Check} size={16} className="h-3.5 w-3.5" />
            </span>
            <span className="font-sans text-caption font-bold tracking-[0.1em] uppercase text-brand">
              Главное
            </span>
          </div>
          <h2
            id={parsed.takeaway.id}
            className="mt-4 mb-3 scroll-mt-[76px] font-sans text-[clamp(20px,1.7vw,23px)] leading-[1.25] font-bold tracking-[-0.01em] text-fg"
          >
            {parsed.takeaway.title}
          </h2>
          <div className="text-[0.93em] leading-[1.68] [&>:last-child]:mb-0">
            {parsed.takeaway.blocks.map((block, i) => (
              <Block key={i} block={block} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
