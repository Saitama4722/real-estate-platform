# Product decisions and domain behaviour

Read before changing anything a user sees: catalog / articles / districts, property
cards, favorites / compare / price history, breadcrumbs and SEO, CRM forms, lead
capture, or the sale-request→property flow.

**Several decisions here are CLOSED. They are marked ⛔ and must not be relitigated.**

---

## Routing

**`/catalog` is a route SEGMENT, not a single page.** It contains both the search
page (`app/catalog/page.tsx`) **and every property detail page**
(`app/catalog/[slug]/page.tsx`). Detail URLs live under `/catalog/` and are linked
from homepage cards, both map components, similar properties, breadcrumbs across
several page types, and the sitemap.

**Before proposing to remove, rename or restructure anything under `/catalog`**,
check whether the change affects only the search page or the **entire segment**.
Treating it as one simple page previously led to the wrong conclusion that the whole
route could be deleted as an unused feature, when it is the primary path to **all**
property listings.

### ⛔ «Популярные запросы» point at SEO landing routes — do NOT "fix" them

They point at dedicated landing routes (`/{city}/{segment}`, e.g.
`/krasnodar/kupit-kvartiru`) resolved via `SEGMENT_TO_TYPE` — **not** dead links.
These are **canonical, indexable** pages, preferred over query-param links for SEO.
Rewriting them to `?property_type=X&city_slug=Y` for consistency with the search form
would be an **SEO regression**.

### ⛔ Breadcrumb hierarchy: type and city must NOT collapse to the same URL

- **Type segment** → broadest scope, **query-param catalog filter only**
  (`/catalog?property_type=X`) — that type across **all** cities.
- **City segment** → narrower, the **canonical SEO landing route** for that city+type
  when one exists (falling back to the query-param form).

Two levels pointing at the **identical** URL breaks the "each level is progressively
narrower" mental model, **even though** it is technically SEO-sound. This **reverses**
an earlier implementation where both collapsed to the landing route; the strict
nesting is the deliberate final choice. Reference: `propertyBreadcrumbs.ts`.

A real bug found during that work: `mapPublicDetailToCatalogItem()` wasn't populating
`citySlug`/`districtSlug` (only the **list** mapper did), silently dropping the
«Город» breadcrumb level. **The list and detail mappers are separate — fixing one
does not fix the other.** (Same pattern bit the area-unit bug below.)

---

## ⚠ An entity rendered in several places needs EVERY render site checked

The homepage «Статьи» section and the `/articles` listing were two **independent**
components rendering the same data with no shared logic. After wiring up article
cover images, `/articles` showed them and the homepage still showed a hardcoded gray
placeholder — **and** the homepage's `page.tsx` was additionally **stripping
`coverImage` out** of the data before it reached the component.

**LESSON: when fixing how any multi-site entity renders, grep for the card/preview
component name across the frontend and check every site** before declaring the fix
complete. Property cards had the same multi-call-site pattern.

That duplication has since been resolved for articles — see the shared card below.

---

## Catalog (redesigned 2026-08-04): the URL is the single source of truth

Every filter, the sort, the list/map view and the page number live in the **query
string**; there is no client-held filter state. The server page parses, sorts and
slices, so a filtered/sorted/paginated URL is fully server-rendered; `CatalogExplorer`
only turns interactions into navigation inside `startTransition` (its `isPending`
drives the real skeletons).

**The state model lives in ONE module — `lib/catalogFilters.ts`** (parse / serialize
/ chips / widen actions / sort-ordering map). **If a param is added, add it THERE**,
never ad-hoc in a component — the panel, chips, pagination links and widen buttons
all derive from it.

### ONE URL interpreter

API params come from `catalogApiParamsFromUiState(parseCatalogUiState(sp))` — a
projection of the **same** parsed state the panel and chips render from, so a filter
can never apply without a chip. The old raw-searchParams builder is **deleted**: its
hardcoded commercial-type whitelist had gone stale (the backend added
`hotel`/`guesthouse`, so «Гостиница» showed a chip and filtered **nothing**).
**Never reintroduce a frontend copy of backend param validation.**

### ⭐ THE APARTMENT-ONLY RULE

**Any filter whose data lives on `ApartmentDetails` requires an explicit «Квартиры»
property type** — that is `rooms`, `market_type` **and** `floor_preset`. One
predicate, `apartmentFiltersApply(f)`, no exceptions.

Under «Все типы» such a filter silently turns an all-types search into an
apartments-only one (nothing else has an `ApartmentDetails` row to match), and the
chip says «Комнат: 2», never «квартиры только». The hero `SearchBar` has **always**
rendered its rooms/market controls only for apartments — **the panel was the
inconsistent surface, not the hero.**

- **Enforced on the STATE, not just at read sites.** `normalizeApartmentFilters()`
  runs in **both** `parseCatalogUiState` (a shared or stale URL) and `withFilters` (a
  type switch), so an inapplicable value can never sit dormant and resurrect when the
  type returns to apartments. The read-site gates are belt-and-braces.
- Controls are **hidden, not disabled**, for every non-apartment type. The price
  field takes the freed grid columns so the row has no gap.
- **Accepted cost:** a shared URL carrying `rooms`/`market_type` with no type stops
  filtering.

### Sorting

`sort=new|price_asc|price_desc` are passed to the API as `?ordering=`.
**«По площади» (`area_desc`) has NO API ordering field** — area lives in 4 per-type
detail tables — and is sorted server-side in the template over the full result set.
Fine while the API returns everything unpaginated `[measured]`; needs a backend
ordering field once the dataset grows.

**«Сначала новые» = `published_at`**, now on the public list serializer (public-safe:
the endpoint already ordered by it and `is_new` disclosed its bucket). It no longer
proxies via `updated_at`, so **a CRM edit cannot bump an old listing.**

### Этаж = PRESETS, not a numeric range

