# Django, migrations, models, auth

Read before writing any migration, changing a model or serializer, touching
auth / JWT / throttling / CRM permissions, making a FK nullable, or restoring a
database.

---

## ⭐ Migrations

### A data migration must use `apps.get_model()`, never a concrete import

`properties/migrations/0014_property_slug_latin.py` did
`from properties.models import Property`. A concrete import gives you **today's**
model, so the query selects **today's columns** against the schema as it existed at
0014. It failed on `properties_property.owner_id` — a column added twelve
migrations later by `0026_property_owner` `[measured]`.

- **⚠ `.defer()` IS NOT A FIX.** The original carried `.defer("crm_property_id")`
  (a field that arrives in 0018), which patched exactly one symptom and left the
  mechanism armed for the next field anyone added.
- **⚠ A `defer()` inherited from the concrete version MUST be deleted when
  converting to `apps.get_model()`** — the historical model has no such field, so
  it raises `FieldDoesNotExist` `[measured]`.
- **Why it stays hidden:** every existing database already has 0014 recorded, so it
  is never replayed. It breaks **only on a fresh database** — i.e. precisely when
  standing up a new host, the worst possible moment to find out.
- **Audited** `[measured]`: 9 migrations contain `RunPython`/`RunSQL`; 0014 was the
  only concrete import. There is no second instance.

### Never reference a live app module from a migration

`articles.0003` imported `articles.models.ARTICLE_BODY_HELP`; a later refactor
deleted that constant and **broke the whole migration graph on import**. The
constant is now inlined. A migration is a historical record.

- Pure helper modules with no model imports are fine (`common/slug_latin.py`).
- `locations/guide_pilot_sections.py` is shared with a seed **and inlined again**
  inside migration 0011. The duplication is deliberate.

### A model method cannot be called from a data migration — inline a FROZEN copy

Historical models carry no custom methods, managers or `save()` overrides. 0014
needed `Property.build_generated_slug()`, so it holds a frozen copy.

- **NEVER update that copy to track later changes to the model method.** A data
  migration must reproduce the behaviour of *its own point in time*; if the copy
  follows the model, a replay on a fresh database produces different slugs than the
  ones already stored.

### Editing an already-applied migration is safe — but only the `RunPython` body

`django_migrations` stores exactly `(app, name, applied)` `[measured]`. **There is
no checksum and no file hash**, so rewriting a `RunPython` function body cannot
trigger a re-run or a mismatch where the migration is already recorded.

**Changing `operations`, `dependencies`, or the filename is NOT safe** — those are
what the graph and state reconstruction are built from.

### A data migration that ran on an EMPTY table proves only that its query compiles

0014's `RunPython` executed against zero rows, so the loop body ran zero times. That
verifies the SQL no longer references a missing column and **nothing else**. Do not
report it as "the logic works." (It was verified separately against 7 synthetic
rows covering every branch, with sentinels written first so an inert migration would
have failed rather than passed silently.)

### A column drop cannot be split across commits — bisect will mislead you

The body→sections refactor landed as five thematic commits. They are coherent as a
set and **not individually runnable** — the commit that removes `body` leaves the
old serializer naming it, and there is no ordering that avoids this.

- `git bisect` across that range reports artefacts of the split, not regressions.
  Bisect to the **boundary** and treat the range as atomic.
- **RULE:** when a schema change forces this, say so in the commit message.

### When a schema change alters what a seed writes, change the seed in the same commit

`seed_district_guides_pilot` re-ran `update(intro=g["body"])` on every invocation.
After the section split that would have restored the whole text into `intro` while
the six sections kept theirs — **every guide rendering twice**, with no error
anywhere. **A stale seed is a silent data-corruption bomb that fires the next time
someone runs it.**

---

## ⭐ A nullable FK is a READ-SITE obligation, not just a column property

