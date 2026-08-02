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

- **Property-card badges + old price are BLOCKED on the public API, not on CSS.**
  The design's card shows a «Новый объект» / «Цена снижена» badge on the photo
  and a struck-through old price beside the current one. Neither can be built
  from what the public API returns today:
  - `old_price` **exists on the model** — `DecimalField(max_digits=15,
    decimal_places=2, null=True, blank=True)` at `properties/models.py:146`
    `[measured]` — and is exposed on all three CRM serializers
    (`CrmPropertyListSerializer`, `CrmPropertyDetailSerializer`,
    `CrmPropertyWriteSerializer`). It is **absent from both public endpoints**:
    dumping the live JSON keys for `/api/properties/` and
    `/api/properties/<slug>/` shows no `old_price` `[measured]`. It is also not
    on `CatalogPropertyItem`. To surface it: add the field to
    `PropertyListSerializer` + `PropertyDetailSerializer`, add `oldPrice?: number`
    to `CatalogPropertyItem`, map it in `publicPropertyList.ts` and
    `publicProperty.ts`, then render. That is an API change, not styling.
  - `is_new` **does not exist anywhere** — no model field, no serializer, no
    frontend type `[measured]`, and no agreed derivation rule. It needs a product
    decision first (e.g. "published within N days", computed vs stored) before
    any of the above.
  - Note the existing `is_price_reduced` flag is NOT a substitute: it is a
    boolean derived from peak price and carries no previous-price VALUE to show.
- ~12 test failures in the properties app: migration 0023 made city/district
  required but existing fixtures don't set them. Needs fixture updates.
- Full Krasnodar residential complex (ЖК) list is incomplete (~130 exist on Cian,
  which blocks scraping) — needs manual data from the user.
- `TZ_Объекты.docx` describes a 16-step property form spec — reviewed but not yet
  implemented.
- **a11y gap in `DistrictCombobox`** (`SearchBar.tsx`, the `role="combobox"` input
  ~line 233): missing `aria-controls`/`aria-expanded` — flagged by ESLint
  (`jsx-a11y/role-has-required-aria-props`) but left out of scope by the tasks that
  touched this file. Worth a small dedicated a11y pass.

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
  - **Card icon placement:** compare toggle sits **top-LEFT** of the card image,
    favorite heart sits **top-RIGHT** — deliberately opposite corners to avoid
    clutter, not grouped together.
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
- **Its correct state (as of 2026-07-04):** price **4 500 000 ₽**, **TWO**
  `PriceHistory` rows (**1 100 000 @ 2026-06-29** → **4 500 000 @ 2026-07-04**),
  **3 real photos**, a real description, **1 lead + 8 phone-reveals** attached.
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
  - The current canonical price is **4 500 000**; `photos.count()` must be **3**;
    lead/phone-reveal counts unchanged. Quick check:
    `Property.objects.get(pk=18)` → `price`, `photos.count()`.
  - **If the price differs from 4 500 000, do NOT blindly reset it.** A different
    value with a clean, signal-generated `PriceHistory` row is very likely another
    **real user edit** — treat it as the new canonical value and **ASK** before
    changing it. Only treat it as corruption if there's clear evidence it came from
    leftover disposable test data (e.g. a price matching a `PID…`-marked test run).
  - When you DO legitimately need to set #18's price (with the user's confirmation),
    use a real `.save()` so the `post_save` signal records a proper `PriceHistory`
    row — do **not** use `QuerySet.update()` for an intended price change (that
    silently skips history). Reserve `QuerySet.update()` for undoing your OWN
    accidental test writes.
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