Param `floor_preset` ∈ `not_first` | `not_last` | `not_first_not_last`. Buyers state
objections ("not the ground floor"), not floor bands; presets are one tap and need no
min≤max validation. `floor_min`/`floor_max` stay available as an orthogonal future
addition.

- `ApartmentDetails.floor` is **required**; `floors_total` is **nullable**. So
  «не первый» is always evaluable, while «не последний» cannot be judged when the
  height is unknown. Those listings are **excluded** (the preset is a hard
  constraint) **and counted**, because a silent disappearance is the failure mode to
  avoid.
- **The hidden count travels as an HTTP RESPONSE HEADER**, `X-Hidden-Unknown-Floors`
  — the list response is a bare array every consumer depends on.
  `fetchPublicPropertiesListWithMeta()` reads it; `fetchPublicPropertiesList()` stays
  items-only. It **includes `?search`** (the count queryset runs through the same
  `SearchFilter` backend as the list; it used to be computed in `get_queryset()`,
  before filter backends, and over-reported).
- **Counting gotcha:** count with `apartment_details__isnull=False` too — a bare
  `apartment_details__floors_total__isnull=True` LEFT JOINs and also matches houses
  and land, which have no `apartment_details` at all.

### ⛔ Срок сдачи is DEFERRED — do not relitigate

There is **no** completion-date field anywhere: not on `Property`, not on
`ApartmentDetails`, not on `ResidentialComplex` `[measured]`. With one real listing, a
field nobody fills is a real cost, so the control stays an honest dashed «Скоро»
placeholder.

**Agreed future shape when wanted: a DATE on `ResidentialComplex`, with buckets
derived at query time — no quarter enum.** Completion is a property of the BUILDING,
so per-property storage would drift between units of the same ЖК; deriving buckets
from a date means they can change without a migration. Known weakness to weigh then:
only listings with a `residential_complex` FK become filterable, and the ЖК catalogue
is incomplete.

### ⛔ Approved deviations from the mockup — do not "fix" back

No Продажа/Аренда segment (`DealType` has only `sale`); the submit button is a static
«Показать объявления» (a live count would refetch the whole unpaginated set per edit;
a `?count_only` endpoint is the future improvement); area filters in «Ещё фильтры»
are real per-type inputs, only Этаж/Срок сдачи were ever «Скоро».

- **Page size is 9** (`CATALOG_PAGE_SIZE`) — the mockup's 3×3 grid. Was 12, corrected
  by the owner.
- **«Цена снижена» is ON THE PHOTO, top-left** (reversed 2026-08-04 to mockup-exact),
  and **both** action buttons (heart, then compare) are grouped in ONE top-right flex
  row at 44px. This reverses the old "opposite corners" card decision.
- **Hero parity rule:** every value the hero `SearchBar` can emit must be expressible
  by the panel/sheet — which is why ROOMS_OPTIONS has an exact «4» and MARKET_OPTIONS
  has «Иное». A hero-only value renders a working filter whose panel control displays
  «Любое» — a live desync, not a hostile-URL edge case.