**RULE: the commit that makes a ForeignKey nullable — or that adds a code path
writing NULL into it — is not finished until every existing READER of that relation
has been audited and guarded.** The writer and the readers are usually in different
files written months apart, and nothing connects them: no type checker, no migration
warning, no test — because every existing test was written when the column could not
be NULL.

**The tell: an endpoint that works when filtered and 500s when unfiltered.**
`[measured]` on `/api/crm/activity-logs/`: unfiltered → 500,
`?action_type=login` → 200. The only difference was whether the 16 rows with
`user_id IS NULL` reached the serializer.

### The two DRF failure modes differ, and the quiet one is worse

| Declaration | Behaviour on a NULL relation |
| --- | --- |
| `SerializerMethodField` doing `obj.user.first_name` | **AttributeError → HTTP 500**, whole list fails |
| `EmailField(source="user.email", read_only=True)` | **Field silently OMITTED from the JSON** (read_only ⇒ `required=False` ⇒ DRF raises `SkipField`) |

**Never rely on `source="a.b"` to be null-safe.** For any nullable relation write an
explicit method field returning a real fallback, so the key is present in every row.

### Checklist when a FK becomes nullable

1. `grep` for the related name and `.<fk>.` across serializers, admin
   `list_display` callables, JSON builders and management commands.
2. Give every read site an explicit `is None` branch with a **meaningful** fallback,
   not `""` — here the model already stores the answer in a sibling column
   (`attempted_email`), which is what the row is *about*.
3. Add a regression test that **creates a row with the FK set to NULL.** The
   pre-existing tests hit the same endpoint three times and all passed, because not
   one ever created such a row. A suite that only builds fully-populated fixtures
   cannot catch this class of bug by accident.
4. Django admin's plain `"fk"` entry in `list_display` is null-safe (renders `-`); a
   **custom method** is not.

### Query parameters are untrusted input even behind an admin permission

The same endpoint parsed `?user=` with `str(x).isdigit()` — correct for `""` and
`"abc"`, but it admits a 50-digit number that passes `isdigit()` and then blows up
as a PostgreSQL `integer` out-of-range **DataError** before the serializer runs.
**Parse through `int()` in a try/except AND bound-check against the column's range;
an unparseable or out-of-range value must be IGNORED, never raised.** Passing a
permission check says who the caller is, not that their query string is sane.

---

## Restoring or rebuilding the local database

### ⛔ DIAGNOSE WHICH DATABASE YOU ARE TALKING TO BEFORE RUNNING `migrate`

```
psql -U postgres -l
```

**Never run `migrate` before this check.** Pointed at the wrong database, `migrate`
cheerfully creates a brand-new empty schema *there*, and the real data then looks
lost while sitting untouched elsewhere. `migrate` is not read-only and it will not
warn you.

Confirm from Django too: `showmigrations` reporting **0 applied** is the gate. **If
any migration is already applied, stop** — the database is partially migrated and a
restore plan is the wrong tool.

- **⚠ `django_session` missing is the fastest tell that the WHOLE schema is gone**,
  not one app. Check it before theorising about a single app's migrations.
- Every API endpoint returning HTTP 500 with `UndefinedTable` shows in the UI as
  «Сервис временно недоступен» — `bannerForStatus()` maps **any** status ≥ 500 to
  it, so a missing table and a sleeping backend are indistinguishable there.

### Recovery sequence

```powershell
# from backend\ ; the venv is per machine, outside pCloud
& "$env:LOCALAPPDATA\Centreal\venv\Scripts\python.exe" manage.py migrate
& "$env:LOCALAPPDATA\Centreal\venv\Scripts\python.exe" manage.py loaddata fixtures/transfer/01_locations.json
& "$env:LOCALAPPDATA\Centreal\venv\Scripts\python.exe" manage.py loaddata fixtures/transfer/02_articles.json
```

Then the **mandatory** sequence reset — without it the next CRM object creation
fails on a primary-key clash, because `loaddata` writes explicit pks and never
advances the sequence:

