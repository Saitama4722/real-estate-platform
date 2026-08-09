"""
Copy local MEDIA_ROOT files referenced by the database up to R2 / S3.

DRY RUN BY DEFAULT — it uploads nothing unless --execute is passed.

The command reads from the local filesystem and writes to the cloud bucket
directly, so it works while MEDIA_STORAGE_BACKEND is still "local". Object keys
are the exact FileField values already stored in the database, so NO DB rows are
touched: once every file is uploaded, flipping MEDIA_STORAGE_BACKEND=r2 makes
every existing URL resolve against the bucket.

    python manage.py migrate_media_to_r2              # dry run
    python manage.py migrate_media_to_r2 --execute    # actually upload

Every FileField / ImageField on every installed model is discovered
automatically, so a new model with an upload field is covered without editing
this file.
"""
from __future__ import annotations

import os
from pathlib import Path

from django.apps import apps
from django.conf import settings
from django.core.files import File
from django.core.files.storage import FileSystemStorage
from django.core.management.base import BaseCommand, CommandError
from django.db.models import FileField


def _human(num_bytes: int) -> str:
    size = float(num_bytes)
    for unit in ("B", "KB", "MB", "GB"):
        if size < 1024 or unit == "GB":
            return f"{size:.1f} {unit}" if unit != "B" else f"{int(size)} B"
        size /= 1024
    return f"{size:.1f} GB"