- **The mobile filter sheet is PORTALED to `document.body`** so it can `inert` its
  siblings while open (a Tab trap never binds a screen reader's virtual cursor). **Do
  not move it back inside the page tree** — `inert` would then hit an ancestor of the
  sheet itself.
- Price digits from the URL are capped at `PRICE_MAX_DIGITS` (12), the same limit the
  inputs enforce; **all** grouped numbers go through `formatPrice.ts` (ASCII-space
  convention). A mapper calling `Intl.NumberFormat` directly is how U+202F reached
  the cards.
- **SEO landings prefill the panel** via `landingImpliedSearchRecord`, so chips and
  panel reflect the route's filters and any interaction continues on /catalog with
  that state carried over. ЖК landings map to city-only (the panel has no ЖК filter).
- **Accessible dropdowns:** `CatalogSelect` (APG select-only combobox — focus stays
  on the trigger, `aria-activedescendant`, typeahead) and `CatalogDistrictCombobox`
  (editable, two-table Микрорайоны/Районы groups, disabled until a city is chosen).

---

## Articles and district guides

### ⛔ Structure comes from SCHEMA FIELDS. `Article.body` / `DistrictGuide.body` NO LONGER EXIST.

- **Article:** `intro` + `ArticleSection` rows (`heading`, `text`, `order`) +
  `conclusion_title` / `conclusion`. **`conclusion_title` is a free CharField
  defaulting to «Вывод»** — not an enum — because one real article ends «Совет», and
  whatever is typed is what the «Главное» card prints.
- **DistrictGuide:** **SIX** fixed named fields — `intro`, `housing`,
  `infrastructure`, `audience`, `caveats`, `conclusion`. Fixed, not repeatable,
  because every guide has the same shape and ~90 are written by one non-technical
  author. **Each field's `verbose_name` IS the heading the page prints**, so there is
  no second list to keep in sync.
- **`DistrictGuide.SECTION_FIELDS` is the one ordered list** driving
  `section_texts()`, `rendered_text_parts()` and therefore `word_count`. **Adding a
  seventh section means five wiring points** — `SECTION_FIELDS`, the admin
  `fieldsets`, the detail serializer, and on the frontend the type + `mapGuide()` +
  **`guideSections()`** (which produces both the TOC and the headings). **The heading
  strings in `guideSections()` must stay byte-identical to the Django
  `verbose_name`s** or the index card's clock disagrees with the page's.
- **`intro` renders with NO heading** and contributes no TOC entry — the H1 already
  names the subject.
- **An empty field is omitted entirely** — no heading, no gap, no TOC row. The
  serializer also drops any section whose heading OR text is blank.

### ⛔ HEADING DETECTION IS GONE. Do not reintroduce it.

`lib/articleContent.ts` is now **paragraph-level only, within one section's text**:
blank-line paragraphs, `- `/`— `/`– `/`• ` and `1. ` lists (the lead-in may share the
paragraph), «Важно: » callout, `> ` quote.

The old heuristic (short line, no terminal punctuation → h2), the explicit
`##`/`###` markers, and the "last section named Вывод/Совет/Итог/Главное is the
takeaway" rule are **all deleted**. A short line without a full stop is now just a
paragraph. **The point is that two authors writing the same text get the same page,
and that a heading cannot be silently lost by forgetting a convention.**

- **Bullets accept the em dash `— `** because it is the natural Russian habit: all 24
  district guides were written with it `[measured]`, and the owner chose one regex
  over 24 text edits plus a retrained habit for the ~90 guides still to come.
- **Parser, `help_text` and `docs/articles-writing-guide.md` change together.**

### ⚠ READING TIME HAS EXACTLY ONE DEFINITION, and it is in TypeScript

`DistrictGuideListSerializer` omits `body`-equivalent text (too heavy for ~90 guides)
and sends **`word_count`** — a **measurement**. The rate, the min-1 floor and the
rounding all live in `articleContent.ts` (`readingTimeFromWordCount`).

**Do not add `reading_minutes` server-side** even with a shared constant: the
algorithm would still be duplicated, and Python's banker's `round()` disagrees with
JS `Math.round` at exact .5. Python's `str.split()` equals
`trim().split(/\s+/).filter(Boolean)`, so the counts agree **by construction** —
verified `[measured]`: index card minutes == detail page minutes for all 25 guides.

This is also why guide cards show **no clock** rather than a fabricated number.
**Do not "fix" that by adding full texts to the guide list payload.**

### `Article.category` values ARE the public URL slugs

`ArticleCategory` in `backend/articles/choices.py`, mirrored by `ARTICLE_CATEGORIES`
in `frontend/src/lib/articleFilters.ts`. **Treat both lists as append-only** —
renaming a value breaks shared `?category=` URLs.

### Shared components — differences travel as DATA, never as a second component

- **THE editorial card is `components/articles/ArticleCard.tsx`** — the /articles
  grid, «Другие статьи», the homepage «Статьи» section **and** the /districts guide
  grid all render it. `ArticlePreviewCard`, `ArticleCatalogLinksBlock` and
  `DistrictGuideCard` were **deleted**. `ArticleCardData` carries `href`, optional
  `eyebrow`, optional `minutes`, optional `ctaLabel`, and each domain supplies its own
  mapper. Both mappers **STRIP the body** — don't pass full texts as client props.
  **If a fourth surface needs the card, add a mapper, not a variant.**
- **THE index layout is `components/editorial/EditorialIndexExplorer.tsx`** —
  /articles and /districts render the same component, generic over the page's state
  type. Each route supplies `hrefOf`, per-facet `valueOf`/`apply`, and `withPage`.
  **⚠ Those are FUNCTIONS, so a Server Component cannot pass them** — hence the thin
  `"use client"` wrappers. (See `nextjs-and-react.md`.)
- **THE long-form layout is `components/articles/ArticleReadingPage.tsx`** — both
  `/articles/[slug]` and `/districts/[slug]` render it, so each page file is just data
  + composition. Differences arrive as props (`eyebrowHref`, `backHref`, `cta`,
  `after`) — **do not fork it.**
  - **⚠ The 3-column grid is CONDITIONAL on having a TOC** (`toc.length >= 2`). With
    no headings the rail column must not be reserved, or the body sits behind an
    empty 264px gutter — which is every one of the 24 current guides. **In the no-TOC
    branch the column is `max-w-[680px]`, not 720**: it must equal the body's own
    measure or the text lands 40px left of true centre.

### ⚠ Featured exclusion must NOT be page-gated, only the RENDER is

Deciding `gridSource` per page gives page 1 and page 2 different source lists, so
slice boundaries slide across the page break `[measured]` — /districts page 2 showed
10 cards instead of 8. **Exclude leads from the grid on EVERY page; pass
`featured={page === 1 ? … : []}`.**

- The /articles featured card is the **newest** article; no "pinned" model flag
  exists. Page size 14 = one full pass of the desktop card-span rhythm.
- The /districts leads are the two city **overview** guides, not "the newest" —
  every guide shares a publish date, so recency is meaningless there. With a KIND
  filter active there is **no lead at all** (the reader is slicing by type, so an
  overview is just another result).
- **Chip counts are computed from the full list — never hardcode.** On /districts
  they are **narrowed by the OTHER facet's active value**, so a chip always predicts
  what clicking it yields.
- **City chips REPLACED the group headings** on /districts: both at once restates the
  same fact, and the span-rhythm grid needs ONE continuous list.

### ⛔ Deliberate deviations from the article mockup

Meta text uses `fg-muted` and featured meta is white/70 — **the mockup grays measure
~2.6:1, below WCAG AA**; the drop cap is CSS `::first-letter`, not the mockup's
duplicated `aria-hidden` span (screen readers would read a broken word); scroll-spy
and reveals use position sweeps, never IntersectionObserver (documented ban); the TOC
anchor offset is 76, not the mockup's 92 (compact header).

### The copy notice appends © text to the CLIPBOARD

`ArticleCopyNotice.tsx` is mounted from `ArticleReadingPage`, so it covers exactly
`/articles/[slug]` and `/districts/[slug]`. **It renders NOTHING** — the component
returns `null` and only installs a `copy` listener.

- Wording cites **ст. 1259, 1270 и 1274 ГК РФ** — 1274 (lawful citation with
  attribution) is there on purpose, so the notice tells a reader how to comply
  instead of only forbidding. **ст. 1301 (компенсация) is deliberately NOT cited** —
  a damages threat on every copied sentence reads as hostile. Owner-approved.
- **⭐ THE TEST IS INTERSECTION, NOT CONTAINMENT — do not "tighten" it back.** The
  first version required the selection to sit *inside* the column, which meant
  **`Ctrl+A` bailed and the entire article left clean** `[measured]`. `Ctrl+A` →
  `Ctrl+C` is the single most likely bulk-copy path. **Accepted cost, stated by the
  owner:** a selection spanning chrome and body carries the notice along with that
  nav text — far smaller than a whole article leaving clean. Selections lying
  entirely outside the column stay clean `[measured]`.
- **It is mounted LAST on purpose** — `useId()` encodes tree position, so inserting
  it earlier would shift every later consumer's id.
- `cut` is deliberately not listened for (it only fires in editable contexts).
- **⚠ "byte-identical source" is the WRONG claim for a `"use client"` component.**
  Rendered markup is byte-identical once `<script>` blocks are excluded, but full
  view-source is **+487 chars** inside Next's RSC bootstrap payload where the client
  module gets registered. Unavoidable for ANY client component — but say "rendered
  markup", never "source".

---

## Features

### Price history

- **`PriceHistory`** — `property` FK (CASCADE), `price`, `changed_at`
  (auto_now_add + indexed), ordering ascending.
- **Auto-tracked via a `post_save` signal**: seeds one "listed at X" row on create;
  appends a row on update **only when the price differs** from the latest entry.
  Skips `update_fields` saves that don't touch `price`. `Property.save()`'s internal
  re-save of title/slug uses `QuerySet.update()`, which emits **no** `post_save` — so
  no double-counting. **Relevant if you touch `Property.save()` again.**
- **⭐ `is_price_reduced` = current price < PEAK (max) historical price — NOT vs. the
  immediately-previous price.** A genuine markdown should still read as «цена
  снижена» after a small later bump. **Any future feature reading price trends must
  reuse this peak-based definition.**
  - List endpoint uses a `peak_price=Max(...)` **annotation** — **no N+1** (constant
    2 queries regardless of row count). If the annotation is absent the method
    returns `False` rather than firing a per-row lookup.
- **`PriceHistoryChart.tsx` is a hand-rolled inline SVG chart — deliberately NOT
  recharts/d3/chart.js.** None were already a dependency, and adding one risks the
  documented flaky-npm-on-pCloud install problem. **Follow this precedent for future
  simple charts.** Renders nothing with `< 2` points.
- **Backfill:** existing properties got one seeded row via data migration
  `0025_backfill_price_history`, so the badge logic has a baseline.

### Old price and badges

- `old_price` and `market_type` are on the list serializer. **Why exposing them is
  safe** (asked and answered before shipping): `market_type` was **already** a public
  filter param on the same endpoint, so the value was publicly derivable; `old_price`
  is a display concept and the detail endpoint already publishes the FULL
  `price_history`, which reveals strictly more. The genuinely private fields
  (`owner`, `real_latitude`, `real_longitude`) carry explicit "never expose" markers
  in `models.py` and stay out.
- **A lower or equal `old_price` must NOT be struck through** — that is not a
  markdown. The guard lives in `publicPropertyList.ts` so the card never has to judge.
- **`is_new` is DERIVED, never stored**: `published_at` within `NEW_LISTING_DAYS` (7),
  computed server-side in both serializers so every consumer agrees. No migration, no
  field to fill, no toggle to forget — **the badge ages out on its own.**
- **ONE badge slot on the photo, and «Цена снижена» WINS it.** The other corners are
  taken (top-right heart+compare, bottom-left market), so a second badge would be a
  fourth overlay. Price-drop takes precedence: it is the stronger buying signal and
  the only one not conveyed elsewhere (recency is already carried by the default sort
  and list position). `is_price_reduced` and `old_price` are **independent** — either
  can appear without the other.

### Favorites and Compare

Both are **fully client-side, localStorage-based, with no backend changes** —
deliberately the same architecture, for consistency and lower risk. **If a similar
"select N items across pages, persist client-side, view together" feature is needed
again, mirror this rather than building something new.**

Compare's differences from Favorites, worth knowing before touching either:

- **Each stored entry is `{slug, type}`**, not a bare slug — storing the type lets
  constraint checks (same-type-only, max 4) run **without re-fetching**.
- **`toggleCompare()` returns a structured `{ok, reason, message}`**, so the UI can
  surface a specific blocked reason instead of failing silently.
- **⛔ Conflict UX = BLOCK the add with a transient inline message (2.5s), never
  silently replace the existing selection.** Explicit product decision — don't change
  it to auto-replace without checking.
- **Comparison table:** properties as columns, attributes as rows, reusing the same
  field set as the detail page. Rows with **no data anywhere** in the compared set are
  hidden entirely rather than shown empty. Lowest price / price-per-m² is highlighted.
- Same-type-only is enforced **at the point of adding**, not as a filter on the page.
- The floating bar shows at **≥2** items. Comparing a single property shows the
  **empty state** by design — that is not a bug.

---

## ⭐⭐ AREA UNITS ARE PER-FIELD, and the unit must travel with the value

**RULE: never write a bare `м²` next to an area. Every area is formatted by
`formatArea(value, field)` from `lib/propertyArea.ts`, whose unit table
`AREA_FIELD_UNIT` is keyed by the MODEL FIELD the number came from — not by property
type, and never by a default.**

A land plot entered as **8 соток** rendered on the card as **«8 м²»** — a 50 000 000 ₽
plot the size of a bathroom. The instinct is to call it "the wrong field was read". It
was not: the mapper read `land_plot_details.land_area` correctly. **The bug was one
step later** — four differently-united fields were **flattened** into one bare
`area: number`, and the card appended a hardcoded « м² » to whatever arrived.

**So the fix is not a land branch — that just relocates the default.** The mappers now
emit `areaField` beside `area`, and the card **renders nothing at all when
`areaField` is missing** rather than guessing a unit. Adding a new area field requires
extending `AreaField`, and TypeScript refuses to format it until it also appears in
`AREA_FIELD_UNIT`.

- **Stored data was correct** `[measured]` — display only; nothing needs a migration.
- **⚠ THE SAME BUG HAD A SECOND HEAD: `₽/м²`.** `CatalogExplorer.pricePerM2` divided
  price by area with no type check, so a land plot got a figure off by a factor of
  100. Now gated by `isSquareMetreField`. `CompareView` had always guarded this; the
  catalog card had not. **Guard every price-per-area figure.**
- **⚠ BOTH MAPPERS NEED IT — the list one is not enough.** `/favorites` fetches each
  property individually through the **detail** mapper, so fixing only the list mapper
  left favourites rendering with **no area at all** `[measured]`. That was the
  fail-safe behaving correctly, and it is why "no field ⇒ render nothing" beats a
  default.
- **A house has two areas in two units** — `house_area` in м² and `land_area` in
  соток. The card shows both, the plot prefixed «участок».

**The type indicator leads the spec row** (Квартира / Дом / Участок / Коммерция),
using the existing singular labels in `PROPERTY_TYPE_LABELS`, re-exported as
`CRM_PROPERTY_TYPE_LABELS` so there is **one vocabulary**. **Placement, and why not a
badge:** all four photo corners are spoken for, so a fifth overlay would fight one of
them and sit on grey on photoless cards. The spec row is in the card **body**, so it
cannot collide with any badge however many a card carries.

```
Квартира · 1-комн. · 45 м² · 8/8 эт.
Дом      · 142,5 м² · участок 6 сот.
Участок  · 8 сот.
Коммерция · 310 м² · 1/5 эт.
```

---

## Sale request → property conversion

Opened as `/account/properties/new?fromSubmission=<id>`; `CrmPropertyFullForm`
fetches the sale request client-side and seeds state. **The endpoint has always
returned everything below — the gaps were in the mapping, not the API.**

| Submission field | Goes to | Note |
| --- | --- | --- |
| `city` / `district` / `neighborhood` | same FKs | dependent selects self-populate off `cityId` |
| `address` | `public_address_text` | **was dropped** — the realtor retyped the owner's address |
| `latitude` / `longitude` | public + real coordinate pairs | **was dropped** |
| `description`, `property_type` | same | |
| `area` | `area_total` (кв) · `house_area` (дом) · `land_area` (участок) · `area_total` (коммерция) | **was apartments-only**, so a house's площадь vanished |
| `rooms` | `rooms` — apartments only | `HouseDetailsForm` has no rooms field |
| `asking_price` | `price`, **labelled as the owner's** | see below |
| `owner_name` / `owner_phone` | the review panel + `OwnerModal` prefill | CRM-only; never the public listing |
| `photos` | copied to `PropertyPhoto` **server-side** | see below |

**Property fields with NO source in a submission** — the realtor must supply them and
validation correctly insists: `land_area` and `floors_total` for a house,
`short_description`, ЖК, street/house number, agency contact phone.

- **⚠ THE OWNER'S ASKING PRICE IS NOT THE LISTING PRICE.** It is pre-filled (retyping
  is worse) but carries an amber note naming it as the owner's figure, and is kept in
  its own state so the note survives edits to `price`.
