# Addresses, geocoding, the service area, and maps

Read before touching any address input, geocoding, city/district scoping, or **any
Leaflet map**.

---

## ⭐ ONE shared module, ONE shared component

- **Every address input uses `frontend/src/lib/addressSuggest.ts`. Do not fetch
  suggestions from a component.**
- **`components/address/AddressPicker.tsx` is THE address input.** The public
  `/sell` form and the CRM property form both render it. **Do not write a second
  one.**

The CRM had its own — `CrmPropertyAddressMap` — and it rotted exactly as a duplicate
does: a plain text box with no suggestions, a map that never recentred on the
selected Район (the realtor saw Геленджик + Бетта selected while the map sat on
Krasnodar), and a caption still crediting 2GIS long after the tiles became OSM and
the key stopped working. **That file is deleted.**

- **The two forms share it OUTRIGHT — no variant prop, no fork.** The one genuine
  difference is how strictly a point is accepted, and that lives in the
  **serializers**: `PublicSaleRequestCreateSerializer._validate_point` rejects a
  point outside the service area, while the CRM property serializer does not
  validate coordinates at all `[measured]`. **That asymmetry IS the realtor
  override** — a realtor entering an address they know is right is not
  second-guessed; an anonymous submission is. The picker itself never blocks a
  point; it only scopes suggestions and centres the map.
- **Plumbing, not behaviour, is what differs**: the CRM holds location ids and keeps
  coordinates as strings, so it derives `cityName`/`areaName` from the selected ids
  and converts number↔string at the boundary.
- **⚠ The CRM's typed address was never saved at ALL before this** — it lived in the
  old component's local state and `buildBasePayload` had no address field. It now
  round-trips through `public_address_text`.

### ⚠ «City arrives» is not «city changed» — the prefill-wiping bug

`AddressPicker` clears the address and the point when `cityName` changes, so a stale
address from another city cannot survive. That effect also fired on the **initial**
`"" → «Геленджик»` transition, destroying prefilled data `[measured]`: the convert
flow set the address and the owner's coordinates, the city id resolved to a name a
tick later, and both were wiped — an empty address field on a page whose banner said
the address had been carried over. **The effect now returns early when the previous
city was empty.** `/sell` never showed this because its field is empty anyway.

---

## The provider is Nominatim (OSM). 2GIS and Yandex are both dead.

**`[measured]` 2026-08-31** — the 2GIS key returns
`403 {"message":"Authorization error, incorrect key."}` for both suggests and
geocode, identically with and without a `Referer`, so it is the **key** that is
rejected. This had been failing silently in the CRM for an unknown length of time
because the old code did `.catch(() => setSuggestions([]))` — **a dead key looked
exactly like "no such street."** That swallow is gone; failures are shown.

Yandex was evaluated and rejected on evidence: `NEXT_PUBLIC_YANDEX_SUGGEST_API_KEY`
**works**, but Geosuggest returns **no coordinates**, and the Geocoder needed to
resolve them answers `403 Invalid api key`. Coordinates-with-each-suggestion is the
whole reason the project left Yandex originally.

**Nominatim** is keyless, returns `lat`/`lon` directly, and does reverse geocoding.
To move to another provider, replace the two `/geo/*` route handlers — nothing in
the UI changes.

### ⚠ Geocoding is proxied server-side, and the path MUST NOT be under `/api/`

`app/geo/suggest/route.ts` and `app/geo/reverse/route.ts`.

- **Why server-side:** Nominatim's usage policy requires a `User-Agent` identifying
  the app, and a browser **cannot** set `User-Agent` from `fetch()` — it is a
  forbidden header. Calling it client-side would violate the policy and hit CORS.
- **⚠ Why not `/api/geo/…`:** `next.config.ts` rewrites `/api/:path*` to Django in
  `beforeFiles`, which runs **before** filesystem routes. A route handler under
  `/api/` is never reached — the request is proxied to Django and 404s there.

### ⚠ Nominatim REVERSE knows streets its FORWARD search cannot find

**Measured in Бетта:** reverse geocoding at 44.3728/38.3956 returns
«5, Подгорная улица, Бетта», yet forward search for that street returns **zero** in
every query form. Thinly-mapped хутора have street geometry but no searchable street
index.

- **Consequence: in some settlements autocomplete CANNOT work, for any query form.**
  «Хлебосольная» (a real street in Бетта) returns 0 results in OSM **worldwide**
  `[measured]`. **Do not keep tuning the query** — the answer is the manual path.
