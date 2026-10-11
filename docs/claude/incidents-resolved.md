# Resolved incidents — history only

**No current rules live here.** Every rule these incidents produced has been moved to
the topic file it belongs in. This file exists so that a familiar-looking symptom can
be recognised quickly, and so nobody re-investigates something already settled.

Read it when a symptom feels familiar, or to check whether something was already
tried.

---

## Symptom → cause index

| Symptom | Actual cause | Rule now lives in |
| --- | --- | --- |
| Every page 500s, `Module parse failed: Unexpected character '@'` | `NODE_ENV=production` with `next dev` | `environment-and-launcher.md` |
| Every `/account/*` page 500s, `EvalError: Code generation from strings disallowed` | Edge-runtime middleware + Next's dev `eval` devtool | `nextjs-and-react.md` |
| `/sell` 500s with `window is not defined` despite `ssr:false` | a plain **value** import from the Leaflet module pulled it into the server bundle | `nextjs-and-react.md` |
| "Backend did not answer within 180s" while Django is running | autoreloader storm from concurrent `next dev` disk load | `environment-and-launcher.md` |
| Intermittent `OperationalError` / `ECONNRESET` while idle | Postgres connection exhaustion from a duplicate dev stack | `environment-and-launcher.md` |
| `next build` dies on a different file every run | pCloud filesystem; build in a local-disk mirror | `environment-and-launcher.md` |
| Dev server dies mid-session, `EPERM .next\trace` | pCloud; restart warm, never delete `.next` | `environment-and-launcher.md` |
| Claude Code aborts with `0xC0000409` | pCloud filesystem fragility hitting the agent process | `environment-and-launcher.md` |
| Data looks missing; `/api/properties/` returns `[]` | ambient `DATABASE_URL` pointed Django at another tool's database | root `CLAUDE.md` |
| Every API 500s with `UndefinedTable`; site shows «Сервис временно недоступен» | the local schema was wiped; `bannerForStatus()` maps any ≥500 to that text | `django-and-migrations.md` |
| `migrate` fails on a fresh database only | a data migration used a concrete model import | `django-and-migrations.md` |
| An endpoint 200s when filtered and 500s unfiltered | a nullable FK with unguarded read sites | `django-and-migrations.md` |
| Every refresh 401s after enabling rotation | claims read *after* `super().validate()` blacklisted the token | `django-and-migrations.md` |
| A page renders empty after a schema refactor | Next's data cache replaying a pre-migration payload | `nextjs-and-react.md` |
| A deleted fixture is still visible on the page | `revalidate` stale-while-revalidate; fetch twice | `nextjs-and-react.md` |
| Homepage sections missing after login; F5 fixes it | a root-layout effect keyed `[]` instead of `[pathname]` | `nextjs-and-react.md` |
| Full-page screenshot is 63% blank | scroll-gated reveal + a consumer that never scrolls | `nextjs-and-react.md` |
| Hero/footer appear twice in a screenshot | naive scroll-and-stitch capture, not a duplicate mount | `testing-and-verification.md` |
| Count-up tiles frozen at 0,1,2,1 forever | `startedRef` guard + rAF cleanup deadlock | `nextjs-and-react.md` |
| Loading bar disappears while the page is still blank | the indicator ended at route commit, not at loading state | `nextjs-and-react.md` |
| A hover lift snaps instead of easing | v4 compiles `-translate-*` to `translate:`, not `transform:` | `frontend-tailwind.md` |
| A dropdown is cut off despite correct z-index and scroll | an ancestor's `overflow-hidden` for decorative gradients | `frontend-tailwind.md` |
| Sitewide horizontal scroll on mobile | one non-wrapping row in the shared `Header` | `frontend-tailwind.md` |
| Article body renders in the wrong font | a `@theme` token referencing a page-scoped `next/font` variable | `frontend-tailwind.md` |
| Address autocomplete returns nothing, silently | the 2GIS key is dead and the error was swallowed by `.catch()` | `address-and-geo.md` |
| «Хлебосольная» not found in Витаминкомбинат | search scoped to a microdistrict's tiny circle instead of the parent city | `address-and-geo.md` |
| The map sits on Krasnodar with a Gelendzhik village selected | `scopeForCity()` returned undefined → fell through to `REGION_DEFAULT` | `address-and-geo.md` |
| Six Gelendzhik settlements return «Ничего не найдено» | hand-reasoned bounding boxes excluded them | `address-and-geo.md` |
| A regex over Cyrillic matches nothing | JS `\b` is ASCII-only | `address-and-geo.md` |
| A map with two listings shows no markers at all | fixed `center`/`zoom` on the centroid of markers 97 km apart | `address-and-geo.md` |
| A land plot shows «8 м²» and a 100× wrong ₽/м² | four differently-united area fields flattened to one bare number | `product-and-domain.md` |
| Media URLs leak the private backend host under local storage | `request.build_absolute_uri()` wrapped around `FieldFile.url` | `media-and-images.md` |
| A media URL says `localhost:3001` though R2 is active | Next's on-disk fetch cache; the browser resolved a relative path | `media-and-images.md` |
| Small JPEGs re-encoded on every upload | `img.format` read *after* `exif_transpose()` returns a copy | `media-and-images.md` |
| A PNG got 3.8× bigger after "compression" | JPEG encoding a flat graphic that needed no resize | `media-and-images.md` |
| #18 renders a broken hero image | a fixture shared #18's file paths; cleanup deleted them | `testing-and-verification.md` |
| #18's price keeps "not persisting" | cleanup reverting a real owner edit to a stale baseline | `testing-and-verification.md` |
| Railway: HTTP 502 on every path, `x-railway-fallback: true` | a hardcoded port — twice, backend then frontend | `django-and-migrations.md` |
| Railway deployed insecure | `DJANGO_`-prefixed settings vs bare `SECRET_KEY`/`DEBUG` | `django-and-migrations.md` |