class Command(BaseCommand):
    help = (
        "Upload local media files referenced by the database to the R2/S3 bucket. "
        "Dry run by default — pass --execute to actually upload."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--execute",
            action="store_true",
            help="Actually upload. Without this flag the command only reports what it would do.",
        )
        parser.add_argument(
            "--backend",
            choices=("r2", "s3"),
            default=None,
            help="Target backend settings to use (default: r2, or the active cloud backend).",
        )
        parser.add_argument(
            "--overwrite",
            action="store_true",
            help="Re-upload keys that already exist in the bucket (default: skip them).",
        )
        parser.add_argument(
            "--skip-remote-check",
            action="store_true",
            help="Do not HEAD each key on the bucket first. Faster, but cannot report skips.",
        )
        parser.add_argument(
            "--model",
            action="append",
            default=None,
            metavar="app_label.ModelName",
            help="Limit to one or more models. Repeatable.",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=0,
            help="Process at most N files (0 = no limit). Useful for a first cautious run.",
        )
        parser.add_argument(
            "--noinput",
            action="store_true",
            help="Skip the confirmation prompt when using --execute.",
        )

    # ------------------------------------------------------------------ setup

    def _target_storage(self, backend: str):
        """
        A write-only storage handle for the bucket.

        Deliberately NOT built via ``common.media_storage.default_storages_entry``:
        that function requires AWS_S3_CUSTOM_DOMAIN, because a storage that has to
        SERVE files needs a public host for ``file.url``. Uploading needs no such
        thing, and demanding it here would block the migration until an unrelated
        variable is set. Everything that does matter — bucket, credentials,
        endpoint, region — is read from the same env vars that function reads, and
        addressing/signature style still fall back to the AWS_S3_* Django settings.
        """
        try:
            from storages.backends.s3boto3 import S3Boto3Storage
        except ImportError as exc:  # pragma: no cover - dependency is in requirements.txt
            raise CommandError(
                "django-storages is not installed. Run: pip install -r requirements.txt"
            ) from exc

        bucket = os.environ.get("AWS_STORAGE_BUCKET_NAME", "").strip()
        access_key = os.environ.get("AWS_ACCESS_KEY_ID", "").strip()
        secret_key = os.environ.get("AWS_SECRET_ACCESS_KEY", "").strip()
        endpoint = os.environ.get("AWS_S3_ENDPOINT_URL", "").strip()
        region = os.environ.get("AWS_S3_REGION_NAME", "").strip()

        missing = [
            name
            for name, value in (
                ("AWS_STORAGE_BUCKET_NAME", bucket),
                ("AWS_ACCESS_KEY_ID", access_key),
                ("AWS_SECRET_ACCESS_KEY", secret_key),
            )
            if not value
        ]
        if missing:
            raise CommandError(
                f"Missing in backend/.env: {', '.join(missing)}. "
                "Run `python manage.py check_media_storage` for a full diagnosis."
            )
        if backend == "r2" and not endpoint:
            raise CommandError(
                "AWS_S3_ENDPOINT_URL is empty. R2 requires "
                "https://<account_id>.r2.cloudflarestorage.com"
            )

        options: dict = {
            "bucket_name": bucket,
            "access_key": access_key,
            "secret_key": secret_key,
            "querystring_auth": False,
            "file_overwrite": True,
            "object_parameters": {"CacheControl": "max-age=86400"},
        }
        if endpoint:
            options["endpoint_url"] = endpoint
        if region:
            options["region_name"] = region

        return S3Boto3Storage(**options)

    def _warn_if_unservable(self, backend: str) -> None:
        """
        Uploading works without AWS_S3_CUSTOM_DOMAIN; serving does not. Say so now
        rather than letting Django fail to start after the switch is flipped.
        """
        if os.environ.get("AWS_S3_CUSTOM_DOMAIN", "").strip():
            return
        self.stdout.write(
            self.style.WARNING(
                "  ! AWS_S3_CUSTOM_DOMAIN is empty. Uploads work without it, but\n"
                f"    MEDIA_STORAGE_BACKEND={backend} raises ImproperlyConfigured at startup\n"
                "    until it is set to the bucket's public host (e.g. pub-xxx.r2.dev,\n"
                "    with no https:// prefix)."
            )
        )

    def _collect_fields(self, model_filter: list[str] | None):
        """Every (model, field_name) pair backed by a FileField/ImageField."""
        wanted = {name.lower() for name in model_filter} if model_filter else None
        found: list[tuple[type, list[str]]] = []
        for model in apps.get_models():
            label = f"{model._meta.app_label}.{model._meta.object_name}"
            if wanted is not None and label.lower() not in wanted:
                continue
            names = [f.name for f in model._meta.get_fields() if isinstance(f, FileField)]
            if names:
                found.append((model, names))
        if wanted is not None and not found:
            raise CommandError(
                f"No installed model matched --model {', '.join(model_filter)}. "
                "Use the app_label.ModelName form, e.g. properties.PropertyPhoto."
            )
        return found

    # ----------------------------------------------------------------- handle

    def handle(self, *args, **options):
        execute = options["execute"]
        overwrite = options["overwrite"]
        remote_check = not options["skip_remote_check"]
        limit = max(0, int(options["limit"]))

        backend = options["backend"] or (
            settings.MEDIA_STORAGE_BACKEND
            if settings.MEDIA_STORAGE_BACKEND in ("r2", "s3")
            else "r2"
        )

        media_root = Path(settings.MEDIA_ROOT)
        local = FileSystemStorage(location=str(media_root))
        target = self._target_storage(backend)

        mode = self.style.ERROR("EXECUTE — files will be uploaded") if execute else self.style.SUCCESS(
            "DRY RUN — nothing will be uploaded"
        )
        self.stdout.write("")
        self.stdout.write(self.style.MIGRATE_HEADING("migrate_media_to_r2"))
        self.stdout.write(f"  mode        : {mode}")
        self.stdout.write(f"  target      : {backend} bucket "
                          f"'{os.environ.get('AWS_STORAGE_BUCKET_NAME', '').strip()}'")
        self.stdout.write(f"  source      : {media_root}")
        self.stdout.write(f"  active store: MEDIA_STORAGE_BACKEND={settings.MEDIA_STORAGE_BACKEND}")
        self._warn_if_unservable(backend)
        self.stdout.write("")

        if not media_root.exists():
            raise CommandError(f"MEDIA_ROOT does not exist: {media_root}")

        # --- inventory from the database ------------------------------------
        # key -> list of "app.Model#pk.field" references (a key can be shared).
        keys: dict[str, list[str]] = {}
        per_model: dict[str, int] = {}

        for model, field_names in self._collect_fields(options["model"]):
            label = f"{model._meta.app_label}.{model._meta.object_name}"
            count = 0
            rows = model._default_manager.all().values_list("pk", *field_names)
            for row in rows.iterator(chunk_size=500):
                pk, values = row[0], row[1:]
                for field_name, value in zip(field_names, values):
                    if not value:
                        continue
                    keys.setdefault(str(value), []).append(f"{label}#{pk}.{field_name}")
                    count += 1
            if count:
                per_model[label] = count

        if not keys:
            self.stdout.write(self.style.WARNING("No file references found in the database. Nothing to do."))
            return

        self.stdout.write(self.style.MIGRATE_HEADING("Referenced files, by model"))
        for label, count in sorted(per_model.items()):
            self.stdout.write(f"  {count:>5}  {label}")
        self.stdout.write(f"  {len(keys):>5}  distinct object keys")
        self.stdout.write("")

        # --- classify --------------------------------------------------------
        missing: list[str] = []
        already: list[str] = []
        todo: list[tuple[str, int]] = []

        for key in sorted(keys):
            path = media_root / key
            if not path.is_file():
                missing.append(key)
                continue
            if remote_check and not overwrite:
                try:
                    if target.exists(key):
                        already.append(key)
                        continue
                except Exception as exc:  # noqa: BLE001 - surfaced, not swallowed
                    raise CommandError(
                        f"Could not query the bucket for {key!r}: {exc}\n"
                        "Run `python manage.py check_media_storage` first, or pass "
                        "--skip-remote-check."
                    ) from exc
            todo.append((key, path.stat().st_size))

        if limit and len(todo) > limit:
            self.stdout.write(
                self.style.WARNING(f"--limit {limit}: {len(todo) - limit} pending files not processed this run.")
            )
            todo = todo[:limit]

        total_bytes = sum(size for _, size in todo)

        # --- local files nobody references ------------------------------------
        referenced = set(keys)
        orphans = 0
        for dirpath, _dirnames, filenames in os.walk(media_root):
            for filename in filenames:
                rel = Path(dirpath, filename).relative_to(media_root).as_posix()
                if rel not in referenced:
                    orphans += 1

        self.stdout.write(self.style.MIGRATE_HEADING("Plan"))
        self.stdout.write(f"  to upload           : {len(todo)}  ({_human(total_bytes)})")
        if remote_check and not overwrite:
            self.stdout.write(f"  already in bucket   : {len(already)}  (skipped)")
        elif overwrite:
            self.stdout.write("  already in bucket   : not checked (--overwrite)")
        else:
            self.stdout.write("  already in bucket   : not checked (--skip-remote-check)")
        self.stdout.write(f"  missing locally     : {len(missing)}")
        self.stdout.write(f"  unreferenced local  : {orphans}  (in MEDIA_ROOT, no DB row — not uploaded)")
        self.stdout.write("")

        if missing:
            self.stdout.write(self.style.WARNING("Referenced but not on disk — these rows point at nothing:"))
            for key in missing[:20]:
                self.stdout.write(f"  {key}")
                for ref in keys[key][:3]:
                    self.stdout.write(f"      <- {ref}")
            if len(missing) > 20:
                self.stdout.write(f"  ... and {len(missing) - 20} more")
            self.stdout.write("")

        if not todo:
            self.stdout.write(self.style.SUCCESS("Nothing to upload."))
            return

        if not execute:
            self.stdout.write(self.style.MIGRATE_HEADING("Files that would be uploaded"))
            for key, size in todo[:40]:
                self.stdout.write(f"  {key}  ({_human(size)})")
            if len(todo) > 40:
                self.stdout.write(f"  ... and {len(todo) - 40} more")
            self.stdout.write("")
            self.stdout.write(self.style.SUCCESS("DRY RUN complete — nothing was uploaded."))
            self.stdout.write("Re-run with --execute to perform the upload.")
            return

        # --- upload -----------------------------------------------------------
        if not options["noinput"]:
            answer = input(
                f"Upload {len(todo)} files ({_human(total_bytes)}) to '{backend}' bucket "
                f"{os.environ.get('AWS_STORAGE_BUCKET_NAME', '').strip()}? [y/N]: "
            )
            if answer.strip().lower() not in ("y", "yes"):
                self.stdout.write("Aborted. Nothing was uploaded.")
                return

        uploaded = 0
        failed: list[tuple[str, str]] = []
        for index, (key, size) in enumerate(todo, start=1):
            try:
                with local.open(key, "rb") as fh:
                    saved = target.save(key, File(fh))
            except Exception as exc:  # noqa: BLE001 - reported per file, run continues
                failed.append((key, str(exc)))
                self.stdout.write(self.style.ERROR(f"  [{index}/{len(todo)}] FAIL {key}: {exc}"))
                continue

            uploaded += 1
            if saved != key:
                # file_overwrite=True should preserve the key; if it did not, the
                # DB value no longer matches the object and the file would 404.
                self.stdout.write(
                    self.style.WARNING(
                        f"  [{index}/{len(todo)}] key changed: {key} -> {saved} "
                        "(the DB still points at the old key)"
                    )
                )
            else:
                self.stdout.write(f"  [{index}/{len(todo)}] ok {key} ({_human(size)})")

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS(f"Uploaded {uploaded} of {len(todo)} files."))
        if failed:
            self.stdout.write(self.style.ERROR(f"{len(failed)} failed:"))
            for key, message in failed[:20]:
                self.stdout.write(self.style.ERROR(f"  {key}: {message}"))
            raise CommandError("Some files failed to upload. Re-run to retry the remainder.")

        self.stdout.write(
            "Object keys are unchanged, so no database update is needed. "
            "Set MEDIA_STORAGE_BACKEND=r2 in backend/.env and restart Django to serve from the bucket."
        )
