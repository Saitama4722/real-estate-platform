# Media, images, and storage

Read before adding an `ImageField`, touching any upload path, changing compression
or derivatives, building a media URL, or deleting media.

---

## ⭐ EVERY image upload path routes through `common/image_compression.py`

**RULE: any new `ImageField` anywhere in this project must go through the shared
pipeline. Do not write a second resize/encode.** There are exactly three entry
points:

| You are adding… | Call | Where it goes |
| --- | --- | --- |
| a **public** upload endpoint | `validate_image_upload(f)` | serializer `validate_<field>` — raises Django `ValidationError` → DRF 400 |
| a field with **one display size** (cover, logo, avatar-like) | `compress_field_in_place(self.field)` | the model's `save()`, before `super().save()` |
| a field with a **derivative ladder** | `build_derivatives(source)` | a Celery task, fired from `transaction.on_commit` in `save()` |

`DERIVATIVE_SIZES` (`large` 1920 / `medium` 1024 / `thumb` 400, longest edge, never
upscaled), `JPEG_QUALITY` (85), `MAX_IMAGE_UPLOAD_BYTES` (12 MiB) and
`ALLOWED_UPLOAD_FORMATS` (JPEG/PNG/WebP) live there and **nowhere else**.

`properties/property_photo_images.py` is now a thin facade that re-exports them. It
used to hold a **duplicate implementation**, and that duplication is precisely why
the public «Продать недвижимость» form shipped storing raw, uncompressed uploads
while CRM property photos were processed.

### What the pipeline guarantees, and the trap behind each guarantee

- **EXIF orientation is applied, then metadata is dropped.** `exif_transpose` runs
  BEFORE any resize; the re-encode passes no `exif=`, so derivatives carry no GPS or
  camera data. `[measured]`: a stored 1200×1600 portrait with `Orientation=6`
  produces 1600×1200 / 1024×768 / 400×300 derivatives with `exif_tags=0`. Owner
  submissions come from phones — this is not optional.
- **⚠ READ `img.format` BEFORE `ImageOps.exif_transpose()`.** That call returns a
  **copy**, and a copied Pillow image has `format = None`. The old code checked
  `img.format` afterwards, so its documented "skip if already a small JPEG" branch
  **could never fire** and every small JPEG was silently re-encoded at q85 on upload.
  `_open()` now returns `(image, format)` for exactly this reason.
- **⚠ `Image.verify()` DOES NOT catch a truncated file.** It validates structure and
  happily accepts a JPEG whose scan data is cut short `[measured]` — a file truncated
  to a third of its bytes passed. **Only a full `load()` on a fresh handle rejects
  it.** `validate_image_upload` does both passes; **do not "optimise" the second one
  away.**
- **⚠ NEVER trust the filename extension or `content_type`** for the format
  whitelist — both are client-supplied. Check the **decoded Pillow format**. A BMP
  renamed `.jpg` is rejected on its real format, not its name.
- **⚠ COMPRESSION MUST NOT INFLATE.** A PNG already within the max edge (a logo, a
  flat graphic, a screenshot) often encodes *larger* as JPEG: `[measured]` a
  1500×1000 RGBA PNG of 9,860 B became a 37,072 B JPEG — **3.8× bigger**, lossy, and
  with transparency flattened onto white. `compress_to_max_edge` keeps the upload
  untouched when no resize was needed and the JPEG is not smaller.
- **The stored "original" is itself capped at 1920/q85.** That is the existing
  convention, not a full-fidelity archive. Derivative generation never rewrites it.

### ⛔ Derivative code must have NO deletion path

`generate_sale_request_photo_derivatives` deliberately does **not** copy the property
task's habit of clearing derivative fields on failure: clearing calls
`FieldFile.delete()`, which removes bytes from storage, and **this project has
already lost the derivatives of a real listing that way.** On error it logs and
returns. `backfill_image_derivatives` is built the same way — it can only ADD files,
and `update_fields` structurally excludes the original column.