```
manage.py shell -c "from django.core.management.color import no_style; from django.db import connection; from django.apps import apps; sql = connection.ops.sequence_reset_sql(no_style(), [m for a in ['users','properties','locations','owners','articles'] for m in apps.get_app_config(a).get_models()]); c = connection.cursor(); [c.execute(s) for s in sql]; print('sequences reset:', len(sql))"
```

Result `[measured]`: 97/97 migrations, 45 tables, `django_session` present, 283
objects loaded, 23 sequences reset, all six public endpoints 200 via the Django test
client. Use `Client(SERVER_NAME='localhost')` — the default `testserver` host is
**not** in `ALLOWED_HOSTS` outside a real test run and 400s.

### ⚠ Fixtures 03 and 04 are deliberately absent — this is not a fault

`backend/fixtures/transfer/` skips **03 (users)** and **04 (owner)**: this
repository is public, the users fixture carries pbkdf2 password hashes, and the
owner row carries a real person's name and phone number. Those two are applied from
the Railway Console instead.

Consequence: `05_realtor_profile` needs `users.user` pk 3, and `06_property` carries
`created_by=3`, `assigned_realtor=3`, `owner=14`. So **05–09 cannot load locally**,
and **PID000001 cannot be restored from the repo alone**. Property/Owner/User counts
of **0** after a local restore are the CORRECT outcome — do not "fix" it by
inventing users or editing fixtures. **Production remains the source of truth for
that record.**

---

## Serializers

- **Relative media paths must be `CharField`, not `URLField`.**
  `PublicRealtorSerializer.avatar` was a `URLField` while the view intentionally
  returns a relative `/media/...` path. `URLField` rejects relative paths, so **any
  realtor with an avatar** made the endpoint 400 — which the frontend mapped to
  `null` → `notFound()` → a plain 404 with no hint of the real error underneath.
- **A public 404 may be masking a swallowed 400/500.** Inspect the real API response
  status and body before assuming a missing-data problem.
- **Readable ≠ editable — check the write path separately.** `RealtorProfile` fields
  existed on the model and were read by the public API, yet had **no editing API
  anywhere**. A field existing and being read does not mean it is writable.

---

## Auth, sessions, permissions

### One 401, deliberately

simplejwt returns an identical body for a wrong password and a disabled account, so
the form is not an account-enumeration oracle. The design draws a separate
«Учётная запись заблокирована» banner; it is **not implemented, by decision**. Do
not "fix" this by distinguishing them server-side.

- Error copy lives in `components/auth/authErrors.ts`, keyed on **STATUS, never on
  server prose**. The old frontend matched the ENGLISH simplejwt string while the
  backend runs `LANGUAGE_CODE="ru-ru"` with simplejwt's ru catalogue, so the match
  never fired and users saw raw library text.

### Lockout and throttle

- **Login throttle: `LoginThrottle`, 10/minute per IP, POST only.** Attempt 11 → 429
  with `Retry-After: 55` `[measured]`. `ThrottledRu` exists because DRF appends an
  untranslated "Expected available in N seconds." to any custom detail.
- **Per-account lockout: 10 consecutive failures → 15 minutes.** Fields live on
  `User`, not the cache.
  - **⚠ THE LOCKOUT MUST NOT LEAK ACCOUNT EXISTENCE.** The check runs BEFORE the
    credential check and raises the SAME `AuthenticationFailed` with the SAME
    detail as a wrong password — verified byte-identical against an unknown address
    `[measured]`. Never add a 423, a distinct code, or "try again in N minutes".
  - Only existing accounts accumulate failures; inventing a row for an unknown
    address would itself be the oracle. Spraying across made-up addresses is the IP
    throttle's job.
- **Failed attempts are logged** as `login_failed` with a reason
  (`bad_credentials` / `locked` / `throttled`), IP and User-Agent — **never the
  password**, verified by grepping every log row for the test password.