- **The «Заполнено из заявки собственника» panel lists what was carried** — the
  realtor is REVIEWING these values, so they are named rather than silently applied.
- **No migration was needed** — `Property` already has `public_address_text` and both
  coordinate pairs.

### Photos are COPIED SERVER-SIDE by `mark-converted`

`_copy_photos_to_property` reads each `SaleRequestPhoto` through the storage API and
creates a `PropertyPhoto` with **its own new file**, inside the same transaction that
marks the submission converted. Chosen over the previous approach, which had the
BROWSER download every photo and re-upload it:

- megabytes through the client, for files the server already has;
- **under R2 the media URL is cross-origin**, so `fetch` would be blocked by CORS and
  the photos silently dropped — the old code swallowed per-photo failures;
- a copy means nothing acting on the property can reach the submission's files.
  **Never point a `PropertyPhoto` at the submission's stored path** — deleting or
  re-saving the property deletes from storage, and this project has already lost a
  real listing's derivatives that way.
- **⚠ The «at least one photo» rule had to learn about them.** With the copy moved
  server-side the form has zero staged photos at submit time, so the check is now
  `stagedPhotos.length > 0 || submissionPhotoCount > 0` — otherwise the realtor is
  made to re-upload exactly the photos this work removed.
- Idempotent: copies nothing if the property already has photos.
- **⛔ ORDER MATTERS (fixed 2026-10-25):** `mark-converted` must run BEFORE the
  realtor's own staged photos are uploaded, because of the idempotency guard above.
  `finishCreate` in `CrmPropertyFullForm.tsx` does it in that order for both create
  paths (it used to upload first, which silently dropped the owner's photos, and
  one path never called `mark-converted`). Copies are capped at
  `MAX_PHOTOS_PER_PROPERTY` and the first one becomes main. A property holds at
  most 10 photos in total; the form reserves room for the owner's photos.

