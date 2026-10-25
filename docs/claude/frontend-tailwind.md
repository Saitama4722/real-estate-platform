# Frontend layout, styling, Tailwind v4

Read before writing Tailwind v4 classes, z-index above a map, transitions or
animations, reduced-motion rules, `overflow-hidden`, responsive / mobile-overflow
work, or any change to shared chrome (Header / Footer / Container).

---

## Verifying that a utility actually compiles

An **invalid** v4 utility is dropped with **no error or warning**. The only reliable
check is the **compiled CSS**: fetch the dev server's own stylesheet
(`http://localhost:3001/_next/static/css/app/layout.css`) and grep it. There is no
Tailwind CLI in this project.

- **In v4 the selector is backslash-escaped** — search for `.z-\[1000\]`, not
  `.z-[1000]`, or a literal-string search comes back empty and looks like the class
  was dropped.
- **`max-w-screen-*` DOES compile** in the installed v4.3.2 `[compiled CSS]` —
  `.max-w-screen-2xl { max-width: var(--breakpoint-2xl); }`. An earlier note here
  claimed the opposite. **Still prefer `max-w-(--breakpoint-2xl)`** in new code: it
  names the theme token directly instead of relying on a legacy alias. The
  recommendation never changed — only the stated reason for it.

---

## z-index over Leaflet: use the bracket form `z-[1000]`

Leaflet map panes render at z-index ~400–600, so any overlapping UI (dropdowns,
modals, mobile nav) must be **1000+**.

**⚠ The reason matters, because the old explanation here was wrong.** It claimed the
scale "stops at `z-50`" so bare `z-1000` was invalid and compiled to an empty rule.
**That is false: `z-<number>` is a documented bare value in v4** — which is exactly
why the VS Code Tailwind extension offers to rewrite `z-[1000]` → `z-1000`. An
observed empty `.z-1000 {}` rule was a **build/version drift problem**, not an
invalid class.

- **RULE (unchanged, for a different reason):** keep using the **arbitrary-value
  bracket form** — `z-[1000]`, `z-[9999]`. Not because the bare form is invalid, but
  because the bracket form is **immune to that class of build/version drift** and
  states the intended value literally. Belt-and-braces, not a bug fix.
- **⚠ WATCH OUT:** IDE linters "canonicalize" `z-[1000]` → `z-1000` automatically
  (the extension raises `suggestCanonicalClasses`), silently reintroducing the
  problem. **Add an explanatory comment above any `z-[1000]`+ class you introduce**
  telling future editors not to apply that "fix" — the existing call sites carry
  one. If a dropdown or overlay stops appearing above other content, **check first**
  whether an arbitrary z-index got "cleaned up" into a bare one.
- Periodically grep for bare `z-1000` across the codebase to catch regressions.
- Leaflet's own CSS sets `.leaflet-container a { color: #0078A8 }`, more specific
  than a single Tailwind utility — override with the `!` suffix (`text-white!`).

---

## v4 animates `translate` / `scale`, NOT `transform`

`-translate-y-*` and `scale-*` compile to the **individual CSS properties**
`translate:` and `scale:`. Two consequences, both silent:

1. **A transition list naming `transform` does not animate them.** The hover state
   still applies — it just snaps. Real case: `transition-[box-shadow,transform]` +
   `hover:-translate-y-[3px]` on `PropertyCard` gave an instant 3px jump instead of
   a 250ms lift. Fix: name the real property, `transition-[box-shadow,translate]`.
2. **`getComputedStyle(el).transform` reports `none`** even when the element is
   visibly offset. Probe `.translate` / `.scale` instead, or you will conclude the
   utility "didn't apply" when it did.

`transition-transform` is **safe** — v4 expands it to
`transition-property: transform, translate, scale, rotate`. That is why a photo's
`group-hover:scale-[1.04]` animated correctly on the very card whose lift did not.

**RULE:** use `transition-transform`, or name the actual animated property.
**Verify with computed styles, not by eye** — a snap and a 250ms ease are impossible
to tell apart in a static screenshot.

---

## Reduced motion: cancel by CATEGORY, never blanket `transform: none`

The global `@media (prefers-reduced-motion: reduce)` block removes movement rather
than shortening it, in three scoped ways. Colour, shadow and focus rings always
still change — those carry meaning, not decoration.

1. **Keyframe animations → `animation: none`.** Not `animation-duration: 1ms`: a 1ms
   run still RUNS and lands on the keyframe's **end** state `[observed]`, so the
   hero icon field froze at full drift.