### ⛔ Storage keys are UUIDs, never the uploader's filename

Every `upload_to` is `common.upload_paths.UniqueUploadTo("<folder>")`, so keys
are `<folder>/<yyyy>/<mm>/<uuid4 hex>.<ext>` (2026-10-12; hosting blocker #1 in
CLAUDE.md). A new file field MUST use it. The class path is frozen into
migrations, so do not move or rename it. Rows stored before the change keep
their old names (`photo_18_large.jpg`, `IMG_0042.jpg`, …); nothing was renamed.

### ⭐ Property photos: 50 per property, server-enforced (2026-10-25)

- **The limit lives in ONE constant per side:** `MAX_PHOTOS_PER_PROPERTY = 50` in
  `backend/properties/property_photo_images.py` (with `PHOTO_LIMIT_MESSAGE` /
  `PHOTO_LIMIT_CODE = "photo_limit"`) and `MAX_PROPERTY_PHOTOS = 50` in
  `frontend/src/lib/crmPropertyPhotos.ts`. Change both together. The public
  sale-request form keeps its own limit of 10.
- `POST /api/crm/properties/<id>/photos/` (one file per request) counts the
  property's existing photos inside `transaction.atomic()` under
  `select_for_update()` on the Property row, and answers 400 `{"detail": "Можно
  загрузить не более 50 фотографий для одного объекта", "code": "photo_limit"}`.
  The same lock makes `sort_order = max+1` exact. `[inferred]` The race itself
  is NOT testable locally: SQLite ignores `select_for_update`, so the 24 tests in
  `properties/tests_photos.py` prove the counting, not the concurrency.
- **Main photo is assigned by the server:** the first photo of a property is main
  without the client saying so; an explicit `is_main=true` moves it; deleting the
  main promotes the next by `sort_order, id`. The client never sends `is_main`.
  ⚠ Public pages never read `is_main` (they take the first photo by `sort_order`),
  pre-existing and not changed.
- **Upload concurrency is 2** (`UPLOAD_CONCURRENCY`). Prod gunicorn has 3 sync
  workers and `--timeout 60`; three or four slow parallel uploads could occupy
  every worker and stall the site. No Django upload setting, gunicorn flag or
  Caddy change was needed: one file per request keeps the defaults irrelevant and
  `deploy/Caddyfile` sets no body limit `[inferred from the files]`.
- **Admin:** `PropertyPhotoInline.max_num` is the same constant (a soft guard; the
  API is the real one).
- **Not done (follow-up):** the catalog list prefetches ALL photos per card for a
  `[:1]` preview (`properties/views.py`, `serializers.py`); at 50 photos that is
  50x the rows per card. Left on purpose by the owner's decision.

### ⛔ ONE shared uploader — and the FileList trap that broke "add photos" in edit mode

`components/crm/CrmPropertyPhotos.tsx` (`StagedPhotos` for create, `LivePhotos`
for edit) over `PhotoDropZone.tsx`, with the logic in `lib/crmPropertyPhotos.ts`.
Do not build a second picker. **Root cause of the 2026-10-25 bug:** the old edit
component did `input.value = ""` BEFORE `Array.from(input.files)`. `files` is a
LIVE FileList, clearing the value empties it, so every pick after the first batch
was silently an empty list. Always snapshot first, then reset the input.
Also: `refreshCrmAccessToken` is single-flight now (rotating refresh tokens +
blacklist make parallel refreshes race and log the realtor out).

### Which models have a ladder, and which deliberately do not

- **Ladder** (original + `image_large`/`image_medium`/`image_thumb`):
  `properties.PropertyPhoto`, `submissions.SaleRequestPhoto`.
- **Compress-in-place only**: `owners.Owner.photo`, `articles.Article.cover_image`,
  `locations.DistrictGuide.cover_image`, `agencies.Agency.logo` — each renders at
  exactly one size, so three extra files per row would never be requested.
  `users.User.avatar` / `RealtorProfile.photo` keep their own 400×400 square crop.