---

## Realtor profiles are a TEMPLATE

- **`is_public` («Показывать на сайте») is ENFORCED** in `PublicRealtorDetailView`.
  It was editable in three interfaces and checked by **none** — every active realtor
  was public regardless, so the checkbox actively misled.
- **Every new realtor gets a profile row with `DEFAULT_REALTOR_BIO`** via a
  `post_save` signal on `User` — **a signal, NOT a CRM-serializer hook**, because
  realtors are created through the CRM panel, Django admin **and** the shell, and only
  a signal covers all three (proved for each path). `is_public` keeps its `False`
  default, so a new realtor is a **draft** until the superadmin tailors and publishes.
- **⚠ The CRM create form posts an EMPTY `short_bio`, which would wipe that
  default.** `RealtorCrmWriteSerializer.create()` therefore drops an empty
  `short_bio`; on UPDATE an empty value is respected (clearing is deliberate there).
- **The bio is STORED, not a render-time fallback** — the superadmin has to SEE the
  text in the CRM to edit it before publishing. It is four paragraphs on purpose;
  `splitBio` maps them to lead / intro / blocks / closing, and the closing paragraph
  is what the CTA band renders. It says «Напишите», not «Напишите или позвоните»,
  because a realtor may have no phone.
- **Anything linking to `/realtors/<crmId>` MUST gate on `is_public`**, or it links
  into a 404. `publicProperty.ts` only sets `realtorCrmId` when the flag is true — so
  **the id's absence IS the link's absence**, and no call site needs its own rule.
  **`realtor_profile_is_public()` in `users/models.py` is the single definition.**
  N+1 note: that flag reads a reverse OneToOne, so all three querysets
  `select_related` the profile.
