# CLAUDE.md

Guidance for working in this repository (Centreal real-estate platform).

## ⚠ RULE ZERO: every factual claim in this file must state HOW it was verified

Three separate claims in this document have now been found wrong or
unverifiable, each of which cost real debugging time because it was written with
the confidence of a measurement:

| Claim | What was wrong |
| --- | --- |
| `max-w-screen-*` "was REMOVED in v4 and compiles to nothing" | It compiles fine. Disproven by grepping the compiled stylesheet. |
| bare `z-1000` "is not in the scale, so it emits an empty rule" | `z-<number>` is a documented v4 bare value; the real cause was build/version drift. |
| "Verified via the Tailwind CLI probe" | **There is no Tailwind CLI in this project.** v4 ships it as a separate `@tailwindcss/cli` package, which is not a dependency here. That verification cannot have happened as described. |

**Therefore, from now on:**

1. **State the evidence inline with the claim.** Use one of:
   - **`[compiled CSS]`** — grepped the dev server's own stylesheet
     (`http://localhost:3001/_next/static/css/app/layout.css`). This is the only
     way to prove a Tailwind class actually emits a declaration.
   - **`[measured]`** — read back from a real browser (computed styles,
     `getBoundingClientRect`, accessible-name/role queries, hit tests).
   - **`[observed]`** — seen happening once (a crash, a log line, a screenshot),
     but not reproduced or instrumented.
   - **`[inferred]`** — reasoned from docs or from other evidence, **not
     directly checked**. Perfectly allowed — it just has to say so.
2. **Anything unlabelled is to be treated as UNVERIFIED on the next read.** Do
   not build on it and do not repeat it; re-verify it first, then label it, or
   delete it.
3. **Never write "verified" without naming the mechanism.** "Verified" alone is
   what produced the Tailwind-CLI claim above.
4. **Prefer falsifiable numbers to adjectives.** "content measures 1200px at a
   1440 viewport `[measured]`" beats "the container is now correct".

This applies to new entries and to any entry you touch. It is cheap at write
time and it is the only thing that stops this file from slowly turning into
folklore.

## Stack
- **Backend:** Django + Django REST Framework (`backend/`), PostgreSQL, Celery + Redis.
- **Frontend:** Next.js (App Router, TypeScript) in `frontend/`.
- **Production:** Railway. Do **not** change Railway/production configuration when
  working on local development.

## Local Development (No Docker)

Local development runs **fully natively on Windows** — no Docker required.
`docker-compose.yml` is kept only for production/infra reference and is **no longer
used** for day-to-day local work.

### Prerequisites
- **PostgreSQL 18** installed natively (Windows service `postgresql-x64-18`),
  listening on `localhost:5432`, database `real_estate_db`
  (user `postgres`, password `12345678`).
- **Memurai** installed (Windows Redis-compatible service) on `localhost:6379`,
  running automatically as a Windows service.
- **Python 3.10+** and **Node.js 18+** available on PATH (the bundled
  `backend\.venv` was created with Python 3.10).

### Environment files
Native processes read env vars from the directory they run in, so the values that
take effect live in two operative files (a combined `.env` at the repo root is
kept as the reference / docker-compose source). All three are gitignored.

| File | Read by | Key variables |
| --- | --- | --- |
| `backend/.env` | Django (`manage.py runserver` from `backend/`) | `DATABASE_URL`, `POSTGRES_*`, `REDIS_URL`, `CELERY_*`, R2 media |
| `frontend/.env.local` | Next.js (`npm run dev` from `frontend/`) | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SITE_URL`, `BACKEND_URL` |
| `.env` (root) | docker-compose only / combined reference | all of the above |

`settings.py` reads `DATABASE_URL` when it is set, and otherwise falls back to the
individual `POSTGRES_*` variables.

### One-time setup
A working virtual environment already ships in `backend/.venv`. If it is missing
(e.g. a fresh clone), create it once:

```powershell
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py create_initial_admin
```

`create_initial_admin` seeds a superuser (idempotent — safe to re-run). **Login to
`/admin/` is by EMAIL, not username.** The **actual accounts in the current
database** are **`daitama@yandex.ru`** and **`admin@admin.ru`** (both active
superusers) — **not** `admin@admin.com`, which the old default assumption named.
**Do not assume any specific default password.** If a password is forgotten, reset
it explicitly with `python manage.py changepassword <email>` (e.g.
`python manage.py changepassword admin@admin.ru`) rather than guessing `12345678` or
any other default.

> `scripts\start_local.ps1` auto-detects `backend\.venv` or `backend\venv`, so
> either name works.

### Daily startup
```powershell
scripts\start_local.ps1
```
Ensures PostgreSQL + Memurai are running, opens a backend window and a frontend
window, then opens the browser. Run it from an **elevated** PowerShell the first
time if a service still needs to be started.

### Stopping
```powershell
scripts\stop_local.ps1
```
Stops the Django and Next.js processes. PostgreSQL and Memurai are left running.

### Local URLs
- Frontend: http://localhost:3000 — **preferred, not guaranteed.** If 3000 is
  held the launcher moves to 3001/3002/… and prints the real URL in its summary.
  See **Frontend port is auto-selected** below.
- Backend:  http://localhost:8001
- API:      http://localhost:8001/api
- Admin:    http://localhost:8001/admin

> Django runs on **8001** locally because **8000 is occupied by another process**
> on this machine. `scripts\start_local.ps1` binds `runserver` to `127.0.0.1:8001`
> and `frontend/.env.local` (`BACKEND_URL`) already proxies `/api` there.

### Frontend port is auto-selected — do not assume 3000

Port 3000 on this machine is intermittently held by an unrelated **java** process
that accepts TCP but never responds. `scripts\start_local.ps1` handles this by
itself now — **there is no manual `-p 3001` / `.env.local` step any more.**

- **Port choice:** prefers **3000**, and if it is held walks upward (3001, 3002,
  …) to the first genuinely free port. Same idea for the backend (prefers 8001).
  `[measured]` — holding 3000 gave "Frontend port 3000 is busy - using 3001
  instead"; holding 3000 **and** 3001 landed on 3002; holding nothing still
  picked 3000. The preferred port is unchanged — the walk is a fallback only.
- **`frontend/.env.local` is rewritten on every launch** to match the chosen
  ports (`NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_API_URL`, `BACKEND_URL`,
  `BACKEND_INTERNAL_URL`); a missing key is appended rather than skipped. **Stop
  hand-editing those four lines** — the launcher owns them and overwrites them on
  the next start.
- **The launcher reads the port back from the running Next.js process**, because
  `next dev` has its own silent fallback: if the port is taken between our check
  and its bind, it moves to the next port and merely prints a notice — which
  would leave `.env.local` naming a dead origin for every browser-side API call.
  On a mismatch the launcher re-syncs `.env.local` and restarts the frontend
  **once**. `[measured]` — stealing the chosen port right after selection made
  Next.js land on 3002; the launcher reported the drift, re-synced, restarted,
  and `http://localhost:3002/api/properties/` then returned HTTP 200 with real
  data through the proxy.
- **Read the actual URL from the launcher's summary block** (`Frontend : http://…`)
  instead of assuming 3000.
- **Gotcha if you touch this detection:** the process that actually owns the port
  is `next\dist\server\lib\start-server.js`, **not** `next dev` or
  `bin\next` — those are its parents and hold no socket `[measured]`. Matching
  only the parents is why an earlier version reported "could not read the port
  back" while the server was plainly up; the pattern must include `\next\dist\`.
- **`NODE_ENV` is now forced to `development` for the Next.js window**, since
  these windows inherit the launching shell's environment and a shell carrying
  `NODE_ENV=production` 500s every page via the CSS `@` error (see the NODE_ENV
  section below). `[measured]` — reproduced from a `NODE_ENV=production` shell:
  500s before the guard, HTTP 200 after.

### Common issues
- **`password authentication failed for user "postgres"`** — `backend/.env` must
  have `POSTGRES_PASSWORD=12345678` (or the matching `DATABASE_URL`). Django's
  built-in default password is `postgres`, which fails against this database.
- **Port already in use (8001 / 3000)** — a previous server is still running. Run
  `scripts\stop_local.ps1`, or find and kill it:
  `Get-NetTCPConnection -LocalPort 8001 | Select-Object OwningProcess`, then
  `Stop-Process -Id <pid>`.
- **`ModuleNotFoundError` (e.g. `celery`, `dj_database_url`, Django)** — either the
  venv is not activated, or its dependencies are incomplete. Activate it
  (`backend\.venv\Scripts\activate`) and, if imports still fail, reinstall:
  `pip install -r requirements.txt`.
- **Service won't start** — `Start-Service` requires Administrator. Start
  `postgresql-x64-18` / `Memurai` from an elevated PowerShell or via `services.msc`.
- **Redis/Celery connection refused** — confirm Memurai is running:
  `Get-Service Memurai`.

> **Note:** Docker is no longer used for local development. `docker-compose.yml`
> is kept only for reference.

## Environment & Local Dev

- Local dev runs natively on Windows (no Docker). PostgreSQL 18 on port 5432,
  Memurai (Redis) on port 6379.
- Django runs on port **8001** — port **8000 is permanently occupied by an
  unrelated "Manager" process** on this machine. **Do not try to use port 8000.**
- The project lives on a **pCloud virtual drive** (`P:\pCloud\...`). `npm install`
  can **silently fail to write files** there — workaround: install to a local temp
  directory and copy the result into `node_modules` if this happens.
- Use **`"Start Centreal.bat"`** to launch all three servers (Django + Next.js +
  Celery worker) with HTTP polling and auto port selection.
- **All three services open in THREE SEPARATE PowerShell windows** (Django /
  Next.js / Celery worker). `Start Centreal.bat` (via `scripts\start_local.ps1`)
  launches each via `Start-Process powershell -NoExit`. (A single `wt.exe`
  split-pane window was tried and **reverted** — see the
  **Windows Terminal / Launcher Scripts** section for the full history and the
  `wt` gotchas.) The Celery worker runs
  `celery -A config.celery worker -l info -P solo` from `backend/` (venv's
  `python.exe` by absolute path), so background tasks (e.g.
  `send_lead_telegram_notification`) run without any manual step. It skips
  launching a duplicate if a worker is already running, confirms readiness via a
  Celery ping, and `scripts\stop_local.ps1` stops all three (process-based, so it
  works regardless of window layout). `-P solo` is used because the default
  prefork pool is unreliable on Windows.
  - _Still true regardless:_ **a successful API/form response only means the task
    was enqueued, not that it ran.** If notifications don't arrive, first confirm
    the worker window is up (or start one manually with the command above).
    _(DONE — auto-start of the worker was implemented; this note replaces the
    earlier "future task" TODO.)_
- **Backend env file:** Django loads environment variables from **`backend/.env`**
  (via python-dotenv's `load_dotenv()` with no arguments — it looks for a file
  named exactly `.env`, **not** `.env.local`). The `.env.local` naming is a
  Next.js/frontend-only convention (`frontend/.env.local` exists and is
  separate). **Do not confuse the two** — both Django and the Celery workers read
  only `backend/.env`.

## Windows Terminal / Launcher Scripts

- **Current layout: THREE SEPARATE PowerShell windows** (Django / Next.js /
  Celery worker), opened by `scripts\start_local.ps1` via `Start-Process
  powershell -NoExit`. This is the proven, reliable approach.
- **A single `wt.exe` split-pane window was tried and REVERTED.** The
  argument-building logic was actually correct and verified working in isolation
  (4/4 manual runs opened the window and started all three services), but in the
  context of the **full launcher script** it exhibited a "flash open then close
  immediately" failure on this machine — a `wt` handoff/timing quirk that could
  **not be reproduced** in isolated tests, so the root cause was never pinned
  down. Rather than ship something unverified for a foundational tool, we reverted
  to three windows.
- **`wt.exe` gotcha (kept for reference, in case split-panes are attempted
  again):** `wt` splits its whole command line on EVERY `;`, including semicolons
  meant to live inside a single pane's PowerShell payload
  (`Set-Location X; & Y; python Z`). `Start-Process -ArgumentList` flattens the
  array into one space-joined string, so `wt` re-parses it and a payload's
  internal `;` is indistinguishable from the `new-tab` / `split-pane` action
  separators — silently shredding one pane command into several broken actions
  (this is what once broke the Celery pane: `& 'Activate.ps1'` → phantom action;
  `python … celery` → ran from `System32` with no venv → `No module named
  'config'`). If you ever revisit `wt`, any per-pane payload must contain **ZERO
  semicolons** (use `wt -d` for the directory, absolute exe paths for commands).
- **Lesson (kept from the attempt, still correct regardless of window layout):**
  launch each service via the venv's **`python.exe` by absolute path**
  (`& 'backend\.venv\Scripts\python.exe' manage.py …` /
  `… -m celery -A config.celery worker …`), **not** `Activate.ps1` + inline
  `Set-Location` chaining. Fewer moving parts, one less thing to fail.
- **Meta-lesson:** when a fix works in isolated/manual testing but fails
  intermittently or unreproducibly in the actual integrated flow, and you can't
  confidently identify the root cause, **prefer reverting to the last known-good
  approach over shipping a "probably fixed" version** — especially for something
  as foundational as the local dev launcher.

## Maps & Address Suggestions (IMPORTANT — do not repeat this mistake)

- This project uses **THREE separate map-related keys/products**, and they are
  **NOT interchangeable**:
  1. `NEXT_PUBLIC_YANDEX_MAPS_API_KEY` — Yandex JS API + HTTP Geocoder only. Does
     **NOT** include suggest/autocomplete. `window.ymaps.suggest()` will silently
     fail or return nothing with this key even though the script loads fine.
  2. `NEXT_PUBLIC_YANDEX_SUGGEST_API_KEY` — a separate Yandex Geosuggest API key
     (different product, requires separate signup, can take time to activate).
     Currently **unused** in code — the project switched to 2GIS instead.
  3. `NEXT_PUBLIC_2GIS_API_KEY` — the **ACTIVE** key used for address suggestions.
     Uses the 2GIS Suggest API directly via `fetch()`, no SDK:
     `https://catalog.api.2gis.com/3.0/suggests?q=<text>&suggest_type=address&fields=items.point&location=38.9769,45.0448&key=<key>`.
     Response gives `full_name` + `point.lat`/`point.lon` directly — no separate
     geocoding call needed after picking a suggestion.
- **Map tiles** across the whole site (CRM form, property detail page,
  homepage/catalog) use 2GIS tiles:
  `https://tile2.maps.2gis.com/tiles?x={x}&y={y}&z={z}&v=1`, attribution "© 2GIS".
  **Do not switch back to Yandex or OSM tiles without asking.**
- Map library is **react-leaflet (Leaflet)**. Key react-leaflet gotchas learned
  the hard way:
  - `<MapContainer center/zoom>` props are **MOUNT-ONLY** — react-leaflet ignores
    changes to `center` after the initial render. To recenter programmatically
    (e.g. after picking an address suggestion), use a child component that calls
    `useMap()` + `map.setView([lat, lng], zoom)` inside a `useEffect` keyed on the
    coordinates. **Do NOT** use a `key={lat-lng}` remount hack — it causes tile
    flicker and fails silently when the same coordinate is re-selected.
  - Any map component (or any component that statically imports `leaflet` or
    `react-leaflet`, including `AttributionControl`) **MUST** be loaded via
    `next/dynamic(() => import(...), { ssr: false })`. `React.lazy()` is **NOT**
    sufficient — it defers loading but does not disable SSR, and Leaflet reads
    `window`/`document` at module-evaluation time, causing a hard
    "window is not defined" server error.
  - Leaflet's own CSS sets `.leaflet-container a { color: #0078A8 }` which is more
    specific than a single Tailwind utility class — if a link/button inside a
    Leaflet popup needs a specific text color (e.g. white on blue), use Tailwind's
    `!` important-modifier suffix (e.g. `text-white!`) to override it.
  - Leaflet map panes render at z-index ~400-600. Any overlapping UI (suggestion
    dropdowns, modals) must use z-index **1000+** to appear above the map, not
    behind it.
  - The Leaflet attribution badge is required by license and cannot be removed —
    but can be replaced with `attributionControl={false}` on `MapContainer` + a
    custom `<AttributionControl>`/`<Attribution>` showing only the wanted text
    (e.g. "© 2GIS").

## Prompting Rules for This Agent (Claude Code)

- Prompts given to you are always written in **English**, even though the user
  (Vadim) communicates in Russian in the planning conversation. This is
  intentional — follow instructions as given regardless of prompt language
  mismatch with the chat.
- **NEVER perform web searches unless explicitly asked** — web search consumes a
  disproportionate share of tokens (est. 40-60% per request). If external data is
  needed (e.g. lists of districts, addresses, API docs), it will be provided to
  you directly in the prompt as a ready-made list/reference. If you feel you need
  to search, stop and ask instead.
- Prefer **small, targeted, single-purpose** prompts/tasks over large multi-step
  ones. If asked to investigate/diagnose something, **report findings BEFORE
  making changes** — don't fix and explain simultaneously unless told to.
- Use **Edit mode** for small scoped changes; reserve **Plan mode** for large
  multi-file changes.
- When told to check something (e.g. "confirm X, don't change anything"),
  **strictly do not modify files** — only report.
- **Path gotcha after `cd` (IMPORTANT).** When a shell is already `cd`'d into
  `frontend/`, writing to a **repo-relative** path (e.g. `frontend/src/...`)
  instead of a **cwd-relative** one silently creates the file under a stray
  nested `frontend/frontend/` directory rather than erroring. Always confirm
  whether a path should be cwd-relative or repo-root-relative before writing,
  especially after `cd`-ing into a subdirectory earlier in the session.
  Typecheck («Cannot find module») is what caught it — a good reason to
  **typecheck after any multi-file change**.
