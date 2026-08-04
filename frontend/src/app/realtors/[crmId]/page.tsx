import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Container } from "@/components/layout/container";
import { PropertyCard } from "@/components/home/PropertyCard";
import { RealtorCountUp } from "@/components/realtor/RealtorCountUp";
import { RealtorHeroMotion } from "@/components/realtor/RealtorHeroMotion";
import { RealtorHeroShapes } from "@/components/realtor/RealtorHeroShapes";
import { RealtorPhoneReveal } from "@/components/realtor/RealtorPhoneReveal";
import { Icon, Icons } from "@/components/ui/icon";
import { siteOrigin } from "@/lib/articleSeo";
import { formatPhone, telHref } from "@/lib/phoneFormat";
import { isPropertyImageUrl } from "@/lib/propertyMedia";
import { fetchPublicPropertiesList } from "@/lib/publicPropertyList";
import { fetchPublicRealtorByCrmId } from "@/lib/publicRealtor";
import type { LucideIcon } from "lucide-react";

const TITLE_SUFFIX = " — Centreal";

/* ---------------------------------------------------------------------------
 * PLATFORM CONSTANTS — the numbers in the stat tiles.
 *
 * The design's four tiles are «1 объект / 2 города / 4 типа / 3 этапа», but the
 * public realtor endpoint returns exactly six fields and only the first of those
 * numbers is among them. Rather than hardcode the other three (which would make
 * them silent lies the moment the platform grows), each is derived from a real
 * list that already exists in the product:
 *   • CITIES mirrors `CatalogCitySlug` in components/catalog/types.ts
 *   • PROPERTY_TYPES mirrors `CatalogPropertyItem["propertyType"]`
 *   • DEAL_STAGES is the sequence the realtor's own bio names
 * They are statements about the platform, not claims about this person — if a
 * third city is ever added, this tile follows by editing one array.
 * ------------------------------------------------------------------------- */
const CITIES = ["Краснодар", "Геленджик"] as const;
const PROPERTY_TYPES = ["квартиры", "дома", "участки", "коммерция"] as const;
const DEAL_STAGES = ["проверка", "переговоры", "оформление"] as const;

interface RealtorPageProps {
  params: Promise<{ crmId: string }>;
}

export async function generateMetadata({
  params,
}: RealtorPageProps): Promise<Metadata> {
  const { crmId } = await params;
  const realtor = await fetchPublicRealtorByCrmId(crmId);
  if (!realtor) {
    return { title: "Риэлтор не найден" };
  }
  const origin = siteOrigin();
  const path = `/realtors/${encodeURIComponent(realtor.crm_id)}`;
  const description =
    (realtor.short_bio || "").trim() ||
    `${realtor.display_name} — риэлтор Centreal. Объектов в продаже: ${realtor.published_properties_count}.`;

  return {
    title: `${realtor.display_name}${TITLE_SUFFIX}`,
    description: description.slice(0, 160),
    alternates: { canonical: `${origin}${path}` },
  };
}

/**
 * Splits the single free-text `short_bio` into the shapes the design lays out.
 *
 * WHY THIS IS DERIVED AND NOT STORED. The mockup shows a lead sentence, a
 * secondary paragraph, three TITLED icon blocks («Рынок» / «Подбор» /
 * «Сопровождение сделки») and a closing CTA line — but the API has no structured
 * bio at all, and those titles were hand-written for one specific realtor.
 * Hardcoding them would make every other realtor's page wrong. So the layout is
 * reproduced from whatever paragraphs the bio actually has:
 *
 *   lead    = first sentence of paragraph 1   (the large display line)
 *   intro   = rest of paragraph 1             (the smaller paragraph under it)
 *   blocks  = the middle paragraphs           (the bordered icon rows, untitled)
 *   closing = the last paragraph              (the CTA band's headline)
 *
 * `closing` is only taken when there are at least three paragraphs, so a short
 * bio keeps all of its text in the blocks and the CTA falls back to fixed copy.
 * Everything degrades to "render what exists": an empty bio yields no lead, no
 * blocks, and the section is skipped entirely.
 */