- **Degradation, verified on a realtor with default bio + no photo + no phone + zero
  listings:** hero and CTA fall back from the phone CTA to «Связаться» (the page
  always keeps a primary action); the photo-less portrait uses the navy band gradient
  with white initials; the CTA fallback copy uses the **prepositional** city names
  («в Краснодаре и Геленджике» — the nominative form was a live grammar bug).

### ⛔ The realtor page's «Связаться» button is always rendered

Intentionally shown regardless of whether the realtor has a phone. The modal is
**form-based**, not phone-dependent, so gating it on phone presence would be wrong.
**Do not reintroduce phone-based conditional rendering without explicit confirmation.**

### ⛔ Never attribute property-scoped analytics to actions outside the property page

The realtor page's «Показать телефон» was wired to
`POST /api/properties/<id>/reveal_phone/` "to reuse counting and throttling". That
endpoint's unit of accounting is a **PROPERTY** — clicks on the realtor page were
logged against #18, which was never viewed, and 5 test clicks had to be hand-deleted.

**RULE: an endpoint's accounting scope must match the page's action.** If no
correctly-scoped endpoint exists, use **local state** (the realtor reveal is now a
pure `useState` flip with no network call) or build a new endpoint — **never borrow
another entity's.** Extra tell that borrowing was wrong: the number is returned in
cleartext by the realtor API and rendered elsewhere on the same page, so the "reveal"
was measuring nothing.

---

## Public forms and lead capture

### ⛔ 152-ФЗ consent lives in ONE shared component

`components/legal/ConsentCheckbox.tsx`, used by `PublicLeadInquiryForm` (itself
shared by the homepage card, the property-detail modal and the realtor contact modal)
and `SellPropertyForm`. **Those are the only two public forms that collect personal
data** — verified by grepping for the relevant field and endpoint names.

- **Unchecked by default, submit disabled until ticked**, with a matching `validate()`
  entry as belt-and-braces. Verified `[measured]`: a forced `form.requestSubmit()`
  without consent fires **no** POST.
- **⛔ Never add wording claiming the data is not stored.** It IS stored for the
  realtor to act on (see `/privacy` §2/§5/§7); such a claim would be false and
  legally worse than saying nothing.
- The policy link opens in a **new tab** on purpose (these forms live in modals;
  navigating away would discard everything typed) and calls `stopPropagation()` — it
  sits inside the `<label>`, so without that a click would silently toggle consent.

### Strict input formatting on the public lead form

- **Phone** — progressively masked to `+7 (XXX) XXX-XX-XX` as the user types, digits
  only, `+7` prefix non-deletable. Mid-typing shows only the entered portion (**no**
  underscore placeholders) — **desired behaviour, not a shortcut to fix later**.
- **Name** — letters (Cyrillic + Latin incl. ё/Ё) and spaces only; no digits, no
  hyphens. **Hyphenated names are intentionally rejected**; two-word names allowed.
- Both are frontend-strip **plus** backend validation as defence in depth.
- **Scoped to the public lead form only.** CRM/account forms are explicitly NOT
  covered and keep free-form input.

### ⚠ Don't let a reset/reload side-effect wipe the error you just set

The bot-check captcha showed the backend's error correctly, but the same branch then
called `loadCaptcha()` **unconditionally** — resetting the answer field and clearing
the just-shown error, so the question silently changed with no visible feedback.

**LESSON: in a submit-error handler, never call a reset/reload function
unconditionally alongside setting an error message.** Gate it to the specific error
conditions that need it — here, reload only when the captcha is expired/invalid,
**not** on a plain wrong answer.

---

## Integrations

### Telegram lead notifications

