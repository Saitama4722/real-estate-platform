# Next.js App Router and React

Read before routing work, server-vs-client boundary changes, anything involving
`revalidate` / ISR, loading indicators, scroll-reveal, root-layout effects,
middleware, or URL-as-state pages.

---

## The RSC boundary

### Functions cannot cross it

Passing a Lucide icon — or any component or function — as a prop from a Server
Component to a `"use client"` component throws `Functions cannot be passed directly
to Client Components` `[observed]` and 500s the whole page in dev.

**RULE: pass the icon NAME (`iconName: IconName`) and resolve it inside the client
component** via the `Icons` registry. The registry type also keeps the name greppable
and typo-safe. Reference: `RealtorContactModal.tsx`.

The same constraint is why a generic shared explorer component cannot be rendered
straight from a server page: `EditorialIndexExplorer` is generic over its state type
and takes `hrefOf` / `valueOf` / `apply` / `withPage` **functions**, so each route
has a thin `"use client"` wrapper (`ArticlesExplorer`, `DistrictsExplorer`) that owns
the callbacks and receives only plain data from the page.

### ⭐⭐ `ssr:false` PROTECTS THE COMPONENT, NOT THE MODULE

**The single most costly trap in this codebase.** `AddressPicker` correctly loaded
its map with `next/dynamic(..., { ssr: false })` — and `/sell` still returned **HTTP
500 with `Error: window is not defined`** `[measured]`.

The cause was a plain **value** import from the map file:

```ts
import { CITY_CENTERS, REGION_DEFAULT } from "./AddressPickerMap";  // ← fatal
```

That pulls the module — and therefore `leaflet`, which reads `window` at
module-evaluation time — straight into the **server** bundle. The dynamic import is
irrelevant at that point.

**RULE: a module that imports `leaflet` may be referenced ONLY through
`next/dynamic({ssr:false})`. Anything else it needs to share — constants, types,
helpers — goes in a separate Leaflet-free file** (`addressMapConstants.ts`, which
must never gain a Leaflet import).

**`React.lazy()` is NOT sufficient** — it defers loading but does not disable SSR.

**The check that catches it: grep the RAW response, not the hydrated DOM.**

```
curl -s http://localhost:3001/sell | grep "window is not defined"
```

A Playwright assertion against `page.content()` reports a **false PASS**, because by
then the client has hydrated over the failed server render. That exact false pass
happened here.

---

## ⚠ ISR staleness is expected, not a bug

Public fetches carry `next: { revalidate: 60 }` (catalog list) or `120` (articles,
guides, realtor profiles). A change can take that long — **plus one
stale-while-revalidate hit** — to appear on a previously-visited URL.

This has produced false bug reports four separate ways:

- **After a schema refactor, a correct page renders EMPTY.** Next's data cache still
  holds a payload fetched *before* the migration, whose now-absent fields the mapper
  defaults to `""`. **The tell: the API is right and the page is empty**, while
  other pages of the same type are fine (they simply had not been cached).
- **After deleting fixture data, the deleted row is still on screen.** The delete was
  correct; the page was stale. Row counts were checked, the **surface** was not.
- **Unpublishing a realtor does not take effect instantly on the page.** The API is
  correct immediately; only the cached page lags. A crm_id never fetched before 404s
  at once. **Do not diagnose this as broken enforcement.**
- **A "localhost URL despite R2 being active"** was Next's on-disk fetch cache
  replaying a pre-switch payload. See `media-and-images.md`.

**RULE: after ANY migration, fixture cleanup, or config switch that changes a
serialized shape, warm every URL you intend to inspect — fetch it 2–3 times —
BEFORE concluding anything is broken.** Fixture cleanup is not done until the page
that renders it has been fetched **twice** and shows the fixture gone: once to burn
the stale hit, once to confirm.

---

## ⚠ An effect in the ROOT LAYOUT keyed on `[]` misses every soft navigation

The root layout **survives client-side navigation**. `RevealController` used `[]`,
so it ran exactly once per full page load: it armed the CSS and snapshotted sections
**for whatever page happened to be first**. Every soft navigation afterwards swapped
in new sections that were never in `pending` and stayed at `opacity: 0` **forever**.
F5 remounted the controller, which is exactly why a refresh "fixed" it and why it
looked like a login race.

