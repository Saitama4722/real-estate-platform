# Environment, launcher, and the pCloud drive

Read when something fails that is not obviously code: the launcher, ports, a dev
server that dies, EPERM / `.next` errors, Postgres `OperationalError`, `NODE_ENV`,
env-var shadowing, or a crashed session.

---

## The launcher

`Start Centreal.bat` → `scripts\start_local.ps1` opens **three separate PowerShell
windows** (Django / Next.js / Celery worker), each launched with `powershell
-NoExit` and the venv's `python.exe` **by absolute path** — not `Activate.ps1` plus
inline `Set-Location` chaining. Fewer moving parts.

- **The venv is `%LOCALAPPDATA%\Centreal\venv`, per machine — never inside pCloud.**
  Step 2/7 validates it (`python.exe -c "import sys"`), deletes and rebuilds a
  broken one with `py -3.10 -m venv` (fallback: newest 3.10–3.12 from `py -0p`),
  and reinstalls packages whenever the SHA256 of `backend\requirements.txt`
  differs from `<venv>\.requirements.sha256`. Root cause and rules: CLAUDE.md →
  «The Python venv lives OUTSIDE pCloud».
- `runserver` is invoked with **`manage.py` by absolute path** so the repo path
  stays in every runserver command line — the interpreter path no longer names
  the repo, and `Test-BelongsToProject` matches on that path.

- A single `wt.exe` split-pane version was built, verified in isolation, and
  **reverted**: it flashed open and closed in the full launcher and the cause was
  never pinned down. **Meta-lesson: when a fix works in isolation but fails
  unreproducibly in the integrated flow, revert to the last known-good approach**
  rather than shipping "probably fixed" — especially for foundational tooling.
- If `wt` is ever revisited: it splits its whole command line on **every** `;`,
  including semicolons inside a pane's PowerShell payload, so any per-pane payload
  must contain **zero** semicolons (`wt -d` for the directory, absolute exe paths).
- The Celery worker runs `celery -A config.celery worker -l info -P solo` from
  `backend/`. `-P solo` because the default prefork pool is unreliable on Windows.
- **A successful API response means the task was ENQUEUED, not that it ran.**
  If notifications do not arrive, check the worker window first.

### ⭐⭐ Django and Next.js must NOT be started at the same time

**Symptom:** `Backend did not answer within 180s: connection refused` while Django
is demonstrably running, and a minute later the site works. It reads exactly like
"Django is broken". It is not.

| Scenario | Result `[measured]` |
| --- | --- |
| Django alone, cold | socket bound at **25.1s**, first HTTP 200 at **25.5s** |
| Django alongside a cold `next dev` compile on this drive | **connection refused for a full 180s** |

The process that eventually served was created **119 seconds** after the window
opened. Django's **autoreloader keeps re-execing** under the disk load `next dev`
generates on this virtual drive, so `runserver` never gets far enough to bind.
Postgres was not the constraint (9 of 100 connections).

- **Do not treat this as "the timeout is too small."** That was tried — 90s → 180s
  — and failed at 180s too, because the storm lasts as long as the frontend compile.
- **Fix, and why the launcher is sequential:** start the backend, wait for it to
  answer, and only then open the Celery and frontend windows. Costs ~25s in the
  good case and converts a reproducible failure into a reliable start.
- **RULE: on this drive, do not start two heavy services concurrently and then
  blame the slow one.** If a readiness check fails while the service is provably
  running, suspect I/O contention and serialise before touching timeouts.

### Readiness gating

- **ANY HTTP status means "listening."** A Django returning 500 is *up* — this repo
  has hit exactly that (see the schema-wipe entry in `django-and-migrations.md`).
  Requiring 200 is wrong.
- **Each service gets its own budget** — backend 180s, frontend 300s. One shared
  deadline starved the second service into a false failure. The ceilings come from
  measurement: Django cold 25.5s; Next.js ~13–17s warm, **54.9s** genuinely cold.
- **⭐ The wait carries a LIVENESS probe, not just a clock.** Every ~3s it re-checks
  that a process of the right shape belonging to this repo still exists (after a 20s
  grace period), and reports **DIED during startup** plus the window holding the
  traceback. Verified it can return **both** answers.