- **If you give one of these a ladder later, it needs a migration AND its serializer
  AND its frontend consumer — not just the model field.**

### Backfilling

`python manage.py backfill_image_derivatives --dry-run` reports what is missing;
without `--dry-run` it writes. Idempotent — a row whose three derivatives exist is
skipped. It covers **ladder models only**; single-image fields are excluded on
purpose, because "backfilling" those would mean rewriting a stored original, which
the command must never do.

---

## ⛔ LOCAL DEV USES LOCAL FILESYSTEM MEDIA. R2 is production-only.

**RULE: `MEDIA_STORAGE_BACKEND=local` in `backend/.env`. `r2` must NEVER be the
active backend while `DEBUG=True`.**

There is **one** bucket (`centreal-media`) and **one** set of credentials — no dev
bucket. With `r2` active on a developer machine, every upload, including a throwaway
test upload, is written straight into the bucket production will read from. And
because **deleting a database row does not delete the stored object**, the junk stays
until someone removes it by hand. This is not theoretical: it happened during the
image-pipeline work, and 16 objects had to be located by name and deleted afterwards.

The R2 credentials stay in place, unchanged — they are needed when the project moves
to production hosting. Nothing reads them while the backend is `local`.

### The active backend is LOGGED AT STARTUP — read it

`CommonConfig.ready()` prints to **stderr**, next to the database line, in the
backend window **and** the Celery worker window:

```
[Centreal] DB     NAME=real_estate_db  USER=postgres  HOST=localhost:5432  (from CENTREAL_DATABASE_URL)
[Centreal] MEDIA  backend=local  root=...\backend\media  url=/media/
```

and, when a cloud backend is active while `DEBUG=True`, a wall of `!` naming the
bucket. **Verbosity is the point** — the failure being prevented is silent use of the
wrong destination.

- **⚠ THE CELERY WORKER HAS ITS OWN COPY OF SETTINGS.** It reads `.env` when it
  starts, so a worker launched before you changed `MEDIA_STORAGE_BACKEND` keeps
  writing derivatives to the OLD backend — the web process can be on `local` while
  the worker still uploads to R2. `[measured]`: a worker 2.7 hours old was still
  holding `r2` after the switch. **Restart the worker after any storage or database
  env change**, and confirm with the `[Centreal] MEDIA` line in ITS window.
- **The line appears TWICE under `runserver`** — the autoreloader runs `ready()` in
  both parent and child. Expected, not a bug.

### ⚠ VERIFY THE BACKEND BEFORE ANY BULK MEDIA OPERATION

Before running `backfill_image_derivatives`, `migrate_media_to_r2`, a reaper, or any
script that walks media: **read the `[Centreal] MEDIA` line first.** A bulk operation
aimed at the wrong backend is the one mistake here that is expensive to undo — cloud
deletes are not recoverable, and the bucket holds the photos of PID000001, the only
real listing.

---

## ⛔ DELETING A ROW DOES NOT DELETE THE OBJECT

**There is no `post_delete` signal, no `django-cleanup`, and no `delete()` override
anywhere** `[measured]`. `perform_destroy` calls plain `instance.delete()`, and
Django has not deleted files on model delete since 1.3. Verified live against the
bucket, baseline 16 objects:

| Action | Result |
| --- | --- |
| Upload a photo (CRM path) | 16 → **20** objects (original + 3 derivatives) |
| Delete the photo row | row gone, **4 of 4 objects still present — ORPHANED** |
| Replace a user avatar | **old avatar still present** |

**This is a real cost/PII issue for production, not a theoretical one:** every
deleted listing photo and every replaced avatar leaves bytes in R2 forever, and a
deleted photo stays publicly fetchable because the bucket is public. It is also where
the unreferenced local files came from. **Nothing has been built to fix this** — the
options are a `post_delete` receiver per model, `django-cleanup`, or a periodic
reaper that diffs bucket keys against DB values (`migrate_media_to_r2` already
computes exactly that diff).