- **So the manual path is load-bearing, not a fallback.** `AddressPicker` keeps a
  hand-typed address when the owner drops a pin: filling an **empty** field from
  reverse geocoding is helpful, **overwriting what they typed is destructive** — in
  a village their typed text is the only correct address there is. `textIsOursRef`
  tracks who wrote the current value.

### Geocoding a whole dropdown: three traps that each produced wrong data

1. **`limit=1` plus a loose `«<name>, Краснодарский край»` query returns the first
   HOMONYM in the krai.** «п. Лазурный» resolved to **Sochi**. Constrain
   geographically with a `viewbox` around the parent city, not by naming the region.
2. **Nearest-of-any-kind picks the wrong FEATURE.** «Бетта» resolved to the **river**
   Бетта, «Прасковеевка» to a **waterfall**, a dozen microdistricts to **bus stops**.
   Filter on `class=place` (then `boundary`) **before** ranking by distance.
3. **A region qualifier excludes valid rows.** Krasnodar's left-bank suburbs (аул
   Козет, п. Яблоновский, аул Тахтамукай) are in **Adygea**, so
   «…, Краснодарский край» matched nothing for them.

### ⚠ `\b` DOES NOT WORK ON CYRILLIC IN JAVASCRIPT

`stripRedundantLocality` removes a locality the owner re-typed inside the street
field («Садовая 3 хутор Бетта» → «Садовая 3»). The first version used `\bБетта\b`
and silently matched **nothing**: JS defines `\b` against `\w`, i.e. `[A-Za-z0-9_]`,
which contains **no Cyrillic**, so there is never a boundary.

**Use Unicode property escapes** — `(?<![\p{L}\p{N}])…(?![\p{L}\p{N}])` with the `u`
flag. `[measured]`: before, «Садовая 3 хутор Бетта» → 0 results; after → 1.

### ⚠ Don't trust `bounded=1` — filter the coordinates yourself

Nominatim treats `bounded=1` as a strong **hint**, not a guarantee. Every result is
re-checked and dropped if it falls outside the service area. That filter — not the
API parameter — is what actually enforces scope, and it also supplies the **city
badge** on each suggestion row (street names repeat between the two cities: both
have a «Красная улица»).

`viewboxForCircle()` sends the box that **circumscribes** the circle; results are
then re-filtered by true distance from the centre, because the circumscribing box
reaches ~1.41r at its corners and would otherwise widen every search by ~41% of area.

### ⚠ MEASURE THE ROUTE, NOT A HAND-WRITTEN curl

Debugging this, repeated `curl` probes returned zero results for `bounded=1` and
wrong-region results for structured `street=`/`city=`, which read as "Nominatim
ignores our parameters" and **nearly triggered a provider change. The route was
working the whole time — the curl invocations were malformed.** Hit `/geo/suggest`
and read its JSON; that is the code that ships.

### Nominatim rate-limits (429) — don't mistake it for a regression

Two of eleven live checks 429'd mid-session `[measured]`, confirmed by hitting
Nominatim directly with the identical query while the **same code path** had already
returned real results for three other settlements moments earlier. Both passed after
a natural cooldown. **Check whether the identical branch already passed elsewhere in
the same run** before concluding anything.

### ⭐⭐ …and that 429 was reaching USERS as «Ничего не найдено» (fixed 2026-09-01)

**RULE: a failed lookup is NOT an empty result. Never let one render as the other.**
A `catch` that returns `[]` makes a provider outage indistinguishable from "nothing
matched" at every layer above it.

Reported as: Город = Геленджик, **no Район**, «Кирова 130» → «Ничего не найдено»,
for a street Геленджик plainly has.

**Every structural hypothesis measured FALSE.** The scope was right (the no-district
path resolves to the Геленджик **city** circle, r=10 km), the query reached
Nominatim **verbatim**, улица Кирова sits **0.75 km** from that circle's centre, and
all four spellings — «Кирова 130», «Кирова», «улица Кирова», «улица Кирова, 130» —
return results `[measured]`. The bug is intermittent because the rate limit is.