A Celery task (`leads/tasks.py: send_lead_telegram_notification`) sends a plain-text
message to a Telegram group via the Bot API, fired from `perform_create` via
`transaction.on_commit()`. Env vars in `backend/.env` (**not** committed):
`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `SITE_URL`.

- **Master switch:** `LEADS_NOTIFICATIONS_ENABLED`. The task no-ops safely if the
  flag is off or credentials are missing — a failed send never affects lead creation.
- Triggered via `.delay()`, so it **requires a running Celery worker.**
- Modeled on the sibling project `real-estate-platform-lp`, where it is a synchronous
  Next.js API route (no database/Celery there).
- **Known limitation:** verified only to the task-enqueue boundary in this
  environment — true end-to-end delivery needs a live worker and real credentials.

### Lead source tracking

**This was NOT a backend gap.** The `Lead` model already had a nullable `property` FK
and both forms were already sending/omitting it correctly. The only missing piece was
**UI** — the «Заявки» table didn't display data the API already returned.

**LESSON: before assuming a feature needs new backend work, check whether the data is
already captured and just isn't displayed.** Grep the serializers and existing API
responses first. This saved a full backend implementation cycle.

---

## SEO

**The `Article` model has NO `meta_title` / `meta_description` fields** — `<title>`
and `<meta description>` for `/articles/[slug]` and the JSON-LD are derived
frontend-side in `lib/articleSeo.ts` from the **title** and **excerpt**. So anyone
adding an article via `/admin/` does not need to think about SEO fields; writing a
good title and excerpt is what drives the meta tags. Adding manual overrides would
need a migration + serializer + wiring.

Article detail pages emit **Article** JSON-LD only — a visible breadcrumb nav but
**no** `BreadcrumbList` block, unlike property pages, which emit both `Product` and
`BreadcrumbList` through the same `<JsonLd>` component as an array.

---

## Known open items

- **The favourites count badge re-breaks the 1024–1079px header fit band** —
  deliberately not fixed (owner decision; the header is off-limits). Details and the
  re-measurement warning are in `frontend-tailwind.md`.
- **~12 test failures in `users/tests.py`** — the same missing `city`/`district`
  fixture pattern already fixed in `leads/tests.py`. See
  `testing-and-verification.md`.
- **The full Krasnodar ЖК list is incomplete** (~130 exist on Cian, which blocks
  scraping) — needs manual data from the owner.
- **`TZ_Объекты.docx`** describes a 16-step property form spec — reviewed, not
  implemented.
- **SEO landing routes do not support targeting a specific neighborhood** — only
  districts. See `address-and-geo.md`.
- **Deleting a row does not delete the stored media object** — a real cost/PII issue
  for production with nothing built to fix it. See `media-and-images.md`.
- **`infrastructure` is empty on 20 of 24 district guides, and that is CORRECT** —
  only 4 guides actually say anything about it. An empty field renders nothing, so
  the page is honest, and the gap doubles as the author's to-do list. **Do not "fix"
  this.**
- **The 24 pilot guides are unstructured prose** — lists work (em dash), but 0
  headings and 0 «Вывод» blocks, so no TOC and no takeaway card until the text is
  edited. Not a code bug; recorded in `docs/articles-writing-guide.md` §10.

---

## Unread counters for заявки (2026-09-01)

Two streams, realtors only: **«Заявки»** (property inquiries = `Lead`) and
**«Заявки на продажу»** (`SaleRequest`). The rules live in CLAUDE.md; this file
holds the domain findings and the one open gap.

### How inquiries reach a realtor (measured, not assumed)

`PublicLeadViewSet.perform_create` sets `assigned_realtor` from exactly two
sources:

| public form | who gets the lead |
| --- | --- |
| property page (a `property` is posted) | `property.assigned_realtor` — and `Property.save()` REFUSES to save without one, so this branch always names a realtor |
| realtor page (`assigned_realtor_crm_id` posted) | that realtor |
| **homepage / generic form** (neither) | **nobody — `assigned_realtor` stays NULL** |

`[measured]` 2026-09-01 in `real_estate_db`: 7 leads, **5 with
`assigned_realtor IS NULL`**, all 5 with `property_id IS NULL` — i.e. every one
of them came from the generic form. The other two belong to realtor id 3.
`Lead.assigned_realtor` is also `on_delete=SET_NULL`, so deleting a realtor
orphans their leads into the same state.

### ✅ CLOSED 2026-10-18: unassigned leads are now a shared queue (option 1)

The owner chose option 1 below, and extended it to sale requests. A realtor's
queryset is now **own + free** (`assigned_realtor IS NULL`) for both leads and
sale requests. Free items are look-only until «Взять в работу» (atomic
conditional UPDATE, 409 for the loser), and the counters follow the same
functions, so homepage leads now count for every realtor who can open them.
Sale requests stopped being a "shared pool forever": once taken, other
realtors no longer see one. The rules, the notification bell and the
superadmin role rule live in CLAUDE.md → «Lead queue + notification bell».
The section below is kept as the history of the decision.

### (history) unassigned leads were in NOBODY's unread count

`crm_lead_queryset_for_user` gave a realtor **only** `assigned_realtor=self`, so
a realtor could not list or open an unassigned lead at all — only staff could.
The counter was deliberately built on that same function, so those 5 leads
counted for no realtor.

**This is a visibility gap that predates the counter, not something the counter
introduced.** Counting them for a realtor would put a badge on a row that 404s
when clicked, which is the worst failure mode a counter has. Today the only
signal for a homepage lead is the Telegram notification.

Options if the owner wants them covered — **none of them implemented, all need a
decision because each changes the access model:**

1. **Shared pool for unassigned leads** — let every realtor see leads with no
   assignee (what sale requests already do). Smallest change: one `Q` in
   `crm_lead_queryset_for_user`; the counter follows for free. Question for the
   owner: should every realtor see every unclaimed client's phone?
2. **Auto-assign on arrival** (round-robin, or a default realtor). Makes the lead
   someone's job, which is probably the real product answer, but needs a rule for
   who and what happens when they are away.
3. **A staff-side counter** for admins/superadmins over the unassigned pool.
   Contradicts «realtors only», so it would be a second feature.
4. **Leave it** — Telegram already fires on every public lead.

### Decisions closed here

- **Read is permanent.** An edit to a lead or sale request does not resurrect it
  as unread. Re-notifying on edit was considered and NOT built: a realtor
  correcting a typo in a submission would re-alert every other realtor, and the
  status workflow already carries "this changed".
- **Role `admin` is treated like `superadmin`** — no indicator. Both are
  staff-level (`has_staff_level_access`) and see the whole pool. There are zero
  `admin` users today, so this is untested against a real one; flipping it is one
  line in `common/crm_unread.py: user_gets_unread_indicator`.
- **Superadmin and admin are not part of the lead workflow** (owner, 2026-10-18):
  no notifications, no take/return, never auto-assigned; they keep oversight
  and their old abilities. `user_gets_unread_indicator` and
  `crm_notify.is_workflow_realtor` both mean "active realtor".
- **The inquiries table's own 15s poll no longer plays a sound.** It still
  highlights new arrivals for 45s (a session-local *arrival* marker, unrelated to
  the persistent *read* state). The sound moved to the single count store so the
  per-realtor mute switch cannot be bypassed and the page cannot double-ring.

### ⚠ Pre-existing, found while testing, NOT fixed here

`SecuritySummaryBand` on `/account` fetches `/api/auth/security-summary/`
unconditionally, but the endpoint is `IsSuperAdmin`. Every realtor loading the
cabinet dashboard therefore logs **two 403s** in the browser console
`[measured]`. Harmless — the band renders nothing on failure — but it is console
noise that makes a real error hard to spot, and it means any future "no console
errors" assertion on `/account` fails for reasons unrelated to what it tests.

---

## Agency phone in the header (2026-09-01)

**Single source of truth: the `HomepageTextBlock` row keyed `agency_phone`.** See
the root `CLAUDE.md` for the storage/permission summary and the warning against
binding this to `Agency.phone` or `User.phone`.

### Why the existing key-value table, and not a new model

`common.HomepageTextBlock` is this project's **only** key-value config mechanism:
predefined keys, seeded by migration, one anonymous public GET and one CRM PATCH.
A `SiteSettings` singleton for one field would have been a second source of truth
on day one. Two minimal widenings were needed because a phone is not copy:

- **`SUPERADMIN_ONLY_TEXT_BLOCK_KEYS`** — the PATCH view re-uses
  `users.permissions.IsSuperAdmin` for those keys. Homepage copy keys keep
  staff-level access, unchanged and regression-tested.
- **`PHONE_TEXT_BLOCK_KEYS`** — the serializer normalises through
  `common.phone.normalize_ru_phone` and rejects anything else with a Russian
  message. The key comes from `self.instance`, never from the request, so it
  cannot be used to select a laxer branch.

`normalize_ru_phone` is **deliberately not** applied to the three existing
hand-rolled validators (leads / owners / submissions). Those keep the raw typed
string on purpose — they record what a caller dictated. This module is for values
the platform **publishes**.

### ⚠ The header is at capacity — the phone's breakpoints are MEASURED

The desktop row already needs ~1047px at `lg` with one favourite present (the
documented open bug). So the phone appears only where it fits. `[measured]` on
`/catalog`, 360→1600 in 20px steps, plus 375/768/1024/1280/1440 across
logged-in/out × favourite/none:

| viewport | what renders | why |
| --- | --- | --- |
| **360–639** | nothing in the bar; the number is the **first row of the MobileNav panel** (48px tap target, brand blue) | at 375 a LOGGED-IN header with the icon measured **392px** — the account chip is 164px vs the logged-out button's 81px. Visibility of a server-rendered element cannot depend on client-side login state, so the safe width wins |
| **640–1023** | 44px phone **icon** beside the hamburger | fits in every state |
| **1024–1139** | **nothing** | genuinely no room. Adding anything here makes the known overflow worse — the icon at 1100 measured **1121px** with one favourite |
| **1140–1279** | 44px phone **icon**, inside the nav `<ul>` before the CTA | first width where the icon fits with a favourite present |
| **1280+** | **full number** `+7 (928) 333-08-37` (173px), icon + text | 0 overflow in all four states |

- **Result `[measured]`: 63 widths swept, 0 overflowing.** The only offenders in
  the full matrix are `logged-out + favourite @ 1024 and 1040 → 1047px`, which
  reproduce **identically with the phone cleared** — pre-existing, not caused here.
- **To free the 1024–1139 band, fix the badge bug first** (hide the count below
  1100, or raise the desktop-nav breakpoint). Do not squeeze the phone in.
- **⚠ Re-measure WITH a favourite AND logged in** if you retune any of this —
  both widen the row, and the fit band was originally tuned against neither.

### Rendering details

- `HeaderPhone` is a **server component**; `Header` is `async` and awaits
  `fetchAgencyPhone()`, which shares the homepage text-blocks fetch (same URL,
  `revalidate: 60`) — free on `/`, one small cached JSON elsewhere. The number is
  in the SSR markup `[measured]`, so there is **no layout shift**.
- Brand blue `rgb(26, 95, 224)` = `#1A5FE0`, weight 600, on the header's own
  background. **The CTA remains the only filled control in the row**, so it stays
  unmistakably the primary action `[measured]` — same background colour, different
  weight of treatment.
