# CLAUDE.md — Centreal real-estate platform

Read this file every session. It is deliberately small so it always loads.
Everything else lives in `docs/claude/*.md` and is read **on demand** — the index
at the bottom says which file a given task needs.

---

## RULE ZERO: state HOW every factual claim was verified

Three claims in the old version of this file were found wrong, each written with
the confidence of a measurement, each costing real debugging time. So:

- Label evidence inline: **`[compiled CSS]`** (grepped the dev server's own
  stylesheet at `http://localhost:3001/_next/static/css/app/layout.css` — the only
  proof a Tailwind class emits a declaration), **`[measured]`** (read back from a
  real browser or a real process), **`[observed]`** (seen once, not reproduced),
  **`[inferred]`** (reasoned from docs — allowed, it just has to say so).
- **Anything unlabelled is UNVERIFIED.** Do not build on it; re-verify, then label.
- Never write "verified" without naming the mechanism.
- Prefer falsifiable numbers to adjectives.

There is **no Tailwind CLI in this project** (v4 ships it as `@tailwindcss/cli`,
not a dependency here). Any claim resting on "the Tailwind CLI probe" is folklore.

---

## The machine and the stack

- **Windows 11, native — no Docker, no WSL** in the running path.
  `docker-compose.yml` is production/infra reference only.