---

## Claims that were WRONG and are corrected

These are recorded because each was written confidently and then disproven. They are
the reason for Rule Zero.

1. **"`max-w-screen-*` was removed in v4 and compiles to nothing."** False — it
   compiles fine in the installed v4.3.2 `[compiled CSS]`. The recommendation to
   prefer `max-w-(--breakpoint-2xl)` survives, for a different reason.
2. **"Bare `z-1000` is not in the scale, so it emits an empty rule."** False —
   `z-<number>` is a documented v4 bare value. The observed empty rule was
   build/version drift. The bracket form is still preferred, as drift-proofing.
3. **"Verified via the Tailwind CLI probe."** **There is no Tailwind CLI in this
   project.** That verification cannot have happened as described.
4. **"The 2026-08-03 loss of #18's derivatives happened when the fixture was
   deleted."** Cannot be right — deleting a row removes no files. The mechanism was
   `_clear_derivative_image_fields()` running on **save**
   `[inferred, from two measured facts]`.
5. **"The unused `cn` lint error has since been fixed in the repo."** It had not —
   the fix existed only in the working tree. `npm run build` from a clean checkout of
   HEAD failed at the lint gate for the whole branch `[measured]`.
6. **"All 24 coordinate-less dropdown rows are microdistricts."** False — five are
   separate settlements 21–35 km out, which no city circle could cover.
7. **"Динская must be excluded from the service area."** Retired — ст. Динская is a
   row of the Город/Район dropdown, so it is inside the service area by definition.
8. **"Nominatim ignores our parameters."** False — the route was working the whole
   time; the hand-written `curl` probes were malformed, and this nearly triggered an
   unnecessary provider change.
9. **`check_r2`** — a management command that **never existed**. If a prompt or note
   names it, that name is folklore.

---

## Approaches tried and rejected — do not retry without new information