The real path: `/geo/suggest` wraps each circle's upstream call in a `try/catch`
whose purpose is "one city failing must not lose the other's results". It also
swallowed **every** upstream failure — 429, timeout, 5xx — and returned **HTTP 200
with `items: []` and no `error`**, which `addressSuggest.ts` maps to `"empty"` and
`AddressPicker` renders as «Ничего не найдено». The honest branch existed and was
**unreachable**: only the OUTER catch returns `{error:"unavailable"}` + 502 →
«Подсказки адреса сейчас недоступны», and the inner catch always caught first.

Proven by fault injection through the same `throw` a 429 produces `[measured]`:

| | route status | body | user sees |
| --- | --- | --- | --- |
| before | **200** | `{"items":[]}` | «Ничего не найдено» — a lie |
| after | **502** | `{"items":[],"error":"unavailable"}` | «Подсказки адреса сейчас недоступны» |

**The fix is a flag, not a bigger catch:** `anySucceeded` records whether any circle
completed a round-trip. Partial failures still return the surviving results; only
when **every** circle failed does the route report the outage. A per-circle catch
alone cannot make that distinction — keep it if you refactor.

**Debugging corollary: a zero-result you cannot reproduce is a provider failure
until proven otherwise.** This cost time twice — once as a false regression report,
once as this user-facing bug.

### ⚠ Do NOT narrow the geocoder by a Район's NAME — for ANY row type

**Now absolute.** When this was first written it applied to city *subdivisions*
only, via `narrowBy = area.isStandaloneSettlement ? area.locality : ""`. Both
`narrowBy` and that flag are **gone** (2026-09-01) — the Район's name reaches
Nominatim for nothing, standalone or not. See «Address search scopes to the
CITY» below for why the half-measure was itself a bug.

The original evidence, still the reason the rule exists: `queryCircle` returned
at the **first attempt that yielded anything**. With `narrowBy="Центр"`, attempt
1 (`city=Центр`) matched nothing and attempt 2 (`q="Ленина, Центр"`) matched a
single «улица Ленина» in **Дивноморское, 7.6 km away** — which short-circuited
the correct city-wide attempt 3 `[measured]`.

- Before: Геленджик + Центр + «Ленина» → **1 result, in Дивноморское**.
- After that fix: **6 results**, the two central Геленджик ones first
  (44.56513/38.08052, 44.56656/38.08164).
- Today, city-wide: **10 results** — the same two central ones first, then
  Дивноморское, Марьина Роща and Виноградное, each badged with its settlement
  and ordered by distance from Центр `[measured]`.

Cost also fell: a query is **one** upstream request, or two when a Район has its
own circle (the additive local sweep), down from up to six — direct relief on
the rate limit that caused the bug above.

**A fallback chain that stops at the first non-empty answer is only as good as its
worst attempt.** Never add an attempt that can match loosely before a stricter one
has run.

### The user's house number must survive

**RULE: if the user typed a house number, the suggestion they pick must still carry
it.** OSM house-number coverage in these two cities is patchy, and nobody should
have to discover for themselves that deleting the number makes the search work.

Two distinct behaviours, both handled:

1. **Nominatim answers a numbered query with the bare street** — common:
   `street=Революционная 8` → «Революционная улица», no number `[measured]`. The
   typed number is re-attached, giving «Революционная улица, 8».
2. **Nominatim returns nothing for the numbered form** — the street alone is
   retried and the number re-attached the same way.

`a.house_number ?? house` — **OSM's own number always wins**; the typed one only
fills a gap. The coordinate is the street's; the address text is the user's, and the
map pin is how they confirm it. `[measured]`: «Кирова 130» keeps OSM's 130, «Кирова»
invents nothing, Бетта «Садовая 3» still resolves the exact house.

Measured aside: the structured `street=` parameter usually degrades on its own —
`street=Красная 999` and `street=Херсонская 999` both still return the street — so
the retry is belt-and-braces, not the common path.

---

## ⭐ GEOGRAPHIC SCOPE: exactly TWO cities

**Краснодар and Геленджик. There is no region-wide mode and no third city.** A
krai-wide bounding box is what made the /sell address field offer streets in Сочи,
Новороссийск, Иркутск and Moscow.

### ⭐⭐ THE SERVICE AREA IS A UNION OF PER-SETTLEMENT CIRCLES

**A point is inside the service area iff it lies within the radius of ANY circle.
There are no rectangles anywhere in this model — not as the primary test and not as
an extra filter.** Circles live in `frontend/src/shared/serviceArea.json`, generated
from the Город/Район dropdown, mirrored by `backend/common/city_bounds.py`.