- **⭐⚠ THE PER-ATTEMPT TIMEOUT IS THE WHOLE GAME.** A poll loop of short requests
  against a compiling Next.js dev server can **never** succeed: Next accepts the
  connection instantly, holds it while it compiles, and **aborting the request makes
  it restart the render**. `[measured]` — a 240s budget of 30s attempts failed
  completely; a single patient request immediately afterwards returned **HTTP 200 in
  54.9s**. **Every attempt gets ALL the remaining budget**, retrying only on
  connection-level failures. This is still safe for a dead process — an exited
  process closes its socket, so the patient request fails at once and liveness fires.
  **Do not put a small fixed per-request timeout back.**
- **⚠ Editing ANY file under `frontend/` — including `.env.local` — recompiles the
  dev server.** Do not touch the tree while waiting on a readiness check, or you
  will diagnose your own edits as a launcher bug.
- Backend is polled first at `http://127.0.0.1:8001/api/properties/`; the frontend
  wait is skipped entirely if the backend is down.
- `Invoke-WebRequest` renders a progress bar by default; setting
  `$ProgressPreference = 'SilentlyContinue'` was worth 1.8s → 0.96s `[measured]`.

### ⚠ Launcher windows must NEVER auto-close on error

A Django startup failure in a window that closes is invisible, and the only symptom
left is `ECONNREFUSED 127.0.0.1:8001` in the frontend window — which sends you
debugging the frontend for a backend fault. Every service window ends with an
explicit red "the process above EXITED, scroll up for the traceback" banner.

### Busy ports: identify BEFORE terminating

```powershell
Get-NetTCPConnection -LocalPort <port> -State Listen | Select-Object OwningProcess
Get-CimInstance Win32_Process -Filter "ProcessId = <pid>" |
    Select-Object Name, ExecutablePath, CommandLine | Format-List
```

The launcher classifies the owner: a **stale Centreal dev server** traceable to this
repo → reported, then terminated; **anything else** (java, `Manager.exe`, anything
unrecognised) → a loud warning and that one service is skipped. **Never a blind kill
by port.**

- **⚠ The ownership test must WALK THE PARENT CHAIN.** Django's autoreloader
  re-execs through the **system** interpreter, and that child's command line is a
  bare `manage.py runserver 127.0.0.1:8001` with **no path in it** — a naive
  "does the command line contain the repo path" test misses it and the launcher
  refuses its own stale server `[measured]`.
- The classifier was verified capable of **both** verdicts, not just the permissive
  one `[measured]`: java on 3000 and `Manager.exe` on 8000 → FOREIGN/refuse; our
  node on 3001 and our python on 8001 → OURS/terminate.

### Next.js 15 does not fall back on an explicit port

With an explicit `--port`, Next 15 **exits with EADDRINUSE** rather than moving on.
Combined with probe-then-launch that is a multi-second TOCTOU window, and the 3000
owner can appear inside it — which is exactly what the old port-walking launcher
did. Use the `PORT` environment variable; `package.json`'s `"dev": "next dev"`
carries no port, so nothing competes with it `[measured]`.

### `NODE_ENV` is forced to `development` for the frontend window

This machine carries **`NODE_ENV=production` at the user level** `[measured]`, and
the service windows inherit the launching shell's environment. See the NODE_ENV
section below for what that breaks. A shell already on `development` is untouched.

### The launcher contains no Railway logic

None should be added back. (`frontend/next.config.ts` still *reads*
`RAILWAY_PUBLIC_DOMAIN` / `RAILWAY_STATIC_URL` as one input to its proxy-collision
guard — that is app config, not launcher logic, and was left alone deliberately.)

### The `/api` proxy needs no CORS — confirmed, not assumed

`next.config.ts` rewrites `/api/*` and `/media/*` to `BACKEND_URL` in `beforeFiles`,
so the browser only ever talks to its own origin and Next forwards server-side.
`[measured]` — `http://localhost:3001/api/properties/` returns the same payload as
`http://127.0.0.1:8001/api/properties/`, with no cross-origin request. No
`CORS_ALLOWED_ORIGINS` change was needed for the 3000 → 3001 move.

---

## ⭐ `NODE_ENV=production` breaks `next dev` — check it FIRST

Running `next dev` with `NODE_ENV=production` leaves the **dev CSS/PostCSS loader
chain unwired**, so `@import "tailwindcss"` in `globals.css` falls through to
webpack's JS parser and **every page 500s** with
`Module parse failed: Unexpected character '@' (1:0)`.