2. **Hover/focus transforms → cancelled at the component**, with `motion-reduce:`.
3. **The hero icon field → cancelled by class**, safe to hit with `transform: none`
   because those elements exist only to drift and do no layout work.

**⚠ NEVER add a blanket `transform: none !important` / `translate: none !important`.**
It is the obvious-looking fix and it breaks real layout: **Leaflet** positions map
panes and tiles with `transform: translate3d()`, so a global kill breaks every map
for reduced-motion users; and `SearchBar` centres a field icon with
`-translate-y-1/2`, which in v4 compiles to `translate` and would drop to the top.

**⚠ ANY element whose visible state comes from a keyframe must carry its END STATE
IN THE BASE STYLE.** Because animations are cancelled outright, a base `opacity: 0`
relying on a keyframe stays invisible **forever** under reduced motion — and also
with JS disabled or hydration broken. This is why the scroll reveal inverts the
design's own `.ctr-reveal{opacity:0}`: sections are **visible by default**, and the
hiding rule lives inside `@media (prefers-reduced-motion: no-preference)` **and**
requires a `.ctr-reveal-on` marker set after mount. Fail either → the page just
renders.

**Before adding any entrance animation, grep for `opacity-0` / `opacity: 0` and
confirm nothing depends on a keyframe to become visible.**

---

## Ancestor `overflow-hidden` clips absolutely-positioned dropdowns

**Symptom:** a dropdown has a correct `max-height` + `overflow-auto`, a correct
`z-[N]`, and correct styling — yet content past a point is cut off and unreachable
even though its own scrollbar exists. (Different cause from the z-index gotcha: here
the panel is being **clipped**, not un-raised.)

**Root cause:** an ancestor has `overflow-hidden` for an unrelated reason — usually
clipping decorative background gradients — and that also clips any
absolutely-positioned descendant extending past its bounds.

**FIX PATTERN:** if a section needs `overflow-hidden` **purely to contain decorative
elements**, do not put it on the section. Wrap **only** the decorative elements in
an `absolute inset-0 overflow-hidden pointer-events-none` wrapper and leave the
section unclipped.