- **Prompt language rule (reaffirmed).** All Claude Code agent prompts must be
  written in **English**, detailed and precise, **even when the planning
  conversation is in Russian**. (Same intent as the first bullet above — kept
  explicit because it's a standing project rule.)
- **UI/UX skill for web projects.** For any web development work (website, web
  service, or web app) on this project, connect this skill at the start of work:
  `https://github.com/nextlevelbuilder/ui-ux-pro-max-skill`. (External resource —
  do **not** fetch/browse it autonomously mid-task per the no-web-search rule;
  connect it deliberately when starting UI/UX work.)

## Frontend Form Validation

- **Don't let a "reset/reload" side-effect wipe the error you just set.** In
  `PublicLeadInquiryForm.tsx` the bot-check captcha showed the backend's
  "Неверный ответ. Попробуйте снова." error correctly, but the same error branch
  then called `loadCaptcha()` unconditionally — which reset the answer field and
  cleared the just-shown error, so the question silently changed with no visible
  feedback. **Lesson:** in a submit-error handler, never call a reset/reload
  function unconditionally alongside setting an error message. Gate it to the
  specific error conditions that need it (here: reload only when the captcha is
  expired/invalid, **not** on a plain wrong-answer error — keep the question,
  the entered value, and the visible error so the user can correct it).

- **Numeric-only input fields.** Property characteristic fields (room count,
  area, floor, etc.) in `CrmPropertyFullForm.tsx` use `type="text"` +
  `inputMode="numeric"`/`"decimal"` instead of `type="number"`, combined with
  `onKeyDown` filtering (blocks non-digit keys in real time) and `onChange`
  sanitizing (catches paste/autofill). **`type="number"` was deliberately
  avoided** because it natively allows `e`/`E`/`+`/`-`/`.` characters and
  silently empties invalid values, which breaks strict digit-only filtering.
  Reusable module-scope helpers: `handleIntegerKeyDown`/`sanitizeInteger`
  (digits only) and `handleDecimalKeyDown`/`sanitizeDecimal` (digits + one
  decimal separator). Since `type="text"` loses the browser's native `min`
  enforcement, `min` values are enforced **on blur** (via a `clampToMin`
  helper — not on every keystroke, to avoid disrupting multi-digit typing)
  instead of relying on the native HTML `min` attribute.

## Frontend Layout & Styling (Tailwind v4)

- **Cabinet width constraint.** The `/account` cabinet layout wraps all pages in
  the shared `Container` component, which defaults to `max-w-6xl` (1152px). That
  was clipping the «Заявки» (leads) table and is a latent constraint for **any**
  data-heavy page under `/account` (the CRM properties table has the same
  issue). **Fix:** `Container` now takes an opt-in `size="wide"` prop
  (default unchanged at `max-w-6xl`; `wide` = 1536px), applied in
  `account/layout.tsx` so the whole cabinet is wider. Public-site pages that use
  `Container` directly are unaffected (still default / 1152px).
- **Tailwind v4 / `max-w-screen-*` — CORRECTED 2026-07-25. This entry used to say
  the opposite.** It previously claimed the `max-w-screen-*` utilities were
  **REMOVED** in v4 and "compile to nothing". **That is wrong for the installed
  Tailwind v4.3.2.** Verified `[compiled CSS]` by grepping the dev server's own compiled
  stylesheet (`/_next/static/css/app/layout.css`), which contains a real
  declaration:

      .max-w-screen-2xl { max-width: var(--breakpoint-2xl); }

  (It is present in the build only because Tailwind's scanner picks the class name
  out of the **explanatory comment** in `container.tsx` — no component actually
  uses the class. That comment is also almost certainly where the original wrong
  claim came from.)
  - **Still prefer `max-w-(--breakpoint-2xl)`** in new code: it names the theme
    token directly instead of relying on a legacy alias a future major could drop.
    So the *recommendation* never changed — only the stated reason for it.
  - **The general lesson survives and still matters:** an *invalid* v4 utility is
    dropped with **no error or warning**. The bare-`z-1000` gotcha below **is** a
    genuine instance of that. So do keep verifying unusual utilities compile —
    just verify against the **compiled CSS** rather than trusting a remembered
    example. Fetching the dev server's stylesheet and grepping it is the cheapest
    reliable check (no Tailwind CLI binary is installed here — v4 ships the CLI as
    a separate `@tailwindcss/cli` package, which this project does not have).
- **Homepage category filtering (in-page, no navigation).** The «Категории»
  cards on the homepage previously navigated to `/catalog?property_type=X`. They
  now filter **client-side**, updating the property list **and** the map together
  without leaving the page. Key insight: `page.tsx` is a **server component**, so
  the category cards, property list, and map (previously separate sibling
  renders) couldn't share React state directly — solved by a single `"use
  client"` wrapper (`HomeCatalogExplorer.tsx`) that owns the `activeType` filter
  state and derives both the list slice and the map markers from the
  already-fetched `catalogItems` array. **No re-fetch needed** — `propertyType`
  was already present on each item, so filtering is pure client-side.

## Tailwind v4 z-index: prefer `z-[1000]`, but the CAUSE was misdiagnosed

- **CORRECTED 2026-07-25 — the earlier explanation in this section was wrong.**
  It claimed the default z-index scale "stops at `z-50`", so any bare `z-N`
  outside that scale (e.g. `z-1000`) was an invalid class that compiled to an
  empty rule. **That reasoning does not hold: `z-<number>` is a DOCUMENTED bare
  value in Tailwind v4** — arbitrary integers are supported by design, which is
  exactly why the VS Code Tailwind extension confidently offers to rewrite
  `z-[1000]` → `z-1000` and `z-[1]` → `z-1`. A correct v4 build emits a real
  declaration for both spellings.
- **So an observed empty `.z-1000 {}` rule was a BUILD/VERSION problem, not an
  invalid class** — a stale or corrupted build, or a Tailwind version that
  predates bare-value z-index. Notably the old note said it was "verified via the
  Tailwind CLI probe", but **there is no Tailwind CLI in this project** (v4 ships
  it separately as `@tailwindcss/cli`, which is not a dependency here) — so that
  verification cannot have been what it claimed, the same way the
  `max-w-screen-*` claim above turned out to be unfounded.
- **RULE (unchanged, for a different reason):** keep using the
  **arbitrary-value bracket form** — `z-[1000]`, `z-[9999]`, `z-[1]` — for
  anything overlaying Leaflet maps (see the **z-index 1000+** rule in **Maps &
  Address Suggestions**). Not because the bare form is invalid, but because the
  bracket form is **immune to this class of build/version drift** and states the
  intended value literally. Treat it as belt-and-braces, not as a bug fix.
- **If you ever see an element with no stacking context, verify before theorising:**
  fetch the dev server's compiled stylesheet and grep for the rule. In v4 the
  selector is backslash-escaped — search for `.z-\[1000\]`, not `.z-[1000]`, or a
  literal-string search will come back empty and look like the class was dropped.
- **WATCH OUT:** some IDE linters/formatters "canonicalize" `z-[1000]` → `z-1000`
  automatically (the VS Code Tailwind extension raises a
  `suggestCanonicalClasses` warning), **silently reintroducing this bug**. The
  fixed call sites carry an explanatory comment right above the class telling
  future editors **not** to apply that "fix" — **add such an explanatory comment
  near any `z-[1000]`+ class you introduce** to discourage this "cleanup". If you
  see a z-index-related visual regression (dropdown/overlay not appearing above
  other content, or content bleeding through the list text), **check first**
  whether an arbitrary z-index class got "cleaned up" into a bare
  (non-functional) one.
- **Known fixed instances (both confirmed clean via a codebase-wide search for
  bare `z-1000`):** `SearchBar.tsx` (`DistrictCombobox` district dropdown) and
  `CrmPropertyAddressMap.tsx` (2GIS address-suggestion dropdown over the Leaflet
  map). If you introduce a new dropdown/overlay, **grep for bare `z-1000` across
  the codebase periodically** to catch regressions early.

## Tailwind v4 animates `translate`/`scale`, NOT `transform` — transition traps

- **In Tailwind v4, `-translate-y-*` and `scale-*` compile to the INDIVIDUAL CSS
  properties `translate:` and `scale:`, not to `transform:`.** Two consequences
  that both fail silently:
  1. **A transition list naming `transform` does not animate them.** The hover
     state still APPLIES — it just snaps, with no easing and no warning. This
     really happened: `transition-[box-shadow,transform]` +
     `hover:-translate-y-[3px]` on `PropertyCard` gave an instant 3px jump
     instead of a 250ms lift. The fix is to name the real property:
     `transition-[box-shadow,translate]`.
  2. **Reading `getComputedStyle(el).transform` reports `none`** even when the
     element is visibly offset. Probe `.translate` / `.scale` instead, or you
     will conclude the utility "didn't apply" when it did.
- Tailwind's own `transition-transform` utility is SAFE, because v4 expands it to
  `transition-property: transform, translate, scale, rotate`. That is why a
  photo's `group-hover:scale-[1.04]` animated correctly on the very same card
  whose lift did not.
- **RULE:** when adding a transformed hover/focus state, either use
  `transition-transform`, or name the actual animated property in the arbitrary
  transition list. **Verify with computed styles**, not by eye — a snap and a
  250ms ease are easy to confuse in a screenshot, and impossible to tell apart in
  a static one. Existing call sites (`PropertyCard`, `CategoriesSection`,
  `ArticlesSection`) carry a comment saying exactly this; keep it when editing.

## Reduced-motion policy: cancel by CATEGORY, never blanket `transform: none`