**⛔ WHY RECTANGLES WERE REJECTED — do not reintroduce one.** A box containing all 72
Krasnodar dropdown rows spans х. Дальний (45.404) to ст. Григорьевская (44.774) and
east to ст. Михайловская (39.622), swallowing **Усть-Лабинск, Абинск and Крымск**,
which the platform does not serve. The округ is too dispersed for its bounding box
to describe it — the extremes are 80+ km apart while the settlements are small. A
circle per settlement follows the actual coverage instead of its convex hull.

**The «exclude Динская» instruction was wrong and is retired.** ст. Динская is a row
of the dropdown, so it is inside the service area **by definition**. It has its own
5 km circle and validates. **Anything still listing Динская as excluded is stale.**

### Radii by settlement type — sized to the type, never one global number

| type | radius | count |
| --- | --- | --- |
| `city` | **16.0 km** Краснодар, **10.0 km** Геленджик | 2 |
| `town` | 5.0 km | 20 |
| `administrative` | 4.0 km | 4 |
| street-centroid settlements | 4.0 km | 3 |
| `village` | 3.5 km | 48 |
| `suburb` / `neighbourhood` / `quarter` / `residential` | 3.0 km | 16 |
| `hamlet` / `locality` | 2.5 km | 9 |
| `allotments` (СНТ) | 2.0 km | 4 |

**⚠ `town` is capped at 5 km by ONE constraint: Кабардинка → Новороссийск, whose
centres are 15.7 km apart.** That leaves **10.7 km** of clearance — the tightest
margin in the model. `test_the_tightest_exclusion_keeps_real_clearance` asserts the
**number**, not merely "outside", so raising a radius later cannot quietly eat the
margin. The two cities carry explicit radii because "city" is not one size.

Verified `[measured]`: **103/103 circle centres accepted** through the real
validation path (`_validate_point` — the public endpoint is rate-limited, so 103 HTTP
POSTs is the wrong instrument), and Усть-Лабинск / Абинск / Крымск / Новороссийск /
Сочи / Москва all rejected. Clearances: Новороссийск **10.7**, Абинск 21.5,
Усть-Лабинск 23.2, Крымск 26.6, Сочи 122.0, Москва 1150.4 km.

### The three kinds of row WITHOUT a circle — not interchangeable

`settlementsWithoutCircle` records a REASON for each, and the test rejects any other
value:

- **`microdistrict` (18)** — ФМР, ХБК, ЮМР… inside their city by construction, so
  the city circle covers them. **Verified rather than asserted**: of the 11 with any
  OSM proxy, 6 land inside the city circle and 5 are homonyms elsewhere in the krai
  (a beach at 88 km, a river at 78 km) — evidence of nothing.
- **`unmapped` (2)** — **п. Титоровка** and **х. Навагинка** are absent from OSM
  entirely `[measured]`. The address is still typeable and submittable; only the map
  pin is impossible, because a pin there would fall outside every circle and be
  correctly rejected. The field says so in Russian rather than letting the owner
  discover it at submit time.
- **`container` (1)** — «Микрорайоны Краснодара» is a GROUPING row, not a place. It
  is filtered out of the /sell Район selector (`isContainerRow`) so it can never
  reach the geocoder.

**⚠ THE «all 24 are microdistricts» ASSUMPTION WAS FALSE.** Five — ст.
Нововеличковская, ст. Новотитаровская, ст. Пластуновская, п. Титоровка, х. Навагинка
— are separate settlements 21–35 km out, which no city circle can cover. Three were
recovered as the **centroid of the 20 named streets inside them** (OSM has the
streets but no place node) and given the 4 km radius; two are unmapped. **Checking
beat asserting.**

### ⚠ A dropdown row can share a name with a city

«Геленджик» is **both** a city and a suburb *district* in the dropdown. Keeping the
two in one name-keyed dict silently replaced the city's 10 km circle with the row's
5 km one — caught only because 103 written came back as 102 loaded. The backend keys
city circles as **«город Геленджик»**; the frontend keeps two arrays. **Count your
entries after building a name-keyed map from two sources.**

### Wiring points — the JSON alone does nothing

1. `components/address/addressMapConstants.ts` — scopes, `resolveArea()`,
   `viewboxForCircle()`, point-in-area. **Must stay Leaflet-free** (a server route
   imports it — see the `ssr:false` rule in `nextjs-and-react.md`).