function splitBio(bio: string) {
  const paragraphs = (bio || "")
    .split(/\n\s*\n|\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) {
    return { lead: "", intro: "", blocks: [] as string[], closing: "" };
  }

  const [first, ...rest] = paragraphs;
  // First sentence = up to the first .!? that is followed by whitespace. The
  // lookahead keeps abbreviations like "5 сот." from splitting mid-sentence
  // only when they end the string, which is good enough for display copy.
  const match = first.match(/^([\s\S]+?[.!?])\s+([\s\S]+)$/);
  const lead = match ? match[1] : first;
  const intro = match ? match[2] : "";

  const hasClosing = paragraphs.length >= 3;
  return {
    lead,
    intro,
    blocks: hasClosing ? rest.slice(0, -1) : rest,
    closing: hasClosing ? paragraphs[paragraphs.length - 1] : "",
  };
}

/* Cycled across the bio rows. The design gives each block a bespoke glyph tied
   to its hand-written title; with untitled, data-driven blocks a small rotating
   set keeps the visual rhythm without implying a meaning the text may not have. */
const BIO_ICONS: LucideIcon[] = [Icons.Search, Icons.Security, Icons.Check];

function RealtorPortrait({
  name,
  avatar,
}: {
  name: string;
  avatar: string | null;
}) {
  if (avatar && isPropertyImageUrl(avatar)) {
    return (
      <img
        src={avatar}
        alt={name}
        className="h-full w-full object-cover"
        loading="eager"
        decoding="async"
      />
    );
  }
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
  return (
    <div className="flex h-full w-full items-center justify-center text-[clamp(56px,8vw,88px)] font-bold tracking-tight text-white/70">
      {initials || "—"}
    </div>
  );
}