### ⚠ LocMemCache is PER PROCESS — no shared counter may live in the cache

`CACHES` is `LocMemCache`. Under more than one Gunicorn worker each keeps its own
copy, so the effective IP throttle is `rate × worker_count`. **This is a known
limitation**, acceptable only because the per-account lockout is the real defence
and does not use the cache.

- **RULE: any counter that must be shared or survive a restart goes in the
  DATABASE.** That is why `failed_login_count` / `locked_until` are columns on
  `User`. Do not "optimise" them into the cache.
- Redis is already running for Celery; pointing `CACHES` at it is the one-line fix
  if exact rate limiting ever matters.

### Session invalidation is by `User.token_version`

JWTs are stateless: a password change does not touch them, and simplejwt's blacklist
can only revoke the **refresh** token, leaving the access token alive. Every token
carries a `tv` claim; `VersionedJWTAuthentication` (the DRF default) rejects any
token whose `tv` is behind the user's counter, and a reset bumps it with `F()`.

- `VersionedTokenRefreshSerializer` repeats the check on `/api/auth/refresh/`.
- **A missing `tv` claim is generation 0** on purpose, so tokens issued before this
  shipped keep working through a deploy.
- Changing your own email does **not** bump the counter — you are still you.
- **⚠ `VersionedTokenRefreshSerializer` must read the token's claims BEFORE calling
  `super().validate()`.** With rotation that call blacklists the incoming token, so
  re-parsing the same string afterwards raises "token is blacklisted" and **every
  refresh 401s** `[measured] — this shipped broken until the verification suite
  caught it`.

### ⚠ The forced-password-change gate lives in AUTHENTICATION, not a permission class

DRF **replaces** `DEFAULT_PERMISSION_CLASSES` whenever a view declares its own, and
31 views across 10 files declare theirs — a "CRM-wide" permission would really be 31
edits, and one missed view is a silent hole. Exactly **one** view overrides
`authentication_classes` (the public homepage text blocks, anonymous by design), so
authentication is the only chokepoint every authenticated request passes. A new view
cannot forget it.

- It raises 403 with `{"detail": …, "code": "password_change_required"}`. DRF's
  `code=` argument does **not** reach the body — pass a dict as `detail`.
- `PASSWORD_CHANGE_EXEMPT_PATHS` is **mirrored in
  `frontend/src/lib/crmAuthConstants.ts`** — change both, or the user is locked out
  of the only screen that frees them.
- `/account/change-password` sits OUTSIDE `account/(cabinet)`; the cabinet redirects
  there, so hosting it inside would loop.
- **⚠ The 37-endpoint sweep is the regression test for this gate** (two passes, flag
  clear / flag set: 0 wrongly gated, 0 reachable when set). Re-run it if you touch
  authentication.

### Token lifetimes — owner-approved, ask before changing

access **15 min**, refresh **48 h**, `ROTATE_REFRESH_TOKENS` and
`BLACKLIST_AFTER_ROTATION` both **on**. Rotation without the blacklist is theatre —
the spent refresh would stay valid for its full 48 h.

- The blacklist tables grow forever unless `flushexpiredtokens` runs. At 50 realtors
  that is ~1.19 M rows / ~475 MB uncleaned after a year, vs ~6 500 rows with the
  daily flush. (Token strings measure 238 bytes `[measured]`; ~400 B/row all-in is
  `[inferred]` — treat 475 MB as an order of magnitude.)
- `users/tasks.py: flush_expired_tokens` is scheduled for 04:00 daily, **but no beat
  process runs**, so the schedule is declarative only. Beat was deliberately kept
  out of the launcher. Manual fallback: `python manage.py flushexpiredtokens`.
  Nothing breaks if it never runs — the tables just grow.
- `ACCESS_COOKIE_MAX_AGE_SEC` in `lib/crmAuth.ts` mirrors the refresh lifetime by
  hand; a longer value lets the cabinet's cookie gate admit people whose refresh has
  already died.