2. `app/geo/suggest/route.ts` — queries per scope with `bounded=1`, merges when no
   city is chosen, and **filters by coordinate afterwards**.
3. `backend/common/city_bounds.py` — the Python mirror.
4. `backend/submissions/serializers.py` — `_validate_point()` rejects an out-of-area
   point with a Russian 400.

**Frontend and backend are duplicated ON PURPOSE** — the deployed backend image does
not contain `frontend/`. Sync tests in `backend/common/tests.py` assert the Python
data equals the JSON and **skip** when the JSON is absent (backend-only checkout). A
one-sided edit fails the suite.

- **⚠ The test reads the FIXTURE, not the database**: `SimpleTestCase` has no DB and
  a fresh test DB would be empty, making the check pass **vacuously**.
  `test_the_fixture_actually_has_entries` guards that guard.
- **Regenerate, don't hand-edit.** A bounding edge or a circle is a **measurement**
  of where the dropdown's settlements are, never a guess about where the platform
  "probably" operates. The earlier hand-reasoned boxes excluded **six real
  settlements of Геленджик** — Бетта, Криница, Пшада, Текос, Береговое,
  Архипо-Осиповка — whose addresses returned «Ничего не найдено» with no error
  anywhere.

---

## ⭐⭐ Address search scopes to the CITY — always. The Район only moves the map.

**Decided 2026-09-01. This REPLACES «address search scopes to the settlement
that owns the street data» (2026-08-31), which is retired in full — both halves.
If you meet the standalone-vs-subdivision split anywhere, it is stale.**

The scope of every address query is the **selected city's whole coverage**: its
own circle **plus every settlement circle belonging to it**, for **every** row
type of the Район selector. The Район narrows nothing.

### What the old rule was, and the measured bug it left behind

It classified each Район row and scoped accordingly — a **standalone
settlement** (`District`/`district_type="suburb"`: Бетта, Кабардинка, ст.
Динская) searched *itself*; a **city subdivision** (any `Neighborhood`:
Витаминкомбинат, Дубинка, ЮМР) searched the *parent city*. The classification
is correct about OSM. It is wrong for this product, because an owner picks the
Район nearest to them and then types a street that belongs to the city.

Reported symptom: **Краснодар + «п. Северный» + «хлебосольная»** → 0 results and
«В населённом пункте "п. Северный" нет базы адресов», for улица Хлебосольная at
**45.13151/38.98944**, a real Krasnodar street `[measured]`. The dropdown's
«п. Северный» is a hamlet at **44.82551/39.21296 — 29.9 km out, near Псекупс** —
and it is `standalone: true`, so the previous fix left the narrowing switched on
for it. The map jumped there too, which was the visible half of the same fact.

### Where the narrowing lived, and what replaced it

| # | Narrowing | Now |
| --- | --- | --- |
| 1 | `resolveArea()` returned the settlement's OWN circle as `circle` when `circle.standalone` — driving both the viewbox and `city=` | `scopeCircles` = `circlesForCity(cityName)`, **always**. The Район's circle survives only as `focusCircle` (map centre + additive hint) |
| 2 | `/geo/suggest`: `narrowBy = area.isStandaloneSettlement ? area.locality : ""`, feeding `city=<settlement>` and `q="<street>, <settlement>"` | **Deleted, not skipped.** `queryScope` has one query shape: `street=<what the user typed>` |
| 3 | result filter `isInsideCircle(x, circle)` against that one circle | `scope.circles.some(c => isInsideCircle(x, c))` — the whole city |
| 4 | `AddressPicker`'s `isSmallSettlement` → «нет базы адресов» | removed; the empty state no longer names a settlement |

`ResolvedArea.isStandaloneSettlement` is **gone from the type**, deliberately, so
nothing can re-read it. `ServiceCircle.standalone` stays — it is generated from
the fixture and asserted by `backend/common/tests.py`, and it is **descriptive
data, not a switch**.

### ⚠ The city CIRCLE is not the scope either — the city's whole COVERAGE is

`[measured]` **42 of Краснодар's 75** dropdown settlements and **12 of
Геленджик's 26** sit OUTSIDE their city circle:

| settlement | km from city centre | city radius |
| --- | --- | --- |
| Кабардинка | 15.2 | 10.0 |
| ст. Динская | 28.1 | 16.0 |
| п. Северный | 29.9 | 16.0 |
| Бетта | 32.4 | 10.0 |
| ст. Михайловская | 54.7 | 16.0 |

