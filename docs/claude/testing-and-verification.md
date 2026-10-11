# Testing, test data, and verification

Read before creating or cleaning up test data, verifying a fix, writing Playwright
checks, or claiming anything passes.

---

## ⛔ Property #18 (`PID000001`) is the ONLY real listing

Created by realtor id 3; «1-комн. квартира, 45.00 м², Краснодар». **Its correct
state, re-read from the DB 2026-08-04 `[measured]`:** price **5 000 000 ₽**, **three**
`PriceHistory` rows (1 100 000 → 4 500 000 → 5 000 000), **3 photos** with all 12
derivative files on disk, a real description, 17 phone-reveals, `is_published=True`.

**⚠️ DO NOT "restore" #18 to any remembered baseline.** During earlier testing a real
user price edit was **twice** mistaken for test contamination and reverted via
`QuerySet.update()`, destroying the owner's work — they reported the price "not
persisting after restart", which was actually this cleanup overwriting it.

**A hardcoded "canonical" number in a doc decays.** This entry once said 4 500 000
and two rows; it was written *twelve minutes* before the owner bumped the price
again. **Re-read the DB rather than trusting this line.**

**RULE — after ANY task touching `Property`, `PriceHistory`, or their signals, even
if #18 was not the target:**

1. Check `Property.objects.get(pk=18)` → `price`, `photos.count()` (must be 3).
2. **If the price differs, do NOT blindly reset it.** A different value with a
   clean, signal-generated `PriceHistory` row is very likely **another real user
   edit** — treat it as the new canonical value and **ASK**. Only treat it as
   corruption if there is clear evidence it came from leftover disposable test data.
3. When you legitimately need to set the price (with confirmation), use a real
   `.save()` so the `post_save` signal records a proper history row. **Reserve
   `QuerySet.update()` for undoing your OWN accidental test writes** — it silently
   skips history.
4. **Verify media, not just rows.** Row counts looked perfect the whole time #18's
   derivatives were missing — `photos.count()` was still 3. What caught it was a
   rendered screenshot; what confirmed it was
   `os.path.exists(os.path.join(settings.MEDIA_ROOT, name))` per field.

This is a temporary single-point-of-failure concern that fades once realtors add real
properties. **Until then, treat #18 as fragile: verify every time, but never
overwrite a real edit with a stale baseline.**

### ⚠ A test fixture must NEVER reference a real object's file paths

**This destroyed real media once, 2026-08-03 `[observed]`.** A disposable
`PropertyPhoto` was created pointing at **#18's existing** file names — reusing the
paths looked like a cheap way to get a valid photo. The storage cleanup then deleted
those files from disk; #18 lost three derivatives and rendered a broken hero image.

- **RULE: a fixture owns its own bytes.** If a fixture needs an image, COPY the file
  to a fixture-only path first and point the row at the copy, then delete that
  directory during cleanup. **Never let a disposable row share a storage path with a
  real one** — `.delete()` cannot tell the difference.
- **Generalises beyond photos:** the same trap exists for any FileField. Before
  reusing ANY real record's file reference in test data, assume deleting the test row
  will delete the file.
- **Recovery if it happens again:** derivatives are rebuildable from the original —
  `from properties.tasks import generate_property_photo_derivatives`, called
  synchronously with the photo id. Verified `[measured]`: all 12 paths existed again
  afterwards with price, photo count and history rows unchanged.

---

## The test-data protocol that works — reuse it

**`transaction.savepoint_rollback()` under `manage.py shell -c` is UNRELIABLE here.**
A real property's price was mutated inside a savepoint block and the rollback **did
not restore it**. Do not rely on any transactional mechanism for cleanup.

1. **Record exact row counts BEFORE seeding** (Property, PropertyPhoto, PriceHistory,
   PhoneRevealLog) plus #18's field values, to a JSON file.
2. **Mark every disposable row** with a `PIDTEST-` `crm_property_id` prefix,
   `created_by=None`, zero photos. Set `crm_property_id` explicitly so the real PID
   sequence is not consumed.