### CRM scope model: exactly one superadmin, many realtors

Every administrative action is `IsSuperAdmin` — **not** `IsCrmStaffManager`, which
also admits `role=admin`.

- **Email is editable, because email IS the login.** Nothing keys off the email
  string — every `User` reference in the schema is an FK by integer id (15 of them)
  `[measured]`. **Do not add an email-valued reference anywhere.**
- **Changing your OWN email requires your current password** (email is the
  credential; swapping it at an unlocked machine is a silent takeover). A superadmin
  changing someone else's is not prompted — already privileged, and logged.
  Endpoint `POST /api/auth/me/email/`, deliberately separate from
  `PATCH /api/auth/me/` so fixing a phone number never asks for a password.
- **Password reset is `POST /api/crm/realtors/<pk>/set-password/`, superadmin
  ONLY.** Shown once, never emailed, never logged, never in a URL. Strength comes
  from Django's `AUTH_PASSWORD_VALIDATORS` — no bespoke rule.
- **⚠ `password` is IGNORED by `PATCH /api/crm/realtors/<pk>/`.** It used to work
  there, which let any *admin* take over a realtor account. Password on CREATE is
  still accepted.
- **Forced sign-out** (`terminate-sessions/`) reuses `token_version` — no second
  mechanism. It does not change the password.
- `EmployeeActivityLog.user` is **nullable** (an attempt on an unknown address has
  nobody to attribute; the typed address goes in `attempted_email`) — see the
  nullable-FK section above, which is exactly this column.
- **`SecuritySummaryBand` renders NOTHING when all three numbers are zero.** That is
  the design: with dozens of realtors nobody scans a log, and silence being normal
  makes the band's appearance the signal. Do not grow it into a monitoring system.

### ⛔ Password recovery by email: DECIDED AGAINST. Do not build it.

Do not propose an email reset flow, a reset-token model, SMTP configuration, or the
four §04 mockup screens again. Employee accounts are created by the superadmin and
there are three of them. The real blocker is **email infrastructure that does not
exist** — `settings.py` has zero `EMAIL_*` keys, so Django would post to
`localhost:25`; standing it up means an SMTP provider, a sender domain, and
SPF/DKIM, to serve a handful of people who sit near the superadmin. The
admin-initiated path above is what was built instead.

---

## Pre-production checklist (do these at go-live, not before)

The project runs locally only today. Several security decisions were deliberately
deferred because they only make sense once the site is exposed and a server shell
exists.

1. **Confirm shell access FIRST** — everything below needs `manage.py` on the
   server, and there is no in-product password recovery by design.
2. **Start Celery beat** (`celery -A config.celery beat -l info`) — a separate
   service from the worker. Until then run `flushexpiredtokens` by hand.
3. **Deactivate superadmin id 1** (the bootstrap account from
   `create_initial_admin`; owns nothing). **Deactivate — do NOT delete, and do NOT
   demote to realtor**, which would make it appear in the staff panel as a
   manageable employee. Untick **Активен** only; leaving role/`is_staff`/
   `is_superuser` is what keeps it revivable. Verify by signing in as the working
   superadmin in a private window and confirming id 1 can no longer reach `/admin/`.
   - Recovery, all requiring a server shell:
     `manage.py changepassword <email>`, or re-enable pk 1 via
     `manage.py shell -c "...filter(pk=1).update(is_active=True)"`, or
     `manage.py createsuperuser`.
4. **Re-check the security posture:** point `CACHES` at Redis (the throttle
   multiplies by worker count on locmem), confirm `DEBUG=False`, real
   `ALLOWED_HOSTS`, and HTTPS — the access cookie only gets `Secure` over https.

---

## Railway deployment (currently unused — local-only project)

Three services: Postgres, plus two built from the **same** repo and branch,
differing only by root directory.