Scoping to `cityCircle()` alone would delete every one of those settlements'
streets — the same class of bug as scoping to the Район, pointing the other way.
**Use `circlesForCity()`.**

### ⚠ The viewbox is a HINT. The circles are the TEST.

The box circumscribing Краснодар's whole coverage is ~55 km across, so it does
contain unserved towns — that is expected and safe **only** because every result
is re-checked against the union of the circles. Proof the filter fires, not just
that it exists: `street=Советская` inside that box returns **26** rows and the
filter drops **11** — Адыгейск, ст. Воронежская (Усть-Лабинский), ст.
Платнировская and х. Раздольная (Кореновский), с. Красногвардейское `[measured]`.
**⛔ Never promote that rectangle to the membership test.**

### ⚠ Two viewboxes, UNIONED — a city-wide sweep alone loses local streets

Nominatim ranks globally and caps at `limit=40`. `street=Красная` across all of
Краснодар's coverage returns 40 rows that are **all** in the city centre, and
ст. Динская's own Красная is **nowhere in it** `[measured]` — so "search the
whole city" was true of the query and false of the results.

`/geo/suggest` therefore sweeps **two** boxes when a Район with a circle is
selected — the city's coverage and the Район's own — and **unions** them. It is
**additive**: both sets pass through the same city-wide circle filter, so the
second box can only ADD rows, never remove one. Sequential, not concurrent —
Nominatim asks for <= 1 req/s and a burst is what produced the 429 documented
above.

**⛔ Do not "simplify" this by scoping the query to the second box. That is the
п. Северный bug re-spelled.**

`limit` is **40**, not 8, for the same reason: with a box this wide, a common
name could fill an 8-row response with rows the filter then discards, turning a
city-wide search into «ничего не найдено».

### Ordering is what makes a city-wide list usable

Results are sorted by **distance from the selected Район's centre** (the city's
centre when no Район is chosen), so the nearest match is first, and every row
carries the settlement it is in. The badge falls back to **our own circle's
name** when OSM names no place — a bare «Краснодар» on a street actually in
х. Ленина is worse than no badge, it is wrong.

`[measured]` Краснодар + ст. Динская + «Красная» → Динская's own two first
(45.21928/39.22284, 45.20641/39.23628), then the city centre's seven, then
Прикубанский округ. Краснодар + п. Северный + «Советская» → Псекупс, Гатлукай,
Тахтамукай, Энем, Козет, Новодмитриевская, Яблоновский, then the city centre —
increasing distance from п. Северный throughout.

### The empty state may not claim a settlement has no address database

It used to say «В населённом пункте «X» нет базы адресов» whenever the Район was
standalone. Once the scope became the whole city that became simply false. The
wording is now:

> Улица не найдена в городе «Краснодар» — искали по всему городу и его
> населённым пунктам. Проверьте написание или введите улицу и номер дома вручную
> и поставьте метку на карте.

(and without a city chosen: «Улица не найдена. Проверьте написание или введите
улицу и номер дома вручную и поставьте метку на карте.»)

**⚠ This is NOT the outage message.** «Подсказки адреса сейчас недоступны» still
covers a 429/5xx — the `anySucceeded` flag that keeps those apart is untouched,
and now exists at two levels: per scope, and per viewbox inside a scope.

### ⚠ `/geo/suggest` is uncached, and that is now explicit

`dynamic = "force-dynamic"` plus `cache: "no-store"` upstream already kept it out
of Next's route and data caches, but the response carried **no `Cache-Control`
at all** `[measured]`, leaving browser reuse to heuristics. Every response —
including the 502 outage branch — now sends **`Cache-Control: no-store`**, so a
stale `{"items":[]}` from the old behaviour cannot outlive this change.
`[measured]`: two identical requests 5 s apart both round-tripped (2328 ms,
1393 ms); a cached second call would be single-digit ms.

### Coordinate validation is UNTOUCHED

A point is valid iff it is inside **any** circle, whichever city owns it. This
change is search-scoping only. `[measured]` through the real
`PublicSaleRequestCreateSerializer._validate_point`, 11/11 as expected:
п. Северный, Бетта, ст. Динская, Кабардинка, and the exact pin a real map click
produced (**44.825500/39.212952**) all **accepted**; Новороссийск, Сочи, Москва,
Усть-Лабинск all **rejected**. A hand-typed address survives the map click
unchanged (`textIsOursRef`), so the manual path in a rural settlement is intact.