3. **Hard-delete inside a transaction with PER-ROW re-asserts** immediately before
   each `.delete()`: marker prefix AND `created_by IS NULL` AND zero photos AND
   `pk != 18` — so a shifted id can never take out a real row.
4. **Re-verify the counts match the recorded baseline exactly** and report
   before/after numbers.
5. **Before deleting any unexpected extra row, check its `user_agent` / timestamp —
   an organic user action is DATA, not residue.** Real case `[measured]`: a
   PhoneRevealLog row appeared mid-session with a YaBrowser UA (automation here is
   HeadlessChrome). It was the owner clicking «Показать телефон» while browsing, and
   was kept as the new baseline, not deleted.

**If a real record must be touched:** explicitly record its exact prior state before
mutating, then explicitly restore and verify. To restore without firing side-effect
signals, use `Model.objects.filter(pk=...).update(...)`.

### Identifying leftover test properties

No single signal is enough — the reliable **combination** was: `created_by = null`
(real CRM creation always stamps a user — the strongest signal), zero photos, empty
or generic description, round identical placeholder prices, generic auto-incremented
titles, and timestamps clustered in a narrow window. Combining them made the split
unambiguous with **zero uncertain cases**.

**Always list candidates for confirmation BEFORE executing.** Check inbound FKs first
(leads / phone-reveals / import-items). Log the deleted PIDs.

### ⚠ Fixture cleanup is not done until the RENDERED PAGE has been checked