| Railway service | Actually is | Root dir |
| --- | --- | --- |
| **`real-estate-platform`** | the **BACKEND** (Django) | `backend/` |
| **`loyal-miracle`** | the **FRONTEND** (Next.js) | `frontend/` |

- **⚠ `loyal-miracle` IS THE FRONTEND. It is not a stale fork. DO NOT DELETE IT.**
  The name is Railway-generated; it was one instruction away from being deleted on
  exactly that assumption. It was identified from a bespoke log string that exists
  only in this repo — which proves the **repo** but **not the branch**. Confirm the
  branch from Settings → Source, never from a log line.

### ⚠ The `DJANGO_` prefix trap — cost a live insecure deploy

`settings.py` reads **`DJANGO_SECRET_KEY`** and **`DJANGO_DEBUG`**. A bare
`SECRET_KEY` or `DEBUG` in the dashboard is read by nothing, and both settings
default to their **insecure** value when unset. Deleting `DJANGO_DEBUG` turns debug
**on**.

- The hardcoded `SECRET_KEY` fallback is **gone**: deployed environments must supply
  one or the process refuses to start; locally a random key is generated per
  process. A boot guard raises `ImproperlyConfigured` when deployed with `DEBUG`
  true or no key, detecting deployment from several `RAILWAY_*` signals so renaming
  one cannot disarm it.
- **`collectstatic` imports settings**, so the Dockerfile and `nixpacks.toml` pass a
  throwaway key for that build step only.
- Only `DEBUG`, `SECRET_KEY` and `ALLOWED_HOSTS` carry the prefix.
  `CORS_ALLOWED_ORIGINS` and `CSRF_TRUSTED_ORIGINS` do **not**.

### ⚠ A hardcoded port has caused two separate outages

Both presented as Railway's edge returning `x-railway-fallback: true` with HTTP 502
on **every** path — which means nothing is listening on the port the proxy targets.
A Django 404 comes from Django; a platform 502 with that header means no container
answered.

1. **Backend:** `PORT` was absent, so `--bind 0.0.0.0:${PORT:-8000}` fell back to
   8000 while the proxy targeted 8080. The fix was a **variable**, not a commit.
2. **Frontend:** `frontend/Dockerfile` existed only on this branch — the
   docker-compose **dev** image, running `npm run dev` with `NODE_ENV=development`.
   Its mere presence flipped Railway from its Next.js builder to the Docker builder.
   Renamed to **`Dockerfile.dev`**. **Do not rename it back.**

- **RULE: prefer a start command containing NO port literal.** `next start` reads
  `$PORT` itself; even `${PORT:-3000}` leaves a number waiting to go stale.
- If a Dockerfile is renamed away, check Settings → Build — Railway may have latched
  the Docker builder and will fail with "Dockerfile not found" rather than falling
  back.

### `BACKEND_URL`, not `BACKEND_INTERNAL_URL`

Server-side fetching uses **`BACKEND_URL`** and appends `/api`.
`BACKEND_INTERNAL_URL` is read only by `next.config.ts` for proxy rewrites.

- **⚠ `http://real-estate-platform:8000` is a docker-compose URL**, carried into
  Railway where it worked **by coincidence** — the service happened to share the
  compose network alias and gunicorn happened to be mis-bound to 8000. Fixing the
  port breaks it. Drift-proof form:
  `http://${{real-estate-platform.RAILWAY_PRIVATE_DOMAIN}}:${{real-estate-platform.PORT}}`.
- Private networking needs an **explicit port** — container-to-container DNS with no
  port translation.
- **`NEXT_PUBLIC_API_URL` must be the PUBLIC backend URL** (the browser cannot
  resolve a private hostname). **`NEXT_PUBLIC_SITE_URL` is the frontend's own public
  domain and is read at BUILD time** — the build dies at `/sitemap.xml` prerender
  without it, and changing it later needs a rebuild, not a restart.