### Map centring is the Район's ONE remaining job — and it still works

`[measured]` on the real /sell form: Краснодар alone → 45.027/38.9795 z12;
selecting «п. Северный» → **44.8247/39.2102 z15**; Геленджик alone →
44.5905/38.0566 z12; selecting «Бетта» → **44.371/38.3972 z14**. Read back from
the loaded OSM tile coordinates, which encode position exactly.

## Two location tables — don't assume one covers both

**`District`** has `district_type`: `city_district` (a **container**, e.g.
«Микрорайоны Краснодара») or `suburb` (a **terminal** village/settlement).
**`Neighborhood`** («Микрорайон / Населённый пункт») holds the actual named
microdistricts, each with a `city` and a parent `District`.

**Krasnodar and Gelendzhik are structured DIFFERENTLY:**

- **Krasnodar:** a dedicated `city_district` row whose children are Neighborhoods.
- **Gelendzhik:** **no** `city_district` — «Геленджик» itself is a `suburb` District
  whose children are Neighborhoods.

**Any code assuming "microdistricts only exist under a `city_district`" silently
misses Gelendzhik. Always fetch/join `Neighborhood` by `city`**, not by walking
`District.district_type`.

**Query-param wiring:** District → `district_slug` → `district__slug`. Neighborhood
→ a **separate** param, `neighborhood_slug` → `neighborhood__slug`. A UI letting a
user pick "a location" must track **which table** the selection came from — a
`{kind: 'district' | 'neighborhood', slug}` shape — and route to the matching param.
**Sending a Neighborhood's slug as `district_slug` silently returns zero/wrong
results** even though the slug looks valid, because it is checked against the wrong FK.

- Verified **0 slug collisions** in current data (Neighborhood slugs embed their
  parent district), but **don't rely on that holding** — the `{kind, slug}`
  disambiguation is what makes them collision-proof **by construction**.
- **Known gap (not fixed):** the SEO landing routes filter server-side via their own
  resolver and do **not** support targeting a specific neighborhood — only districts.

### Which location picker to use

- **`LocationAutocomplete`** (`components/crm/LocationAutocomplete.tsx`) — exported,
  reusable, **id-emitting**. Optional `createEndpoint` for inline create; omit it and
  it never touches CRM auth, so it works on **public** forms too. **Use this for any
  FORM that saves a location FK by id** (CRM property form, public /sell).
- **`DistrictCombobox`** (inside `SearchBar.tsx`) — **not exported**, slug-based,
  kind-tagged, built for the catalog **search/filter** flow. Use only for filtering;
  it cannot be dropped into a save-by-id form without a rewrite.

This split is a deliberate, correct engineering choice on the /sell form — **do not
"fix" it back for superficial spec consistency.**

---

## Leaflet / react-leaflet

### Mount-only props

**`<MapContainer center/zoom>` are MOUNT-ONLY** — react-leaflet ignores changes
after the initial render. To recentre programmatically, use a **child component**
calling `useMap()` + `map.setView([lat, lng], zoom)` inside a `useEffect` keyed on
the coordinates.

**Do NOT use a `key={lat-lng}` remount hack** — it causes tile flicker and fails
silently when the same coordinate is re-selected.

### Loading rule

Any map component — or any component that statically imports `leaflet` or
`react-leaflet`, **including `AttributionControl`** — **must** be loaded via
`next/dynamic(() => import(...), { ssr: false })`. See the `ssr:false` section in
`nextjs-and-react.md` for the trap that makes this insufficient on its own.

### ⭐⭐ A map showing a SET of markers must FIT to them

**RULE: any map rendering more than one marker mounts `FitToMarkers` from
`components/map/FitToMarkers.tsx`. Never ship a multi-marker map with a hardcoded
`center`/`zoom`.**

`CatalogMap` opened at `zoom={11}` centred on the **centroid** of its markers. With
listings in Krasnodar and Бетта — **97 km apart** — that view lands in the hills
between them and shows **no markers at all**. On the homepage that reads as "there
are no listings"; the owner had to zoom out by hand to discover their own objects.