`[measured]`: soft-navigating `/catalog` → `/` left **6/6 sections at `opacity: 0`**
with content fully present and zero console errors. A/B on the dependency array
alone: `[]` → **0/5** renders, `[pathname]` → **5/5**.

**RULE: any effect in the root layout that touches PAGE content must be keyed on the
route, not `[]`.** `[]` there means "once per full page load", which is almost never
what page-level DOM work wants. **The tell for this class of bug is "a manual
refresh fixes it."** Only genuinely document-scoped work (analytics boot, a global
listener with no page-specific state) belongs in `[]`.

---

## Scroll-gated visibility is invisible to every non-scrolling consumer

The end-state-in-base-style rule (see `frontend-tailwind.md`) is **necessary but not
sufficient.** The scroll reveal satisfied it and still produced a mostly-blank page.
The failure mode is not "JS broken" — it is **JS working perfectly while the viewer
never scrolls.**

`[measured]`: a full-page capture of the homepage at 1440×900 taken **without
scrolling** came out **2080px of 3306px blank — 63%**, because 5 of 6 sections were
still at `opacity: 0`. This hits screenshot tools, PDF/archive jobs, preview
crawlers and link unfurlers. A **tall** viewport was never affected (at 3306px the
first sweep reveals everything), which is why Googlebot-style rendering and
DevTools' full-size capture always worked.

**FIX, in place — do not remove it.** `RevealController` reveals whatever is still
pending after `REVEAL_FAILSAFE_MS` (**2500ms**). The trade-off is deliberate and
documented at the constant: a reader who lingers past 2.5s on the hero gets no
fade-in below the fold.

**RULE for any future scroll-driven visibility** (reveals, lazy sections, count-up
numbers): **cap it.** Ask "what does this look like to something that renders once
and never scrolls?" and give it a time-based failsafe.

### IntersectionObserver is the wrong trigger mechanism in this repo

IO fires only when an intersection ratio **crosses a threshold**. A viewport jump —
in-page anchor, browser-restored scroll position, fast flick — can move an element
from below the viewport to above it without crossing one, so IO never fires and the
element stays in its pre-reveal state permanently `[observed]`.

**RULE: for anything scroll-gated, use the RevealController pattern** — a position
sweep ("is its top above the viewport bottom") shared with the rAF-throttled scroll
handler, plus the 2500ms failsafe. **Do not add new IntersectionObserver triggers.**

### The count-up / rAF deadlock

An animation effect that (a) sets a "started" ref at the **start**, (b) calls
`cancelAnimationFrame` in cleanup, and (c) has no completion guarantee, **freezes
forever** the moment anything interrupts the chain: cleanup kills the frame, the
re-run returns early on the ref, nothing can restart it. Reproduced on the realtor
stats strip: one cancelled frame ~120ms in left the tiles at **0,1,2,1**
permanently, and scrolling away and back did not recover them.