- **A failed remote delete cannot break the database delete** `[measured]` — the
  delete path never touches storage, so there is nothing to fail.
- **⚠ But the ONE path that does delete remotely is unguarded.**
  `_clear_derivative_image_fields()` (called from `save()` when the original file
  changes, and from `properties/tasks.py`) calls `field.delete(save=False)` and
  **propagates the exception** — a simulated R2 failure raised `OSError` straight out
  to the caller `[measured]`. On local disk a delete practically never fails; against
  R2 it is a network call, and a transient failure would 500 a photo re-upload.
- **This corrects an older incident note.** The 2026-08-03 loss of #18's derivatives
  was recorded as happening when a fixture was **deleted**. That cannot be right —
  delete removes no files. The mechanism was `_clear_derivative_image_fields()`
  running on **save**, which deletes exactly the three derivative fields and leaves
  `original_file` — precisely what #18 lost `[inferred, from the two measured facts
  above]`. **The fixture rule itself stands unchanged and matters just as much.**

### Known leftovers in the bucket — reported, deliberately NOT deleted

`[measured]` 2026-08-31, `centreal-media` holds **19 objects**. Three are
uncompressed owner-form uploads from **2026-08-11** that predate the image pipeline
and no longer have database rows (`sale_requests/photos/2db5149f-…`, 1.5–2.9 MB
each). **They were left in place on purpose** — deleting from the production bucket
was explicitly out of scope. Decide on them deliberately; **do not let a cleanup
script sweep them up as a side effect.**

Separately, ~16 unreferenced files sit in local `MEDIA_ROOT` and are deliberately
**not** uploaded by `migrate_media_to_r2` — uploading them would mean paying to store
files nothing can render. If a count ever has to be reconciled, that is the gap.

---

## ONE helper builds every media URL — `common/media_urls.py`

The real divergence was **not** "public serializer vs CRM serializer vs mobile
sizes" (there is no separate mobile-size code path — `image_large`/`image_medium`/
`image_thumb` are just fields on the same serializer). Measured, it was **two**
patterns across ten sites:

| Pattern | Sites | Under r2 | Under local |
| --- | --- | --- | --- |
| `request.build_absolute_uri(f.url)` | 7 custom methods + DRF's `ImageField` on 4 CRM photo fields | R2 URL | `http://<backend-host>/media/…` — **leaks the private Django host** |
| bare `f.url` | 3 avatar sites | R2 URL | `/media/…` |

Under r2 the two agree **by accident**: `build_absolute_uri` is a no-op on a URL that
already has a scheme and host `[measured]`. That is why the split stayed invisible
until the local path was examined.

- **`media_url(file_field)` returns `FieldFile.url` verbatim**, and `MediaURLField`
  does the same for model fields. **Nothing inspects `MEDIA_STORAGE_BACKEND`** — the
  storage already encodes it, and duplicating that decision is exactly what produced
  the split.
- **⚠ NEVER wrap it in `request.build_absolute_uri()`.** Under r2 harmless; under
  local it re-introduces the host leak.
- Verified `[measured]`: 13 media-emitting fields across 10 serializers, probed under
  **both** backends with a request in context — absolute R2 under `r2`, relative
  `/media/…` under `local`, **0 backend-host leaks in both**. Article covers, guide
  covers and sale-request photos are **code-verified only** — no rows carry those
  files.
- **Consequence to know:** `propertyStructuredData.ts` filters JSON-LD images to
  absolute URLs, so under **local** the `image` array is empty. No real loss — the
  previous value was a backend-host URL no crawler could fetch.

### The `/media/` proxy in `next.config.ts` must stay unconditional