- The global `@media (prefers-reduced-motion: reduce)` block in `globals.css`
  **removes movement rather than merely shortening it**, but it does so in three
  scoped ways. Colour, shadow and focus rings always still change — those carry
  meaning, not decoration.
  1. **Keyframe animations → `animation: none`.** Not `animation-duration: 1ms`:
     a 1ms run still RUNS and lands on the keyframe's END state `[observed]`, so the
     hero icon field froze at full drift instead of at rest, and `ctr-pop` flashed.
  2. **Hover/focus transforms → cancelled at the component**, with Tailwind's
     `motion-reduce:` variant (see `PropertyCard`'s lift and photo scale).
  3. **The hero icon field → cancelled by class** (`.ctr-hero__icon`,
     `.ctr-hero__layer`), which is safe to hit with `transform: none` because
     those elements exist only to drift and do no layout work.
- **⚠ NEVER add a blanket `transform: none !important` / `translate: none
  !important`.** It is the obvious-looking fix and it breaks real layout:
  - **Leaflet** positions map panes and tiles with `transform: translate3d()` —
    a global kill breaks every map on the site for reduced-motion users;
  - `SearchBar.tsx` centres a field icon with `-translate-y-1/2`, which in v4
    compiles to the `translate` property (see the section above), so it would
    drop to the top of the field.
- **⚠ ANY element whose visible state comes from a keyframe must carry its END
  STATE IN THE BASE STYLE.** Because animations are cancelled outright, a base
  `opacity: 0` that relies on a keyframe to reach 1 stays invisible **forever**
  under reduced motion — and also with JS disabled or hydration broken. This is
  why the scroll reveal inverts the design's own `.ctr-reveal{opacity:0}`:
  sections are **visible by default**, and the hiding rule lives inside
  `@media (prefers-reduced-motion: no-preference)` **and** requires the
  `.ctr-reveal-on` marker that `RevealController` sets after mount. Fail either
  condition → the page just renders. **Before adding any entrance animation,
  grep for `opacity-0` / `opacity: 0` and confirm nothing depends on a keyframe
  to become visible.**

## Scroll-gated visibility is invisible to every non-scrolling consumer

- **The end-state-in-base rule above is NECESSARY BUT NOT SUFFICIENT.** The
  scroll reveal *satisfied* it — sections are visible by default and the hiding
  rule needs both `prefers-reduced-motion: no-preference` **and** the JS-set
  `.ctr-reveal-on` marker — and it still produced a mostly-blank page. The
  failure mode is not "JS broken", which that rule covers. It is **JS working
  perfectly while the viewer never scrolls.**
- **Measured `[measured]`:** a full-page capture of the homepage at 1440×900
  taken **without scrolling** came out **2080px of 3306px blank — 63%** — one
  flat band `y=940..3020`, colour `rgb(246,245,241)` (the page background),
  because 5 of the 6 `.ctr-sec` sections were still at `opacity: 0`. Hits
  screenshot tools, PDF/archive jobs, preview crawlers, link unfurlers.
- **FIX, in place — do not remove it.** `RevealController` reveals whatever is
  still pending after `REVEAL_FAILSAFE_MS` (**2500ms**), so nothing can stay
  hidden longer than that. The trade-off is deliberate and documented at the
  constant: a reader who lingers past 2.5s on the hero gets no fade-in below the
  fold. Adjust the number if the balance ever needs to shift; don't delete the
  failsafe.
- **A tall viewport was never affected `[measured]`:** at `innerHeight` 3306 the
  sweep reveals all 6 sections on the first frame — 0% blank, height exactly
  3306. So Googlebot-style rendering and DevTools' "Capture full size
  screenshot" always worked; only normal-viewport-without-scrolling consumers
  broke.
- **RULE for any future scroll-driven visibility (reveal, lazy sections, count-up
  numbers):** cap it. Ask "what does this look like to something that renders
  once and never scrolls?" and give it a time-based failsafe.

### …and a once-only effect in the ROOT LAYOUT misses every soft navigation

- **Second failure of the same mechanism, different cause — fixed 2026-08-03.**
  Reported as "after logging in as a realtor the homepage's Категории and Новые
  объекты are missing; F5 fixes it". **It is not auth-related and not a data
  problem** — it reproduces logged out, and the sections are fully present in the
  DOM the whole time.
- **Root cause:** `RevealController` is mounted from `app/layout.tsx`, and the
  root layout **survives client-side navigation**. Its effect used `[]`, so it
  ran exactly once per full page load: it armed `ctr-reveal-on` on `<html>` and
  snapshotted `.ctr-sec` **for whatever page happened to be first**. Every soft
  navigation afterwards swapped in new sections that were never in `pending`,
  never reached by the already-fired failsafe, and still hidden by the
  still-armed CSS → `opacity: 0` **forever**. F5 remounted the controller, which
  is exactly why a refresh "fixed" it and why it looked like a login race.
- **Evidence `[measured]`:** soft-navigating `/catalog` → `/` left **6/6 sections
  at `opacity: 0`, `is-in=false`**, with content present (heights 298–580px,
  «Новые объекты» rendering 2 cards) and **zero console errors / failed
  requests**. Scrolling top-to-bottom did **not** help, while `is-compact` on the
  header toggled correctly throughout — proving the shared scroll handler was
  alive and that it was `pending` that was empty. A/B on the dependency array
  alone: `[]` → **0/5** fresh realtor logins rendered the sections, `[pathname]`
  → **5/5**.
- **Fix:** key the effect on `usePathname()` so it re-snapshots and re-arms per
  route, and make the failsafe re-query `.ctr-sec:not(.is-in)` instead of
  draining only the mount-time snapshot (keeps the "never hidden longer than
  `REVEAL_FAILSAFE_MS`" invariant true for anything that arrives late, e.g. if
  the homepage ever streams). Cleanup + setup run in the same commit with no
  paint between, so re-arming cannot flash the page `[measured]`.
- **RULE: any effect in the root layout that touches PAGE content must be keyed
  on the route, not `[]`.** `[]` there means "once per full page load", which is
  almost never what page-level DOM work wants. The tell for this class of bug is
  **"a manual refresh fixes it"** — that means state is being set up once per
  document rather than once per page. Only genuinely document-scoped work
  (analytics boot, a global listener with no page-specific state) belongs in `[]`.
- **Verified after the fix `[measured]`:** 10/10 checks — soft nav home from
  `/catalog`, `/articles`, `/favorites`, browser Back, 3 repeated round-trips,
  reduced-motion on both load paths, compact header still toggling, and the
  animation itself still intact (6/6 hidden immediately after arming, revealed by
  the failsafe). Plus 5/5 fresh realtor logins and a 46-check responsive sweep
  (23 routes × 390/768px) with zero horizontal overflow.
- **Testing gotcha that cost a false alarm:** sampling section opacity at a fixed
  ~400ms after `domcontentloaded` reports "nothing hidden" and looks like the
  animation is dead. It isn't — in dev, hydration had not armed
  `ctr-reveal-on` yet, and the base state is deliberately visible. **Poll for
  `ctr-reveal-on` before asserting anything about reveal state**, never a fixed
  sleep.

### «The homepage renders twice» — it does NOT; that's the screenshot tool

- Reported as a bug: hero, search panel and footer each appearing **twice** in a
  full-page screenshot with a large empty gap, while normal scrolling looked
  fine. **Both plausible causes were measured and are false** — there is no
  duplicate mount and nothing hidden-but-occupying-layout.
  `header/footer/main/.ctr-hero` count **1/1/1/1** in the SSR HTML *and* in the
  hydrated DOM at both 900px and 3306px viewports `[measured]`;
  `scrollHeight` 3306 == `footerBottom` 3306 exactly, with **no** element below
  the footer.
- **Cause: naive scroll-and-stitch capture.** Reproduced `[measured]` — a
  stitcher on the 3306px document at 900px viewport emitted a **4500px** image:
  1. **the bottom scroll CLAMPS** — tiles at 0/900/1800/2700, but max `scrollY`
     is 2406, so the last tile re-shoots ~294px already captured → **footer
     duplicated**;
  2. most extensions **restore scroll to top and take a final frame** → hero
     band matched in **2 of 5** tiles → **hero + search panel duplicated**.
  The `sticky` header lands in every tile by design — true of any sticky-header
  site, not fixable page-side.
- **Before investigating this again**, count the DOM nodes first
  (`document.querySelectorAll('header,footer,main,.ctr-hero').length`) — one
  command separates a real duplicate mount from a capture artifact. For
  verification screenshots use **DevTools → ⋮ → Capture full size screenshot**
  (resizes the viewport, no stitching): 1440×3306, single copy, 0% blank
  `[measured]`. Playwright's `full_page` uses the same CDP path and is equally
  safe — which is why the committed captures in `design-audit/screenshots-after/`
  are correct.

## Footer: full-bleed, and «Популярные запросы» belongs INSIDE it

- **«Популярные запросы» is a SITEWIDE FOOTER column. This REVERSES the former
  "Conflict C".** An earlier decision kept those SEO landing links as a
  homepage-only `SeoLinksFooter` section, reasoning that footering them would put
  them on all 32 pages and change the internal link graph. Re-examined against the
  design files, the sitewide placement won: the kit puts them in the footer in
  **both** `ui_kits/website/index.html` and `components/navigation/footer.card.html`,
  and because the targets are canonical indexable landing routes, sitewide
  internal links to them are an SEO gain. `SeoLinksFooter` has been deleted —
  **do not reintroduce it.**
- **The footer is FULL-BLEED with SQUARE CORNERS — verified; do not "fix" it into
  a rounded inset card.** This was raised as a discrepancy and turned out to be
  unfounded: `.ctr-footer` in the design carries **no** `border-radius`, **no**
  `margin` and **no** `max-width`, and measuring the rendered kit `[measured]` gives
  `left=0, width=1440, border-radius: 0px` at a 1440 viewport (identical in
  `mobile.html`). The inset belongs to the **inner** container
  (`.ctr-footer__in`: `max-width:1200px; padding:56px 24px 28px`). The
  rounded-card impression came from `footer.card.html`, a component-preview page
  that frames the footer inside a white padded body — and separately from the
  whole PAGE being inset in a screenshot. Confirmed rejected by the user.
- **Footer structure (kit `.ctr-footer__top`):** a three-zone grid
  `1.4fr 1fr 1fr`, gap 40px, `padding-bottom:40px` and a
  `1px solid rgba(255,255,255,0.12)` bottom rule; single column below 640px.
  The bottom row is `display:flex; justify-content:space-between` — copyright
  left, the four nav/legal links **inline on the right**. There is **no «РАЗДЕЛЫ»
  label anywhere in the design**; the only small-caps label is
  `.ctr-footer__h` (12/16, `letter-spacing:0.06em`, uppercase,
  `rgba(255,255,255,0.5)`) sitting over the first queries column.
- **Implementation note:** the kit puts a literal `&nbsp;` in the second column's
  label to keep the two link lists' baselines aligned. Ours does **not** — the
  queries block is one `<nav>` spanning both grid columns with a single label and
  one `<ul>` that splits into two columns internally. Same geometry (the spanning
  cell is `1fr + 40px + 1fr`, and the inner grid reuses the 40px gap, so each
  resolves to exactly 1fr), one accessible name, no placeholder text in the DOM.

## Ancestor `overflow-hidden` can clip absolutely-positioned dropdowns/overlays

- **Symptom:** a dropdown/overlay (e.g. `DistrictCombobox`) has a correct
  `max-height` + `overflow-auto` for internal scrolling, a correct `z-[N]`, and a
  correct background/border/shadow — **yet content past a certain point is still
  visually cut off and unreachable**, even though the dropdown's own scrollbar
  exists. (Note this is a **different** cause from the bare-`z-1000` gotcha above —
  here the z-index is fine; the panel is being clipped, not un-raised.)
- **Root cause:** a parent/ancestor section has `overflow-hidden` for an
  **unrelated** reason (e.g. clipping decorative background gradients to a hero
  section), and that `overflow-hidden` **also clips any absolutely-positioned
  descendant** that extends past the ancestor's bounds — including dropdowns meant
  to float freely above other page content. The dropdown's own internal scroll
  can't fix this because the **whole panel** is being clipped by the parent, not
  limited by its own height.
- **FIX PATTERN:** if a section needs `overflow-hidden` **purely to contain
  decorative elements** (background gradients, patterns, etc.), do **NOT** put
  `overflow-hidden` on the section itself. Instead, wrap **only** the decorative
  elements in a dedicated `absolute inset-0 overflow-hidden pointer-events-none`
  wrapper, and leave the section (and any interactive descendants like dropdowns)
  unclipped.
- **Fixed instance:** `HeroSection.tsx` — `overflow-hidden` was on the outer
  `<section>`, clipping the `SearchBar`'s District dropdown for cities with long
  district lists (e.g. Геленджик; the last items like «СНТ Сосновое» became
  invisible). Moved `overflow-hidden` onto an inner wrapper containing only the two
  background gradient divs. **The catalog-page `SearchBar` was unaffected** — it
  has no `overflow-hidden` ancestor — so this was a homepage-hero-only clip.
- **CHECKLIST when adding `overflow-hidden` to any section/container going
  forward:** does this section contain (or will it contain) any
  absolutely-positioned dropdown, tooltip, popover, or overlay that might need to
  extend beyond the container's bounds? If yes, **scope the `overflow-hidden` to a
  decorative wrapper** instead of the whole section.

## Responsive / Adaptive Layout (mobile overflow — check shared chrome FIRST)

- **A sitewide horizontal-scroll problem almost always has ONE root cause in a
  shared layout component — not N per-page bugs.** The `Header`
  (`layout/header.tsx`) rendered its logo, nav links, «Продать недвижимость» CTA,
  and account controls in a **single non-wrapping flex row with no mobile
  breakpoint**. That row's intrinsic width became the **global minimum document
  width on EVERY page**: every public page measured **712px** wide and every CRM
  page **795px** (the account chip is wider) at a **390px** mobile viewport →
  sitewide horizontal scroll. It *looked* like dozens of separate per-page
  responsiveness bugs (each page's screenshot was too wide) but was a **single
  shared-component fix**. **Before writing per-page CSS patches for a
  responsiveness problem, inspect the shared chrome first** — `Header`, `Footer`,
  and any global `Container`/layout wrapper. One root cause is common and far
  cheaper than N patches.
- **Diagnostic method (objective, scriptable — reuse this for any overflow
  investigation):** on each page compare
  `document.documentElement.scrollWidth` against the viewport width via Playwright.
  **A page overflows iff `scrollWidth > viewport width`** — this is an exact,
  mechanical pass/fail, **not** an eyeball check. (A convenient equivalent when
  taking `fullPage` screenshots: the **PNG width equals the document width**, so a
  page is fixed iff its 390px-viewport capture is exactly 390px wide.) The
  before/after here: all 31 pages went from 712/795px → **exactly 390px at 390 and
  768px at 768**, verified both ways across 66 captures with zero offenders.
- **Fix pattern used: hamburger button + full-width dropdown panel** (NOT a
  slide-in drawer — a dropdown needs no portal, no body-scroll lock, and reuses the
  existing `DistrictCombobox` outside-click idiom). Desktop nav is `hidden lg:block`
  / `hidden lg:flex`; the mobile `MobileNav` (`layout/MobileNav.tsx`) is `lg:hidden`.
  **The switch is at `lg` (1024px), NOT `md` (768px)** — measurement showed the
  desktop row didn't fit even at ~795px, so `md` would still overflow the tablet
  range. **Pick the breakpoint from the measured width, don't assume `md`.** The
  panel closes on link click, `Escape`, outside-click (`mousedown` + `containerRef`),
  and `usePathname()` change. The `<header>` gets `relative` to anchor the
  `absolute inset-x-0 top-full` panel.
- **z-index for the panel/overlay must clear Leaflet map panes** (z ~400–600 — the
  homepage and catalog render maps *under* the header). Use the **`z-[1000]` bracket
  form** (the drift-proof spelling — see **Tailwind v4 z-index: prefer
  `z-[1000]`, but the CAUSE was misdiagnosed**),
  and keep the anti-"canonicalization" comment on it. **Whenever a dropdown/overlay
  sits near a map component, confirm the z-index is actually high enough** rather
  than assuming the default scale suffices.
- **Already-responsive things that did NOT need touching** (verified, so don't
  "fix" them again): `SearchBar` (`grid-cols-1 md:grid-cols-12`), the cabinet shell
  (`AccountSidebar` `w-full md:w-52`, `AccountCabinetLayout` `flex-col md:flex-row`),
  all CRM/leads tables (already wrapped in `overflow-x-auto` — the "cramped" look
  was the page-level overflow, not the tables), `CrmPropertyFullForm`
  (`grid-cols-1 sm:grid-cols-2`), and all maps/charts (`w-full`, fluid). **CRM
  tables keep the horizontal-scroll pattern on mobile** (card-layout conversion is a
  redesign, explicitly out of scope) — just ensure in-cell values that must stay on
  one line get `whitespace-nowrap` (e.g. the masked phone in `AccountInquiriesTable`).

## Searchable Dropdown Pattern (District filter)

- **When a `<select>` has too many options for users to scan comfortably** (e.g.
  District/Район lists with 20+ items for cities like Геленджик), replace it with a
  **local searchable combobox** instead of a native `<select>`:
  - **Controlled text input + absolutely-positioned dropdown list**, filtered
    client-side via **case-insensitive substring match**
    (`.toLowerCase().includes(query)`) — **not** just a prefix match (typing "хот"
    must match "Джанхот").
  - **Selection via `onMouseDown` + `preventDefault()`** on list items (**not**
    `onClick`) so it fires **before** the outside-click-to-close handler.
  - **Outside-click-to-close** via a `mousedown` listener on `document`, scoped
    with a `containerRef`.
  - **No keyboard navigation** implemented by default (mouse-click only) — add
    arrow-key/Enter support only if **explicitly requested**.
  - **Dropdown overlay z-index must be 1000+** and written as `z-[1000]` (the
    arbitrary-value bracket form — preferred over bare `z-1000` as the
    build/version-drift-proof spelling; see **Tailwind v4 z-index: prefer
    `z-[1000]`, but the CAUSE was misdiagnosed** and the Leaflet z-index rule in **Maps &
    Address Suggestions**).
- **Reference implementation:** `DistrictCombobox` in
  `frontend/src/components/home/SearchBar.tsx` (shared between the **hero** and
  **catalog** variants of the search form).
- **Reuse this same local-combobox pattern** for any other filter field that grows a
  long option list (e.g. future ЖК/complex selectors), rather than reaching for a
  new select-search library each time.

## Catalog page (redesigned 2026-08-04): URL is the single source of truth

- **/catalog was rebuilt to the design reference** (`docs/design/Centreal
  Каталог (standalone).html` — a Claude Design export whose real markup lives
  JSON-escaped inside the bundler wrapper; extract it before reading). Every
  filter, the sort, the list/map view and the page number live in the QUERY
  STRING; there is no client-held filter state. The server page
  (`catalog/page.tsx` → `CatalogPageTemplate`) parses, sorts and slices, so a
  filtered/sorted/paginated URL is fully server-rendered; the client
  (`CatalogExplorer`) only turns interactions into `router.push` inside
  `startTransition` (its `isPending` drives the real skeletons).
- **The state model lives in ONE module — `lib/catalogFilters.ts`** (parse /
  serialize / chips / widen actions / sort-ordering map). If a param is added,
  add it THERE, never ad-hoc in a component — the panel, chips, pagination
  links and widen buttons all derive from it.
- **Sorting nuance:** `sort=new|price_asc|price_desc` are also passed to the
  API as `?ordering=`; **«По площади» (`area_desc`) has NO API ordering field**
  (area lives in 4 per-type detail tables) and is sorted server-side in the
  template over the full result set. Fine while the API returns everything
  unpaginated `[measured]` (bare array, no `DEFAULT_PAGINATION_CLASS`); needs
  a backend ordering field once the dataset grows.
- **Deliberate deviations from the mockup** (approved, do not "fix" back):
  no Продажа/Аренда segment (`DealType` has only `sale` — reintroduce only
  when rent lands in the API); submit button is a static «Показать
  объявления» (a live count would refetch the whole unpaginated set per edit;
  a `?count_only` endpoint is the future improvement); area filters in «Ещё
  фильтры» are REAL per-type inputs, only Этаж/Срок сдачи are «Скоро» (no
  API params); no old-price strikethrough and no Новостройка/Вторичка card
  badge — the public list serializer exposes neither `old_price` nor
  `market_type` (both are one-field serializer additions if ever wanted).
- **«Цена снижена» is ON THE PHOTO, top-left (REVERSED 2026-08-04).** An
  earlier decision kept it beside the price to avoid the compare button in
  that corner; the user reversed it to mockup-exact: badge top-left on the
  photo (h-6, px-2.5, rounded-md, `bg-accent`, white 11px/600), and BOTH
  action buttons (heart, then compare — the mockup's order) grouped in ONE
  top-right flex row at 44px. This also reverses the old "opposite corners"
  card decision recorded under the Compare feature below. Verified
  `[measured]`: badge at 12/12px offsets with exact mockup metrics, both
  controls 44×44 top-right, on a staged price-dropped fixture.
- **Page size is 9** (`CATALOG_PAGE_SIZE` in `lib/catalogFilters.ts`) — the
  mockup's 3×3 grid; was 12, corrected by the user.
- **⚠ History entries must exist BEFORE the transition.** `router.push`
  inside `startTransition` defers its `history.pushState` until the
  transition COMMITS — on a slow dev-server render that leaves a seconds-long
  window with NO entry for the target URL, and a Back press in that window
  pops PAST the catalog and leaves the site `[measured]` (repro: back
  pressed 80ms after a pagination click landed on about:blank). Fix pattern
  in `CatalogExplorer.navigate()`: `window.history.pushState(null, "", href)`
  synchronously (Next 15 syncs its router with native pushState), then
  `router.replace(href)` inside the transition onto that same entry. A test
  that awaits full settlement before pressing Back can NEVER catch this —
  always include a mid-transition Back variant.
- **Этаж filter = PRESETS, not a numeric range** (agreed 2026-08-04). Param
  `floor_preset` ∈ `not_first` | `not_last` | `not_first_not_last`. Buyers
  state objections ("not the ground floor"), not floor bands; presets are one
  tap, need no min≤max validation, and reuse the accessible `CatalogSelect`.
  `floor_min`/`floor_max` stay available as an orthogonal future addition.
  - **`ApartmentDetails.floor` is REQUIRED; `floors_total` is NULLABLE.** So
    «не первый» (`floor > 1`) is always evaluable, while «не последний»
    (`floor < floors_total`) cannot be judged when the height is unknown.
    Those listings are **excluded** — the preset is a hard constraint — and
    **counted**, because a silent disappearance is the failure mode to avoid.
  - **The hidden count travels as an HTTP RESPONSE HEADER**,
    `X-Hidden-Unknown-Floors`, not a JSON envelope: the list response is a
    bare array every consumer already depends on. `fetchPublicPropertiesListWithMeta()`
    reads it; `fetchPublicPropertiesList()` stays items-only for the other
    callers. The UI shows «N объявлений скрыто: не указана этажность дома»
    under the results count, with Russian plural agreement.
  - **Counting gotcha:** count with `apartment_details__isnull=False` too — a
    bare `apartment_details__floors_total__isnull=True` LEFT JOINs and also
    matches houses/land, which have no apartment_details at all.
  - **Visible ONLY for an explicit «Квартиры»** — hidden (not disabled) for
    every other type and never under «Все типы», where a floor filter would
    silently turn an all-types search into an apartments-only one. Because the
    param is emitted from state rather than copied from the old URL, switching
    type drops it automatically — no orphaned `floor_preset` can linger
    `[measured]`.
- **Срок сдачи is DEFERRED — do not relitigate.** There is NO completion-date
  field anywhere: not on `Property`, not on `ApartmentDetails`, and not on
  `ResidentialComplex` (whole model read: city, district, neighborhood, name,
  slug, address_text, latitude, longitude, description) `[measured]`. With one
  real listing, a field nobody fills is a real cost, so the control stays an
  honest dashed «Скоро» placeholder and the «СКОРО» label is scoped to it
  alone now that Этаж is real. **Agreed future shape when it is wanted: a
  DATE on `ResidentialComplex`, with buckets derived at query time — no
  quarter enum.** Completion is a property of the BUILDING, so per-property
  storage would drift between units of the same ЖК; deriving buckets from a
  date means they can change without a migration. Known weakness to weigh
  then: only listings with a `residential_complex` FK become filterable, and
  the ЖК catalogue is incomplete.
- **ISR staleness is expected, not a bug:** the public list fetch uses
  `next: { revalidate: 60 }`, so a newly published property can take up to a
  minute (plus one stale-while-revalidate hit) to appear on a
  previously-visited catalog URL. Warm URLs twice in tests before asserting
  counts.
- **SEO landings prefill the panel:** `[city]/[catalogSegment]/page.tsx`
  passes `landingImpliedSearchRecord(city, resolved)` as
  `catalogSearchParams`, so chips/panel reflect the route's filters and any
  interaction continues on /catalog with that state carried over (ЖК landings
  map to city-only — the panel has no ЖК filter). Landing rendering mode is
  unchanged (`ƒ` dynamic, no `searchParams` read) `[measured]` in the build
  route table.
- **Accessible dropdowns:** `CatalogSelect` (APG select-only combobox — focus
  stays on the trigger, `aria-activedescendant`, typeahead) and
  `CatalogDistrictCombobox` (editable, two-table Микрорайоны/Районы groups,
  disabled until a city is chosen). Old `CatalogResultsSection`/
  `CatalogControls` were deleted. Verified `[measured]`: 84/84 Playwright
  checks (states, full keyboard run, sheet focus trap, 360→1600 sweep,
  reduced motion, AA contrast), 0 console errors.
- **⚠ OPEN BUG (pre-existing, header — NOT fixed, needs a decision): the
  favourites COUNT BADGE re-breaks the 1024–1099px header fit band.** With at
  least one favourite the nav reads «Избранное1» and the row's intrinsic
  width returns to **1047px**, so `scrollWidth` is 1047 at viewports 1024 and
  1040 on EVERY page `[measured]`; 1080+ and empty-localStorage are clean at
  every width. The fit band was tuned against a header with no badge, and
  CLAUDE.md's own warning there ("if a nav label is added or renamed, the
  1047px intrinsic width moves — re-measure") covers exactly this. The
  affected range is **1024–1079px**; 1080+ is clean.
  - **Status: KNOWN OPEN ISSUE, deliberately NOT fixed** (user decision,
    2026-08-04 — the header stays off-limits until they say otherwise).
  - Three options when it is taken up: (1) compress more inside the existing
    1024–1099 band, (2) hide the count badge below 1100px, (3) raise the
    desktop-nav breakpoint above 1024.
  - **⚠ The 1024–1099 fit band was tuned against a BADGE-LESS header.** Any
    future header work must re-measure **with favourites present** — and so
    must any responsive sweep, or it silently tests a narrower header than a
    real user with one favourite ever sees.
- **A `getBoundingClientRect()` beyond the viewport is NOT necessarily
  overflow.** An element inside an `overflow:hidden` ancestor still reports
  its full un-clipped rect, so an overflow detector that only compares rects
  produces false positives — the homepage hero icons (inside
  `.ctr-hero__field`) report right=1045 at a 1040 viewport while contributing
  nothing to `scrollWidth`. Trust `document.documentElement.scrollWidth` for
  the verdict and use rects only to LOCATE the cause.
- **⚠ A computed-style colour is NOT always `rgb()`/`rgba()` — never regex it.**
  Tailwind v4's opacity modifier on a theme colour (`bg-surface-dark/70`)
  compiles to `color-mix()`, and `getComputedStyle().backgroundColor` returns
  **`oklab(0.237 -0.009 -0.054 / 0.7)`** `[measured]`. An `rgba(...)` regex
  returns null there, so a contrast/colour probe either crashes or silently
  skips the element — i.e. reports a PASS it never actually checked. Resolve
  any CSS colour through the browser instead: paint it into a 1×1 canvas and
  read the pixel back (`ctx.fillStyle = css; ctx.fillRect(...)`;
  `getImageData` gives straight sRGB + alpha for rgb, hsl, oklab and
  color-mix alike). Also composite semi-transparent fills over their opaque
  ancestor before measuring contrast, or a badge over a photo scores its
  text against the photo's background and falsely fails.
- **A box-bottom delta is not a baseline delta.** Asserting that a 13px old
  price is baseline-aligned with a 20px price by comparing
  `getBoundingClientRect().bottom` fails by ~2px even when alignment is
  perfect — the smaller font has less descent. Assert the mechanism
  (`align-items: baseline` on the row) and allow a few px on the box edges.
- **Playwright gotchas that produced FALSE bug reports here** (all
  `[measured]`): a screenshot's default caret-hiding injects
  `caret-color:transparent` and, racing hydration after `reload()`, fakes a
  React hydration-mismatch console error — pass `caret="initial"`; the CDP
  keyboard emits NO `keydown` for non-layout (Cyrillic) chars, so `type("г")`
  can't exercise typeahead — dispatch a real `KeyboardEvent`; content after
  `go_back()` swaps asynchronously — poll for the expected count, never read
  it synchronously.

### Catalog invariants added by the external-review fixes (2026-08-05)

All verified `[measured]` by a 34-check before/after Playwright+API run
(every check reproduced the broken behaviour first, then the fix).

- **ONE URL interpreter.** API params come from
  `catalogApiParamsFromUiState(parseCatalogUiState(sp))` — a projection of the
  SAME parsed state the panel and chips render from, so a filter can never
  apply without a chip. The old raw-searchParams builder in
  `catalogQueryParams.ts` is DELETED — its hardcoded commercial-type whitelist
  had already gone stale (backend added `hotel`/`guesthouse`; «Гостиница»
  showed a chip and filtered NOTHING). **Never reintroduce a frontend copy of
  backend param validation.**
- **Mutations in `CatalogExplorer` must read `currentState()`, never the
  `uiState` prop.** While a transition is pending the prop describes the
  PREVIOUS URL; two interactions inside one pending window lost the first
  (same-tick repro: type=Дома + «На карте» kept only view=map). The
  `lastNavigatedRef` clears when props catch up to its href, and on popstate.
  Related: `navigate()` no-ops on the current URL (Back had appeared dead
  after re-picking the active sort/view), and the sheet's «Показать
  объявления» commits areas+price as ONE merged patch — two same-tick
  `onPatch` calls always lose the first even with the ref.
- **«Сначала новые» = `published_at`** (now on the public list serializer —
  public-safe: the endpoint already ordered by it and `is_new` disclosed its
  bucket). `sortCatalogProperties` no longer proxies via `updated_at`, so a
  CRM edit cannot bump an old listing; `updatedAt` remains only as a fallback
  for stale cached payloads.
- **Hero parity rule:** every value the hero SearchBar can emit must be
  expressible by the panel/sheet — that is why ROOMS_OPTIONS has an exact «4»
  and MARKET_OPTIONS has «Иное». A hero-only value renders a working filter
  whose panel control displays «Любое» — a live desync, not a hostile-URL
  edge.
- **⭐ THE APARTMENT-ONLY RULE (2026-08-05): any filter whose data lives on
  `ApartmentDetails` requires an explicit «Квартиры» property type.** That is
  `rooms`, `market_type` AND `floor_preset` — one predicate,
  `apartmentFiltersApply(f)`, no exceptions. Under «Все типы» such a filter
  silently turns an all-types search into an apartments-only one (nothing else
  has an ApartmentDetails row to match), and the chip says «Комнат: 2», never
  «квартиры только». `floor_preset` was gated from the start while
  rooms/market_type were not — **the catalog was the odd one out: the hero
  SearchBar has ALWAYS rendered its rooms/market controls only for
  apartments** (`propertyType === "apartment" &&` in SearchBar.tsx), so the
  panel was the inconsistent surface, not the hero.
  - **Enforced on the STATE, not just at read sites.**
    `normalizeApartmentFilters()` runs in BOTH `parseCatalogUiState` (a shared
    or stale URL) and `withFilters` (a type switch), so an inapplicable value
    can never sit dormant in state and resurrect when the type comes back to
    apartments. Verified `[measured]`: before, `?rooms=2` with no type
    filtered (2 of 8 fixtures) and picking «Квартиры» kept `rooms=2`; after,
    it filters nothing, shows no chip, and picking «Квартиры» gives all 5
    apartments. The gates at the read sites (chips, counts, widen actions, the
    serializer, panel, sheet) are belt-and-braces.
  - Controls are **hidden, not disabled**, for every non-apartment type
    `[measured]`: rooms/market/floor all absent under «Все типы», «Дома»,
    «Участки» and «Коммерция»; all three present under «Квартиры». The price
    field takes the freed grid columns (`lg:col-span-5`) so the row has no gap.
  - **Accepted cost:** a shared URL carrying `rooms`/`market_type` with no
    type stops filtering. Same class as the `rooms=27` change.
- **Draft resync is PER KEY, against the previous applied value**
  (`prevAppliedRef` in the panel and the sheet). A blanket
  `setDrafts(draftsFrom(f))` on every `f` identity change wiped in-progress
  typing whenever an unrelated navigation committed. **The repro needs a
  PENDING navigation** `[measured]`: type while an earlier action's RSC render
  is still in flight, and the commit wipes the draft. The obvious "type, then
  click another control" flow does NOT reproduce it — the click blurs the
  input, blur commits the draft to the URL, and it round-trips back. Same
  reason there is no user-reachable wipe in the SHEET at all (every control
  there is a tap): its per-key resync is defensive consistency, verified
  non-regressive rather than fixing an observable bug.
- **`X-Hidden-Unknown-Floors` includes `?search`** — the count queryset runs
  through the same `SearchFilter` backend as the list (it used to be computed
  in `get_queryset()`, before filter backends, and over-reported).
- **The mobile filter sheet is PORTALED to `document.body`** so it can `inert`
  its siblings while open (a Tab trap never binds a screen reader's virtual
  cursor). Do not move it back inside the page tree — inert would then hit an
  ancestor of the sheet itself.
- Price digits from the URL are capped at `PRICE_MAX_DIGITS` (12, exported
  from `priceDigits.ts`) — same limit the inputs enforce; and ALL grouped
  numbers go through `formatPrice.ts` (`formatPriceRub`/`formatGroupedNumber`,
  ASCII-space convention). A mapper calling `Intl.NumberFormat` directly is
  how U+202F reached the cards.

## Articles (redesigned 2026-08-08): parsed plain-text bodies, category enum, URL-driven index

All behaviour verified `[measured]` by 100/100 Playwright checks (90 in phase 1
across 3 articles incl. shortest/longest, 10 pagination checks against 13
seeded-then-deleted QA articles), plus a 32-width scroll sweep per page.

- **`Article.body` stays PLAIN TEXT; structure is parsed at render time** (user
  decision, 2026-08-08 — chosen over a Markdown migration). The single parser is
  `frontend/src/lib/articleContent.ts`: `\n\n` paragraphs; a short bare line
  (≤90 chars, no terminal punctuation, uppercase start) alone in its paragraph =
  h2; `- ` lines = list items (the lead-in may share the paragraph or not —
  both occur in the seeded data); a standalone paragraph starting «Важно:» =
  callout; the LAST h2 named Вывод/Совет/Итог/Главное + everything after it =
  the «Главное» takeaway card; explicit `## `/`### `/`> ` markers also honored
  (future articles can opt into unambiguous structure with no migration). The
  same parse feeds the TOC and heading ids (RU-translit slugs, deduped), so TOC
  and body cannot drift. Reading time = words/170, min 1, computed from the
  body — no stored field. Django admin `help_text` documents the authoring
  convention (`ARTICLE_BODY_HELP` in `backend/articles/models.py`), and
  **`docs/articles-writing-guide.md` is the human-facing version** (Russian,
  for the superadmin) — parser, help text and guide change together.
  - **Audited across all 15 articles `[measured]`, zero warnings:** 4–6 h2
    each, 1–3 lists, li count equals the raw `- ` line count exactly, every
    article ends in a takeaway card (14× «Вывод», 1× «Совет» —
    `rayony-krasnodara-dlya-pokupatelya`), drop cap on all 15, and **0
    callouts** — no article starts a paragraph with «Важно:» (the one in
    `oformlenie-sdelki…` sits mid-paragraph, which correctly stays prose).
    The audit also flags loose convention (a short unpunctuated line left as a
    `<p>`, a `:` lead-in with no list, a literal `- ` paragraph); none fired.
  - **⚠ The parser is wired to ARTICLES ONLY.** `/districts/[slug]` still
    renders `guide.body` through a `whitespace-pre-line` div, so a guide's
    headings and `- ` lists show as flat text. Writing guides to the
    convention is still correct and forward-compatible — the day that
    renderer is swapped, all of them gain structure with no content edits —
    but do not claim district guides are parsed today.
  - **Heading-detection trap:** «Новостройка: на что обратить внимание» is a
    heading that CONTAINS a colon; only a line ENDING with «:» is a list
    lead-in. Don't "simplify" the rule to `contains(':')`.
- **`Article.category` is a CharField whose VALUES ARE THE PUBLIC URL SLUGS**
  (`pokupka`, `prodazha`, `ipoteka-i-finansy`, `rayony-i-lokacii`,
  `investicii`, `yuridicheskie-voprosy`) — `ArticleCategory` in
  `backend/articles/choices.py`, mirrored by `ARTICLE_CATEGORIES` in
  `frontend/src/lib/articleFilters.ts`. **Treat both lists as append-only**:
  renaming a value breaks shared `?category=` URLs. Backfill migration 0004
  assigned the 15 seeded articles (counts 6/1/1/4/2/1, matching the design
  mockup exactly). New articles pick the category in Django admin (no default —
  the form forces a choice).
- **/articles mirrors the catalog's URL-as-single-source-of-truth pattern**:
  `articleFilters.ts` (parse/serialize, defaults omitted), server page filters +
  slices, `ArticlesExplorer` navigates via the SAME sync-pushState→
  router.replace-in-transition idiom (all three catalog mechanisms copied:
  lastNavigatedRef/currentState, popstate reset, same-URL no-op). Page size 14 =
  one full pass of the desktop card-span rhythm [3,3,2,2,2,3,3,2,2,2,3,3,3,3].
  **Featured card = the NEWEST article, only on «Все» page 1, and it is
  excluded from the grid on every page** — no "pinned" model flag exists.
  `CatalogPagination` is reused as-is. Chip counts are computed from the full
  list — never hardcode. The empty-category state renders from the same
  server-computed filter result (`items.length === 0`); with current data every
  category is non-empty, so it was code-verified but could not be exercised
  live (deliberately: creating the state meant unpublishing a real article,
  which the permission layer refused — to see it, set the one «Продажа» article
  to draft in admin).
- **⚠ A `@theme` token must NOT reference a PAGE-scoped next/font variable.**
  `--font-article-serif: var(--font-literata), …` in `@theme` silently rendered
  the whole body in Golos `[measured]`: @theme variables substitute their
  `var()` refs at `:root`, where the detail-page-only `--font-literata`
  (injected by `app/articles/fonts.ts` on a wrapper div) does not exist → the
  token computes to guaranteed-invalid → the utility no-ops with no warning.
  (`--font-sans` dodges this only because `--font-golos` sits on `<html>`
  itself.) **Fix pattern:** keep a plain local stack in `@theme` and re-declare
  the token in a scope class that lives on the SAME element as the font
  variable (`.ctr-article-serif-scope` in globals.css). If a serif body ever
  renders in Golos again, check this before anything else.
- **Literata is self-hosted via next/font, scoped to the detail page only** —
  `app/articles/fonts.ts` is imported by `articles/[slug]/page.tsx` alone, so
  its preload/woff2 (2 files, ~78 KB: normal 51 + italic 27 `[measured]`) is
  emitted only there; Golos remains 59 KB sitewide. CLS on article load 0.002
  `[measured]`. Source Serif 4 / PT Serif are named fallbacks in the stack, not
  shipped files.
- **⚠ Anchor scrolling must assume the COMPACT header.** A pre-computed
  `scrollTo(rect.top + scrollY − offset)` from the top of the page lands 12px
  off `[measured]`: the sticky header compacts 64→52px DURING the scroll and
  shifts the whole document. The TOC uses offset **76** (compact 52 + room —
  the catalog's `scroll-mt-[76px]` convention, NOT the mockup's 92) and then a
  settle-and-correct rAF loop (`scrollToEntry` in `ArticleToc.tsx`): wait for 3
  stable frames, then one instant `scrollBy` if the heading missed the line.
  Headings carry matching `scroll-mt-[76px]` — keep the two in sync.
- **THE editorial card is `components/articles/ArticleCard.tsx`** — the /articles
  grid, «Другие статьи» (`ArticleSimilarSection`), the homepage «Статьи» section
  AND the /districts guide grid all render it. `ArticlePreviewCard`,
  `ArticleCatalogLinksBlock` and `DistrictGuideCard` were DELETED (replaced by
  `ArticleCard` / `ArticleCatalogCta`). **Per-surface differences travel as
  DATA, never as a second component** — `ArticleCardData` carries `href`,
  optional `eyebrow`, optional `minutes` and optional `ctaLabel`, and each
  domain supplies its own mapper: `articleCardDataFrom()` (in the card file)
  and `districtGuideCardDataFrom()` (in `lib/publicDistrictGuides.ts`). Both
  STRIP `body` — don't pass full texts as client props. If a fourth surface
  needs the card, add a mapper, not a variant.
  - **`minutes` is optional for a real reason:** `DistrictGuideListSerializer`
    omits `body` (only the detail serializer has it), so guide cards show **no
    clock** rather than a fabricated number. Do not "fix" this by adding
    `body` to the guide list payload — that ships ~90 full texts to render a
    clock. A backend-computed `reading_minutes` would also mean two
    definitions of reading time; keep the one in `articleContent.ts`.
  - Guide eyebrow is the AREA KIND («Район» / «Микрорайон»), derived from the
    `catalogParam` the API already sends — **not** the city, which /districts
    already prints as the group heading.
- **Deliberate deviations from the mockup (do not "fix" back):** meta text uses
  `fg-muted` instead of the mockup's `#94A3B8` and the featured meta is
  white/70 not /55 — the mockup grays measure ~2.6:1, below WCAG AA; drop cap
  is CSS `::first-letter`, not the mockup's duplicated `aria-hidden` span
  (screen readers would read a broken word); scroll-spy and reveals use
  position sweeps, never the mockup's IntersectionObserver (documented ban);
  TOC anchor offset is 76, not 92 (compact header, above); the mockup's
  «Спецификация» section is design documentation and was not built.
- **Tablet/desktop TOC breakpoints:** the sticky rail is `min-[1140px]:` (the
  mockup's own threshold — between stock `lg` and `xl`); the accordion wrapper
  is `hidden md:max-[1139px]:block`. **Use the stacked variant, not
  `md:block min-[1140px]:hidden`** — that pair has equal specificity, so the
  winner would depend on stylesheet order.
- The public articles API now returns `category`; `PublicArticle.category`
  falls back to `""` for stale cached payloads. `getSimilarArticles` prefers
  same-category, then recency. Remember the **`revalidate: 120`** on both
  article fetches: after editing an article (or its status) the site can serve
  the old payload for up to 2 minutes — poll before declaring a change broken.

## Realtor profiles are a TEMPLATE: default bio, publish gate, link gating

- **`is_public` («Показывать на сайте») is now ENFORCED** in
  `PublicRealtorDetailView` (2026-08-05). It was editable in three interfaces
  (CRM panel, `/api/auth/me/`, Django admin) and checked by **none** — every
  active realtor was public regardless, so the checkbox actively misled.
  `/api/realtors/<crm_id>/` now 404s unless a profile exists with
  `is_public=True`. Verified `[measured]`: draft → 404, publish → 200,
  unpublish → 404 again. At the time of the change **0 of 1 realtors** would
  have been affected (RID000003 was already public), and **0 realtors lacked a
  profile row**.
- **Every new realtor gets a profile row with `DEFAULT_REALTOR_BIO`**, via a
  `post_save` signal on `User` (`users/signals.py`, wired in
  `UsersConfig.ready()`). A signal, NOT a CRM-serializer hook: realtors are
  created through the CRM panel, Django admin AND the shell, and only a signal
  covers all three — proved for each path `[measured]`. `is_public` keeps its
  `False` default, so a new realtor is a DRAFT until the superadmin tailors
  the bio and publishes.
- **⚠ The CRM create form posts an EMPTY `short_bio`, which would wipe that
  default.** `RealtorCrmWriteSerializer.create()` therefore drops an empty
  `short_bio` so the template survives; on UPDATE an empty value is respected
  (clearing the bio there is deliberate). Both directions verified.
- **The bio is STORED, not a render-time fallback** — the superadmin has to
  SEE the text in the CRM to edit it before publishing, which only works if it
  is really in the field. It is four paragraphs on purpose: `splitBio` maps
  them to lead / intro / blocks / closing, and the closing paragraph is what
  the CTA band renders. It says «Напишите», not «Напишите или позвоните»,
  because a realtor may have no phone.
- **Anything linking to `/realtors/<crmId>` MUST gate on `is_public`**, or it
  links into a 404. `RealtorShortSerializer` exposes the flag, and
  `publicProperty.ts` only sets `realtorCrmId` when it is `true` — so the id's
  absence IS the link's absence, and no call site needs its own rule. The one
  public link surface today is `PropertyContactBlock` («Страница риэлтора»);
  verified absent for an unpublished realtor and present for a published one
  `[measured]`. **`realtor_profile_is_public()` in `users/models.py` is the
  single definition — reuse it rather than re-deriving the rule.**
  - N+1 note: that flag reads a reverse OneToOne, so the public list, the
    public detail and the CRM list querysets all `select_related` the
    profile (`assigned_realtor__realtor_profile`, `created_by__realtor_profile`).
- **Degradation, all verified on a realtor with default bio + no photo + no
  phone + zero listings `[measured]`:** the hero and CTA band fall back from
  the phone CTA to «Связаться» (the page always keeps a primary action — a
  phoneless realtor previously had none); the photo-less portrait uses the
  navy band gradient with white initials instead of washed-out white/70 on
  light grey; the CTA fallback copy uses the PREPOSITIONAL city names
  («в Краснодаре и Геленджике» — the nominative form was a live grammar bug).
- **⚠ Unpublishing does not take effect instantly on the PAGE.**
  `fetchPublicRealtorByCrmId` caches with `revalidate: 120`, so an
  already-rendered profile can serve a stale 200 after the flag flips — and in
  dev it persisted across repeated requests `[measured]`. The API is correct
  immediately; only the cached page lags. A crm_id never fetched before 404s
  at once. Do not diagnose this as broken enforcement — test with a fresh
  crm_id, or wait out the window.

## Which location picker to use: `LocationAutocomplete` vs `DistrictCombobox`

There are TWO searchable location pickers in the codebase. They are NOT
interchangeable — pick by what your form needs (this was a deliberate, correct
engineering choice on the /sell form; do NOT "fix" it back for superficial spec
consistency):

- **`LocationAutocomplete`** (`components/crm/LocationAutocomplete.tsx`) — **exported,
  reusable, id-emitting.** Takes `options: {id,name}[]`, `value` (selected id as
  string), `onChange(id, name)`. Optional `createEndpoint` for inline create (omit it
  and it never touches CRM auth, so it works on **public** forms too). **USE THIS for
  any FORM that needs to save a location FK by id** (CRM property form, the public
  /sell form). It's the right tool when the output is "which id did the user pick".
- **`DistrictCombobox`** (inside `components/home/SearchBar.tsx`) — **NOT exported,**
  slug-based, kind-tagged (`{kind:'district'|'neighborhood', slug}`), built for the
  **catalog SEARCH/FILTER** flow (emits `district_slug`/`neighborhood_slug` query
  params). USE THIS only for catalog filtering. It is tightly coupled to the search
  form and cannot be dropped into a save-by-id form without a rewrite.
- **Rule of thumb:** save-a-location-FK form → `LocationAutocomplete`; catalog
  search/filter → `DistrictCombobox`. The /sell form uses `LocationAutocomplete` with
  merged, kind-tagged options (микрорайоны + районы) and emits the correct FK id per
  kind — the correct choice, verified working end-to-end.

## Live Thousands-Separator Formatting for Number Inputs

- **Pattern for "type digits, see them grouped as you type" inputs** (e.g.
  `"1000000"` → displays `"1 000 000"` live), used for the Price от/до fields in
  `SearchBar.tsx`.
- **Key helpers (module-scope, near `normalizeDecimalInput` in `SearchBar.tsx`):**
  - `digitsOnly(v)` — strips everything but `0-9`. Handles both typing **and**
    pasted values like `"1 000 000"` or `"1,000,000"` — **always sanitize on paste
    too**, not just on keydown.
  - `groupDigits(raw)` — raw digit string → space-grouped display string.
    **DELIBERATELY uses a plain ASCII space, NOT `Intl.NumberFormat("ru-RU")`'s
    default separator** — that locale formatter uses a **narrow no-break space
    (U+202F)**, which looks like a space but renders/copies inconsistently across
    contexts (pasting into other apps, some fonts rendering it oddly). Always build
    the grouping manually with a real space when the formatted string is
    user-facing and potentially copied.
- **Cursor position:** when reformatting a controlled input's display value on
  **every keystroke**, do **NOT** rely on string offset for the caret (it breaks as
  soon as spaces shift). Instead track/restore the caret by **DIGIT COUNT before
  the caret**: after reformatting, walk the new formatted string to place the caret
  after the same number of digits. Apply via `requestAnimationFrame` +
  `setSelectionRange` (setting selection synchronously during the same render can
  get overridden by React's own DOM update).
- **State holds RAW DIGITS only** (e.g. `"1000000"`), **never** the formatted
  display string — the formatted version is derived for rendering only. This keeps
  `normalizeDecimalInput` / URL query params / API calls clean with no stray
  spaces.
- **Use `inputMode="numeric"`** on the input for correct mobile keyboards.
- **Reference implementation:** `PriceInput` component in `SearchBar.tsx` (local to
  that file, **not yet extracted** as a shared component). If another money-input
  need comes up elsewhere (e.g. CRM price fields), **lift this out into a shared
  component** rather than reimplementing from scratch. (Note: CRM/other price
  inputs were **explicitly out of scope** when this was added — the search form's
  two price fields are the only current users.)

## District vs Neighborhood: two separate location tables, don't assume one covers both

- **Symptom:** a location dropdown/filter shows some places but is **missing named
  microdistricts / urban sub-areas**, even though those same values are selectable
  in the CRM property form.
- **Root cause: this project has TWO separate location tables:**
  - `District` — has `district_type`: `city_district` (a **container**, e.g.
    «Микрорайоны Краснодара») or `suburb` (a **terminal** village/settlement/hamlet,
    e.g. «ст. Елизаветинская»). No further children by itself.
  - `Neighborhood` (verbose name «Микрорайон / Населённый пункт») — the actual
    named microdistricts / urban areas (e.g. ФМР, ЮМР, Центр, Пятый микрорайон),
    each with a `city` and a parent `District`.
- **Krasnodar and Gelendzhik are structured DIFFERENTLY** even though the bug and
  fix are identical:
  - **Krasnodar:** has a dedicated `city_district` row («Микрорайоны Краснодара»)
    whose children are Neighborhoods.
  - **Gelendzhik:** has **NO** `city_district` — instead «Геленджик» itself is a
    `suburb` District whose children are Neighborhoods.
  - Any code that assumes "microdistricts only exist under a `city_district`" will
    **silently miss Gelendzhik's case**. **Always fetch/join `Neighborhood` by
    `city`**, not by walking `District.district_type`. (Verified in data: exactly
    these two containers have children; no other district in either city does; 0
    orphan neighborhoods.)
- **Query-param wiring:** District filtering uses `district_slug` → `district__slug`
  (`properties/views.py`). Neighborhood filtering uses a **SEPARATE** param,
  `neighborhood_slug` → `neighborhood__slug` (already existed; was just **unused**
  by the public search frontend). A UI that lets a user pick "a location" must track
  **WHICH TABLE** the selection came from (a `{kind: 'district' | 'neighborhood',
  slug}` value shape) and route to the matching param — **sending a Neighborhood's
  slug as `district_slug` (or vice versa) silently returns zero/wrong results** even
  if the slug string looks valid, because it's checked against the wrong FK.
- **Slug-collision note:** verified **0 collisions** between District and
  Neighborhood slugs in current data (Neighborhood slugs embed their parent
  district, e.g. `krd-mikrorajony-<name>`), but **don't rely on that holding
  forever** without the `{kind, slug}` disambiguation — it's what makes the two
  tables collision-proof **by construction**, not just by current data luck.
- **Reference implementation:** `SearchBar.tsx` / `DistrictCombobox` —
  `LocationKind`, `LocationSelection`, `LocationOption`, `selectionKey()`. Fetches
  both `/api/locations/districts/` and `/api/locations/neighborhoods/` in parallel,
  renders two groups («Микрорайоны» then «Районы и населённые пункты»), and
  `buildCatalogQuery` emits **exactly one** of `neighborhood_slug` / `district_slug`
  based on the selection kind. The grouping is **by table, parent-agnostic**, so it
  covers both cities with no per-city special-casing.
- **Known gap (not yet fixed, flagged for future work):** the SEO landing routes
  (`[city]/[catalogSegment]`) filter server-side via their own resolver and do
  **NOT** yet support targeting a specific neighborhood — only districts. If/when
  SEO landing pages for specific microdistricts are needed (relevant to the upcoming
  breadcrumbs / SEO-links roadmap item), that resolver needs the same
  district-vs-neighborhood awareness added.

## Routing / Architecture

- **`/catalog` is a route SEGMENT, not a single page.** It contains **both** the
  property search/results page (`app/catalog/page.tsx`) **and every property
  detail page** (`app/catalog/[slug]/page.tsx`). Property detail URLs live under
  `/catalog/` and are linked from homepage property cards, both map components,
  «Похожие объявления» (similar properties), breadcrumbs across several page
  types, and the sitemap. **Before proposing to remove, rename, or restructure
  anything under `/catalog`**, check whether the change affects only the search
  page (`catalog/page.tsx`) or the **entire segment including detail pages** —
  treating `/catalog` as one simple page has previously led to a wrong assumption
  that the whole route could be deleted as an unused feature, when it is in fact
  the primary path to **all** property listings on the site.

- **Property detail breadcrumbs + «Популярные запросы» SEO links (roadmap item,
  DONE).**
  - **Breadcrumbs on property detail pages:** «Главная > Каталог > Тип > Город >
    Название», with **strict level-to-URL nesting** (see **Breadcrumb link
    hierarchy** under **Product Decisions** for the type-vs-city rule). Implemented
    in `propertyBreadcrumbs.ts` (`buildPropertyBreadcrumbs` + `buildBreadcrumbJsonLd`),
    wired into `catalog/[slug]/page.tsx` **alongside** the existing `Product`
    JSON-LD — both rendered via the same `<JsonLd>` component as an **array** (one
    `<script type="application/ld+json">` block).
  - **Real bug fixed during this work:** `publicProperty.ts`'s
    `mapPublicDetailToCatalogItem()` wasn't populating `citySlug` / `districtSlug`
    (only the **list** mapper `mapPublicListItemToCatalogItem` did). This silently
    dropped the «Город» breadcrumb level (and forced the type link to the
    query-param fallback). The fix also benefits `SimilarProperties` and any other
    consumer of the detail-mapped item that reads those fields.
  - **«Популярные запросы» homepage links were already correct — NO fix needed.**
    They point to dedicated **SEO landing routes** (`/{city}/{segment}`, e.g.
    `/krasnodar/kupit-kvartiru`) resolved by the `[city]/[catalogSegment]` route via
    `SEGMENT_TO_TYPE` — **not** dead links. These are **canonical, indexable** pages,
    **preferred over query-param links** for SEO. **Do NOT "fix" them into
    `?property_type=X&city_slug=Y` links** even if it looks more consistent with the
    search form — that would be an **SEO regression**. (Verified live: each returns
    200 with correctly type-filtered results for both cities.)

- **Homepage article cards use a SEPARATE component from `/articles` — one fix does
  NOT cover both.** The homepage «Статьи» section (`home/ArticlesSection.tsx`) and
  the `/articles` listing (`articles/ArticlePreviewCard.tsx`) are **two independent
  components** rendering the same `Article` data — they **do NOT share rendering
  logic**. A fix applied to one (e.g. adding cover-image rendering) does **not**
  automatically apply to the other.
  - **Symptom this caused:** after wiring up article cover images, `/articles` and
    `/articles/[slug]` correctly showed the covers, but the homepage «Статьи»
    section still showed the gray «Статья» placeholder — because
    `ArticlesSection.tsx` **hardcoded** that placeholder with no `coverImage` prop /
    render logic at all, AND the homepage's `page.tsx` was additionally **stripping
    `coverImage` out** of the article data before it reached the component (mapping
    to only `{slug, title, excerpt}`).
  - **LESSON:** when fixing or extending how article (or **any entity that appears
    in multiple places** — property cards had the same multi-call-site pattern, see
    **Favorites / Compare / PriceDropBadge** entries) data renders, **explicitly
    check EVERY page/component that displays that entity**, not just the "main"
    listing page. **Grep for the card/preview component name across the frontend**
    to find all render sites before declaring a rendering fix complete.
  - **Known article render sites (verify all three after any article-card change):**
    `/articles` (`ArticlePreviewCard`), `/articles/[slug]` (the detail page's own
    image logic), and the homepage «Статьи» section (`ArticlesSection.tsx`, fed by
    `page.tsx`'s article mapping).

- **Article cover images are PLACEHOLDER gradients, not real / AI photography.**
  This environment has **no AI image-generation tool** (checked: only Miro / Figma /
  Box connectors exist, none synthesize images from text prompts). The published
  articles' covers are **programmatically generated gradient PNGs** (Pillow, via the
  `generate_article_covers.py` management command, saved to
  `media/articles/covers/<slug>.png`) — clean, on-brand, topic-colour-coded
  placeholders, **not real photography**. The client replaces them with real images
  via the CRM later. **If asked to "generate AI images" again in this environment,
  disclose upfront that true AI image generation isn't available here** rather than
  silently substituting something else — this was handled correctly last time
  (explicit disclosure); keep doing that.

- **Article cover images are now OPTIONAL (client decision) — no image shown by
  default.** The gradient placeholder covers were **cleared** from all existing
  articles (`generate_article_covers --clear` deletes the PNG + unsets the field),
  and all three render sites (`ArticlePreviewCard`, `ArticlesSection`,
  `articles/[slug]/page.tsx`) use a **genuine conditional**: the image block renders
  only when `cover_image` is set, otherwise **no image area at all** (no gray box, no
  «Статья» placeholder) — just title + excerpt. A real cover uploaded later via
  `/admin/` renders normally above the title. **Do not reintroduce the gradient
  placeholder / default cover.** The `generate_article_covers.py` command still
  exists but should not be run to re-attach covers unless the client asks.

- **The `Article` model has NO `meta_title` / `meta_description` fields — SEO tags
  are auto-generated frontend-side.** `<title>` and `<meta description>` for both the
  `/articles/[slug]` page and the JSON-LD come from `frontend/src/lib/articleSeo.ts`
  (`buildArticleDocumentTitle` derived from the article **title**,
  `buildArticleMetaDescription` derived from the **excerpt**). So **anyone adding an
  article via `/admin/` does NOT need to think about SEO fields separately** — writing
  a good title + excerpt is what drives the meta tags. There is nothing to fill in for
  SEO in the admin form; adding manual meta-override fields would require a model
  migration + serializer + `articleSeo.ts` wiring (not currently present). (Note:
  article detail pages emit **Article** JSON-LD only — a visible breadcrumb nav but
  **no** `BreadcrumbList` structured-data block, unlike property pages.)

## Product Decisions

- **Realtor page «Связаться» button is always rendered.** On the public realtor
  page (`frontend/src/app/realtors/[crmId]/page.tsx`), the «Связаться» button
  that opens the contact modal is **intentionally shown regardless of whether the
  realtor has a phone number** on file. This differs from the old behavior, where
  a `tel:` dial link appeared only if a phone existed. The modal is **form-based**
  (`PublicLeadInquiryForm` with `realtorCrmId`), not phone-dependent, so gating it
  on phone presence would be wrong. This is a **deliberate product choice, not an
  oversight** — do **not** reintroduce phone-based conditional rendering for this
  button without explicit confirmation.

- **Public lead form enforces strict input formatting.** On
  `frontend/src/components/inquiry/PublicLeadInquiryForm.tsx` (used by both the
  «Задать вопрос» and «Связаться с риэлтором» modals):
  - **Phone** — progressively masked to `+7 (XXX) XXX-XX-XX` as the user types
    (`formatPhoneMask` helper), digits only, `+7` prefix always present and
    non-deletable. Mid-typing shows only the entered portion (**no** underscore
    placeholders) — this is the **desired** behavior, not a shortcut to fix later.
  - **Name** — letters (Cyrillic + Latin, incl. ё/Ё) and spaces only
    (`stripName` helper); **no digits, no hyphens, no other punctuation**.
    Hyphenated names are **intentionally rejected**; space-separated two-word
    names are allowed.
  - Both are **frontend-strip on input + backend validation** in
    `PublicLeadCreateSerializer` (`validate_client_name`) as defense in depth
    against direct API calls.
  - **Scoped to the public lead form only.** CRM/account forms (e.g.
    `AccountStaffRealtorsPanel.tsx`, realtor create/edit) are **explicitly NOT
    covered** and keep free-form input unless a separate decision changes that.

- **152-ФЗ consent checkbox lives in ONE shared component —
  `components/legal/ConsentCheckbox.tsx`.** Both public data-collecting forms use
  it: `PublicLeadInquiryForm` (itself shared by the homepage card, the
  property-detail modal and the realtor contact modal) and `SellPropertyForm`.
  Those are the **only two** public forms that collect personal data — verified by
  grepping for `client_phone`/`owner_phone`/`api/leads`/`api/sale-requests`; every
  other hit is a staff-facing CRM table.
  - **Unchecked by default, and the submit button is disabled until it is
    ticked** (`disabled={… || !consent}`), with a matching `validate()` entry as
    belt-and-braces for programmatic submits. Verified `[measured]`: 31/31
    browser checks across all four surfaces — including that a forced
    `form.requestSubmit()` without consent fires **no** POST to `/api/leads`.
  - **Never add wording claiming the data is not stored.** It IS stored for the
    realtor to act on (see `/privacy` §2/§5/§7); such a claim would be false and
    legally worse than saying nothing.
  - The policy link opens in a **new tab** on purpose (these forms live in
    modals; navigating away would discard everything typed) and calls
    `stopPropagation()` — it sits inside the `<label>`, so without that a click
    would silently toggle consent while opening the policy.
  - `ui/checkbox.tsx` gained `label?: React.ReactNode` (so a label can contain a
    link) plus `alignTop` / `wrapperClassName`. **`alignTop` is a prop, not a
    class**, because `cn()` in `lib/utils.ts` is a **naive join, NOT
    tailwind-merge** — passing `items-start` alongside the hardcoded
    `items-center` would emit BOTH and let stylesheet order pick the winner.
    Existing CRM call sites are unaffected (both new props default to falsy).

- **Breadcrumb link hierarchy: type vs. city must NOT collapse to the same URL.**
  When building breadcrumbs that combine a **type-level** segment and a
  **city-level** segment (e.g. «Квартиры > Краснодар» on a property detail page),
  and a combined "type+city" SEO landing route exists (e.g.
  `/krasnodar/kupit-kvartiru`), do **NOT** point both breadcrumb levels at that same
  combined route just because it's available and "more canonical". **Product
  decision:** keep the hierarchy **strictly nested** —
  - **Type segment** → broadest scope, **query-param catalog filter only**
    (`/catalog?property_type=X`) — the same type across **ALL** cities.
  - **City segment** → narrower scope, the **canonical SEO landing route** for that
    specific city+type combo when one exists (falls back to
    `/catalog?property_type=X&city_slug=Y` otherwise).
  - Two breadcrumb levels pointing at the **identical** URL breaks the expected
    "each level is progressively narrower" mental model, **even if** it's
    technically SEO-sound from a pure canonical-URL perspective. (This reverses an
    earlier implementation where both collapsed to the landing route — the strict
    nesting is the deliberate final choice.) Reference: `propertyBreadcrumbs.ts`
    (`buildPropertyBreadcrumbs`); verified live for both Krasnodar and Gelendzhik.

## Integrations

### Telegram Lead Notifications

- When a public lead is created (`PublicLeadViewSet.perform_create` in
  `backend/leads/views.py`), a Celery task
  (`backend/leads/tasks.py: send_lead_telegram_notification`) sends a plain-text
  notification to a Telegram group via the Bot API (`sendMessage`, no
  `parse_mode`). Message fields: Имя / Телефон / Сообщение / Источник / Страница
  (property's `/catalog/<slug>` URL) / Время (Europe/Moscow, " МСК").
- **Env vars** (set in `backend/.env`, **NOT committed**):
  `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `SITE_URL`. Documented as empty
  placeholders in `.env.example`.
- **Master switch:** the `LEADS_NOTIFICATIONS_ENABLED` setting. The task no-ops
  safely (logs and returns) if the flag is off or credentials are missing —
  a failed/absent send never affects lead creation.
- **Modeled on** the sibling project `real-estate-platform-lp`
  (`app/api/lead/route.ts`) — same message template and Telegram API call
  pattern, but there it's a **synchronous Next.js API route** (that project has
  no database/Celery), whereas here it's an **async Celery task** fired via
  `transaction.on_commit()` after the DB commits.
- Triggered via `.delay()`, not called directly — so it **requires a running
  Celery worker** to actually send. It will **not** fire if only the Django dev
  server is running without a worker (and `CELERY_TASK_ALWAYS_EAGER` is unset).

### Lead Source Tracking (property vs homepage)

- The `Lead` model already had a nullable `property` FK, and **both** the
  property-page «Задать вопрос» modal and the homepage form were already
  correctly sending it (property page) / omitting it (homepage → `property =
  null`). This was **NOT** a backend gap. The only missing piece was **UI**: the
  realtor «Заявки» page (`AccountInquiriesTable.tsx`) didn't display the data
  even though the API (`CrmLeadListSerializer`) already returned it. Added an
  «Источник» column showing either «Главная страница» (no property) or a PID
  link + title (property linked), matching the existing CRM properties-table
  link pattern.
- **Lesson:** before assuming a feature needs new backend/data-model work, check
  whether the data is already being captured and just isn't displayed — grep the
  serializers and existing API responses first. This saved a full backend
  implementation cycle here.

## Session Summary — 2026-07-03

Index of what changed this session; details live in the linked sections above.

1. **Telegram lead notifications** — Celery task
   `send_lead_telegram_notification`, fired from
   `PublicLeadViewSet.perform_create` via `transaction.on_commit()`. Env vars in
   `backend/.env` (**not** `.env.local`): `TELEGRAM_BOT_TOKEN`,
   `TELEGRAM_CHAT_ID`, `LEADS_NOTIFICATIONS_ENABLED=True`, `SITE_URL`. Message
   format modeled on sibling project `real-estate-platform-lp`. → see
   **Integrations › Telegram Lead Notifications**.
2. **Local dev launcher** (`Start Centreal.bat` / `scripts\start_local.ps1`) —
   now auto-starts Django + Next.js + Celery worker in **three separate
   PowerShell windows** (a `wt.exe` split-pane version was attempted and reverted
   after an unreproducible "flash and close"). Worker launches via venv
   `python.exe` by absolute path. → see **Environment & Local Dev** and
   **Windows Terminal / Launcher Scripts**.
3. **Numeric-only input fields** — property characteristics use `type="text"` +
   `inputMode` + custom `onKeyDown`/`onChange` filtering (not `type="number"`),
   `min` enforced on blur. Reusable helpers in `CrmPropertyFullForm.tsx`. → see
   **Frontend Form Validation**.
4. **Lead source tracking** — «Заявки» page gained an «Источник» column («Главная
   страница» vs linked property PID + title). Data was already captured
   backend-side; only the UI was missing. → see **Integrations › Lead Source
   Tracking**.
5. **Cabinet width fix + Tailwind v4 gotcha** — `Container` gained a
   `size="wide"` (1536px) variant, applied to `account/layout.tsx`;
   `max-w-(--breakpoint-2xl)` is the preferred spelling. (The claim recorded that
   session — that `max-w-screen-*` no longer compiles in v4.3.2 — was later
   **DISPROVEN**; it does compile.) → see **Frontend Layout & Styling
   (Tailwind v4)**.
6. **Homepage category filtering** — «Категории» cards now filter the homepage
   list **and** map in-place (via new `HomeCatalogExplorer.tsx` client wrapper)
   instead of navigating to `/catalog`. → see **Frontend Layout & Styling
   (Tailwind v4)**.

## Known Issues / Backlog

- **~~Property-card badges + old price are BLOCKED on the public API~~ — DONE
  2026-08-04 for old price and market; `is_new` is still open.**
  - `old_price` and `market_type` are now on `PropertyListSerializer`, so the
    card renders the struck-through previous price and the
    «Новостройка»/«Вторичка» photo badge. **Why exposing them is safe** (asked
    and answered before shipping): `market_type` was ALREADY a public filter
    param on the same endpoint (`?market_type=…`), so the value was publicly
    derivable anyway; `old_price` is a display concept («Старая цена») and the
    detail endpoint already publishes the FULL `price_history`, which reveals
    strictly more. The genuinely private fields carry explicit "never expose"
    markers in `models.py` (`owner`, `real_latitude`, `real_longitude`) and
    stay out. Verified `[measured]`: the list payload gained exactly these two
    keys (21 → 23) and nothing else.
  - **A lower or equal `old_price` must NOT be struck through** — that is not a
    markdown. The guard lives in `publicPropertyList.ts` (`formatOldPrice`
    returns undefined unless `old > price`), so the card never has to judge.
    `market_type: "other"` and null render no badge.
  - `is_new` **is now DERIVED, never stored** (2026-08-04): `is_new_listing()`
    in `properties/serializers.py` returns True when `published_at` is within
    `NEW_LISTING_DAYS` (7). No migration, no field for anyone to fill, no
    manual toggle to forget — the badge ages out on its own. Computed
    server-side (both list AND detail serializers) so every consumer agrees
    on what "new" means.
  - **ONE badge slot on the photo, and «Цена снижена» WINS it.** The kit's
    `.ctr-card__badges` is a flex row that could hold both, but the other
    corners are taken (top-right = heart+compare, bottom-left = market), so a
    second badge would be a fourth overlay on one photo. Price-drop takes
    precedence: it is the stronger buying signal and the only one not
    conveyed elsewhere (recency is already carried by the default «Сначала
    новые» sort and list position). «Новый объект» reuses the same box and
    changes only the fill (brand blue + white) — which is exactly how the kit
    separates `.ctr-badge--accent` from `--primary`.
  - `is_price_reduced` (peak-derived boolean) and `old_price` are INDEPENDENT:
    the «Цена снижена» badge and the struck price can appear together or
    separately, and neither implies the other.
- ~12 test failures in the properties app: migration 0023 made city/district
  required but existing fixtures don't set them. Needs fixture updates.
- Full Krasnodar residential complex (ЖК) list is incomplete (~130 exist on Cian,
  which blocks scraping) — needs manual data from the user.
- `TZ_Объекты.docx` describes a 16-step property form spec — reviewed but not yet
  implemented.
- ~~a11y gap in `DistrictCombobox`~~ **FIXED (catalog redesign session,
  2026-08-04):** the note itself was half-stale — `aria-expanded` was already
  present; the actual gap was only `aria-controls` + a listbox `id`, both added.
  The lint rule no longer fires on this file `[measured]` (eslint run clean).

## Price History Feature (PriceHistory model, badge, chart) — reference summary

- **New model: `PriceHistory`** — `property` FK (CASCADE,
  `related_name="price_history"`), `price`, `changed_at` (auto_now_add + indexed),
  `Meta.ordering = ["changed_at", "id"]` (ascending).
- **Auto-tracking via a `post_save` signal** (`properties/signals.py`, wired in
  `apps.py` `ready()`): seeds one "listed at X" row on **create**; appends a row on
  **update only when the price differs** from the latest entry. **Skips
  `update_fields` saves that don't touch `price`.** Note: `Property.save()`'s
  internal re-save of title/slug uses `QuerySet.update()`, which does **NOT** emit
  `post_save` — so it doesn't cause double-counting. **Relevant if you touch
  `Property.save()` again later.**
- **`is_price_reduced` definition (load-bearing product decision): current price <
  PEAK (max) historical price — NOT vs. the immediately-previous price.** A genuine
  markdown should still read as «цена снижена» even after a small later bump. **Any
  future feature reading price trends must reuse this same peak-based definition**,
  not reinvent a "vs. previous" comparison.
  - **Detail endpoint** (`PropertyDetailSerializer`): exposes `price_history`
    (nested, ascending) and `is_price_reduced` (SerializerMethodField over the
    prefetched history).
  - **List endpoint** (`PropertyListSerializer`): `is_price_reduced` via a
    `peak_price=Max("price_history__price")` **annotation** on the list queryset —
    **NO N+1** (verified: constant 2 queries regardless of row count). The method
    field reads `obj.peak_price`; if the annotation is absent it returns `False`
    rather than firing a per-row lookup.
- **Frontend chart: `PriceHistoryChart.tsx` is a hand-rolled inline SVG line/area
  chart — deliberately NOT recharts/d3/chart.js.** None were already a project
  dependency, and adding one risks the documented flaky-npm-on-pCloud install
  issue. **Follow this precedent (inline SVG) for future simple charts** unless a
  chart's complexity genuinely demands a library. Renders **nothing** when there
  are `< 2` points.
- **Badge: `PriceDropBadge.tsx`** («↓ Цена снижена») — rendered on the detail page
  next to the price AND on `PropertyCard` (catalog + homepage «Новые объекты» +
  similar/realtor/favorites), gated by `isPriceReduced`. Positioned in a flex row
  with the price (same non-disruptive approach as the favorite heart precedent).
- **`formatPrice.ts` (new shared utility): `formatPriceRub` / `formatPriceCompactRub`**
  via `Intl.NumberFormat("ru-RU")` normalized to a **plain ASCII space** (per the
  thousands-separator convention — see **Live Thousands-Separator Formatting**).
  **Reuse this** rather than reimplementing price formatting elsewhere.
- **Backfill:** existing properties got one seeded `PriceHistory` row (dated
  `published_at or created_at`) via data migration `0025_backfill_price_history`, so
  the graph/badge logic has a valid baseline for pre-existing listings, not just
  newly created ones.

## Compare Properties Feature — reference summary (mirrors Favorites architecture)

- **Fully client-side, localStorage-based** (key `"centreal_compare"`), **no
  backend/API/DB changes** — the **same architectural pattern as Favorites**,
  reused deliberately for consistency and lower risk.
- **Key differences from Favorites** (worth knowing before touching either):
  - **Each stored entry is `{slug, type}`**, not a bare slug — storing the type
    alongside the slug lets constraint checks (same-type-only, max 4) run **without
    re-fetching** each property's data first.
  - **`toggleCompare()` returns a structured `{ok, reason, message}`** result (not a
    plain boolean), so the calling UI (`CompareToggleButton`) can surface a
    specific blocked-reason message (wrong type / max reached) instead of silently
    failing.
  - **Conflict UX = BLOCK the add with a transient inline message (2.5s)**, never
    silently replace the existing selection — this was an **explicit product
    decision; don't change it to auto-replace** without checking first.
  - **Card icon placement — REVERSED 2026-08-04:** heart and compare now sit
    **grouped in ONE top-right row** (heart first, compare second), matching
    the catalog mockup; the top-left corner belongs to the «Цена снижена»
    photo badge. The old "deliberately opposite corners" layout is obsolete —
    see the catalog-page section above.
  - **Comparison table (`CompareView.tsx`):** properties as columns, attributes as
    rows, reusing the **same field set already shown on the property detail page**
    (price + price-drop badge, price per m², rooms, area, floor, district,
    renovation, material, …). Rows with **no data anywhere** in the compared set
    are **hidden entirely** rather than shown empty. Lowest price / price-per-m²
    gets a highlight.
  - **Same-type-only is enforced at the point of adding** a second+ property, NOT
    as a filter on the compare page itself.
- **Reference files:** `lib/compare.tsx` (`CompareProvider`/`useCompare`),
  `CompareToggleButton.tsx`, `CompareBar.tsx` (floating bottom indicator, shows at
  **≥2** items), `HeaderCompareLink.tsx` (header badge), `app/compare/page.tsx` +
  `CompareView.tsx`. Both providers are mounted in `app/layout.tsx`
  (`FavoritesProvider` → `CompareProvider`).
- **If a similar "select N items across pages, persist client-side, view together"
  feature is needed again**, mirror this (and Favorites) architecture rather than
  building something new from scratch.

## Backend / Serializers

- **Relative media paths must be `CharField`, not `URLField`.**
  `PublicRealtorSerializer.avatar` was a `URLField`, but the backend
  (`PublicRealtorDetailView`, `users/public_views.py`) **intentionally returns a
  relative `/media/...` path**, not an absolute URL — by design, for Next.js
  proxying and to avoid leaking the internal backend host in production.
  `URLField` rejects relative paths, so **any realtor with an avatar set** made
  the public realtor-detail endpoint fail with a **400**. The frontend's
  `fetchPublicRealtorByCrmId` silently mapped that to `null`, the page called
  `notFound()`, and it surfaced as a **plain 404** with no hint of the real 400
  underneath. **Fix:** use `serializers.CharField(allow_null=True)` (not
  `URLField`) whenever a field is intentionally a relative media path.
- **A public 404 may be masking a swallowed 400/500.** When a public page shows
  404, check whether the underlying API call actually returns 404, or whether a
  "not found" fallback (e.g. non-OK → `null` → `notFound()`) is silently
  swallowing an unrelated validation error. **Always inspect the real API
  response status/body before assuming it's a missing-data problem.**
- **Readable ≠ editable — check the write path separately.** The `RealtorProfile`
  fields (`short_bio`, `public_name`, `public_phone`, `is_public`) existed on the
  model and were **read** by the public API, yet had **no editing API anywhere**
  — neither `/api/auth/me/` (self-service) nor `/api/crm/realtors/<id>/` (admin)
  accepted them for write. Support was added to both via a shared
  `_apply_realtor_profile_fields` helper that get-or-creates the profile
  (realtor-role users only). **Takeaway:** a field existing on a model and being
  read somewhere does **not** mean it's editable — verify the write path
  (serializers + views) before assuming a "missing" UI is just a frontend gap.

## Local dev / tooling

- **Don't run one-off Django scripts via `manage.py shell < script.py`.** On this
  Windows/pCloud setup the stdin-redirect form runs in interactive-console mode
  and **silently no-ops** — assignments / side effects don't reliably persist (a
  seed looked like it ran but wrote nothing). **Working form:**
  `manage.py shell -c "exec(open('script.py', encoding='utf-8').read())"`. Use
  this for any one-off seed/data script run through the Django shell — **not** the
  `<` redirect.

- **Intermittent `OperationalError` = Postgres connection exhaustion, not a
  crash.** The local Django dev server intermittently failed with
  `psycopg2.OperationalError` / `django.db.utils.OperationalError` (surfacing on
  the Next.js side as `ECONNRESET` / socket hang-up) **even while idle with no
  code changes**. **Root cause:** connection exhaustion. `max_connections=100`
  (~97 usable) and all ~60 idle connections were held by a **single leftover
  Django dev server** — **two `runserver` instances and two Celery workers were
  running at once** (the dev stack had been launched twice without stopping the
  first). Nothing reaped idle connections (`idle_session_timeout` was 0), and
  Django's `CONN_MAX_AGE=600` only closes connections lazily at request
  boundaries, so a burst of parallel frontend API calls (e.g. `/api/auth/me/` +
  `/api/auth/login/`) spawned enough persistent connections to cross the limit.
  **Fix (all reversible):**
  1. Cleaned up duplicate processes via `scripts\stop_local.ps1` before
     relaunching **one** clean stack with `Start Centreal.bat` — connections
     dropped 69 → 9 immediately.
  2. `idle_session_timeout='5min'` in Postgres (`ALTER SYSTEM` + reload) so
     Postgres reaps abandoned idle connections from any future leftover process.
  3. Lowered `CONN_MAX_AGE` to **60s for local dev only** — env-driven in
     `backend/config/settings.py`, set via `backend/.env`; **production/Railway
     default of 600 is unchanged**. Kept below the 5-min Postgres timeout so
     Django recycles before Postgres force-closes.
  4. Enabled `log_connections`/`log_disconnections` in Postgres so future
     connection churn is visible in the logs
     (`C:\Program Files\PostgreSQL\18\data\log\`) instead of silently piling up.
  - **Prevention:** **always run `scripts\stop_local.ps1` before relaunching** —
    never start a second parallel `runserver`/Celery/Next.js set on top of an
    existing one. If Django throws intermittent `OperationalError` with no code
    cause, check `SELECT count(*) FROM pg_stat_activity;` against
    `SHOW max_connections;` **before** assuming it's a code bug.

- **`manage.py shell -c` + `transaction.savepoint_rollback()` is UNRELIABLE — do
  NOT trust it to undo test-data changes.** Observed: during a shell-based test, a
  **real property's price was temporarily mutated** inside a
  `savepoint()`/`savepoint_rollback()` block, and the rollback **did not restore
  it** — the change persisted and required manual detection + explicit restoration.
  **Do NOT rely on savepoint rollback for cleanup after shell-based testing** in
  this Windows/pCloud environment. Instead:
  - **(a) Preferred:** create **disposable** test records and **hard-delete** them
    when done (`Property.objects.filter(crm_property_id="PIDTEST...").delete()`).
  - **(b) If a real record must be touched:** explicitly **record its exact prior
    state before mutating**, then explicitly **restore + verify** it afterward —
    never assume any transactional mechanism auto-cleans it. To restore without
    firing side-effect signals (e.g. the price-history `post_save`), use
    `Model.objects.filter(pk=...).update(...)` (QuerySet.update emits no signals),
    not `instance.save()`.

## Property #18 is the ONLY real listing — verify its integrity after any price / PriceHistory work

- **Property #18** (`PID000001`, «1-комн. квартира, 45.00 м², Краснодар», created by
  realtor `vl@vl.ru`) is currently the **single real, production-meaningful**
  property in the database.
- **Its correct state, re-read from the DB on 2026-08-04 `[measured]`:** price
  **5 000 000 ₽**, **THREE** `PriceHistory` rows (**1 100 000 @ 2026-06-29** →
  **4 500 000 @ 2026-07-04 01:44** → **5 000 000 @ 2026-07-04 01:56**), **3 real
  photos** (all 12 derivative files on disk), a real description, **17
  phone-reveals** attached (the 17th is an organic YaBrowser click confirmed by
  the user as the new baseline), `is_published=True`.
  - **This entry used to say 4 500 000 and TWO rows.** That was not wrong when
    written — it was written *twelve minutes* before the user bumped the price
    again in the same CRM session, and then went stale. Which is the whole point
    of the rule below: a hardcoded "canonical" number in a doc decays, so
    **re-read the DB rather than trusting this line.** Both the price and the
    phone-reveal count (was 8) had drifted by the time it was next checked.
- **⚠️ DO NOT "restore" #18 to the old 1 100 000 «baseline» — that value is STALE.**
  The user edited the price to **4 500 000** through the CRM. During earlier
  price-history/compare testing this real edit was **twice mistaken for test
  contamination and reverted to 1 100 000** via `QuerySet.update()`, destroying the
  user's edit (they reported the price "not persisting after restart" — it was
  actually being overwritten by that cleanup, not a save/DB bug). **The lesson: a
  properly-formed price change (a new price WITH a matching `PriceHistory` row) is
  what a REAL edit looks like — NOT contamination. Never assume a "baseline" price
  is correct.**
- **RULE:** after **ANY** task that touches `Property`, `PriceHistory`, or related
  signals/migrations — **even if #18 wasn't the intended target** — verify #18's
  integrity, but **before "restoring" anything, check whether the current price
  reflects a real, intentional user edit:**
  - The last-observed canonical price is **5 000 000** (2026-08-03 `[measured]`);
    `photos.count()` must be **3**. Quick check:
    `Property.objects.get(pk=18)` → `price`, `photos.count()`.
  - **If the price differs from 5 000 000, do NOT blindly reset it.** A different
    value with a clean, signal-generated `PriceHistory` row is very likely another
    **real user edit** — treat it as the new canonical value and **ASK** before
    changing it. Only treat it as corruption if there's clear evidence it came from
    leftover disposable test data (e.g. a price matching a `PID…`-marked test run).
  - When you DO legitimately need to set #18's price (with the user's confirmation),
    use a real `.save()` so the `post_save` signal records a proper `PriceHistory`
    row — do **not** use `QuerySet.update()` for an intended price change (that
    silently skips history). Reserve `QuerySet.update()` for undoing your OWN
    accidental test writes.
### ⚠ A test fixture must NEVER reference a real object's file paths

- **This destroyed real media once — 2026-08-03 `[observed]`.** Building
  0-photo / 1-photo fixtures for the property-detail template, a disposable
  `PropertyPhoto` was created pointing at **#18's existing** `original_file` /
  `image_large` / `image_medium` / `image_thumb` names — reusing the paths
  looked like a cheap way to get a valid photo. Deleting the fixture afterwards
  ran the storage cleanup, which **deleted those files from disk**. #18 lost the
  three derivatives of one photo and rendered a broken hero image; only
  `original_file` survived.
- **Recovery, if it happens again:** the derivatives are rebuildable from the
  original — `from properties.tasks import generate_property_photo_derivatives`
  then call it synchronously with the photo id. Verified `[measured]`: all 12
  file paths across #18's 3 photos existed again afterwards, with price, photo
  count and price-history rows unchanged.
- **RULE: a fixture owns its own bytes.** If a fixture needs an image, COPY the
  file to a fixture-only path first (e.g.
  `properties/photos/qa_fixture/…`) and point the row at the copy, then delete
  that directory during cleanup. Never let a disposable row share a storage path
  with a real one — `.delete()` on the fixture cannot tell the difference.
- **Generalises beyond photos:** the same trap exists for any FileField whose
  model deletes from storage on delete. Before reusing ANY real record's file
  reference in test data, assume deleting the test row will delete the file.
- **Verify media, not just rows, after fixture cleanup.** Row counts looked
  perfect the whole time this was broken — `photos.count()` was still 3. What
  caught it was a rendered screenshot, and what confirmed it was
  `os.path.exists(os.path.join(settings.MEDIA_ROOT, name))` per field. Add that
  check to the #18 integrity pass whenever a task touched photos.

- **This is a temporary single-point-of-failure concern** — once realtors add real
  properties through the CRM in normal use, it naturally fades. **Until then, treat
  #18 as fragile: verify every time, but never overwrite a real edit with a stale
  baseline.**

## Testing

- **`Property` fixtures need `city`/`district` since migration 0023.** Tests in
  `backend/leads/tests.py` (`PublicLeadCaptchaAndCreateTests`) were failing
  **entirely in `setUp()`**, before any test body ran, because migration 0023
  made `city` and `district` **required** on `Property` while the fixtures created
  `Property` objects without them. **Fix:** create minimal `City`/`District`
  fixtures in `setUp()` and attach them to every `Property.objects.create(...)`.
  **Confirmed also affects `backend/users/tests.py`** — ~23 failures there are
  the same `city_id NOT NULL` fixture errors (plus one separate, unrelated
  activity-log ordering failure). This was **confirmed but NOT fixed** this
  session (deferred). **Future work:** next time work touches `users/tests.py`,
  apply the same `City`/`District` fixture fix used in `leads/tests.py` **before**
  adding new tests there; and check whether **other test files** across the
  properties/CRM apps have the same unfixed pattern — **don't assume only
  `leads` and `users` are affected**.
- **Making a form/API field required breaks existing "empty value → 201" tests.**
  When you add a required-field validation to any public-facing form or DRF
  endpoint that already has serializer tests, any existing test that POSTs the
  field empty/blank/omitted and asserts **201** will start failing with **400**
  once the field is required. **Update those tests to send a valid, non-empty
  value for that field first**, then add the new validation-specific tests —
  otherwise the new tests can't be verified as isolating the intended failure.

## Favorites feature: verified end-to-end via Playwright, 12/12 checks pass

- The localStorage-based **Favorites** feature (`FavoriteHeartButton.tsx`,
  `PropertyCard.tsx`, `favorites.tsx` context, `app/favorites/page.tsx`,
  `FavoritesView.tsx`, `header.tsx` count badge) was smoke-tested with a **real
  headless Chromium browser via Playwright** against the live dev server. All of:
  heart toggle (no navigation triggered), header badge live updates, `/favorites`
  page rendering **real data**, live removal without reload, **persistence across a
  full page reload**, empty state + working catalog link, and **zero
  console/hydration errors** — all confirmed working. **No app code needed
  changing** — the two initial red checks were bugs in the test script (a stale
  post-click locator, and a Cyrillic `aria-label*=` substring selector Playwright
  didn't resolve — use a plain `article` locator instead), not the feature.
- **Test approach for future smoke tests:** install `@playwright/test` as a dev
  dependency, write a **throwaway** script, run it against the running dev servers,
  then **clean up** — remove the temp script, **revert `package.json` /
  `package-lock.json` to committed state** (npm re-resolves and pins unrelated dep
  ranges on install), stop the servers, free the ports. **Do NOT leave Playwright as
  a permanent dependency** unless explicitly requested — treat it as a disposable
  verification tool per use. (The Chromium binary caches under
  `~/AppData/Local/ms-playwright/`, outside the repo — harmless to leave or delete.)
- **Gotcha for the test itself:** `/favorites` fetches each property client-side
  after mount (localStorage stores only slugs), so wait for `article` to appear
  before asserting card count — `networkidle` alone can fire too early. Also, the
  Next.js proxy 308-redirects `/api/properties/<slug>/` → the no-slash URL (→ 200);
  browsers follow it transparently, so it's not an error — don't mistake the 308 in
  the network log for a failure.

## Additional pCloud EPERM occurrence: Next.js DEV server (not just `next build`)

- The pCloud virtual-drive **EPERM issue with `.next\trace`** (the same filesystem
  quirk that makes `next build` fail here — see the pCloud note under **Environment
  & Local Dev**) can **ALSO crash the Next.js DEV server mid-session**: it may serve
  initial requests successfully, then **die while flushing its tracer**.
- **If the dev server dies unexpectedly during a session, this is the likely
  cause.** **Fix:** just restart the dev server — a **warm `.next` cache** after
  restart tends to run stably afterward (observed: crash on cold first run, then a
  clean ~11s restart that survived a full Playwright suite).
- This is an **environment quirk, not an application bug** — if the terminal shows
  an `EPERM` / `.next/trace` error, **do NOT debug application code first**; restart
  and retry.
- **IMPORTANT — do NOT `rm -rf .next` to "fix" a dev problem on this drive.** Deleting
  `.next` forces a full cold rebuild, and on pCloud the cold rebuild's many small
  writes fail **much** more often than incremental warm writes — cascading into
  `ENOENT .next/cache/.rscinfo`, `EIO .next/build-manifest.json`, locked
  (un-deletable, EPERM) `.next/cache` files, and the CSS failures below. Once `.next`
  is thrashed this way the drive can get **stuck holding file locks that only the
  pCloud client releases** — no number of restarts recovers it in-session. Prefer a
  warm restart (keep `.next`); reserve deletion for a last resort when the drive is
  known-healthy.

## Claude Code itself can abort with 0xC0000409 on this drive — recovery checklist

- **The abort is ENVIRONMENTAL, not a code error.** Claude Code died mid-session
  with Windows exit code **`0xC0000409` (3221226505,
  `STATUS_STACK_BUFFER_OVERRUN`)** `[observed]` — the same class of pCloud
  filesystem fragility as the `.next\trace` EPERM and the PackFileCache rename
  failures above, just hitting the agent process instead of the dev server. The
  log named `.claude\settings.local.json` being written on the pCloud drive at
  the moment of the crash. **Do not start debugging application code, and do not
  assume the repository is damaged.**
- **The settings file was NOT corrupted, and the log line naming it is not
  evidence that it was** `[measured]`: after the abort,
  `.claude/settings.local.json` parsed as **valid JSON**, 3280 bytes, with an
  mtime of **2026-06-28** — i.e. no write had landed at crash time at all. Check
  it, but expect it to be fine; `[inferred]` the abort interrupted the write
  before it touched the file rather than half-writing it.

### First moves after ANY abnormal termination — in this order

1. **`git status` + `git log --oneline -10`.** What is committed is safe; only
   the working tree can be mid-edit.
2. **Check for an in-progress operation** before touching anything —
   `MERGE_HEAD`, `REBASE_HEAD`, `CHERRY_PICK_HEAD`, `BISECT_LOG`,
   `rebase-merge/`, `rebase-apply/` under `.git/`. A half-finished rebase is the
   one state where the tree really is incoherent, and it is invisible in a
   casual `git status` read.
3. **`tsc --noEmit`** to prove the tree compiles rather than eyeballing diffs
   for truncation. Run it with the **project-local** binary —
   `& "frontend\node_modules\.bin\tsc.cmd" --noEmit -p frontend\tsconfig.json`.
   Bare `npx tsc` from the repo root does **not** resolve (typescript is a
   `frontend/` dependency) and prints "This is not the tsc command you are
   looking for", which is a tooling miss, not a type error `[measured]`.
4. Only then read diffs.

### ⭐ The diagnostic that actually settled it: mtimes vs commit timestamps

- **Compare each dirty file's `LastWriteTime` against the timestamps of the last
  commits.** That is what proved the abort landed _after_ the final commit
  rather than during one, and it is cheaper and far more conclusive than reading
  the diff and guessing whether it "looks finished".
- **Worked example (2026-08-05 recovery)** `[measured]`: the last three commits
  were written at **05:36:51 / 05:37:57 / 05:38:07 +0300**; the single dirty file
  (`frontend/src/app/privacy/page.tsx`) had an mtime of **2026-08-03 01:06** —
  **two days earlier**. So it was a stale leftover from an unrelated earlier
  session, not a casualty of the crash, and the interrupted task had in fact
  completed and committed. `tsc --noEmit` exited **0** and no in-progress git
  operation existed, confirming the tree was coherent.
- **Corollary — a dirty file is not automatically "the file it crashed on".**
  Establish its age before assuming it needs repair or reverting it. Reverting a
  complete, unrelated edit because it happened to be uncommitted is the
  destructive failure mode here.

### Prevention: commits on this drive exist in exactly one place

- **Push early and often.** 38 commits of finished work were sitting only on
  `P:\` when this abort hit — on a drive this file already documents as capable
  of locking files, failing builds and killing processes. `git push` is the only
  thing that makes work survive the drive. `[measured]` the branch pushed clean
  afterwards (`bb1d894..2379b13`, remote ref == local HEAD).
- **Gotcha:** `git push` may print **`fatal: Cannot prompt because user
  interactivity has been disabled`** and still succeed `[measured]` — that line
  comes from a credential-helper probe, and the real result is the
  `old..new branch -> branch` line below it. **Verify with
  `git ls-remote origin <branch>` against `git rev-parse HEAD` instead of
  reading the word "fatal" as failure.**

## CRM cabinet "EvalError: Code generation from strings disallowed" — ROOT CAUSE + FIX

- **Symptom:** every `/account/*` page 500s in dev with `EvalError: Code generation
  from strings disallowed for this context`. Public pages are fine.
- **Root cause (confirmed via stack trace):** the error is in the compiled
  **`.next/server/middleware.js`** running in the **Edge runtime**. `src/middleware.ts`
  gated `/account/*`, and Next runs middleware in the Edge runtime by default. The
  Edge VM sandbox is created with **code generation from strings DISABLED**
  (`eval`/`new Function` forbidden). But Next's **dev webpack wraps every module in
  `eval("…")`** (the `eval-source-map` devtool — the compiled middleware.js had 87
  `eval(` calls). So the eval-wrapped middleware bundle throws the instant the Edge
  sandbox evaluates it → 500 on **every** page the middleware `matcher` covers.
- **What does NOT work:** overriding webpack `config.devtool` in `next.config.ts` —
  Next re-applies its own eval devtool to the middleware compiler *after* the hook.
  `experimental.nodeMiddleware: true` (run middleware in Node.js runtime) **is
  canary-only** and throws `CanaryOnlyError` on stable 15.2.8 — don't use it.
- **THE FIX (applied):** deleted `src/middleware.ts` and moved its auth gate into the
  **`app/account/(cabinet)/layout.tsx` Server Component** (`cookies()` +
  `redirect("/account/login")`). This runs in the Node.js server runtime (no eval
  restriction) and does the identical check. `/account/login` lives OUTSIDE the
  `(cabinet)` route group so it's never gated; client-side `RequireEmployeeAuth`
  still validates the token against `/api/auth/me`. **If you ever re-add Edge
  middleware here, this EvalError comes back** — keep the gate in the server layout.

## pCloud webpack PackFileCache corrupts CSS ("Unexpected character '@'")

- **Symptom:** after a cold `.next` rebuild on pCloud, EVERY page 500s and the log
  shows `./src/app/globals.css Module parse failed: Unexpected character '@' (1:0)`
  (and the same for `leaflet/dist/leaflet.css`). It looks like a CSS/PostCSS config
  problem but the config is fine — `@tailwindcss/postcss`, `lightningcss`, and
  `postcss.config.mjs` all load correctly.
- **Root cause:** webpack's persistent `PackFileCacheStrategy` writes `X.pack.gz_`
  then **atomically renames** it to `X.pack.gz`; on pCloud that rename intermittently
  fails (`ENOENT …/client-development/1.pack.gz_ -> 1.pack.gz`). The corrupted cache
  breaks the loader chain, so CSS modules fall through to webpack's JS parser and
  choke on the leading `@import`/`@tailwind`.
- **UPDATE — the ACTUAL root cause of the CSS failure was `NODE_ENV=production`
  (see the section below), NOT the pack-cache rename.** The in-memory webpack cache
  did NOT fix it and was reverted. The pack-rename ENOENT warnings are real pCloud
  noise but are not what breaks CSS. If you see `globals.css`/`leaflet.css`
  "Unexpected character '@'", check `NODE_ENV` FIRST.

## ⭐ ROOT CAUSE of the whole CSS/dev-server saga: `NODE_ENV=production` breaks `next dev`

- **THE bug (confirmed):** the shell/session had **`NODE_ENV=production`** set in the
  environment. Running `next dev` with `NODE_ENV=production` puts Next into an
  inconsistent state where **the dev CSS/PostCSS loader chain is not wired up** — so
  `@import "tailwindcss"` in `src/app/globals.css` falls through to webpack's JS
  parser and every page 500s with `Module parse failed: Unexpected character '@'
  (1:0)`. Next even prints a warning at startup: `⚠ You are using a non-standard
  "NODE_ENV" value` — **that warning is the tell; do not ignore it.**
- **This masqueraded as many other things** across a long debugging session:
  corrupted `.next`, PackFileCache rename failures, pCloud EPERM — none of which were
  the cause. A full `rm -rf .next` rebuild did NOT fix it (CSS still failed on a
  pristine `.next`), which is the clue that it's environmental, not cache.
- **THE FIX:** run the dev server with `NODE_ENV=development` (or unset the
  `production` override). `NODE_ENV=development npm run dev` → every page renders 200,
  CSS compiles, EvalError gone. **DONE — `scripts\start_local.ps1` now sets
  `$env:NODE_ENV = 'development'` in the Next.js window before `next dev`**
  (the windows inherit the launching shell's env, so a `production` value used to
  leak straight through) `[measured]`. This guard covers the launcher path only —
  if you run `npm run dev` by hand from a shell that has it set, you still get the
  500s. If pages
  500 with the CSS `@` error, run `echo $NODE_ENV` (or check the "non-standard
  NODE_ENV" warning) BEFORE touching `.next` or any config.
- **Full saga order for future recognition:** (1) an Edge-middleware EvalError 500'd
  `/account/*` — fixed by moving the auth gate to a server layout (see that section);
  (2) separately, `NODE_ENV=production` 500'd ALL pages via the CSS `@` error;
  (3) repeated `rm -rf .next` while chasing (2) temporarily stuck the pCloud drive
  holding locks (see the pCloud fragility section) — but the drive released on its
  own later, and once `NODE_ENV=development` was used, a clean rebuild served
  perfectly. Lesson: **check `NODE_ENV` and the startup warnings before assuming
  `.next` corruption.**

## Test-data protocol that worked (catalog sessions, 2026-08-04) — reuse it

1. **Record exact row counts BEFORE seeding** (Property, PropertyPhoto,
   PriceHistory, PhoneRevealLog) plus #18's field values, to a JSON file.
2. **Mark every disposable row** with a `PIDTEST-` `crm_property_id` prefix,
   `created_by=None`, zero photos. Set `crm_property_id` explicitly so the
   real PID sequence is not consumed.
3. **Hard-delete inside a transaction with PER-ROW re-asserts** immediately
   before each `.delete()`: marker prefix AND `created_by IS NULL` AND zero
   photos AND `pk != 18` — a shifted id can never take out a real row.
4. **Re-verify the counts match the recorded baseline exactly** and report
   before/after numbers.
5. **Before deleting any unexpected extra row, check its `user_agent`/
   timestamp** — an organic user action is DATA, not residue. Real case
   `[measured]`: a PhoneRevealLog row appeared mid-session with a YaBrowser
   UA (the user's real browser; automation here is HeadlessChrome) — it was
   the user clicking «Показать телефон» while browsing, kept as the new
   baseline (17), not deleted.

## Test-data cleanup: how test properties were identified

- When cleaning up leftover **test/fake properties** from a prior testing session
  (e.g. Playwright smoke tests that didn't fully roll back), the reliable
  **combined** signal set was:
  - `created_by = null` (real CRM creation **always** stamps a user — this is the
    single strongest signal),
  - **zero photos**,
  - empty / generic description,
  - **round, identical placeholder prices** (e.g. exactly 1 000 000 ₽ across
    several),
  - generic **auto-incremented titles** (e.g. «Квартира #N»),
  - **timestamps clustered in a narrow window** matching a known test run.
- **No single signal was used alone** — combining them made the real-vs-test split
  **unambiguous** with **zero "uncertain"** cases (the one real listing had a real
  `created_by`, 3 photos, a full description, and attached leads/phone-reveals).
- **Process:** always **list candidates for confirmation BEFORE executing**, then
  hard-delete inside a **transaction with per-row safety re-asserts** (re-check
  PID + `created_by is null` + zero photos immediately before each `.delete()`, so a
  shifted ID can never delete the wrong row). Hard delete matches the CRM's own
  `perform_destroy()` path and is fine for test data; log the deleted PIDs. Check
  inbound FKs first (leads / phone-reveals / import-items) — test data typically has
  none, so nothing is orphaned. If similar cleanup is needed again, look for this
  same **combination** before deleting anything.

## Full-Site Audit (post-roadmap) — all clear, no regressions

- After completing the full roadmap (Favorites, Compare, Price History / badge,
  Similar Properties, Breadcrumbs / SEO links, Articles blog), a **comprehensive
  35-check Playwright-driven audit** was run across the public site (homepage,
  catalog, property detail, favorites, compare, articles) and CRM (price edit →
  history signal, photo upload, realtor public profile, lead create/delete, auth
  routing, Telegram task import).
- **Result: all checks passed, zero console errors / warnings / hydration
  mismatches on any page.** Every previously-documented issue in this file — the
  bare-`z-1000` no-op, `overflow-hidden` clipping, District/Neighborhood combobox,
  price-input live formatting, breadcrumb type-vs-city hierarchy,
  `ArticlesSection` / `ArticlePreviewCard` duplication, compare-icon/price overlap,
  price-history chart collapse, and #18 integrity — was **explicitly re-tested and
  confirmed NOT regressed**.
- **Pattern worth remembering: when a Playwright check fails, investigate BEFORE
  concluding it's an app bug.** 3 of the initial 35 "failures" were **test-script
  artifacts**, not defects — overly-broad selectors (a page-wide «Цена снижена»
  match that hit a **similar-section card's** badge, not the price block) or wrong
  assumptions about intended behavior (e.g. "removing 1 of 2 compared items should
  leave a 1-column table" — it correctly shows the **empty state** instead, since
  comparing a single property is meaningless by design). Confirm the app's actual
  DOM/state before filing a bug.
- **Known non-bug limitation:** Telegram lead notifications are verified only to
  the **Celery task-enqueue boundary** in this dev environment — true end-to-end
  delivery needs a live worker process + real Telegram credentials, neither of
  which an automated audit here exercises.
- The audit used **disposable test properties** (created + explicitly hard-deleted,
  no rollback reliance) — consistent with the safe-testing pattern documented
  above.

## Session findings — realtor profile redesign (2026-08-04)

Seven lessons from the /realtors/[crmId] redesign sessions, each of which cost
real time. Reference implementation for most of them:
`frontend/src/components/realtor/` + `app/realtors/[crmId]/page.tsx`.

### 1. Count-up / rAF deadlock: a `startedRef` guard + rAF cleanup = permanent freeze

- **The trap `[measured]`:** an animation effect that (a) sets a "started" ref at
  the START of the animation, (b) calls `cancelAnimationFrame` in the effect
  cleanup, and (c) has no completion guarantee, freezes forever the moment
  anything interrupts the rAF chain: cleanup kills the frame, the re-run setup
  returns early on the ref, nothing can restart it. Reproduced on the realtor
  stats strip: one cancelled frame ~120ms in left the tiles at **0,1,2,1**
  permanently; scrolling away and back did not recover them.
- **What interrupts the chain in practice:** Fast Refresh (re-runs effects while
  **preserving refs** — so the guard survives while the animation dies; this is
  why the bug showed in the user's live browser but not in a fresh headless
  load), StrictMode remounts, backgrounded tabs (rAF pauses, timers don't), and
  dropped frames.
- **The symptom signature:** SSR/no-JS output is CORRECT while the live browser
  shows the animation's start value (0) forever — i.e. the "enhancement"
  actively destroys working server output. If a no-JS test passes and the
  browser shows 0, look for exactly this deadlock.
- **RULE:** the real value is what React renders (`{value}` in JSX); the
  animation is a temporary imperative overwrite of it, never the source of
  truth. Three guarantees, all three: (1) effect cleanup writes the FINAL value
  back, so no teardown leaves a partial state painted; (2) a `setTimeout`
  failsafe (2500ms — same budget as RevealController's) snaps to the final
  value, covering backgrounded tabs where rAF never fires; (3) any "done" flag
  is set only once the true value is actually on screen — never at animation
  start. Reference: `RealtorCountUp.tsx` `[measured]` — interrupted run now
  recovers to the real values.

### 2. Never attribute property-scoped analytics to actions outside the property page

- **What happened `[measured]`:** the realtor page's «Показать телефон» was
  wired to `POST /api/properties/<id>/reveal_phone/` (the only reveal endpoint
  that exists) "to reuse counting and throttling". That endpoint's unit of
  accounting is a PROPERTY: it writes `PhoneRevealLog` and increments that
  property's `phone_views_count`. Clicks on the realtor page were therefore
  logged against property #18, which was never viewed — 5 test clicks had to be
  hand-deleted and the counter restored to its recorded baseline (15/15).
- **RULE:** an endpoint's accounting scope must match the page's action. If a
  page needs a similar interaction and no correctly-scoped endpoint exists,
  use **local state** (the realtor reveal is now a pure `useState` flip with no
  network call — `RealtorPhoneReveal.tsx`) or build a new endpoint — never
  borrow another entity's. Extra tell that borrowing was wrong here: the number
  is returned in cleartext by the realtor API and rendered elsewhere on the same
  page, so the "reveal" was measuring nothing.

### 3. Lucide icon components cannot cross the RSC boundary

- Passing a Lucide icon (or any component/function) as a prop from a Server
  Component to a `"use client"` component throws `Functions cannot be passed
  directly to Client Components` `[observed]` — it 500s the whole page in dev.
- **RULE:** pass the icon **name** (`iconName: IconName`) and resolve it inside
  the client component via the `Icons` registry (`Icons[iconName]`). Reference:
  `RealtorContactModal.tsx`. The registry type also keeps the name greppable
  and typo-safe.

### 4. IntersectionObserver is the wrong reveal/trigger mechanism in this repo

- IO fires only when an intersection RATIO CROSSES A THRESHOLD. A viewport jump
  — in-page anchor, browser-restored scroll position, fast flick — can move an
  element from below the viewport to above it without ever crossing one, so IO
  never fires and the element stays in its pre-reveal state permanently
  `[observed]` (this bit the homepage reveal first; RevealController's header
  comment documents the original measurement).
- **RULE:** for anything scroll-gated (reveals, count-ups, lazy sections), use
  the RevealController pattern: a position sweep («is its top above the viewport
  bottom») shared with the rAF-throttled scroll handler, plus the 2500ms
  failsafe so nothing stays wrong/hidden longer than that. Do not add new
  IntersectionObserver-based triggers.

### 5. Responsiveness sweeps: every 40px from 360 to 1600, not just at breakpoints

- **Two real, sitewide bugs sat BETWEEN the breakpoints** and survived every
  earlier audit (which tested 390/768/1024/1440):
  - header overflow at **1024–1046px** `[measured]`: the desktop nav switches on
    at `lg` (1024) but the row's intrinsic width was 1047px, so `scrollWidth`
    was 1047 at a 1024 viewport on every page. Fixed by a scoped 1024–1099px
    fit band in globals.css (unlayered, next to the compact-header rules)
    compressing discretionary gaps only.
  - a 375px floor at **360px** `[measured]`: the logged-out «Вход в личный
    кабинет» ButtonLink is `whitespace-nowrap` and held the header at 375px
    intrinsic width, overflowing every page at a 360px viewport. Fixed by
    collapsing the label to «Вход» below 400px
    (`header-account-controls.tsx`).
- **RULE:** the pass criterion stays `document.documentElement.scrollWidth ===
  viewport width` (exact, mechanical), but the sweep must walk **360→1600 in
  40px steps** on at least: the page under work, /catalog, /articles, and the
  homepage. A breakpoint-only check proves nothing about the ranges between
  them. (Verified after both fixes: 4 pages × 32 widths, 128/128 pass
  `[measured]`.)

### 6. pCloud: `next build` cannot run in place on P:\ — mirror to local disk

- **In-place `npm run build` dies on a DIFFERENT phantom file each run**
  `[measured]`: `EPERM open .next\cache\.rscinfo`, then `EISDIR readlink
  robots.ts`, `sitemap.ts`, `favicon.ico` across consecutive runs — all
  ordinary files (`os.path.isfile` → True). **A different file each time is the
  tell that it is environmental**, not code — do not start debugging the build
  config.
- **Workaround that gives a definitive signal (~1 min):** copy `src` +
  `package.json` + `package-lock.json` + `next.config.ts` + `tsconfig.json` +
  `postcss.config.mjs` + `.env.local` + `.npmrc` to a local-disk scratch dir,
  `npm ci --include=dev`, `npm run build` there. Delete the copy afterwards.
  `.npmrc` matters — it carries `legacy-peer-deps=true`, without which
  `npm ci` fails on the react-leaflet-cluster peer conflict `[measured]`.
- **`NODE_ENV=production` silently makes `npm ci` skip devDependencies**
  `[measured]`: it reported a cheerful "added 35 packages" and produced a
  node_modules with no `tailwindcss`/`typescript`; the only tell is the
  implausibly small package count. Session shells here can carry
  `NODE_ENV=production` (see the ⭐ NODE_ENV section above) — use
  `NODE_ENV=development npm ci --include=dev` for any install.
- **…but UNSET `NODE_ENV` again before `npm run build`** `[measured]` — the
  variable's correct value differs per step, and both mistakes really happened:
  `production` breaks the install (above), while `development` breaks the
  BUILD: `next build` warns "non-standard NODE_ENV", links the dev
  `app-page.runtime.dev.js` runtime, and prerender then dies with
  `TypeError: Cannot read properties of undefined (reading 'env')` on
  arbitrary pages (/crm/leads, /account/properties/new) that have nothing
  wrong with them. Same mirror, same source, `Remove-Item Env:NODE_ENV` →
  clean 33/33-page build. Recipe: `NODE_ENV=development` for `npm ci`, unset
  for `npm run build`.

### 7. State the provenance of every build signal

- During this work, "npm run build passes" was reported while the green build
  actually came from a **mirrored copy carrying a local-only patch** (removing
  a pre-existing lint error the repo still had). That is a Rule-Zero violation
  in spirit: the claim implied the repo passed when it did not.
- **RULE:** a build/test result must name WHERE it ran and WHAT was patched:
  "in-repo", or "mirrored copy, unpatched source", or "mirrored copy plus the
  exact local patch, named". If the signal required any local-only change, the
  repo does NOT pass — say so explicitly.
- **CORRECTED 2026-08-04 — the parenthetical here used to claim that lint error
  "has since been fixed in the repo". It was NOT.** The unused `cn` import in
  `header-account-controls.tsx` is still present in **committed** code: at the
  session-start commit `bb1d894` line 17 imports `cn` and nothing uses it
  `[measured]`. The fix exists only in the WORKING TREE, uncommitted — so
  "fixed in the repo" was true of the checkout on this machine and false of
  the repository, which is exactly the distinction the RULE above exists to
  make. **Consequence: `npm run build` from a clean checkout of HEAD FAILS**
  at the lint gate (`'cn' is defined but never used`), and has done for this
  whole branch `[measured]` — built from `git archive HEAD`, which is the only
  way to see it; a mirror of the working tree passes and hides it.
- **RULE (stronger): to claim "the repo builds", build the REPO — `git archive
  HEAD | tar -x` into the mirror, not a copy of `src/`.** A working-tree mirror
  silently includes uncommitted fixes AND untracked files, so it proves nothing
  about what anyone else would check out. This caught a second, worse instance
  the same day: staging a file that carried unrelated uncommitted work
  committed a page importing five untracked modules, leaving HEAD unbuildable
  with "Module not found" until they were added.

## Tech Stack Reminder

- **Backend:** Django + DRF, port 8001 locally
- **Frontend:** Next.js 15 (TypeScript), App Router
- **DB:** PostgreSQL 18 (native), Memurai (Redis) for cache/queue, Celery for
  background jobs
- **Hosting:** Railway (production); considering future migration to a VPS
  (e.g. Hetzner) for cost efficiency
- **Maps:** 2GIS (tiles + suggestions), Leaflet/react-leaflet
- **Styling:** TailwindCSS (use `!` suffix syntax for important overrides,
  e.g. `text-white!`)

## Экономия токенов — важные правила

### Никогда не давать агенту искать в интернете
Веб-поиск съедает 40-60% токенов за один запрос.
Агент читает целые HTML-страницы — это очень дорого.

**Плохо:**
"Search online for all districts of Krasnodar..."

**Хорошо:**
Сначала найди данные сам (Google, Wikipedia),
вставь готовый список в промпт, потом дай агенту только записать в код.

### Разбивай задачи на шаги
Один промпт = одно действие.

**Плохо:** Research + update code + run migrations + verify (всё в одном)

**Хорошо:**
1. Промпт 1: только посмотреть файл
2. Промпт 2: только изменить одно место
3. Промпт 3: только запустить миграцию

### Edit mode для мелких задач
Plan mode и Auto mode тратят больше токенов.
Для правок одного файла используй Edit mode.

### Не давай агенту читать много файлов сразу
Каждый прочитанный файл = токены.
Указывай точный файл и строку если знаешь.

### Проверяй перед запуском
Попроси агента показать план (без выполнения),
проверь — потом выполняй.