**What interrupts it in practice:** Fast Refresh (re-runs effects while
**preserving refs**, so the guard survives while the animation dies — which is why
it showed in the user's live browser but not in a fresh headless load), StrictMode
remounts, backgrounded tabs (rAF pauses, timers don't), dropped frames.

**The symptom signature: SSR/no-JS output is CORRECT while the live browser shows
the animation's start value forever** — the "enhancement" actively destroys working
server output.

**RULE:** the real value is what React renders; the animation is a temporary
imperative overwrite, never the source of truth. Three guarantees, all three:
(1) effect cleanup writes the **final** value back; (2) a `setTimeout` failsafe
(2500ms) snaps to the final value, covering backgrounded tabs; (3) any "done" flag
is set only once the true value is actually on screen — **never at animation start.**

---

## ⭐ Loading indicators are tied to LOADING STATE, never to route commit or a timer

**RULE: a loading indicator ends when the thing it describes has finished, and the
only way it may learn that is from real loading state. Never a `setTimeout`, never a
minimum duration, and — the specific trap here — never route commit on its own.**

The shared mechanism is **`usePageLoading()`** in
`components/layout/pageLoadingSignal.ts`, consumed by `NavigationProgress`, which
treats a pathname change as *arming* the finish and only ends the run once no
component is holding.

### Why commit is not "loaded"

`usePathname()` changes at **route commit**. With **zero `loading.tsx` files**, App
Router does not commit a server route until its RSC payload arrives, so for
`/districts`, `/articles`, `/catalog` commit and content coincide `[measured]`.
**That is why this bug looked absent on the pages one would naturally test.**

It is a different story for a page that fetches *after* mount. `[measured]` on
`/favorites` with the API delayed 4000ms: route committed at 297ms, indicator gone
at 776ms, content painted at 4524ms — **3748ms of a contentless page with no
indicator.** After the fix the indicator outlived content by 448ms.

### ⛔ REQUIREMENT FOR EVERY NEW ROUTE

The first pass wired only two components and the bug was still reproducible
everywhere else — **the mechanism was right and the coverage was wrong. Coverage is
the part that rots.**

> **Any client component that renders before the content the user navigated for
> exists MUST call `usePageLoading(<its real loading flag>)`.** Not a timer, not a
> duration — the component's own state.

**A skeleton is not a loaded page.** Shimmer cards, «Загрузка…» or an auth
placeholder all mean still-loading. Where a page loads in stages, hold until the
stage that produces the primary content — the cabinet holds twice (auth gate, then
the page's own fetch) and the counter composes them automatically.

**Current coverage — 14 hold sites. Add to this list when you add a route.**

| Component | Held flag |
| --- | --- |
| `RequireEmployeeAuth` | `state === "checking"` (stage 1 of **every** `/account/*` route) |
| `AccountActivityLogsPanel`, `AccountOwnersTable`, `AccountSaleRequestsTable`, `AccountStaffRealtorsPanel`, `AccountSaleRequestDetail`, `account/(cabinet)/profile/page` | `loading` |
| `AccountInquiriesTable`, `CrmPropertyTable`, `CrmLeadsTable` | `rows === null` |
| `CrmDashboardPanel` | `user === undefined` |
| `CrmPropertyFullForm` | `mode === "edit" && bootstrapping` |
| `FavoritesView`, `CompareView` | `!ready \|\| loading` |

**What deliberately does NOT hold — do not "fix" these:** server-rendered routes
(commit == content, with no `loading.tsx` anywhere); Leaflet maps via
`next/dynamic({ssr:false})` (they render a shell by construction, but the map is
never the primary content — the listing text is, and it is server-rendered);
`SecuritySummaryBand` (renders nothing at all when the numbers are zero);
redirect-only routes and static text pages; `SellPropertyForm` (the form **is** the
content and paints immediately).

### ⚠ Two implementation traps, both measured, both non-obvious

1. **Register with a LAYOUT effect, not a passive one.** `NavigationProgress` sits
   above `<main>`, so its passive pathname effect runs **before** the destination
   page's passive effects, and a `requestAnimationFrame` can fire before React
   flushes passive effects at all. With `useEffect` the holder registered too late,
   the count read 0, and the fix appeared to do nothing. `usePageLoading` uses an
   isomorphic `useLayoutEffect`.
2. **⭐ NEVER act on a transient zero.** A holder releases and re-acquires within a
   single commit — StrictMode runs every effect setup → cleanup → setup in dev.
   `[measured]`: holders went `1 → 0 → 1` inside the same millisecond, and a
   synchronous check landing in that gap finished the run while the page was still
   loading. `scheduleFinishCheck()` coalesces on one `requestAnimationFrame`. **That
   frame is a coalescing window, not a duration** — it cannot extend a finished run.
   Do not "simplify" it away.

### What was rejected, and why

- **`useLinkStatus`** — **does not exist in Next 15.2.8** `[measured]`; it arrived
  in 15.3. Revisit after an upgrade, but note it is scoped to a `<Link>` and ends at
  commit, so it would still not cover the post-commit fetch.
- **`useTransition`** — a component can only observe *its own* transition, and these
  navigations are driven by `<Link>`.
- **Suspense + `loading.tsx`** — worth adding on its own merits, but it does **not**
  fix the indicator: the route would commit *earlier*, so a commit-based end signal
  would stop sooner still.
- **Extending a timeout / a minimum visible duration** — explicitly not done. It
  moves the mismatch instead of removing it.

### The start signal must not be `pushState`

Capture-phase click on an internal `<a>`, plus `popstate`. `router.push` inside
`startTransition` defers its `history.pushState` until the transition **commits**,
so pushState fires at the END of a navigation — useless as a start signal.
`DELAY_MS = 180` keeps fast navigations silent; a Back committing in 66ms shows
nothing `[measured]`. The 10s safety reset is the backstop.

### A cheap way to stop relying on memory (PROPOSED, NOT IMPLEMENTED)

1. **Lint rule / CI grep** (smallest, no runtime risk): fail when a file under
   `components/` or `app/` contains `"use client"` **and** a `useState(true)` named
   `loading` (or `useState<T[] | null>(null)` named `rows`) **and** does not import
   `usePageLoading`. Catches the exact shape of every site above. **Recommended
   first.**
2. A `useAsyncPageData()` wrapper owning `loading`, the fetch and the hold in one
   call. A real refactor of 12 components — **do not start it without reporting the
   plan.**

---

## ⚠ History entries must exist BEFORE the transition

`router.push` inside `startTransition` defers its `history.pushState` until the
transition **commits**. On a slow dev-server render that leaves a seconds-long
window with **no entry for the target URL**, and a Back press in that window pops
PAST the page and leaves the site `[measured]` — repro: Back pressed 80ms after a
pagination click landed on `about:blank`.

**Fix pattern** (in `CatalogExplorer.navigate()`, copied by `ArticlesExplorer` and
`DistrictsExplorer`): `window.history.pushState(null, "", href)` **synchronously**
(Next 15 syncs its router with native pushState), then `router.replace(href)` inside
the transition onto that same entry.

**A test that awaits full settlement before pressing Back can NEVER catch this —
always include a mid-transition Back variant.**

### Mutations must read `currentState()`, never the `uiState` prop

While a transition is pending, the prop describes the **previous** URL. Two
interactions inside one pending window lost the first (same-tick repro: type=Дома +
«На карте» kept only `view=map`). A `lastNavigatedRef` clears when props catch up to
its href, and on popstate.

- `navigate()` **no-ops on the current URL** — Back had appeared dead after
  re-picking the active sort or view.
- **Two same-tick `onPatch` calls always lose the first even with the ref**, so the
  mobile sheet's «Показать объявления» commits areas + price as ONE merged patch.
- **Draft resync is PER KEY**, against the previous applied value. A blanket
  `setDrafts(draftsFrom(f))` on every identity change wiped in-progress typing
  whenever an unrelated navigation committed. **The repro needs a PENDING
  navigation** — the obvious "type, then click another control" flow does **not**
  reproduce it, because the click blurs the input and the draft round-trips.

---

## ⚠ Anchor scrolling must assume the COMPACT header

A pre-computed `scrollTo(rect.top + scrollY − offset)` from the top of the page
lands 12px off `[measured]`: the sticky header compacts 64→52px **during** the
scroll and shifts the whole document.

The TOC uses offset **76** (compact 52 + room) and then a settle-and-correct rAF
loop: wait for 3 stable frames, then one instant `scrollBy` if the heading missed.
Headings carry matching `scroll-mt-[76px]` — **keep the two in sync.**

---

## ⛔ Edge middleware: do not re-add it for the `/account` gate

**Symptom:** every `/account/*` page 500s in dev with `EvalError: Code generation
from strings disallowed for this context`. Public pages are fine.

**Root cause:** Next runs middleware in the **Edge runtime**, whose VM sandbox
forbids `eval`/`new Function`. But Next's **dev webpack wraps every module in
`eval("…")`** (the `eval-source-map` devtool — the compiled middleware.js had 87
`eval(` calls), so the bundle throws the instant the sandbox evaluates it → 500 on
every path the `matcher` covers.

**What does NOT work:** overriding webpack `config.devtool` in `next.config.ts`
(Next re-applies its own eval devtool to the middleware compiler *after* the hook);
`experimental.nodeMiddleware: true` is **canary-only** and throws `CanaryOnlyError`
on stable 15.2.8.

**THE FIX (applied):** `src/middleware.ts` was deleted and the auth gate moved into
the **`app/account/(cabinet)/layout.tsx` Server Component** (`cookies()` +
`redirect`), which runs in the Node.js runtime. `/account/login` lives OUTSIDE the
`(cabinet)` group so it is never gated. **If you re-add Edge middleware here, this
EvalError comes back — keep the gate in the server layout.**

---

## Tablet/desktop breakpoint pairs must not have equal specificity

The article TOC rail is `min-[1140px]:`; the accordion wrapper is
`hidden md:max-[1139px]:block`. **Use the stacked variant, not
`md:block min-[1140px]:hidden`** — that pair has equal specificity, so the winner
would depend on stylesheet order.