- **The conditional lives on the wrapper `<li>` / `<div>`, never inside
  `HeaderPhone`.** A rendered-but-empty flex child would still consume the row's
  `gap`. With the phone cleared: 0 `tel:` links, 0 empty wrappers, and
  `scrollWidth` identical to baseline at every width `[measured]`.
- **⚠ `formatPhoneParens` is a SECOND display form, deliberately.** `formatPhone`
  renders `+7 928 333-08-37` (spaces) on the realtor page; the header and every
  phone input mask use the bracketed form. Unifying them is a one-line change in
  `lib/phoneFormat.ts` plus a realtor-page re-measure — worth doing, not an accident.

### Propagation and gotchas

- A change reaches the header **without a redeploy**, bounded by the 60s
  `revalidate` window. `[measured]` in dev: set → visible after **7s**, cleared →
  gone after **17s**. Warm the URL a few times before concluding it is broken.
- **⚠ A CRM fetch path MUST start with `/api/`.** `crmBrowserApiUrl` returns
  anything else **unchanged**, so a shorter path silently hits the Next.js app and
  returns 404 HTML — which surfaces as a generic save failure. This cost a
  debugging cycle here.
- **⚠ The `(cabinet)` layout gates on the access COOKIE server-side.** A test that
  only sets `localStorage` lands on `/account/login` and measures the wrong page —
  set the cookie on the browser context so it exists on the first request.

### Verified `[measured]` 2026-09-01

| Case | Result |
| --- | --- |
| Superadmin sets `8 (928) 111-22-33` | 200, stored `+79281112233`, header renders `+7 (928) 111-22-33` |
| Superadmin sets `+7 (928) 333-08-37` | 200, stored `+79283330837` |
| Change appears with no redeploy | 7s |
| Clear (empty string) | 200, stored `""`, header clean after 17s, no gap, no empty wrapper |
| **Admin** PATCH | **403** «Изменять телефон агентства может только суперадминистратор.» |
| **Realtor** PATCH | **403** (caught by the outer staff check — layered) |
| **Anonymous** PATCH | **401** |
| Invalid `позвоните нам` / `+7 928 333` | **400**, Russian message, stored value unchanged |
| Panel visibility | superadmin sees «Контакты сайта»; admin and realtor do not |
| Backend suite | `common` **38/38 OK**, incl. 9 new; gate verified failable (403 → 200 when removed) |