**Fixed instance:** `HeroSection.tsx` clipped `SearchBar`'s District dropdown for
cities with long lists (Геленджик's last items became invisible). The catalog
`SearchBar` was unaffected — no `overflow-hidden` ancestor.

**CHECKLIST before adding `overflow-hidden` to any container:** does it contain (or
will it contain) a dropdown, tooltip, popover or overlay that might extend beyond
the bounds? If yes, scope the `overflow-hidden` to a decorative wrapper.

---

## Responsive work: check SHARED CHROME first

**A sitewide horizontal-scroll problem almost always has ONE root cause in a shared
layout component — not N per-page bugs.** The `Header` rendered its logo, nav, CTA
and account controls in a single non-wrapping flex row with no mobile breakpoint.
That row's intrinsic width became the **global minimum document width on every
page**: 712px public / 795px CRM at a 390px viewport. It looked like dozens of
per-page bugs and was one shared-component fix.

**Before writing per-page CSS patches for a responsiveness problem, inspect
`Header`, `Footer`, and any global `Container` wrapper.**

### The pass criterion is mechanical, not visual

A page overflows **iff `document.documentElement.scrollWidth > viewport width`**.
Equivalently, a `fullPage` PNG's width equals the document width, so a page is fixed
iff its 390px capture is exactly 390px wide.

- **⚠ A `getBoundingClientRect()` beyond the viewport is NOT necessarily overflow.**
  An element inside an `overflow:hidden` ancestor still reports its full un-clipped
  rect — the homepage hero icons report right=1045 at a 1040 viewport while
  contributing nothing to `scrollWidth`. **Trust `scrollWidth` for the verdict; use
  rects only to LOCATE the cause.**

### Sweep every 40px from 360 to 1600, not just at breakpoints

**Two real sitewide bugs sat BETWEEN the breakpoints** and survived every audit that
tested only 390/768/1024/1440:

- **Header overflow at 1024–1046px** `[measured]`: the desktop nav switches on at
  `lg` (1024) but the row's intrinsic width was 1047px. Fixed with a scoped
  1024–1099px fit band in globals.css compressing discretionary gaps only.
- **A 375px floor at 360px** `[measured]`: the logged-out «Вход в личный кабинет»
  ButtonLink is `whitespace-nowrap`. Fixed by collapsing the label to «Вход» below
  400px.

Sweep at least: the page under work, `/catalog`, `/articles`, and the homepage.

### ⚠ OPEN, deliberately unfixed: the favourites badge re-breaks the 1024–1079 band

With at least one favourite the nav reads «Избранное1» and the row's intrinsic width
returns to **1047px** `[measured]` — so `scrollWidth` is 1047 at viewports 1024 and
1040 on every page. 1080+ and empty-localStorage are clean.

- **Status: KNOWN OPEN ISSUE, deliberately NOT fixed** (user decision — the header
  stays off-limits until they say otherwise).
- Options when taken up: compress further inside the band, hide the badge below
  1100px, or raise the desktop-nav breakpoint above 1024.
- **⚠ The fit band was tuned against a BADGE-LESS header.** Any future header work —
  and any responsive sweep — must re-measure **with favourites present**, or it
  silently tests a narrower header than a real user ever sees.

### The mobile nav pattern

Hamburger button + full-width **dropdown panel**, not a slide-in drawer — a dropdown
needs no portal, no body-scroll lock, and reuses the existing outside-click idiom.
Desktop nav `hidden lg:block`; `MobileNav` is `lg:hidden`. **The switch is at `lg`
(1024), NOT `md`** — measurement showed the desktop row didn't fit even at ~795px.
**Pick the breakpoint from the measured width, don't assume `md`.** The panel closes
on link click, `Escape`, outside-click, and `usePathname()` change.

### Already responsive — do not "fix" again

`SearchBar` (`grid-cols-1 md:grid-cols-12`), the cabinet shell, all CRM/leads tables
(already `overflow-x-auto` — the "cramped" look was page-level overflow),
`CrmPropertyFullForm`, and all maps/charts. **CRM tables keep horizontal scroll on
mobile** (card-layout conversion is a redesign, explicitly out of scope) — just give
in-cell values that must stay on one line `whitespace-nowrap`.

---

## ⚠ A computed-style colour is NOT always `rgb()` — never regex it

Tailwind v4's opacity modifier on a theme colour (`bg-surface-dark/70`) compiles to
`color-mix()`, and `getComputedStyle().backgroundColor` returns
**`oklab(0.237 -0.009 -0.054 / 0.7)`** `[measured]`. An `rgba(...)` regex returns
null there, so a contrast probe either crashes or **silently skips the element —
reporting a PASS it never checked.**

Resolve any CSS colour through the browser instead: paint it into a 1×1 canvas and
read the pixel back (`ctx.fillStyle = css; ctx.fillRect(...)`; `getImageData` gives
straight sRGB + alpha for rgb, hsl, oklab and color-mix alike). Also **composite
semi-transparent fills over their opaque ancestor** before measuring contrast, or a
badge over a photo scores its text against the photo and falsely fails.

**A box-bottom delta is not a baseline delta.** Comparing
`getBoundingClientRect().bottom` of a 13px and a 20px font fails by ~2px even when
alignment is perfect — the smaller font has less descent. Assert the mechanism
(`align-items: baseline`) and allow a few px on the box edges.

---

## Component patterns

### Container width

The `/account` cabinet wraps pages in the shared `Container`, which defaults to
`max-w-6xl` (1152px) — that was clipping data-heavy tables. `Container` takes an
opt-in `size="wide"` prop (1536px), applied in `account/layout.tsx`. Public pages
using `Container` directly are unaffected.

### Searchable dropdown (combobox)

When a `<select>` has too many options to scan (District lists with 20+ items),
replace it with a **local searchable combobox**:

- Controlled text input + absolutely-positioned list, filtered client-side by
  **case-insensitive substring** — not prefix (typing "хот" must match "Джанхот").
- **Selection via `onMouseDown` + `preventDefault()`**, not `onClick`, so it fires
  **before** the outside-click-to-close handler.
- Outside-click via a `mousedown` listener on `document`, scoped with a `containerRef`.
- **No keyboard navigation by default** — add arrow/Enter support only if explicitly
  requested. (The catalog's `CatalogSelect` is a full APG combobox and does have it.)
- Overlay z-index `z-[1000]`, bracket form.

Reference: `DistrictCombobox` in `components/home/SearchBar.tsx`. **Reuse this
pattern** for any filter field that grows a long option list.

### Live thousands-separator number inputs

Pattern for "type digits, see them grouped" (`"1000000"` → `"1 000 000"`):

- `digitsOnly(v)` strips everything but `0-9` — **always sanitize on paste too**,
  not just on keydown.
- `groupDigits(raw)` **deliberately uses a plain ASCII space, NOT
  `Intl.NumberFormat("ru-RU")`** — that locale formatter uses a **narrow no-break
  space (U+202F)**, which looks like a space but renders and copies inconsistently.
  Build the grouping manually whenever the string is user-facing and copyable.
- **Cursor position: track the caret by DIGIT COUNT before it**, never string
  offset (which breaks as soon as spaces shift). Apply via `requestAnimationFrame` +
  `setSelectionRange` — setting selection synchronously during the same render gets
  overridden by React's DOM update.
- **State holds RAW DIGITS only**; the formatted version is derived for rendering.
- `inputMode="numeric"` for correct mobile keyboards.

Reference: `PriceInput` in `SearchBar.tsx` (local to that file). **If another money
input is needed elsewhere, lift this out into a shared component** rather than
reimplementing.

### Numeric-only fields use `type="text"`, not `type="number"`

Property characteristic fields use `type="text"` + `inputMode` + `onKeyDown`
filtering + `onChange` sanitizing. **`type="number"` was deliberately avoided** — it
natively allows `e`/`E`/`+`/`-`/`.` and silently empties invalid values. Since
`type="text"` loses native `min` enforcement, `min` is enforced **on blur** (not
every keystroke, which would disrupt multi-digit typing).

### Drop zone pattern (`components/crm/PhotoDropZone.tsx`, 2026-10-25)

A real `<button>` with a `sr-only` (not `display:none`) file input; `pointer-events-none`
on its children so dragging over them does not fire `dragleave` (flicker);
`preventDefault` on dragenter/dragover/drop; a window-level guard so a file dropped
beside the zone does not navigate away from an unsaved form. Use
`bg-[var(--field-bg)]`, never `bg-[--field-bg]` (v3 shorthand, invalid in v4).

### ⚠ `justify-center` + `overflow-x-auto` hides the overflowing start

A centred flex row that overflows scrolls only to the right; the left items are
unreachable. Use `ml-auto` on the first and `mr-auto` on the last child (centres a
short row, scrolls a long one from 0). Hit in the lightbox thumbnail row at 50 photos.

### `cn()` is a naive join, NOT tailwind-merge

Passing `items-start` alongside a hardcoded `items-center` emits **both** and lets
stylesheet order pick the winner. That is why `ui/checkbox.tsx` takes `alignTop` as
a **prop**, not a class.

### `.ctr-*` kits are unlayered and opt-in

`.ctr-control` beats any Tailwind `pl-*` utility regardless of order, because it is
unlayered — a utility class alone will not move padding on it. Extensions must be
peer `.ctr-control--*` classes. (Same reason the captcha's width lives on a wrapper
div.) The `.ctr-auth-*` kit is separate from `.ctr-field` (52px/r10 vs 48px/r12) so
an auth tweak cannot restyle every cabinet input.

**Chrome autofill defeat** (`.ctr-auth-control:-webkit-autofill`):
`-webkit-text-fill-color` + `box-shadow: 0 0 0 1000px … inset` + `caret-color` +
`transition: background-color 9999s`. **The focus ring must be STACKED onto the
inset shadow** or setting one drops the other.

### ⚠ A `@theme` token must NOT reference a PAGE-scoped `next/font` variable

`--font-article-serif: var(--font-literata), …` in `@theme` silently rendered the
whole body in Golos `[measured]`: `@theme` variables substitute their `var()` refs
at `:root`, where a detail-page-only font variable injected on a wrapper div does
not exist → the token computes to guaranteed-invalid → the utility no-ops with no
warning.

**Fix pattern:** keep a plain local stack in `@theme` and re-declare the token in a
scope class that lives on the **same element** as the font variable. If a serif body
ever renders in Golos again, check this first.

### The footer is FULL-BLEED with SQUARE CORNERS — do not "fix" it into a card

`[measured]` at a 1440 viewport: `left=0, width=1440, border-radius: 0px`. The inset
belongs to the **inner** container (`max-width:1200px; padding:56px 24px 28px`). The
rounded-card impression came from a component-preview page that frames the footer
inside a white padded body. Confirmed rejected by the user.

«Популярные запросы» is a **sitewide footer column**, not a homepage-only section.
`SeoLinksFooter` was deleted — **do not reintroduce it.**