export default async function PublicRealtorPage({ params }: RealtorPageProps) {
  const { crmId } = await params;
  const realtor = await fetchPublicRealtorByCrmId(crmId);
  if (!realtor) {
    notFound();
  }

  const properties = await fetchPublicPropertiesList({
    searchParams: { assigned_realtor_crm_id: realtor.crm_id },
  });

  const phone = (realtor.phone || "").trim();
  const bio = splitBio(realtor.short_bio || "");
  const count = realtor.published_properties_count;

  /*
   * ⚠ THE LABELS ARE INTENTIONALLY SHORTER THAN THE MOCKUP'S. This is the one
   * place on the page that deviates from it on copy.
   *
   * The mockup's own labels are «Города работы: Краснодар и Геленджик», «Типа
   * объектов: квартиры, дома, участки, коммерция» and «Этапа сопровождения:
   * проверка, переговоры, оформление» — i.e. a big numeral sitting directly
   * above an enumeration of exactly that many things, which restates the
   * numeral in words. Each label is now the bare category, so the numeral is
   * the only place the count appears, matching the mockup's own first tile
   * («Объектов в продаже», no enumeration).
   *
   * Nothing is lost from the page: the cities are still named in the hero
   * tagline and the CTA band, and the property types are the catalogue's four
   * categories.
   */
  const stats: { value: number; label: string; icon: LucideIcon }[] = [
    { value: count, label: "Объектов в продаже", icon: Icons.House },
    { value: CITIES.length, label: "Города работы", icon: Icons.Address },
    {
      value: PROPERTY_TYPES.length,
      label: "Типа объектов",
      icon: Icons.Apartment,
    },
    {
      value: DEAL_STAGES.length,
      label: "Этапа сопровождения",
      icon: Icons.Security,
    },
  ];

  /*
   * On-dark CTA geometry. The hero and the closing band are NOT the same size in
   * the mockup — hero is 52px tall / 14px radius / 15.5px text, the band is
   * 56px / 15px / 16px — so they get separate strings rather than one shared
   * one that splits the difference. Both clear the 44px touch-target floor.
   * The focus ring is blue-300: the default brand ring is invisible on navy.
   */
  const darkCtaBase =
    "inline-flex items-center justify-center gap-2.5 font-semibold transition-[box-shadow,background-color,border-color] duration-[250ms] ease-out focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-blue-300 disabled:cursor-not-allowed disabled:opacity-70";
  const heroCta = `${darkCtaBase} h-13 rounded-[14px] text-[15.5px]`;
  const bandCta = `${darkCtaBase} h-14 rounded-[15px] text-base`;
  /* Aside CTA — on a light surface, so it gets the brand focus ring rather than
     the on-dark blue-300 one. 54px/14px/15.5px per the mockup. */
  const asideCta =
    "inline-flex h-[54px] w-full items-center justify-center gap-2.5 rounded-[14px] bg-brand text-[15.5px] font-semibold text-white shadow-realtor-cta transition-[background-color,box-shadow] duration-[250ms] ease-out hover:bg-brand-hover hover:shadow-realtor-cta-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

  return (
    <>
      {/* ── HERO ─────────────────────────────────────────────────────────────
          `.ctr-sec` opts the section into the shared scroll reveal + its 2500ms
          failsafe (RevealController). Padding comes from utilities, which beat
          `.ctr-sec`'s own rhythm because it lives in @layer components. */}
      <section className="ctr-rp-hero ctr-sec relative isolate pt-0">
        <div
          aria-hidden="true"
          className="ctr-rp-hero__wash pointer-events-none absolute inset-0"
        />
        <svg
          aria-hidden="true"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 h-full w-full opacity-50 mix-blend-overlay"
        >
          <filter id="ctr-rp-grain">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.9"
              numOctaves="3"
              stitchTiles="stitch"
            />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100" height="100" filter="url(#ctr-rp-grain)" opacity="0.34" />
        </svg>

        <RealtorHeroMotion className="relative">
          <RealtorHeroShapes />

          <Container className="flex min-h-[min(88vh,760px)] flex-col py-[clamp(20px,2.6vw,34px)] pb-[clamp(40px,4.4vw,60px)]">
            <Breadcrumbs
              tone="dark"
              className="mb-[clamp(24px,3vw,44px)]"
              items={[
                { label: "Главная", href: "/" },
                { label: "Каталог", href: "/catalog" },
                { label: realtor.display_name },
              ]}
            />

            <div className="grid flex-1 items-center gap-[clamp(36px,4vw,64px)] lg:grid-cols-2">
              {/* ---- Text column ---- */}
              <div className="relative" data-reveal-stagger>
                {/* Darkens the wash directly behind the headline so white text
                    clears AA over the brightest part of the gradient.

                    ⚠ The horizontal bleed is lg-ONLY. Nothing clips this (the
                    hero deliberately has no `overflow-hidden` — see the note in
                    globals.css), so below lg, where this column spans the full
                    grid, an 80px right bleed pushed `document.scrollWidth` past
                    the viewport and gave the whole page a horizontal scrollbar
                    `[measured]`: 454px at a 390 viewport, 824 at 768. From lg up
                    the column is half the grid, so the bleed lands mid-page and
                    costs nothing. */}
                <div
                  aria-hidden="true"
                  className="ctr-rp-hero__scrim pointer-events-none absolute inset-x-0 -inset-y-10 lg:-left-15 lg:-right-20"
                />

                <div className="relative mb-5 inline-flex items-center gap-2.5 text-[11.5px] font-bold tracking-[0.22em] text-blue-300">
                  <span
                    aria-hidden="true"
                    className="h-px w-[26px] bg-gradient-to-r from-brand to-accent"
                  />
                  <span>РИЭЛТОР</span>
                </div>

                <h1 className="relative mb-[18px] text-balance text-[clamp(40px,5.4vw,76px)] font-black leading-[0.98] tracking-[-0.045em] text-white [text-shadow:0_1px_0_rgba(255,255,255,.22),0_18px_44px_rgba(15,30,56,.55)]">
                  {realtor.display_name}
                </h1>

                <p className="relative mb-[26px] max-w-[44ch] text-[clamp(15.5px,1.2vw,18px)] leading-[1.5] text-slate-100/90">
                  {CITIES.join(" и ")} · подбор и сопровождение сделки
                </p>

                <ul className="relative mb-[30px] flex list-none flex-wrap gap-2.5 p-0">
                  {[
                    {
                      icon: Icons.House,
                      node: (
                        <>
                          Объектов в продаже:{" "}
                          <span className="tabular-price font-bold">
                            {count}
                          </span>
                        </>
                      ),
                    },
                    { icon: Icons.Security, node: <>Проверка объекта</> },
                    { icon: Icons.Check, node: <>Сопровождение до сделки</> },
                  ].map((chip, i) => (
                    <li
                      key={i}
                      className="inline-flex h-10 items-center gap-2 rounded-full border border-white/[.18] bg-white/10 px-4 text-[13.5px] font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,.24)] backdrop-blur-[10px]"
                    >
                      <Icon
                        icon={chip.icon}
                        size={16}
                        className="shrink-0 text-blue-300"
                      />
                      {chip.node}
                    </li>
                  ))}
                </ul>

                <div className="relative flex flex-wrap items-center gap-3">
                  {phone && (
                    <RealtorPhoneReveal
                      phone={phone}
                      buttonClassName={`${heroCta} cursor-pointer px-[26px] bg-brand text-white shadow-realtor-cta hover:bg-brand-hover hover:shadow-realtor-cta-hover`}
                      linkClassName={`${heroCta} tabular-price px-[26px] bg-brand text-white shadow-realtor-cta hover:bg-brand-hover hover:shadow-realtor-cta-hover`}
                    />
                  )}
                  <a
                    href="#objects"
                    className={`${heroCta} border border-white/30 bg-white/10 px-6 text-white shadow-[inset_0_1px_0_rgba(255,255,255,.2)] hover:border-white/45 hover:bg-white/20`}
                  >
                    Смотреть объекты
                    <Icon
                      icon={Icons.ChevronDown}
                      size={16}
                      className="shrink-0"
                    />
                  </a>
                </div>
              </div>

              {/* ---- Portrait column ---- */}
              <div className="flex flex-col items-center gap-3.5 [perspective:1200px]">
                <div className="flex items-center gap-2.5 self-start rounded-[14px] border border-white/60 bg-white/95 px-[15px] py-2.5 shadow-realtor-float">
                  <Icon
                    icon={Icons.Map}
                    size={16}
                    className="shrink-0 text-brand"
                  />
                  <span className="text-[13px] font-semibold text-fg">
                    Знает рынок по районам
                  </span>
                </div>

                <div className="ctr-rp-tilt relative w-[min(100%,340px)]">
                  {/* Same overflow trap as the scrim: at 390 the portrait is
                      already 340 of 358 available px, so a 14% bleed each side
                      overflowed the document `[measured]`. Vertical bleed is
                      kept at every width — only the horizontal one waits for
                      room. */}
                  <div
                    aria-hidden="true"
                    className="ctr-rp-portrait-glow absolute inset-x-0 -inset-y-[14%] rounded-[40px] sm:-inset-[14%]"
                  />
                  <div className="ctr-rp-portrait-ring relative rounded-[26px] p-[1.5px] shadow-realtor-portrait">
                    <div className="ctr-rp-portrait-inner relative aspect-[4/5] overflow-hidden rounded-[24.5px]">
                      <RealtorPortrait
                        name={realtor.display_name}
                        avatar={realtor.avatar}
                      />
                      <div
                        aria-hidden="true"
                        className="ctr-rp-portrait-sheen pointer-events-none absolute inset-0"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 self-end rounded-[14px] border border-white/[.18] bg-realtor-navy/[.68] px-[15px] py-2.5 shadow-realtor-float backdrop-blur-[12px]">
                  <Icon
                    icon={Icons.Phone}
                    size={16}
                    className="shrink-0 text-blue-300"
                  />
                  <span className="text-[13px] font-semibold text-white">
                    Отвечает лично
                  </span>
                </div>
              </div>
            </div>
          </Container>
        </RealtorHeroMotion>
      </section>

      {/* ── STATS ────────────────────────────────────────────────────────────
          The strip rides UP over the hero's bottom edge. The offset is on the
          inner div, never on `.ctr-sec` itself — the reveal animates `transform`
          on the section, and a transform there would be overwritten on reveal.
          `z-[5]` in bracket form per the Tailwind-v4 z-index note in CLAUDE.md. */}
      <section className="ctr-sec relative z-[5] pt-0">
        <Container>
          <div
            className="flex translate-y-[clamp(-52px,-4vw,-34px)] flex-wrap gap-4"
            data-reveal-stagger
          >
            {stats.map((s) => (
              <div
                key={s.label}
                className="min-w-[190px] flex-[1_1_220px] rounded-[20px] border border-fg/[.06] bg-surface-raised px-6 pb-6 pt-[22px] shadow-realtor-stat transition-shadow duration-[250ms] ease-out hover:shadow-realtor-stat-hover"
              >
                <div className="mb-[18px] flex h-10 w-10 items-center justify-center rounded-xl bg-brand-tint">
                  <Icon icon={s.icon} size={20} className="text-brand" />
                </div>
                <RealtorCountUp
                  value={s.value}
                  className="tabular-price block text-[40px] font-extrabold leading-none tracking-[-0.035em] text-fg"
                />
                <p className="mt-[9px] text-[13.5px] leading-[1.4] text-fg-muted">
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* ── ABOUT + CONTACT ─────────────────────────────────────────────────── */}
      {(bio.lead || phone) && (
        <section className="ctr-sec pb-[clamp(64px,7vw,96px)] pt-[clamp(8px,2vw,24px)]">
          <Container>
            <div className="flex flex-wrap items-start gap-[clamp(32px,4vw,64px)]">
              <div className="min-w-0 flex-[1_1_min(100%,520px)]">
                {bio.lead && (
                  <>
                    <p className="mb-[18px] text-[11.5px] font-bold tracking-[0.2em] text-brand">
                      О РАБОТЕ
                    </p>
                    <p className="mb-10 max-w-[34ch] text-pretty text-[clamp(20px,2vw,27px)] font-medium leading-[1.34] tracking-[-0.02em] text-fg">
                      {bio.lead}
                    </p>
                  </>
                )}
                {bio.intro && (
                  <p className="mb-11 max-w-[62ch] text-pretty text-[16.5px] leading-[1.68] text-fg-secondary">
                    {bio.intro}
                  </p>
                )}

                {bio.blocks.length > 0 && (
                  <div className="ctr-rp-bio grid gap-0.5 overflow-hidden rounded-[20px]">
                    {bio.blocks.map((text, i) => (
                      <div
                        key={i}
                        className="flex gap-5 bg-surface-raised px-[clamp(20px,2.4vw,30px)] py-[26px]"
                      >
                        <div className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[13px] bg-realtor-navy">
                          <Icon
                            icon={BIO_ICONS[i % BIO_ICONS.length]}
                            size={20}
                            className="text-blue-300"
                          />
                        </div>
                        <p className="max-w-[60ch] text-pretty text-[15.5px] leading-[1.62] text-fg-secondary">
                          {text}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ---- Contact aside: phone + ONE primary action. No WhatsApp. */}
              <aside className="sticky top-24 min-w-[min(100%,300px)] flex-[0_1_360px]">
                {/* `to-[var(--field-bg)]`, NOT `to-[--field-bg]` — the bare
                    custom-property form is inert in this v4 build (it silently
                    emitted no background on the /sell drop zone). */}
                <div className="relative rounded-[22px] border border-border bg-gradient-to-b from-surface-raised to-[var(--field-bg)] px-[26px] pb-6 pt-[26px] shadow-realtor-aside">
                  <div
                    aria-hidden="true"
                    /* Four stops, not three: the mockup runs transparent →
                       brand → accent → transparent, so the hairline warms up
                       toward its right end. A single `via-` would drop the
                       accent stop entirely. */
                    className="absolute inset-x-[26px] top-0 h-px bg-[linear-gradient(90deg,transparent,var(--color-brand),var(--color-accent),transparent)]"
                  />

                  {phone ? (
                    <>
                      <p className="text-[11px] font-bold tracking-[0.2em] text-fg-muted">
                        ТЕЛЕФОН
                      </p>
                      <a
                        href={telHref(phone)}
                        className="tabular-price mb-[18px] mt-2 block rounded-sm text-[clamp(23px,2vw,27px)] font-bold tracking-[-0.02em] text-fg transition-colors hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                      >
                        {formatPhone(phone)}
                      </a>
                    </>
                  ) : (
                    <p className="mb-[18px] text-small text-fg-muted">
                      Телефон уточняйте по объектам.
                    </p>
                  )}

                  {/* Same affordance as the hero, so the page has ONE behaviour
                      for "get the number" instead of a reveal here and a modal
                      there. Hand-rolled geometry rather than the shared Button:
                      the mockup's aside CTA is 54px/14px/15.5px and the shared
                      ladder's nearest size is 48px/8px/16px. */}
                  {phone && (
                    <RealtorPhoneReveal
                      phone={phone}
                      buttonClassName={`${asideCta} cursor-pointer`}
                      linkClassName={`${asideCta} tabular-price`}
                    />
                  )}

                  <div className="mt-[18px] flex items-start gap-3 border-t border-border pt-4">
                    <Icon
                      icon={Icons.Alert}
                      size={16}
                      className="mt-0.5 shrink-0 text-brand"
                    />
                    <p className="text-[13.5px] leading-[1.55] text-fg-muted">
                      Отвечаю на звонки и сообщения лично. Расскажу про район и
                      объект до просмотра.
                    </p>
                  </div>
                </div>
              </aside>
            </div>
          </Container>
        </section>
      )}

      {/* ── OBJECTS ─────────────────────────────────────────────────────────── */}
      <section
        id="objects"
        className="ctr-sec scroll-mt-20 border-y border-border bg-surface-raised pb-[clamp(56px,6vw,88px)] pt-[clamp(56px,6vw,88px)]"
      >
        <Container>
          <div className="mb-[clamp(28px,3vw,40px)] flex flex-wrap items-end justify-between gap-[18px]">
            <div>
              <p className="mb-3.5 text-[11.5px] font-bold tracking-[0.2em] text-brand">
                КАТАЛОГ
              </p>
              <h2 className="text-[clamp(30px,3.6vw,46px)] font-extrabold leading-[1.04] tracking-[-0.035em] text-fg">
                Объекты риэлтора
              </h2>
            </div>
            <p className="flex items-center gap-2.5 text-small text-fg-muted">
              <span
                aria-hidden="true"
                className="h-[7px] w-[7px] rounded-full bg-accent"
              />
              В продаже:{" "}
              <span className="tabular-price font-bold text-fg">
                {properties.length}
              </span>
            </p>
          </div>

          {/*
           * The "весь каталог" panel is a GRID MEMBER, not a footer link — with a
           * single listing a 3-up grid would otherwise sit two thirds empty. The
           * panel widens to fill whatever the cards leave: at lg it spans 2 of 3
           * columns beside one card, and it drops back to a normal cell as soon
           * as there are enough listings to fill the row. Same rule as the
           * mockup's `catalogSpan`, expressed in breakpoints rather than JS.
           */}
          <div
            className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
            data-reveal-stagger
          >
            {properties.map((p) => (
              <PropertyCard
                key={p.id}
                slug={p.slug}
                image={p.image}
                price={p.price}
                oldPrice={p.oldPrice}
                marketLabel={p.marketLabel}
                title={p.title}
                characteristics={p.characteristics}
                rooms={p.rooms}
                area={p.area}
                floor={p.floor}
                totalFloors={p.totalFloors}
                location={p.location}
                href={p.href}
                favoriteId={p.slug}
                isPriceReduced={p.isPriceReduced}
                isNew={p.isNew}
                compareId={p.slug}
                compareType={p.propertyType}
              />
            ))}

            <Link
              href="/catalog"
              className={`ctr-rp-panel group relative flex min-h-[260px] flex-col justify-between overflow-hidden rounded-[20px] p-7 text-white shadow-realtor-panel transition-[box-shadow,translate] duration-[250ms] ease-out hover:-translate-y-1 hover:shadow-realtor-panel-hover focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-blue-300 motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${
                properties.length === 1 ? "lg:col-span-2" : ""
              }`}
            >
              <div
                aria-hidden="true"
                className="ctr-rp-panel__wash pointer-events-none absolute inset-0"
              />
              <div className="relative">
                <p className="mb-4 text-[11.5px] font-bold tracking-[0.2em] text-blue-300">
                  ВСЯ БАЗА
                </p>
                <p className="max-w-[22ch] text-[clamp(20px,1.7vw,25px)] font-bold leading-[1.22] tracking-[-0.025em]">
                  Ещё не нашли нужное — покажу больше вариантов
                </p>
              </div>
              <span className="relative mt-[26px] inline-flex h-12 items-center justify-between gap-3.5 rounded-full border border-white/20 bg-white/10 py-0 pl-[18px] pr-2 text-[15px] font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,.22)]">
                Смотреть весь каталог
                <span
                  aria-hidden="true"
                  className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-white"
                >
                  <Icon
                    icon={Icons.ArrowRight}
                    size={16}
                    className="text-realtor-navy"
                  />
                </span>
              </span>
            </Link>
          </div>
        </Container>
      </section>

      {/* ── CTA BAND ────────────────────────────────────────────────────────── */}
      <section className="ctr-sec pb-[clamp(72px,8vw,120px)] pt-[clamp(56px,6vw,96px)]">
        <Container>
          <div className="ctr-rp-band relative overflow-hidden rounded-[clamp(20px,2vw,28px)] px-[clamp(24px,4vw,64px)] py-[clamp(40px,5vw,72px)] shadow-realtor-band">
            <div
              aria-hidden="true"
              className="ctr-rp-band__wash pointer-events-none absolute inset-0"
            />
            <div
              aria-hidden="true"
              className="ctr-rp-band__ring pointer-events-none absolute -top-[30%] -right-[6%] h-[380px] w-[380px] rounded-[46px]"
            />

            <div className="relative flex flex-wrap items-center justify-between gap-[clamp(28px,4vw,56px)]">
              <div className="flex-[1_1_min(100%,460px)]">
                <p className="mb-[18px] text-[11.5px] font-bold tracking-[0.22em] text-blue-300">
                  СЛЕДУЮЩИЙ ШАГ
                </p>
                <p className="max-w-[38ch] text-balance text-[clamp(26px,3.2vw,42px)] font-extrabold leading-[1.1] tracking-[-0.035em] text-white">
                  {bio.closing ||
                    `Пишите или звоните — расскажу, что сейчас интересного есть в ${CITIES.join(" и ")}`}
                </p>
                {/* The supporting line is the FALLBACK's other half, so it is
                    suppressed whenever the headline came from the bio. Rendering
                    both duplicated the copy verbatim: this realtor's closing
                    paragraph already ends "…подберём объекты, которые
                    действительно стоит смотреть" `[observed]` in the rendered
                    page. */}
                {!bio.closing && (
                  <p className="mt-5 max-w-[48ch] text-base leading-[1.6] text-slate-100/80">
                    Под ваш запрос подберём объекты, которые действительно стоит
                    смотреть.
                  </p>
                )}
              </div>

              {phone && (
                <div className="flex flex-[0_1_320px] flex-col gap-3">
                  <a
                    href={telHref(phone)}
                    className={`${bandCta} tabular-price bg-brand px-6 text-white shadow-realtor-cta hover:bg-brand-hover hover:shadow-realtor-cta-hover`}
                  >
                    <Icon icon={Icons.Phone} size={20} className="shrink-0" />
                    {formatPhone(phone)}
                  </a>
                </div>
              )}
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