It is **required** under `local` (a relative `/media/…` only resolves because Next
proxies it to Django) and it is the rollback path. Making it conditional means giving
the frontend its own copy of the backend's storage setting — a second source of truth
that can drift, the same class of mistake as the seven `build_absolute_uri` sites.
Under r2 nothing emits a relative `/media/…`, so the only remaining callers are stale
caches and old bookmarks, for which a 404 is the honest answer.

### The "localhost URL despite R2 being active" symptom was the NEXT.JS CACHE

**Not the proxy.** The actual cause: Next's on-disk data cache
(`.next/cache/fetch-cache`) was replaying a payload fetched **before** the switch. The
relative `/media/…` in that payload is turned into `http://localhost:3001/media/…`
**by the browser**, resolving against the document origin — no application code
concatenates anything. `[measured]`: 171 cache entries, 160 written before the
switch. The file survives a Django restart, which is why restarting the backend never
helped. **The port is the tell — Django never emits `:3001`.** Fetch any affected page
2–3 times to burn it.

Also worth knowing: once `MEDIA_URL` contains `://`,
`django.conf.urls.static.static()` returns an empty list, so **Django stops serving
`/media/` entirely** — stale relative URLs 404 rather than silently working
`[measured]`.

---

## R2 tooling

Two management commands. **Neither existed before 2026-08-09**, and **`check_r2` has
never existed** — if a prompt or note refers to it, that name is folklore.

- **`python manage.py check_media_storage`** — proves the credentials work **without
  uploading anything**: `HeadBucket` + `ListObjectsV2` only. Prints the resolved
  config with the secret masked and maps failures to causes (403 → wrong key or a
  token not scoped to the bucket; 404 → wrong bucket name or account endpoint). Runs
  fine while the backend is `local`, so credentials can be checked before switching.
- **`python manage.py migrate_media_to_r2`** — **dry run by default**; uploads only
  with `--execute`. Discovers every `FileField`/`ImageField` on every installed
  model, so a new model with an upload field is covered without editing it. Object
  keys are the exact DB values, so **no rows change** and the switch is just an env
  var afterwards. Flags: `--limit N`, `--model app.Model`, `--overwrite`,
  `--skip-remote-check`.
  - It deliberately does **not** build its storage through `default_storages_entry()`,
    which requires `AWS_S3_CUSTOM_DOMAIN` (needed to SERVE files, not to upload them)
    and would block the migration on an unrelated variable.

**Custom domain later is an env-var change only.** `AWS_S3_CUSTOM_DOMAIN` (bare host,
**no** `https://` prefix) is read at settings load and is what `file.url` and
`MEDIA_URL` are built from. Pointing the bucket at a real domain is that variable
plus a restart — no migration, no DB change, because rows store relative keys
`[inferred from the settings code path; not exercised with a real custom domain]`.
Caveat: already-rendered pages and Next fetch-cache entries keep the old host until
their revalidate window expires.

**The safe protocol for touching a shared bucket** (used for the deletion test):
snapshot the bucket key set BEFORE, give every fixture its OWN bytes at a
fixture-only name, assert no fixture key collides with a baseline key, and at the end
delete only `current − baseline`. Result `[measured]`: 26 objects at peak → back to
exactly 16, set-equal to the baseline, DB counts restored, #18 untouched.

---

## Article cover images are OPTIONAL — no image by default

The gradient placeholder covers were **cleared** from all existing articles
(`generate_article_covers --clear`). All render sites use a **genuine conditional**:
the image block renders only when `cover_image` is set, otherwise **no image area at
all** — no gray box, no «Статья» placeholder. **Do not reintroduce the gradient
placeholder or a default cover.** The command still exists but should not be run to
re-attach covers unless the client asks.

**There is no AI image generation in this environment** (only Miro / Figma / Box
connectors exist; none synthesize images from prompts). The old covers were
programmatically generated gradient PNGs via Pillow, not photography. **If asked to
"generate AI images" here, disclose upfront that it isn't available** rather than
silently substituting something else — this was handled correctly last time; keep
doing that.