| Case | Behaviour |
| --- | --- |
| Several spread markers | `fitBounds` with **48 px** padding |
| **Exactly one marker** | `setView` at **`SINGLE_MARKER_ZOOM = 15`** — `fitBounds` on a zero-area box goes to MAX zoom and shows a doorstep |
| **Near-identical coordinates** | same street-level branch when the set spans **< 0.0005°** (~55 m) — two flats in one building must not collapse to an unusable zoom |
| **Zero markers** | `serviceAreaBounds()` plus a Russian overlay. Both callers already replace the map with their own explanation, so this is defensive |
| **Two distant clusters** | fits both, at low zoom, **on purpose** |

- **⚠ THERE IS DELIBERATELY NO `maxZoom` CAP ON THE FIT.** Capping the zoom-out to
  keep tiles "readable" would reintroduce the original bug — seeing every object at
  once is exactly what was asked for. `[measured]`: both properties frame at **z=8**
  with both icons in the viewport.
- **⚠ Refit only when the MARKER SET changes — user intent outranks the fit.** The
  effect is keyed on a **sorted list of the coordinates themselves**, not render
  count or array identity, so a re-render producing the same markers is a no-op and
  a pan or zoom the user performed is never yanked back `[measured]`. Filters **do**
  refit, because they change the set.
- **A single-point map is NOT this.** `PropertyMap` (property detail) shows one
  property at fixed zoom 14 and correctly has **no** `FitToMarkers`.
- The homepage and catalog map are the **same component** (`CatalogMap`), so one fix
  covers both surfaces.

### Tile layer convention: OpenStreetMap, from the shared constants

**RULE: every `<TileLayer>` uses `OSM_TILE_URL` / `OSM_TILE_ATTRIBUTION` /
`OSM_MAX_ZOOM` from `components/address/addressMapConstants.ts`. Do not type a tile
URL into a component.** All four call sites import them. No `{s}` subdomain — OSM
deprecated a/b/c.

Geocoding had moved to Nominatim while the tiles had not, so every map credited
«© 2GIS» for data 2GIS no longer supplied.

**2GIS is fully gone from the running application** `[measured]` — zero requests to
any 2gis host across a run covering the homepage, catalog map, filtered map, empty
state and a property detail page. Remaining references, all inert:
`NEXT_PUBLIC_2GIS_API_KEY` in `frontend/.env.local` (read by nothing; a dead key in a
gitignored local file, left alone rather than editing the owner's env), and
`AccountSaleRequestDetail.tsx`'s outbound **link** to `2gis.ru/geo/...` — a link, not
a tile or an API call.

The Leaflet attribution badge is required by licence and cannot be removed, but can
be replaced with `attributionControl={false}` plus a custom `<AttributionControl>`.

### ⚠ A full-width map must not trap page scroll on mobile

One-finger drag over a Leaflet map pans the map and the page stops scrolling,
stranding a reader mid-form. `AddressPickerMap` sets `dragging={!isTouch}` (detected
via `matchMedia("(hover: none) and (pointer: coarse)")`) while keeping `touchZoom`
on. **The MARKER stays draggable regardless** — marker dragging is independent of map
dragging — and a tap still places the point. `[measured]` at 375px: no horizontal
overflow, page scrolls past the map.

### Layout details

- The map wrapper has a **fixed height** (`h-[260px]`) shared with the
  `next/dynamic` `loading` placeholder, so mounting the chunk shifts nothing.
- The suggestion dropdown uses `z-[1000]` in the **bracket form** — it sits directly
  above Leaflet's 400–600 panes.
- **The address field's icon gutter is DERIVED, not a magic number.**
  `.ctr-control--icon-left`/`--icon-right` compute padding as
  `calc(var(--field-icon-inset) + var(--field-icon-size) + var(--field-gutter))`, and
  `AddressPicker` positions the icons from those same three custom properties. Move
  the icon and the text gutter follows. `[measured]` at 375/768/1440: padding-left
  **42px** (12 + 16 + 14), text starting 14.0px clear of the pin.

---

## The submit gate on /sell was never what it looked like

`[measured]`: the button's condition was `submitting || captchaLoading || !consent`
— **not** gated on the other required fields, despite the "Заполнено N из 8" header
implying it. With consent ticked the form could be submitted with a required field
empty, and only the inline error stopped it. The new address **is** gated on the
button as well as in `validate()`; the pre-existing fields were left alone rather
than silently changing their behaviour. **If you touch that header, check the button
condition too — they are separate.**