**This shipped a visible defect to the owner 2026-08-08.** A disposable district
guide was hard-deleted with per-row asserts and the DB verified clean — and the owner
then **saw the QA card live on /districts**. The delete was correct; **the page was
stale** (Next's `revalidate: 120` data cache serving one stale-while-revalidate hit).

**RULE: fetch the page that renders it TWICE and confirm the fixture is gone** — once
to burn the stale hit, once to confirm. Row counts were checked; the surface was not.
Same lesson as "verify media, not just rows", applied to a cached read surface.

---

## ⭐ State the provenance of every build and test signal

**RULE: a build/test result must name WHERE it ran and WHAT was patched** —
"in-repo", or "mirrored copy, unpatched source", or "mirrored copy plus the exact
local patch, named". **If the signal required any local-only change, the repo does
NOT pass — say so explicitly.**

This has gone wrong twice, both times invisibly:

- "npm run build passes" was reported while the green build came from a **mirrored
  copy carrying a local-only patch** that removed a pre-existing lint error the repo
  still had.
- A later note claimed that lint error "has since been fixed in the repo". **It had
  not** — the fix existed only in the **working tree**, uncommitted `[measured]`. So
  "fixed in the repo" was true of the checkout on this machine and false of the
  repository, which is exactly the distinction this rule exists to make.

**RULE (stronger): to claim "the repo builds", build the REPO —
`git archive HEAD | tar -x` into the mirror, not a copy of `src/`.** A working-tree
mirror silently includes uncommitted fixes **and untracked files**, so it proves
nothing about what anyone else would check out. This caught a second, worse instance
the same day: staging a file that carried unrelated uncommitted work committed a page
importing five **untracked** modules, leaving HEAD unbuildable with "Module not
found".

---

## Verification methods that actually work

### Check the RAW response, not the hydrated DOM

For any server-render failure, **grep the raw HTTP response**:

```
curl -s http://localhost:3001/sell | grep "window is not defined"
```

A Playwright assertion against `page.content()` reports a **false PASS**, because by
then the client has hydrated over the failed server render. That exact false pass
happened here.

### POLL, never sleep

- Sampling section opacity at a fixed ~400ms after `domcontentloaded` reports
  "nothing hidden" and looks like the animation is dead. It isn't — in dev, hydration
  had not armed the marker yet. **Poll for the marker before asserting anything about
  reveal state, never a fixed sleep.**
- Content after `go_back()` swaps **asynchronously** — poll for the expected count,
  never read it synchronously.
- `/favorites` fetches each property client-side after mount, so **wait for `article`
  to appear** before asserting card count — `networkidle` alone can fire too early.
- **Warm ISR URLs twice** before asserting counts (see `nextjs-and-react.md`).

### Count DOM nodes before theorising

Reported as "the homepage renders twice" — hero, search panel and footer each
appearing twice in a full-page screenshot. **Both plausible causes were measured and
are false**: `header/footer/main/.ctr-hero` count **1/1/1/1** in the SSR HTML *and*
the hydrated DOM, and `scrollHeight == footerBottom` exactly.

**Cause: naive scroll-and-stitch capture.** The bottom scroll **clamps** (the last
tile re-shoots already-captured pixels → footer duplicated), and most extensions
**restore scroll to top and take a final frame** → hero duplicated. The `sticky`
header lands in every tile by design.

- **Before investigating this again, run
  `document.querySelectorAll('header,footer,main,.ctr-hero').length`** — one command
  separates a real duplicate mount from a capture artifact.
- For verification screenshots use **DevTools → Capture full size screenshot** (it
  resizes the viewport, no stitching). Playwright's `full_page` uses the same CDP
  path and is equally safe.

### A control that cannot fail is not a control

- The service-area sync test reads the **fixture**, not the database, because
  `SimpleTestCase` has no DB and a fresh test DB would be empty — making the check
  pass **vacuously**. `test_the_fixture_actually_has_entries` guards that guard.
- The migration slug test overwrote the slugs with **sentinels first**, so an inert
  migration would have failed rather than passing silently.
- The `standalone` flag test was verified by **perturbing one entry, watching it fail
  with the exact expected message, then restoring it.**
- The launcher's port classifier was verified capable of **both** verdicts, not just
  the permissive one.
- The liveness probe was verified to return **both** answers.

**Before trusting any new check, make it fail on purpose once.**

---

## Playwright

**Treat it as a disposable verification tool per use**, not a permanent dependency:
install `@playwright/test` as a dev dependency, write a **throwaway** script, run it
against the running dev servers, then remove the script and **revert `package.json` /
`package-lock.json` to committed state** (npm re-resolves and pins unrelated dep
ranges on install). The Chromium binary caches under
`~/AppData/Local/ms-playwright/`, outside the repo — harmless to leave.

### Gotchas that produced FALSE bug reports here

All `[measured]`:

- **A screenshot's default caret-hiding injects `caret-color: transparent`** and,
  racing hydration after `reload()`, fakes a React hydration-mismatch console error.
  Pass `caret="initial"`.
- **The CDP keyboard emits NO `keydown` for non-layout (Cyrillic) characters**, so
  `type("г")` cannot exercise typeahead — dispatch a real `KeyboardEvent`.
- **The CDP keyboard cannot set the CapsLock modifier** —
  `keyboard.down("CapsLock")` leaves `getModifierState` false. Dispatch a
  `KeyboardEvent` with `modifierCapsLock: true`.
- **A Cyrillic `aria-label*=` substring selector may not resolve** — use a plain
  `article` locator.
- **Next injects its own empty `<div role="alert" id="__next-route-announcer__">`**,
  so scope alert selectors to the form.
- **A sync Playwright route handler cannot call a Playwright API** (the route
  auto-handles) — use CDP `Network.emulateNetworkConditions` latency to observe a
  submitting state.
- **The Next.js proxy 308-redirects `/api/properties/<slug>/`** to the no-slash URL
  (→ 200). Browsers follow it transparently — **don't mistake the 308 for a failure.**
- **Overly broad selectors**: a page-wide «Цена снижена» match hit a *similar-section
  card's* badge, not the price block.

**When a Playwright check fails, investigate BEFORE concluding it's an app bug.** In
one 35-check audit, **3 of the initial failures were test-script artifacts**, not
defects — bad selectors, or wrong assumptions about intended behaviour (e.g.
"removing 1 of 2 compared items should leave a 1-column table" — it correctly shows
the **empty state**, since comparing a single property is meaningless by design).

### Clipboard verification recipe

1. **Set the clipboard to a unique sentinel before every case.** Without it a stale
   clipboard reads as a successful copy — the single most likely way to fake a pass.
2. Drive a **real `Ctrl+C`**, then read the **Windows** clipboard with
   `Get-Clipboard -Raw`. That is the true end-to-end path; the in-page
   `navigator.clipboard` API is not what a user's paste uses.
3. **Firefox writes CRLF** — normalise line endings before comparing lengths, or
   every multi-line total looks short by the number of lines.
4. Treat "clipboard unchanged" as a **test** failure, not a product one — it means
   the copy never fired (usually focus), so redo the case.
5. **`Get-Clipboard -TextFormatType Html` MANGLES CYRILLIC** — it is the READER, not
   the payload (Windows CF_HTML is UTF-8; PowerShell decodes it as ANSI). **Verify
   clipboard HTML by pasting into a browser**, never by printing PowerShell's decode.

---

## Backend tests

- **`Property` fixtures need `city`/`district` since migration 0023.** Tests failed
  **entirely in `setUp()`**, before any test body ran, because the migration made
  those required while fixtures created `Property` objects without them. Fixed in
  `leads/tests.py` by creating minimal `City`/`District` fixtures in `setUp()`.
  **`users/tests.py` has the same ~23 failures and was NOT fixed** (deferred). Next
  time work touches it, apply the same fix **before** adding tests, and **check
  other test files too — don't assume only `leads` and `users` are affected.**
- **Making a field required breaks existing "empty value → 201" tests.** Any test
  that POSTs the field blank and asserts 201 starts failing with 400. **Update those
  tests to send a valid value first**, then add the validation-specific tests —
  otherwise the new tests cannot be verified as isolating the intended failure.
- **Fixture notes for `Property`:** `save()` raises `ValidationError` without
  `assigned_realtor`, and auto-allocates the PID and slug — all three contaminate a
  slug test, so use `bulk_create()`, which bypasses `save()` and its signals.
  `ApartmentDetails.rooms` is NOT NULL, so "rooms is None" is unreachable; the
  equivalent path is an apartment with **no details row**.
- **Test-client host:** use `Client(SERVER_NAME='localhost')` — the default
  `testserver` host is not in `ALLOWED_HOSTS` outside a real test run and 400s.
- **⚠ If a `test_<something unfamiliar>` database name scrolls past, STOP.**
  `Creating test database for alias 'default' ('test_mindmem')...` is the loudest
  available signal that an ambient env var has redirected the connection — and it is
  one line in a wall of migration output.

---

## How a destructive data migration was proven lossless — reuse this method

1. **Reassemble the post-migration state using the migration's OWN `backwards()`
   logic**, in memory — not a hand-written inverse, which can disagree with the real
   one.
2. **Compare against the seed-command literals at the pre-refactor commit**
   (`git show HEAD:…`), which are the exact strings written to the DB.
3. **Compare four independent measures, not just equality**: character count,
   paragraph count, list-item count, word count. Equality alone hides a
   whitespace-normalisation change; the counts localise it.
4. **Check the render-layer droppers too** — here, sections the serializer removes.

Result `[measured]`: 15/15 articles and 24/24 guides round-tripped
character-identical; 69 sections, 0 empty; reading time identical for all 39.

**⚠ HONEST LIMITATION, state it whenever quoting this result:** it proves the
TRANSFORMATION is lossless for records whose body still equalled the seed text when
the migration ran. **It cannot detect loss in a record hand-edited in admin after
seeding** — such a record would show as a mismatch indistinguishable from a genuine
edit. No mismatches occurred, so the question never arose. There is no pre-migration
dump; **this is the best available evidence, not a byte diff.**