- **The repo lives on a pCloud virtual drive (`P:\`).** This is the single largest
  source of non-code failures here. See `environment-and-launcher.md`.
- **Backend:** Django + DRF (`backend/`), PostgreSQL 18 native on 5432
  (`real_estate_db`), Celery + Memurai (Redis) on 6379.
- **Frontend:** Next.js 15 (App Router, TypeScript) in `frontend/`, Tailwind v4.
- **Maps:** Leaflet / react-leaflet, **OpenStreetMap tiles**, **Nominatim**
  geocoding. 2GIS and Yandex are both gone — their keys are dead.
- **Production:** Railway exists but **the project is local-only today.** The
  target is a Beget VPS via Docker. See «Production deploy» below.
- **⛔ Docker is NEVER run on the Windows dev machines** (no `docker build`, no
  `docker compose`, not even to "just check"). Production images are built
  and checked **only on the VPS**. Locally you may only validate the files
  (YAML well-formed, referenced paths exist).

### Production deploy (Beget VPS) — `deploy/README.md`

`docker-compose.prod.yml` (repo root) with these services:
- caddy, the only service with ports 80/443 (`deploy/Caddyfile`, site
  address from `SITE_ADDRESS`);
- frontend (`frontend/Dockerfile.prod`, Next.js `output: "standalone"`);
- backend, celery and celery-beat, all from one image built from
  `backend/Dockerfile`;
- db (`postgres:18`) and redis, which publish no ports and sit on an
  `internal: true` network.

The full step-by-step guide in Russian is in `deploy/README.md`; the env
template is `deploy/.env.prod.example`. The real `deploy/.env.prod` and
`deploy/backups/` (dumps) exist only on the server and are gitignored.
- **⚠ `CENTREAL_DEPLOYED=1` is what makes a container "deployed"**
  (`settings.IS_DEPLOYED`). The compose file sets it on every Django service.
  Before 2026-10-12 only `RAILWAY_*` variables counted, so on a non-Railway
  host a missing `DJANGO_SECRET_KEY` became a random key **per process**
  (every gunicorn worker signing JWTs differently), and the DEBUG guard was
  off. Deployed also means **`DATABASE_URL` wins** (compose builds it from
  `POSTGRES_*`). Never set `CENTREAL_DATABASE_URL` in production.
- **`NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_API_URL` and `BACKEND_URL` are BUILD
  args.** `rewrites()` in `next.config.ts` is evaluated at build time.
  Changing them means `up -d --build frontend`, not a restart. Those three
  (plus `BACKEND_INTERNAL_URL` and the server-side `NOMINATIM_CONTACT_EMAIL`)
  are the only env vars frontend code reads; the
  old `NEXT_PUBLIC_MAP_PROVIDER` / `NEXT_PUBLIC_YANDEX_MAPS_API_KEY` are dead.
- **`CSRF_TRUSTED_ORIGINS` needs an explicit `http://` for the IP phase.**
  `settings._csrf_origin_with_scheme` prepends `https://` to a bare host.
- Caddy appends the trailing slash to `/api/*` paths itself (the same
  contract as the Next.js rewrite), because browser `/api` calls now reach
  Django directly.

### Ports are FIXED. Do not auto-select, do not walk.

| | port | why not the round number |
| --- | --- | --- |
| Frontend | **3001** | 3000 is held by `java.exe` — the VS Code extension `ibm.db2forzosdeveloperextension` `[measured]` |
| Backend | **8001** | 8000 is held by an unrelated `Manager.exe` `[measured]` |

Start with `Start Centreal.bat` (→ `scripts\start_local.ps1`). Stop with
`scripts\stop_local.ps1`. **Always stop before relaunching** — a second stack
exhausts Postgres connections and produces intermittent `OperationalError`.

### Git on the pCloud drive

**Automatic git gc/maintenance is disabled on the pCloud repo because repack
hangs on pCloud I/O.** Repo-local config: `gc.auto=0`, `maintenance.auto=false`.
`[measured]` 2026-10-12: a `git fetch` started `maintenance run --auto`, and
its `pack-objects` sat for 4+ minutes using 0.3 s of CPU (waiting on disk)
until it was killed. `fsck --connectivity-only` was clean afterwards. Do not
re-enable them. If the object store ever needs repacking, do it from a copy on
a local disk.

### Environment files

Django reads **`backend/.env`** only (python-dotenv looks for exactly `.env`, never
`.env.local`). Next.js reads `frontend/.env.local`. The root `.env` is
docker-compose reference. All are gitignored.

### The Python venv lives OUTSIDE pCloud — `%LOCALAPPDATA%\Centreal\venv`, per machine

The repo is synced by pCloud between two PCs with **different Windows user
names**. A venv is not portable: its `pyvenv.cfg` hard-codes the absolute path of
the base interpreter (`C:\Users\<user>\AppData\Local\Programs\Python\Python310`),
so the old `backend\.venv`, built on one machine, died on the other with
`No Python at 'C:\Users\<other user>\...\python.exe'`.

- **Never create a venv inside the synced tree** (`backend\.venv` is legacy,
  gitignored, safe to delete). Never hard-code a `C:\Users\...` path — locate
  Python with the **py launcher** (`py -3.10`; fallback newest 3.10–3.12 from
  `py -0p`) and the venv via `$env:LOCALAPPDATA`.
- **The launcher self-heals** (`start_local.ps1` step 2/7): if the venv is missing
  or its `python.exe -c "import sys"` fails, it is deleted and rebuilt; packages
  are (re)installed whenever the SHA256 of `backend\requirements.txt` differs from
  `<venv>\.requirements.sha256`. First run on a machine takes minutes; later runs
  skip pip. A `requirements.txt` change synced from the other PC triggers an
  install on the next launch.
- Manual commands: `& "$env:LOCALAPPDATA\Centreal\venv\Scripts\python.exe" manage.py ...`

### Each machine has its OWN PostgreSQL — the data does not sync

pCloud syncs the code and `backend\.env`, **never the database**. Each PC runs its
own PostgreSQL 18 on 127.0.0.1:5432.

- **The `postgres` password must be identical on both machines** — it is read from
  the synced `backend\.env`. A mismatch surfaces as a bare
  `psycopg2.OperationalError` with an EMPTY message (the server's cp1251 "password
  authentication failed" cannot be decoded) — and only at `runserver`, because
  `manage.py check` never opens a connection `[measured]`.
- **`psql` / `pg_dump` / `pg_restore` are NOT on PATH** — call them by full path:
  `& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -h 127.0.0.1 -U postgres ...`
- **The FULL data (users, owners, PID000001) lives only in the DESKTOP's
  PostgreSQL.** The laptop holds a partial restore (2026-10-11): locations +
  articles + one local-only superuser `admin@admin.com`; properties / owners = 0.
- **⛔ `backup_local.json` is NOT a way to move the data.** The valid copy
  (`P:\pCloud\work\Web_projects\Centreal\backup_local.json`) holds only 283 objects
  of locations + articles — no users, owners or properties `[measured]`. The copy
  in `backend\` is cp1251 and truncated mid-object (gitignored; to be deleted).
- **Move the full data with a `pg_dump` file.** ⚠ **NOT YET EXECUTED** — owner's
  procedure, not run on either machine yet; replace this flag with the measured
  result once it has been.
  - **⛔ The dump lives in `P:\pCloud\work\Centreal_db\`, OUTSIDE the repo, on
    purpose.** It contains password hashes and real contacts; it must never be
    inside the git working tree.
  - **Source** (the machine with the data, today the desktop; site stopped):
    create `P:\pCloud\work\Centreal_db\`, then
    `& "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe" -U postgres -h 127.0.0.1 -Fc -f "P:\pCloud\work\Centreal_db\real_estate_db.dump" real_estate_db`.
    **Wait until pCloud has finished syncing the file** before switching machines.
  - **Target** (site stopped): check the dump's size matches the source machine's,
    then
    `& "C:\Program Files\PostgreSQL\18\bin\pg_restore.exe" -U postgres -h 127.0.0.1 -d real_estate_db --clean --if-exists --no-owner "P:\pCloud\work\Centreal_db\real_estate_db.dump"`.
    Verify counts (properties, owners, users) and that PID000001 exists with
    internal id 18.
  - **The restore REPLACES the target database completely** — e.g. the laptop's
    local-only `admin@admin.com` is replaced by the desktop's users.
  - **⛔ Data flows ONE WAY at a time.** Before working on the other machine, dump
    from the machine you last edited data on. Never edit data on both machines
    without syncing in between — one side's changes will be lost.
- **A new machine:** create `real_estate_db` (`OWNER postgres ENCODING 'UTF8'
  TEMPLATE template0`), `manage.py migrate` (103 migrations `[measured]`; 0014
  passes only with the uncommitted working-tree fix), then restore the dump. If
  `loaddata` is used instead, reset sequences for **every** app afterwards
  (`sequence_reset_sql` over `apps.get_models()`; 41 statements `[measured]`).

### An ambient OS env var SILENTLY BEATS `backend/.env`

`load_dotenv()` does not override a variable that already exists in the
environment. This machine carries a User-level `DATABASE_URL` (pointing at an
unrelated `mindmem` database) and `NODE_ENV=production`. Both have already caused
real incidents — a whole root-cause investigation once ran against the wrong
database.

- The backend reads **`CENTREAL_DATABASE_URL` first** — a project-specific name
  nothing else on the machine can shadow — and prints the resolved database and
  media backend to stderr at startup. **Read those `[Centreal]` lines; never assume.**
- **Do NOT unset or rename the ambient `DATABASE_URL`** — another tool depends on it.
- Every diagnostic that reports row counts must name the database it counted them in.
- `/api/properties/` returning `[]` does **not** distinguish the two databases —
  the real one is also empty locally. Only the connection name does.

### PowerShell quirks that have each cost a session

- `npm run dev -- -p 3001` is **swallowed** under PowerShell (Next treats `3001` as
  a directory path). Set the **`PORT` env var** in the window instead.
- `[System.IO.File]::WriteAllText` fails with *Access denied* on
  `frontend/.env.local` — dot-files are **Hidden** on this drive and `CREATE_ALWAYS`
  is denied on a hidden file. Use `::Open(..., OpenOrCreate, ...)` + `SetLength(0)`.
- `Get-Content` without `-Encoding UTF8` under PS 5.1 reads ANSI and mojibakes
  Cyrillic on a read-then-write cycle. Name UTF-8 on both sides.
- `if` as a hashtable **value** is PS 7 only — a parse error in 5.1. The launcher
  must run under both.
- `manage.py shell < script.py` **silently no-ops** here. Use
  `manage.py shell -c "exec(open('script.py', encoding='utf-8').read())"`.
- `Get-Clipboard -TextFormatType Html` decodes UTF-8 as ANSI and mangles Cyrillic —
  the payload is fine. Verify clipboard HTML by pasting it into a browser.

---

## ⛔ HARD PROHIBITIONS

These are not suggestions. Each one has already caused damage.

1. **NEVER stage by directory.** No `git add .`, no `git add -A`, no bare
   directory. Stage explicit file paths only. `git add frontend/` has swept the
   owner's uncommitted work into an unrelated commit **twice**.
2. **NEVER commit `frontend/src/app/privacy/page.tsx`.** It has carried an
   uncommitted edit of the owner's since 2026-08-03. It is work in progress, and
   its age may be the only clue to what it was. Do not commit it, and do not
   "helpfully" revert it.
3. **Run `git status --short` BEFORE every commit** and account for every line; run
   `git show --stat HEAD` AFTER and confirm the file list. A `M` you did not cause
   belongs to someone else.
4. **NEVER touch these records** — do not mutate, delete, "restore", or use them as
   test fixtures:
   - **Property #18 / `PID000001`** — the only real listing. Verify its integrity
     after any work touching `Property`, `PriceHistory` or their signals, and never
     overwrite a real edit with a remembered "baseline".
   - **Property #178**, **sale request #16**, **sale request #38**.
     *(Owner-stated 2026-09-01. These three appear nowhere in the project's own
     history and are **unverified** — confirm the ids before relying on them.)*
5. **NEVER `rm -rf .next`.** Cold rebuilds on pCloud fail far more often than warm
   incremental writes, and thrashing `.next` can leave the drive holding file locks
   that only the pCloud client releases. Prefer a warm restart.
6. **NEVER let a test fixture reference a real record's file paths.** A fixture owns
   its own bytes. Deleting the fixture deletes the shared file — this destroyed
   #18's photo derivatives once.
7. **NEVER run a bulk media operation without first reading the `[Centreal] MEDIA`
   startup line.** There is one R2 bucket and no dev bucket; cloud deletes are not
   recoverable.
8. **NEVER perform a web search unless explicitly asked.** Needed external data is
   supplied in the prompt. If you think you need to search, stop and ask.

---

## Brand assets (logo, icons, OG image)

- **Source package:** `centreal-logo-package` (svg masters, png, web icons,
  social, brand sheet). It is meant to live OUTSIDE the repo and is read-only.
  ⚠ As of 2026-10-12 it actually sits UNTRACKED at
  `frontend/public/Direction options for Central logo/centreal-logo-package/`,
  so `next dev`/`next start` serve the whole package publicly. Move it out of
  `public/` before deploying.
- **What the site uses (`frontend/public/`):** `favicon.ico`, `icon.svg`,
  `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`,
  `icon-512-maskable.png`, `site.webmanifest`, `og-image.png` (1200×630), and
  `brand/logo-header.svg`, `brand/logo-footer-reversed.svg`,
  `brand/centreal-mark-primary.svg`, `brand/centreal-mark-white.svg`.
- **⛔ Strip C2PA before adding any SVG.** Every SVG in the package carries a
  `<metadata><c2pa:manifest>` block plus `xmlns:c2pa` (~7–8 KB of base64 —
  `logo-header.svg` 12 085 → 4 311 B). Remove only those two; paths, viewBox
  and fills stay byte-identical.
- **`icon.svg` carries a style the package lost:** primary `#2563EB`, and
  `#7AA5FF` under `prefers-color-scheme: dark` (the brand sheet's "icon.svg on
  dark tabs"). The delivered file had no fill at all and rendered black.
  Re-add it if the file is ever re-copied.
- **⛔ Icons/manifest/OG/theme-color are declared ONLY via the Metadata API in
  `src/app/layout.tsx`** (`metadata.icons`, `manifest`, `openGraph`, `twitter`,
  and `viewport.themeColor`). No raw `<link>` tags, and **no `app/favicon.ico`
  or `app/icon.*`**: the App Router auto-serves those and would emit a second,
  competing icon set. One set in `<head>` on `/` `[measured]`.
- **Header logo size is constrained by the header fit:** 28px tall (99px wide,
  the old wordmark's width) below 1280px, 32px from 1280. The 1024–1040
  overflow with a favourite is pre-existing and unchanged by the logo
  (`scrollWidth` 1047 logged out / 1038 logged in at 1024 `[measured]`).

---

## ⭐ The agency phone has ONE home — do not create a second

**`HomepageTextBlock` row with key `agency_phone`** (table `common_homepagetextblock`).
Stored canonically as `+7XXXXXXXXXX`; rendered as `+7 (928) 333-08-37`.

- **Public read:** `GET /api/homepage/text-blocks/` (anonymous) →
  `fetchAgencyPhone()` in `lib/homepageTextBlocks.ts`. The header awaits it
  **server-side**, so there is no layout shift.
- **Write:** `PATCH /api/crm/homepage/text-blocks/agency_phone/`, **superadmin
  only** (`IsSuperAdmin`, via `SUPERADMIN_ONLY_TEXT_BLOCK_KEYS` — homepage copy
  keys stay staff-level). Edited in the CRM at **`/account/staff` → «Контакты
  сайта»**; the panel renders nothing for anyone else.
- **Empty means absent.** Clearing it removes the element entirely — the
  conditional is on the wrapper, never inside `HeaderPhone`, so no gap is left.
- **⚠ It is NOT `Agency.phone` and NOT `User.phone`.** `Agency` has **zero rows**
  and its `phone` is exposed by no serializer `[measured]`. What a property page
  reveals is `PropertyContact.phone` falling back to `assigned_realtor.phone` —
  a realtor's PERSONAL field, which that realtor can change via
  `PATCH /api/auth/me/`. Binding the site header to it would let a realtor
  silently change the sitewide number. **Do not "unify" them that way.** The
  right unification, if ever wanted, is the reverse: make `reveal_phone` fall
  back to `agency_phone`.
- Details, breakpoints and the measured header numbers:
  `docs/claude/product-and-domain.md` → «Agency phone in the header».

---

## ⭐ Unread заявки: read state is PER REALTOR and set ON ITEM OPEN

**`LeadReadReceipt` (leads) and `SaleRequestReadReceipt` (submissions).** One row =
one `(item, user)` pair. **The presence of the ROW is the state** — there is
deliberately no `is_read` boolean anywhere, so "read" cannot be expressed halfway.

- **⛔ NEVER "simplify" this into a flag on `Lead` / `SaleRequest`.** A column on
  the item is GLOBAL by construction: sale requests are a shared pool every realtor
  sees, so the first person to open one would silently clear it from everyone
  else's counter. That is the single failure this design exists to prevent.
- **⛔ NEVER mark read from a LIST view.** The receipt is written only by
  `POST /api/crm/leads/<pk>/mark-read/` and
  `POST /api/crm/sale-requests/<pk>/mark-read/`, called when the realtor opens
  **that item's** detail (the «Подробнее» panel for a lead, the detail page for a
  sale request). A list that marks everything read is a counter that always
  reads zero. It is a POST, not a side effect of GET, so the intent stays explicit.
- **Read is permanent.** An edit to an item does NOT resurrect it. If re-notifying
  on edit is ever wanted, raise it — do not just add it.
- **The count is defined by what the realtor can OPEN.** `common/crm_unread.py`
  builds the inquiry count from `crm_lead_queryset_for_user` — the same function
  that serves the list — so the badge can never point at a row that 404s. Leads
  with `assigned_realtor IS NULL` (homepage-form leads) are therefore in NOBODY's
  count, because no realtor can open them. **That is a known gap, not an
  oversight** — see `docs/claude/product-and-domain.md` → «Unread counters».
- **Realtors only** (`role=realtor`). `user_gets_unread_indicator()` is the ONE
  definition, mirrored in `lib/employeeUser.ts: roleGetsUnreadIndicator`. Staff
  roles get honest zeros, not a 403.
- **Delivery is POLLING, 30s, `GET /api/crm/notifications/unread-counts/`** —
  counts only, no item data. **Do not introduce Channels or a WebSocket layer**
  (no ASGI server here, owner decision). Hidden tab → no polling.
- **The header badge is `absolute` on the avatar and MUST stay that way.** The
  header is at capacity in the 1024–1139px band; an absolutely positioned badge
  adds exactly 0px to the row at any count. Verified `[measured]` at 375/768/
  1024/1140/1280/1440 with a favourite present: `scrollWidth` identical with no
  badge, "1", "42" and "99+". Display caps at **99+**.
- **The sound belongs to ONE place** — `lib/crmUnreadCounts.ts`, on an INCREASE
  only, never on load (the first successful poll just sets the baseline). The
  per-realtor switch is `User.crm_notify_sound_enabled`, server-side so it follows
  the realtor to any browser; the toggle lives under the cabinet sidebar nav.
  Do not add a second sound call site.

---

## ⭐⭐ ADDRESS SEARCH SCOPES TO THE CITY — ALWAYS. Район only moves the map.

**Supersedes «address search scopes to the settlement that OWNS the street data»
(2026-08-31). That rule is retired — do not reinstate either half of it.**

The Город/Район pair feeds `resolveArea()` in
`components/address/addressMapConstants.ts`. The **search scope is the selected
city's WHOLE coverage** — its own circle **plus every settlement circle
belonging to it** — for **every** row type. The Район narrows **nothing**.

- **⛔ `ServiceCircle.standalone` MUST NOT REACH THE SEARCH PATH.** It still
  exists, is still generated from the Django model and is still asserted by
  `backend/common/tests.py::test_standalone_flag_matches_the_dropdown_model` —
  it is **descriptive data, not a switch**. The previous rule used it to decide
  «search this settlement» vs «search the parent city»; that decision is gone.
- **⛔ The Район's NAME must never reach Nominatim** — not as `city=`, not
  inside `q=`. Its only surviving use is `stripRedundantLocality`, which
  **removes** text the owner duplicated («Садовая 3 хутор Бетта» → «Садовая 3»).
- **⭐ What the Район still does, deliberately: centres the map** (`center`/
  `zoom`, `[measured]`: selecting п. Северный moves the map from 45.027/38.9795
  z12 to 44.8247/39.2102 z15) **and orders the results** by distance from
  itself.

**Why the old rule was wrong for this product.** It split the Район selector
into standalone settlements (searched on their own) and city subdivisions
(searched city-wide). That is accurate about OSM and wrong here: an owner picks
the Район nearest them and then types a street belonging to the city.
`[measured]` «Краснодар + п. Северный + хлебосольная» → **0 results** and «В
населённом пункте "п. Северный" нет базы адресов», for улица Хлебосольная at
45.13151/38.98944, a real Krasnodar street. The dropdown's «п. Северный» is a
hamlet at 44.82551/39.21296 — **29.9 km away, near Псекупс** — classified
`standalone: true`, so the 2026-08-31 fix left the narrowing switched on for it.
That leftover *was* the bug.

**⚠ THE CITY CIRCLE ALONE IS NOT THE SCOPE EITHER.** `[measured]`: **42 of
Краснодар's 75** dropdown settlements and **12 of Геленджик's 26** lie OUTSIDE
their city circle (ст. Динская 28.1 km, п. Северный 29.9, Бетта 32.4,
Кабардинка 15.2, against radii of 16.0 / 10.0 km). Scoping to the city circle
would delete every one of those settlements' streets — the same bug pointing the
other way. Use `circlesForCity()`, never `cityCircle()` alone.

**⚠ The viewbox is a HINT; the circles are the TEST.** The box circumscribing
Краснодар's whole coverage is ~55 km across and does contain unserved towns.
`[measured]`: `street=Советская` in that box returns 26 rows and the circle
filter drops **11** — Адыгейск, Усть-Лабинский, Кореновский, Красногвардейский
районы. ⛔ Never promote that rectangle to the membership test.

**⚠ A city-wide sweep alone loses the Район's own streets, so there are TWO
viewboxes.** Nominatim ranks globally and caps at 40: `street=Красная` over all
of Краснодар returns 40 rows that are **all** in the city centre, and ст.
Динская's own Красная is nowhere in it `[measured]`. `/geo/suggest` therefore
also sweeps the Район's own box and **unions** the two. It is **additive** —
both sweeps are judged by the same city-wide circle filter, so it can only add
rows. ⛔ Do not "simplify" it into scoping the query to that box; that is the
п. Северный bug re-spelled.

**Ordering carries the meaning now.** Results are sorted by distance from the
Район's centre (the city's when none is chosen), so the nearest match is first
and every row shows **which settlement** it is in. `[measured]` «Краснодар +
ст. Динская + Красная» → Динская's own two first, then Krasnodar's centre.

**The empty state may not claim a settlement has no address database.** The
search was city-wide, so the only honest report is that the street was not
found — see `AddressPicker.tsx`.

**Coordinate validation is untouched and stays that way.** A point inside ANY
circle is valid, whichever city owns it. `[measured]` through
`_validate_point`: п. Северный / Бетта / ст. Динская / Кабардинка and the
pin a real map click produced (44.825500/39.212952) all **accepted**;
Новороссийск, Сочи, Москва, Усть-Лабинск all **rejected**. This is a
search-scoping change only.

Details: `docs/claude/address-and-geo.md`.

---

## ⛔ HOSTING-MIGRATION BLOCKERS — resolve BEFORE enabling cloud anything

The project is local-only today, and each of these is **dormant only because of
that**. Every one of them fires the moment the hosting move happens, and each is
invisible until then — which is why they are listed here rather than in a TODO.

### 1. ~~Cloud storage OVERWRITES same-named uploads~~ — RESOLVED 2026-10-12 (uncommitted)

**Was:** keys came from the uploader's filename (`IMG_0042.jpg`) and
`media_storage.py` set `file_overwrite: True`, so on r2/s3 two uploads with the
same name became ONE object and the second silently replaced the first.

**Now, two layers (owner's decision, both applied):**
1. **Unique keys at the source, on every backend.** All 15 upload fields use
   `upload_to=UniqueUploadTo("<folder>")` (`common/upload_paths.py`), so the key is
   `<folder>/<yyyy>/<mm>/<uuid4 hex>.<ext>` with a lowercase extension. Folder
   prefixes are unchanged (`properties/photos`, `…/large|medium|thumb`,
   `sale_requests/photos…`, `users/avatars`, `realtors/photos`, `owners/photos`,
   `agencies/logos`, `articles/covers`, `districts/covers`, `imports/jobs`).
   Compression and derivative saves go through `FieldFile.save()` and therefore
   through this callable, so they keep `.jpg`. Existing rows keep their old keys;
   there is no data migration.
2. **`file_overwrite: False`** in `media_storage.py` as the second safety net.
   ⚠ `migrate_media_to_r2` keeps its own `True` **on purpose**, because it copies
   files to the exact keys the DB holds. Do not "align" it.

- Migrations `*_unique_upload_paths` (7 apps, `AlterField` only). `[measured]`:
  applied on the laptop DB, and **110/110 on a brand-new database** (throwaway
  `centreal_migtest`, dropped afterwards).
- `[measured]` local-storage check with `PIDTEST-U1` rows: two different images
  both named `test.jpg` → 8 distinct keys (2 originals + 6 derivatives), all
  matching the pattern; neither replaced the other; both served by Django
  `/media/` with exact bytes. The avatar got a unique key too. Row counts and the
  `MEDIA_ROOT` file set were identical to the baseline afterwards.
- `[measured]` test suite: 40 failing with the change vs 39 on the same tree
  without it. The one difference is
  `test_admin_lists_activity_logs_newest_first`, which passes 4 out of 4 runs
  alone in both trees (an order/timing flake). The rest are pre-existing: test
  `Property` fixtures without `city`/`district`, among others.
- **Remaining orphan cases (not collisions):** a new key on every save means
  that replacing a SALE-REQUEST photo's image, or re-running a derivative task
  on a row that already has derivatives, leaves the previous derivative
  objects behind. `submissions/tasks.py` deliberately never deletes. Property
  photos clear old derivatives on an original change, and the backfill only
  fills what is missing.
- **⛔ RULE: every `upload_to` must be a `UniqueUploadTo` (UUID-based callable).
  Never rely on original filenames for storage keys.** A new `FileField` /
  `ImageField` without it brings this blocker back.
- **Still true, unrelated to this fix:** deleting a row removes **no** files.
  There is no `post_delete` handler anywhere `[measured]`: deleting the
  PIDTEST photo row left all 4 of its files on disk. See
  `docs/claude/media-and-images.md`.

### 2. ~~No `.dockerignore` for the backend~~ — RESOLVED 2026-10-12

`backend/.dockerignore` now exists (uncommitted). It excludes the venvs,
caches, `.env*` (except `.env.example`), `media/`, `staticfiles/`, `*.sqlite3`,
`*.dump`, `*.sql`, `backup*.json`, the personal-data fixtures 03/04, VCS and
editor files, logs, `Dockerfile.dev`, `docker-compose*.yml` and
`nixpacks.toml`. An emulation of Docker's matching rules over the real
`backend/` `[measured]` shows 257 files / 1.3 MB shipping (was 12 424 files), with
all 10 apps, `config/`, 83 migration files, `static/` and
`create_initial_admin` present, and nothing secret or local-only. **Not verified with a
real `docker build`**: the Docker CLI is installed but the Docker Desktop
engine was not running on the laptop.

- **⛔ Rule: anything secret or local-only must be in `.dockerignore` BEFORE any
  image build.** `COPY . .` ships whatever is not excluded. A new local file
  (dump, backup, `.env.*`, export) must be added to `.dockerignore` first.
- Patterns are relative to the context root: use `**/__pycache__/`, not
  `__pycache__/`, or only the top level is matched.
- The frontend's production image is `frontend/Dockerfile.prod` (2026-10-12).
  `frontend/.dockerignore` excludes `node_modules/`, `.next/`, `.env*`, test
  output and **`public/Direction options for Central logo/`** (the brand
  source package).

### 3. The 0014 migration fix is UNCOMMITTED

`backend/properties/migrations/0014_property_slug_latin.py` carries the
`apps.get_model()` + frozen-slug-copy fix **in the working tree only** — not
staged, not committed `[measured]`. The bug it fixes (`from properties.models
import Property` plus a `.defer()` for a column that does not exist yet) breaks
**only on a fresh database**, i.e. precisely when standing up the new host. If
the migration is deployed as committed, the first `migrate` on the new host
fails. See `docs/claude/django-and-migrations.md`.

### 4. ~~Hard-coded initial admin~~ — RESOLVED 2026-10-12 (uncommitted)

`create_initial_admin` runs on **every** container start (Dockerfile CMD:
migrate → create_initial_admin → gunicorn), and it used to create
`admin@admin.com` with the local dev password (see local notes) on any database without a superuser. The repo
is public, so a fresh server would have had a superadmin with a known password.

- It now reads **`INITIAL_ADMIN_EMAIL` / `INITIAL_ADMIN_PASSWORD`**
  (documented in `backend/.env.example`). If a superuser exists it skips. If
  either variable is missing, or the password fails `validate_password`, it
  prints a warning (never the password) and **exits 0**, so the container
  still starts. There is **no default credential**. ⛔ Do not add one back.
- **Production:** either set both variables **only for the very first start**
  and then remove the password from the server's env, or restore the database
  from the desktop dump (it already has superusers, so the command skips).
  ⛔ **After ANY dump restore on the server, immediately change the password of
  every superuser, or deactivate the local-dev ones** — the desktop DB carries a
  local-dev superadmin with a known password. See `deploy/README.md`.
- `[measured]` on the laptop: the real run skips ("Superuser already exists").
  The no-superuser paths were exercised inside a rolled-back transaction:
  unset → warning; only email → warning; an all-digit common password → two validator messages,
  nothing created; valid → superadmin created; rerun → skip. `users_user` was
  identical afterwards.
- The laptop's local `admin@admin.com` superuser (local dev password, see local notes) is just a row in
  that machine's database. It is unaffected, and will be replaced by a dump
  restore.

---

## Working agreements

- **Prompts to the agent are always in English**, even though the planning
  conversation is in Russian. Follow them as given.
- **Report findings BEFORE making changes** when asked to investigate. When told to
  check something without changing it, do not modify files.
- Prefer small, single-purpose tasks. One prompt = one action.
- **Typecheck after any multi-file change**, with the project-local binary:
  `& "frontend\node_modules\.bin\tsc.cmd" --noEmit -p frontend\tsconfig.json`.
  Bare `npx tsc` from the repo root does not resolve — TypeScript is a `frontend/`
  dependency — and prints a misleading "not the tsc command you are looking for".
- **Path gotcha after `cd`:** with the shell inside `frontend/`, writing to
  `frontend/src/...` silently creates a nested `frontend/frontend/` rather than
  erroring.
- **Leave a marker when you defer or stub work**, naming what was skipped and the
  upgrade path.
- **A build or test result must name WHERE it ran and WHAT was patched.** To claim
  "the repo builds", build the repo — `git archive HEAD`, never a copy of the
  working tree, which silently includes uncommitted fixes and untracked files.
- **A FAILED LOOKUP IS NOT AN EMPTY RESULT — never let one render as the other.**
  A `catch` that returns `[]` makes a provider outage indistinguishable from
  "nothing matched", at every layer above it. This shipped: a rate-limited
  Nominatim made `/geo/suggest` answer `200 {"items":[]}`, and the address field
  told users a real street did not exist `[measured]`. Track whether any attempt
  actually succeeded and report the failure when none did. Corollary for
  debugging: **a zero-result you cannot reproduce is a provider failure until
  proven otherwise.** See `docs/claude/address-and-geo.md`.

---

## Index — which file to read for what

| File | Read it when… |
| --- | --- |
| **`docs/claude/environment-and-launcher.md`** | anything fails that is not obviously code: the launcher, port conflicts, a dev server that dies, EPERM / `.next` errors, Postgres `OperationalError`, `NODE_ENV`, env-var shadowing, a crashed session, or you are about to edit `start_local.ps1`. |
| **`docs/claude/django-and-migrations.md`** | writing a migration (**always** — the `apps.get_model()` rule lives here), changing a model or serializer, touching auth / JWT / throttling / CRM permissions, making a FK nullable, or restoring a database. |
| **`docs/claude/frontend-tailwind.md`** | writing Tailwind v4 classes, z-index above a map, transitions and animations, reduced-motion, `overflow-hidden`, responsive / mobile-overflow work, or any shared-chrome (Header / Footer / Container) change. |
| **`docs/claude/nextjs-and-react.md`** | App Router routing, server-vs-client component boundaries, `revalidate` / ISR staleness, loading indicators, scroll-reveal, root-layout effects, middleware, or URL-as-state pages. |
| **`docs/claude/address-and-geo.md`** | any address input, geocoding, the service area, city / district scoping, or **any Leaflet map** — mount-only props, `ssr:false`, tiles, fitting to markers. |
| **`docs/claude/media-and-images.md`** | adding an `ImageField`, any upload path, image compression or derivatives, media URLs, R2 vs local storage, or deleting media. |
| **`docs/claude/testing-and-verification.md`** | creating or cleaning up test data, verifying a fix, writing Playwright checks, or claiming anything passes. **Read this before reporting a result.** |
| **`docs/claude/product-and-domain.md`** | changing behaviour a user sees: catalog / articles / districts, property cards, favorites / compare / price history, breadcrumbs and SEO, CRM forms, lead capture, or the sale-request→property flow. Also holds the decisions that are closed and must not be relitigated. |
| **`docs/claude/incidents-resolved.md`** | a symptom feels familiar, or you want to know whether something was already tried. History only — no current rules. |

### Superseded ideas — if you meet one of these, it is stale

2GIS keys and tiles · Yandex suggest / geocoder · rectangular city bounding boxes ·
`Article.body` / `DistrictGuide.body` as plain text · port auto-selection and
walking · the ambient-`DATABASE_URL` `Remove-Item` workaround · `check_r2` (never
existed) · `SeoLinksFooter` · Edge middleware for the `/account` gate ·
«exclude Динская» · `max-w-screen-*` "compiles to nothing" ·
**«address search scopes to the settlement that owns the street data»** and its
standalone-vs-subdivision split — the scope is the whole city for every row
type; `standalone` no longer affects search, only the map centre.