| Approach | Why it was rejected |
| --- | --- |
| `wt.exe` split-pane launcher | correct in isolation (4/4 manual runs), unreproducible "flash and close" in the full launcher; reverted to three windows rather than ship something unverified |
| Raising the launcher readiness timeout (90s → 180s) | failed at 180s too — the storm lasts as long as the frontend compile. Serialising the startup was the fix |
| A small fixed per-request timeout in the readiness poll | aborting a request makes a compiling Next.js **restart the render**, so the loop can never succeed |
| Overriding webpack `config.devtool` to fix the Edge EvalError | Next re-applies its own eval devtool to the middleware compiler *after* the hook |
| `experimental.nodeMiddleware: true` | canary-only; throws `CanaryOnlyError` on stable 15.2.8 |
| `useLinkStatus` for the loading indicator | does not exist in Next 15.2.8 (arrived in 15.3), and would end at commit anyway |
| `useTransition` for the loading indicator | a component can only observe its **own** transition; these navigations come from `<Link>` |
| Suspense + `loading.tsx` for the loading indicator | worth adding on its own merits, but it makes the route commit *earlier*, so a commit-based end signal would stop sooner |
| A minimum visible duration / longer timeout for the indicator | moves the mismatch instead of removing it |
| An in-memory webpack cache to fix the CSS `@` error | did not fix it; the cause was `NODE_ENV`. Reverted |
| `rm -rf .next` to fix a dev problem | made things worse on pCloud; a pristine `.next` still failed, proving it environmental |
| `load_dotenv(override=True)` | `backend/Dockerfile` does `COPY . .` with **no `.dockerignore`**, so a developer's `.env` would be baked into any image and beat the platform-injected secrets. Safe today only by the coincidence that `.env` is gitignored. *(The missing `.dockerignore` is a real finding in its own right.)* |
| Unsetting the ambient `DATABASE_URL` | another tool on this machine depends on it. `CENTREAL_DATABASE_URL` was added instead |
| Rectangular city bounding boxes | a box containing all 72 Krasnodar dropdown rows also swallows Усть-Лабинск, Абинск and Крымск |
| Yandex Geosuggest as the address provider | the key works, but Geosuggest returns **no coordinates** and the Geocoder needed to resolve them 403s |
| A backend-computed `reading_minutes` | would duplicate the algorithm, and Python's banker's `round()` disagrees with JS at exact .5 |
| Adding `body` to the guide list payload to show a clock | ships ~90 full texts to render a clock |
| Password recovery by email | closed permanently — see `django-and-migrations.md` |
| Auto-replacing the compare selection on conflict | explicit product decision to block with an inline message instead |
| A `key={lat-lng}` remount to recentre a Leaflet map | tile flicker, and fails silently when the same coordinate is re-selected |
| `React.lazy()` for Leaflet components | defers loading but does not disable SSR |
| IntersectionObserver for reveals | never fires when a viewport jump skips the threshold |
| A `maxZoom` cap on `FitToMarkers` | would reintroduce the original bug — seeing every object at once is the requirement |

---

## Audits that came back clean

Recorded so they are not re-run without reason.

- **Full-site audit after the roadmap** (Favorites, Compare, Price History, Similar
  Properties, Breadcrumbs/SEO, Articles): 35 Playwright checks across public site and
  CRM, **all passed, zero console errors or hydration mismatches.** Every
  previously-documented issue was explicitly re-tested and confirmed not regressed.
  **3 of the initial "failures" were test-script artifacts, not defects.**
- **Responsive sweep** after the header fixes: 4 pages × 32 widths (360→1600 in 40px
  steps), **128/128 pass**; and a 46-check sweep across 23 routes at 390/768 with zero
  horizontal overflow.
- **Catalog redesign:** 84/84 Playwright checks (states, full keyboard run, sheet
  focus trap, 360→1600 sweep, reduced motion, AA contrast), 0 console errors.
- **Catalog external-review fixes:** 34-check before/after run — **every check
  reproduced the broken behaviour first, then the fix.**
- **Articles redesign:** 100/100 checks plus a 32-width scroll sweep per page.
- **Auth redesign:** 38 checks plus a 4-check success path against a disposable
  account (created, used, hard-deleted; 3 real users intact).
- **CRM hardening:** 36/36 API checks plus a 37-endpoint gate sweep, against
  disposable `.invalid` accounts, hard-deleted after (users 3 → 6 → 3).
- **CRM staff panel:** 23 API checks against four disposable accounts; #18 unchanged
  and all three real users still `token_version=0`.
- **Media URL audit:** 13 media-emitting fields across 10 serializers, probed under
  **both** storage backends, 0 backend-host leaks.
- **Service area:** 103/103 circle centres accepted through the real validation path;
  Усть-Лабинск / Абинск / Крымск / Новороссийск / Сочи / Москва all rejected.
- **Body→sections migration:** 15/15 articles and 24/24 guides round-tripped
  character-identical (see the honest limitation in `testing-and-verification.md`).
- **Migration audit:** 9 migrations contain `RunPython`/`RunSQL`; **0014 was the only
  concrete import.** There is no second instance.

---

## Deleted components — do not reintroduce

`SeoLinksFooter` · `ArticlePreviewCard` · `ArticleCatalogLinksBlock` ·
`DistrictGuideCard` · `CatalogResultsSection` · `CatalogControls` ·
`catalogQueryParams.ts` · `CrmPropertyAddressMap` · `src/middleware.ts`