- **Next prints `⚠ You are using a non-standard "NODE_ENV" value` at startup. That
  warning is the tell — do not ignore it.**
- This masqueraded as corrupted `.next`, PackFileCache rename failures, and pCloud
  EPERM across a long debugging session. **A full `rm -rf .next` did NOT fix it** —
  which is the clue that it is environmental, not cache.
- **If pages 500 with the CSS `@` error, check `NODE_ENV` BEFORE touching `.next` or
  any config.**
- The launcher guards its own window only. Running `npm run dev` by hand from a
  shell carrying `production` still gives the 500s.

### `NODE_ENV` has a different correct value per build step

- **`NODE_ENV=production` silently makes `npm ci` skip devDependencies**
  `[measured]` — it reports a cheerful "added 35 packages" and produces a
  node_modules with no `tailwindcss` or `typescript`. The only tell is the
  implausibly small package count. Use `NODE_ENV=development npm ci --include=dev`.
- **…but UNSET it again before `npm run build`** `[measured]` — `development`
  makes `next build` link the dev runtime and prerender dies with
  `TypeError: Cannot read properties of undefined (reading 'env')` on arbitrary
  pages. `Remove-Item Env:NODE_ENV` → clean 33/33-page build.

---

## pCloud drive fragility

The repo lives on `P:\`, a pCloud virtual drive. These are environment quirks, not
application bugs — **do not debug application code first.**

- **A machine whose pCloud cache is cold makes the FIRST `next dev` take many
  minutes, and it looks hung.** pCloud holds `frontend\node_modules` online-only
  there, so every file read is fetched on demand: ~300–550 ms per `readFileSync`
  `[measured]` on the laptop, 2026-10-11, with no output and ~1 s CPU for
  minutes. On that run it bound 3001 about 9 minutes after starting, answered
  `/` at about 12 minutes, and `/catalog` took 90 s more `[measured]`. The
  launcher's frontend budget is therefore 600 s, and running out of it while
  the process is alive prints "First start on this machine can be slow (pCloud
  is downloading files)", opens the browser anyway and exits 0. Only a frontend
  that DIED is a `[FAIL]`. Later starts are warm. A permanent fix is to make
  the folder available offline in the pCloud client `[inferred]`, not
  `rm -rf .next`.
- **`npm install` can silently fail to write files.** Workaround: install to a local
  temp directory and copy the result into `node_modules`.
- **`next build` cannot run in place.** It dies on a **different phantom file each
  run** `[measured]`: `EPERM open .next\cache\.rscinfo`, then `EISDIR readlink
  robots.ts`, `sitemap.ts`, `favicon.ico` — all ordinary files. **A different file
  each time is the tell that it is environmental.**
  - **Workaround (~1 min):** mirror `src` + `package.json` + `package-lock.json` +
    `next.config.ts` + `tsconfig.json` + `postcss.config.mjs` + `.env.local` +
    `.npmrc` to a local-disk scratch dir, `npm ci --include=dev`, build there,
    delete the copy. **`.npmrc` matters** — it carries `legacy-peer-deps=true`,
    without which `npm ci` fails on the react-leaflet-cluster peer conflict.
  - To claim *the repo* builds, mirror `git archive HEAD`, not the working tree.
- **The EPERM on `.next\trace` can also kill the DEV server mid-session** — it may
  serve requests fine, then die while flushing its tracer. Just restart; a **warm
  `.next`** tends to run stably afterwards.
- **⛔ Do NOT `rm -rf .next` to "fix" a dev problem.** A cold rebuild's many small
  writes fail far more often than warm incremental ones, cascading into
  `ENOENT .next/cache/.rscinfo`, `EIO .next/build-manifest.json`, and locked
  un-deletable cache files. Once thrashed, the drive can hold locks that **only the
  pCloud client releases** — no number of restarts recovers it in-session.
- **webpack `PackFileCacheStrategy` rename failures** (`X.pack.gz_` → `X.pack.gz`,
  `ENOENT`) are real pCloud noise, **but they are not what breaks CSS.** That is
  `NODE_ENV`. The in-memory-cache workaround did not help and was reverted.
- **Push early and often.** 38 commits of finished work once sat only on `P:\`.
  `git push` is the only thing that makes work survive this drive.
  - **Gotcha:** `git push` may print `fatal: Cannot prompt because user
    interactivity has been disabled` **and still succeed** `[measured]` — that comes
    from a credential-helper probe. Verify with `git ls-remote origin <branch>`
    against `git rev-parse HEAD`, not by reading the word "fatal" as failure.

---

## Postgres connection exhaustion

Intermittent `psycopg2.OperationalError` / `django.db.utils.OperationalError`
(surfacing frontend-side as `ECONNRESET`) **even while idle** is connection
exhaustion, not a crash. `max_connections=100`; ~60 idle connections were held by a
**single leftover Django dev server** — two `runserver` instances and two Celery
workers running at once.

Fixes in place: `idle_session_timeout='5min'` in Postgres; `CONN_MAX_AGE` lowered to
**60s for local dev only** (env-driven; production stays 600, kept below the 5-min
Postgres timeout); `log_connections`/`log_disconnections` enabled.

- **Prevention: always run `scripts\stop_local.ps1` before relaunching.** If Django
  throws intermittent `OperationalError` with no code cause, check
  `SELECT count(*) FROM pg_stat_activity;` against `SHOW max_connections;` **before**
  assuming a code bug.
- **⚠ A crashed session leaves the servers running.** The launcher's windows are
  detached, so anything that kills the agent or terminal leaves `runserver` alive
  holding its connections. Check before starting:

  ```powershell
  Get-CimInstance Win32_Process |
    Where-Object { $_.CommandLine -match 'manage.py|celery|next' } |
    Select-Object ProcessId,CommandLine
  ```

  A clean machine returns nothing.
- **⚠ DO NOT COUNT PROCESSES — COUNT LISTENERS.** Django's autoreloader re-execs
  itself, so **one healthy backend shows up as four `manage.py runserver`
  processes** in a parent→child chain, alternating between the venv interpreter and
  the system `Python310` one `[measured]`. That mixed-interpreter chain looks
  exactly like "someone started a second stack with the wrong Python" and **is
  not** — this misread happened during the very session that wrote the note. Two
  backends can only coexist on two **different ports**, so
  `Get-NetTCPConnection -State Listen -LocalPort 8001,8002` is the check that cannot
  be fooled. **A backend listening on anything other than 8001 is the real tell.**

---

## Recovering from an abnormal termination

Claude Code itself has died mid-session with Windows exit code **`0xC0000409`
(`STATUS_STACK_BUFFER_OVERRUN`)** `[observed]` — the same class of pCloud fragility
as the EPERM and rename failures, hitting the agent process. **It is environmental.
Do not start debugging application code and do not assume the repo is damaged.**

**First moves, in this order:**

1. **`git status` + `git log --oneline -10`.** What is committed is safe.
2. **Check for an in-progress operation** — `MERGE_HEAD`, `REBASE_HEAD`,
   `CHERRY_PICK_HEAD`, `BISECT_LOG`, `rebase-merge/`, `rebase-apply/` under `.git/`.
   A half-finished rebase is the one genuinely incoherent state, and it is invisible
   in a casual `git status` read.
3. **`tsc --noEmit`** with the project-local binary, to prove the tree compiles
   rather than eyeballing diffs for truncation.
4. Only then read diffs.

### ⭐ The diagnostic that settles it: mtimes vs commit timestamps

Compare each dirty file's `LastWriteTime` against the last commits' timestamps.
Worked example `[measured]`: the last three commits were written at 05:36–05:38;
the single dirty file (`frontend/src/app/privacy/page.tsx`) had an mtime **two days
earlier**. So it was a stale leftover from an unrelated session, not a casualty, and
the interrupted task had completed and committed.

- **A dirty file is not automatically "the file it crashed on."** Establish its age
  before assuming it needs repair. **Reverting a complete, unrelated edit because it
  happened to be uncommitted is the destructive failure mode here.**
- A log line naming a file being written at crash time is **not** evidence it was
  corrupted. `.claude/settings.local.json` parsed as valid JSON afterwards with an
  mtime weeks old — no write had landed at all `[measured]`.

---

## One-off Django scripts

`manage.py shell < script.py` runs in interactive-console mode here and **silently
no-ops** — a seed looked like it ran and wrote nothing. Working form:

```
manage.py shell -c "exec(open('script.py', encoding='utf-8').read())"
```

**`transaction.savepoint_rollback()` under `manage.py shell -c` is UNRELIABLE** —
a real property's price was mutated inside a savepoint block and the rollback did
**not** restore it. See `testing-and-verification.md` for the protocol that works.
