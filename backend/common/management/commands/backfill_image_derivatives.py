"""
Generate MISSING image derivatives for rows already in the database.

    python manage.py backfill_image_derivatives --dry-run
    python manage.py backfill_image_derivatives            # actually writes
    python manage.py backfill_image_derivatives --model submissions.SaleRequestPhoto
    python manage.py backfill_image_derivatives --limit 10

⛔ SAFETY — THIS COMMAND HAS NO DELETION PATH, BY CONSTRUCTION.

It never calls ``FieldFile.delete()``, ``Model.delete()``, ``os.remove`` or
``storage.delete``. It only ever ASSIGNS new derivative files and saves the
three derivative columns with an explicit ``update_fields``. The original file
column is never named in ``update_fields``, is never reassigned, and is opened
read-only.

That is deliberate and load-bearing: this project has already lost the
derivatives of a real listing once, when cleanup code called ``delete()`` on
fields that turned out to be shared with a real row. A backfill that can only
add files cannot repeat that, whatever state it finds.

Writing a derivative goes through ``Storage.save()``, which allocates an
AVAILABLE name — so even regenerating an entry whose file vanished from disk
creates a new object rather than overwriting anything.

IDEMPOTENT: a row whose three derivatives all exist AND are present in storage
is skipped. Re-running the command after a successful run does nothing.

SCOPE: only models with a derivative ladder are handled. Single-image fields
(Owner.photo, Article.cover_image, DistrictGuide.cover_image, Agency.logo) are
deliberately NOT backfilled — for those the pipeline compresses the stored file
IN PLACE, and rewriting them here would overwrite an original, which this
command must never do. New uploads to those fields are compressed on save.
"""
from __future__ import annotations

from dataclasses import dataclass

from django.apps import apps
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand, CommandError

from common.image_compression import build_derivatives


@dataclass(frozen=True)
class LadderSpec:
    """One model that carries an original + three derivative fields."""

    label: str           # "app.Model"
    original: str        # field holding the source image
    prefix: str          # derivative filename prefix, "<prefix>_<pk>_<size>.jpg"
    fields: tuple[tuple[str, str], ...] = (
        ("large", "image_large"),
        ("medium", "image_medium"),
        ("thumb", "image_thumb"),
    )


SPECS: tuple[LadderSpec, ...] = (
    LadderSpec(label="properties.PropertyPhoto", original="original_file", prefix="photo"),
    LadderSpec(label="submissions.SaleRequestPhoto", original="image", prefix="salephoto"),
)


class Command(BaseCommand):
    help = "Generate missing image derivatives (large/medium/thumb). Never deletes."

    def add_arguments(self, parser) -> None:
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report what would be generated; write nothing.",
        )
        parser.add_argument(
            "--model",
            default="",
            help='Limit to one model, e.g. "submissions.SaleRequestPhoto".',
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=0,
            help="Process at most N rows per model (0 = no limit).",
        )

    # ------------------------------------------------------------------ utils
    def _missing_sizes(self, row, spec: LadderSpec) -> list[str]:
        """Which derivative suffixes are absent, or named but gone from storage."""
        missing = []
        for suffix, field_name in spec.fields:
            f = getattr(row, field_name)
            if not f or not f.name:
                missing.append(suffix)
                continue
            try:
                if not f.storage.exists(f.name):
                    missing.append(suffix)
            except Exception:  # noqa: BLE001 — an unreachable backend is not a reason to delete
                # Treat as present: never regenerate on a storage hiccup.
                continue
        return missing

    # ------------------------------------------------------------------- main
    def handle(self, *args, **options) -> None:
        dry_run: bool = options["dry_run"]
        only: str = (options["model"] or "").strip().lower()
        limit: int = options["limit"]

        specs = SPECS
        if only:
            specs = tuple(s for s in SPECS if s.label.lower() == only)
            if not specs:
                raise CommandError(
                    f"Unknown --model {options['model']!r}. "
                    f"Known: {', '.join(s.label for s in SPECS)}"
                )

        mode = "DRY RUN — nothing will be written" if dry_run else "WRITING"
        self.stdout.write(self.style.MIGRATE_HEADING(f"backfill_image_derivatives — {mode}"))
        self.stdout.write("This command never deletes or overwrites an original file.")

        grand_rows = grand_gen = grand_skip = grand_fail = 0

        for spec in specs:
            model = apps.get_model(spec.label)
            qs = model.objects.all().order_by("pk")
            if limit:
                qs = qs[:limit]

            total = considered = generated = skipped = failed = no_source = 0
            self.stdout.write("")
            self.stdout.write(self.style.MIGRATE_LABEL(f"[{spec.label}]"))

            for row in qs.iterator():
                total += 1
                source = getattr(row, spec.original)
                if not source or not source.name:
                    no_source += 1
                    self.stdout.write(f"  #{row.pk}: no {spec.original}, skipped")
                    continue

                missing = self._missing_sizes(row, spec)
                if not missing:
                    skipped += 1
                    continue

                considered += 1
                if dry_run:
                    self.stdout.write(
                        f"  #{row.pk}: would generate {', '.join(missing)} "
                        f"from {source.name}"
                    )
                    generated += 1
                    continue

                try:
                    parts = build_derivatives(source)
                except Exception as exc:  # noqa: BLE001 — one bad row must not stop the run
                    failed += 1
                    self.stdout.write(
                        self.style.ERROR(f"  #{row.pk}: FAILED ({exc}); original untouched")
                    )
                    continue

                touched: list[str] = []
                for suffix, field_name in spec.fields:
                    if suffix not in missing:
                        continue
                    getattr(row, field_name).save(
                        f"{spec.prefix}_{row.pk}_{suffix}.jpg",
                        ContentFile(parts[suffix]),
                        save=False,
                    )
                    touched.append(field_name)

                # ⛔ update_fields lists ONLY derivative columns — the original
                # field is structurally excluded from the write.
                assert spec.original not in touched, "original must never be written"
                row.save(update_fields=[*touched, "updated_at"])
                generated += 1
                self.stdout.write(f"  #{row.pk}: generated {', '.join(missing)}")

            self.stdout.write(
                f"  rows={total} generated={generated} already-complete={skipped} "
                f"no-source={no_source} failed={failed}"
            )
            grand_rows += total
            grand_gen += generated
            grand_skip += skipped
            grand_fail += failed

        self.stdout.write("")
        summary = (
            f"TOTAL rows={grand_rows} "
            f"{'would generate' if dry_run else 'generated'}={grand_gen} "
            f"already-complete={grand_skip} failed={grand_fail}"
        )
        self.stdout.write(self.style.SUCCESS(summary))
        if dry_run:
            self.stdout.write("Dry run: no files were written and no rows were saved.")
