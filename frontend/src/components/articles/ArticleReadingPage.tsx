import Link from "next/link";
import { Container } from "@/components/layout/container";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/layout/breadcrumbs";
import { Icon, Icons } from "@/components/ui/icon";
import { ArticleBodyRenderer } from "@/components/articles/ArticleBodyRenderer";
import { ArticleProgressBar } from "@/components/articles/ArticleProgressBar";
import { ArticleShareRow } from "@/components/articles/ArticleShareRow";
import { ArticleToc } from "@/components/articles/ArticleToc";
import { ArticleTocAccordion } from "@/components/articles/ArticleTocAccordion";
import { literata } from "@/app/articles/fonts";
import { formatArticleDate, type ParsedArticleBody } from "@/lib/articleContent";
import { isPropertyImageUrl } from "@/lib/propertyMedia";

/**
 * The long-form reading page — ONE layout, used by /articles/[slug] and
 * /districts/[slug]. An article and a district guide are the same object to a
 * reader (a titled, dated, categorised piece of writing), so they get the same
 * shell: progress bar, breadcrumbs, accent rule, eyebrow, H1, meta row,
 * optional cover, the parsed serif body, share row, a CTA and an optional
 * full-width section below. Per-surface differences arrive as props.
 *
 * Everything scroll-driven degrades on its own: the TOC needs two headings,
 * the drop cap needs the body to start with a paragraph, the progress bar
 * copes with a body shorter than the viewport.
 */

interface ArticleReadingPageProps {
  breadcrumbs: BreadcrumbItem[];
  /** Small brand pill over the title — category, area kind, … */
  eyebrow?: string;
  /** Makes the eyebrow a link (the article category filter). */
  eyebrowHref?: string;
  title: string;
  publishedAt: string;
  minutes: number;
  coverImage?: string | null;
  parsed: ParsedArticleBody;
  /** Canonical URL — what the share buttons publish, never location.href. */
  shareUrl: string;
  /** "Back to the index" target in the share row; defaults to /articles. */
  backHref?: string;
  backLabel?: string;
  /** Closing block inside the reading column (the catalog CTA). */
  cta?: React.ReactNode;
  /** Full-width block below the grid («Другие статьи»). */
  after?: React.ReactNode;
}

export function ArticleReadingPage({
  breadcrumbs,
  eyebrow,
  eyebrowHref,
  title,
  publishedAt,
  minutes,
  coverImage,
  parsed,
  shareUrl,
  backHref,
  backLabel,
  cta,
  after,
}: ArticleReadingPageProps) {
  /*
   * The TOC rail is a real grid column, so it must not be reserved when there
   * is nothing to put in it: every one of the 24 existing district guides has
   * zero headings [measured], and an always-on 3-column grid would push their
   * body off-centre behind an empty 264px gutter. Same threshold the TOC
   * components use to render at all.
   */
  const hasToc = parsed.toc.length >= 2;
  const showCover = Boolean(coverImage && isPropertyImageUrl(coverImage));

  const eyebrowPill = eyebrow ? (
    <span className="inline-flex rounded-full bg-brand-tint px-3.5 py-1.5 text-caption font-bold tracking-[0.08em] uppercase text-brand">
      {eyebrow}
    </span>
  ) : null;

  return (
    /* literata.variable defines --font-literata for this subtree only, and
       ctr-article-serif-scope re-declares --font-article-serif HERE so the
       self-hosted face joins the stack (at :root the token cannot see a
       page-scoped font variable — see globals.css). */
    <div className={`${literata.variable} ctr-article-serif-scope`}>
      <ArticleProgressBar targetId="article-body" />

      <Container>
        <div
          className={
            hasToc
              ? "min-[1140px]:grid min-[1140px]:grid-cols-[minmax(40px,1fr)_minmax(0,680px)_264px] min-[1140px]:gap-x-14"
              : ""
          }
        >
          <div
            className={
              hasToc
                ? "mx-auto w-full max-w-[720px] min-[1140px]:col-start-2 min-[1140px]:mx-0 min-[1140px]:max-w-none"
                : /* 680, not 720: with no rail to balance it the column IS the
                     page, so it must match the body's own 680px measure —
                     otherwise the text sits 40px left of true centre while the
                     wrapper is centred [measured]. With a TOC the offset is
                     deliberate: the rail balances it. */
                  "mx-auto w-full max-w-[680px]"
            }
          >
            <section className="ctr-sec pt-8 md:pt-[60px]">
              <Breadcrumbs tone="strong" items={breadcrumbs} />

              <div
                aria-hidden="true"
                className="mt-7 mb-[22px] h-[3px] w-11 rounded-sm bg-accent md:mt-11"
              />

              <article>
                {eyebrowHref && eyebrow ? (
                  <Link
                    href={eyebrowHref}
                    className="inline-flex rounded-full bg-brand-tint px-3.5 py-1.5 text-caption font-bold tracking-[0.08em] uppercase text-brand transition-colors duration-[150ms] hover:bg-brand-tint-2 focus-ring-brand"
                  >
                    {eyebrow}
                  </Link>
                ) : (
                  eyebrowPill
                )}

                <h1 className="mt-[18px] max-w-[760px] text-[clamp(32px,4.4vw,52px)] leading-[1.12] font-extrabold tracking-[-0.025em] text-pretty text-fg">
                  {title}
                </h1>

                <div className="mt-6 flex flex-wrap gap-x-[22px] gap-y-2.5 text-small text-fg-muted">
                  <span className="inline-flex items-center gap-[7px]">
                    <Icon icon={Icons.Calendar} size={16} className="h-[15px] w-[15px]" />
                    <time dateTime={publishedAt}>
                      Опубликовано {formatArticleDate(publishedAt)}
                    </time>
                  </span>
                  <span className="inline-flex items-center gap-[7px]">
                    <Icon icon={Icons.Clock} size={16} className="h-[15px] w-[15px]" />
                    {minutes} мин чтения
                  </span>
                </div>

                {showCover && (
                  <div className="mt-9 aspect-[21/9] w-full overflow-hidden rounded-[20px] bg-surface-inset">
                    <img
                      src={coverImage as string}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </div>
                )}

                <div aria-hidden="true" className="mt-8 h-px bg-border md:mt-[52px]" />

                {/* Tablet-only collapsible TOC (md → <1140); below md none.
                    Stacked md:max-[1139px] variant rather than md:block +
                    min-[1140px]:hidden — equal specificity would leave the
                    winner to stylesheet order. */}
                <div className="hidden md:max-[1139px]:block">
                  <ArticleTocAccordion entries={parsed.toc} />
                </div>

                <ArticleBodyRenderer parsed={parsed} />

                <ArticleShareRow
                  url={shareUrl}
                  title={title}
                  backHref={backHref}
                  backLabel={backLabel}
                />

                {cta}
              </article>
            </section>
          </div>

          {hasToc && (
            <aside className="hidden min-[1140px]:col-start-3 min-[1140px]:block min-[1140px]:pt-[220px]">
              <ArticleToc entries={parsed.toc} />
            </aside>
          )}
        </div>

        {after}
      </Container>
    </div>
  );
}
