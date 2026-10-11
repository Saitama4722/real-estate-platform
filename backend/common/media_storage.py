"""
Default file storage configuration for Django ``STORAGES["default"]``.

Backends:
  local  — Django FileSystemStorage (dev only; ephemeral on Railway)
  s3     — AWS S3 via django-storages S3Boto3Storage
  r2     — Cloudflare R2 via django-storages S3Boto3Storage (S3-compatible)

Switch: set ``MEDIA_STORAGE_BACKEND`` env var (default: local).

Required env vars per backend:

  r2 / s3:
    AWS_ACCESS_KEY_ID         — R2 Access Key ID  (or AWS key)
    AWS_SECRET_ACCESS_KEY     — R2 Secret Access Key (or AWS secret)
    AWS_STORAGE_BUCKET_NAME   — bucket name
    AWS_S3_ENDPOINT_URL       — R2: https://<account_id>.r2.cloudflarestorage.com
                                 S3: omit (uses default AWS endpoint)
    AWS_S3_CUSTOM_DOMAIN      — public URL host for file.url, e.g. pub-xxx.r2.dev
                                 or your custom domain. Must NOT include https://.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured

BACKEND_LOCAL = "local"
BACKEND_S3 = "s3"
BACKEND_R2 = "r2"

KNOWN_BACKENDS = frozenset({BACKEND_LOCAL, BACKEND_S3, BACKEND_R2})

#: Cloud backends. Writing to one of these from a dev machine writes to the REAL
#: bucket — there is one bucket and one set of credentials.
CLOUD_BACKENDS = frozenset({BACKEND_S3, BACKEND_R2})


def default_storages_entry(
    *,
    backend_key: str,
    media_root: str | Path,
    media_url: str,
) -> dict:
    """
    Build the ``STORAGES["default"]`` dict for the given backend key.
    """
    key = (backend_key or BACKEND_LOCAL).strip().lower()
    if key not in KNOWN_BACKENDS:
        raise ImproperlyConfigured(
            f"Unknown MEDIA_STORAGE_BACKEND={backend_key!r}. "
            f"Expected one of: {', '.join(sorted(KNOWN_BACKENDS))}."
        )

    if key == BACKEND_LOCAL:
        return {
            "BACKEND": "django.core.files.storage.FileSystemStorage",
            "OPTIONS": {
                "location": str(media_root),
                "base_url": media_url,
            },
        }

    if key in (BACKEND_S3, BACKEND_R2):
        bucket = os.environ.get("AWS_STORAGE_BUCKET_NAME", "").strip()
        if not bucket:
            raise ImproperlyConfigured(
                f"MEDIA_STORAGE_BACKEND={key!r} requires AWS_STORAGE_BUCKET_NAME."
            )
        access_key = os.environ.get("AWS_ACCESS_KEY_ID", "").strip()
        secret_key = os.environ.get("AWS_SECRET_ACCESS_KEY", "").strip()
        if not access_key or not secret_key:
            raise ImproperlyConfigured(
                f"MEDIA_STORAGE_BACKEND={key!r} requires "
                "AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY."
            )

        options: dict = {
            "bucket_name": bucket,
            "access_key": access_key,
            "secret_key": secret_key,
            # Files are public — no signed URLs needed for avatars.
            "querystring_auth": False,
            # ⚠⚠ THIS OVERWRITES. The comment here used to claim the OPPOSITE
            # ("prevent django-storages from overwriting files with the same
            # name") — it was wrong, and the wrong version is the one a reader
            # would have trusted. `file_overwrite=True` makes S3Boto3Storage's
            # `get_available_name()` return the requested key UNCHANGED, so a
            # second upload to an existing key REPLACES the stored object.
            # `False` is what appends a suffix and preserves both.
            #
            # ⛔ THIS IS A HOSTING BLOCKER, DELIBERATELY LEFT AS-IS FOR NOW.
            # Stored names come from `_jpeg_name()`, which derives them from the
            # UPLOADER'S OWN filename with nothing unique added — so two owners
            # sending `IMG_0042.jpg`, or two employees sending `photo.jpg`,
            # collide and the second silently replaces the first. Dormant today
            # only because MEDIA_STORAGE_BACKEND=local, and FileSystemStorage
            # has no such option (it always suffixes).
            # Do NOT flip this without reading the analysis in CLAUDE.md
            # → «Cloud storage is a HOSTING BLOCKER»: `False` fixes the
            # collisions but orphans a bucket object on every regeneration of a
            # SALE-REQUEST derivative, because that task deliberately never
            # deletes. The two have to be resolved together.
            "file_overwrite": True,
        }

        endpoint = os.environ.get("AWS_S3_ENDPOINT_URL", "").strip()
        if endpoint:
            options["endpoint_url"] = endpoint

        custom_domain = os.environ.get("AWS_S3_CUSTOM_DOMAIN", "").strip()
        if not custom_domain:
            raise ImproperlyConfigured(
                f"MEDIA_STORAGE_BACKEND={key!r} requires AWS_S3_CUSTOM_DOMAIN "
                "(the public bucket URL host, e.g. pub-xxx.r2.dev). "
                "Without it file.url returns the private storage endpoint, "
                "which browsers cannot access."
            )
        # django-storages uses this as the host for file.url → full public URL.
        # e.g. https://pub-xxx.r2.dev/users/avatars/photo.jpg
        options["custom_domain"] = custom_domain

        region = os.environ.get("AWS_S3_REGION_NAME", "").strip()
        if region:
            options["region_name"] = region

        options["object_parameters"] = {"CacheControl": "max-age=86400"}

        return {
            "BACKEND": "storages.backends.s3boto3.S3Boto3Storage",
            "OPTIONS": options,
        }

    # Unreachable given KNOWN_BACKENDS check above, but keeps type checkers happy.
    raise ImproperlyConfigured(f"Unhandled backend: {key!r}")


# ---------------------------------------------------------------------------
#  Startup visibility — same principle as the database guard in config/db_env.py
# ---------------------------------------------------------------------------
def build_media_startup_report(
    *,
    backend_key: str,
    media_root: str | Path,
    media_url: str,
    bucket: str = "",
    custom_domain: str = "",
    debug: bool = False,
) -> tuple[str, str]:
    """
    Return ``(info_line, warning_block)``; ``warning_block`` is "" when fine.

    The warning fires on **cloud backend + DEBUG=True**, which is almost always a
    mistake: it means a development machine is writing into the production
    bucket. That is not hypothetical — it happened during an earlier task, and
    because deleting a database row does NOT delete the stored object, the junk
    stayed until it was removed by hand.
    """
    key = (backend_key or BACKEND_LOCAL).strip().lower()

    if key in CLOUD_BACKENDS:
        target = bucket or "(bucket unset)"
        info = (
            f"[Centreal] MEDIA  backend={key}  bucket={target}"
            f"  domain={custom_domain or '(unset)'}"
        )
    else:
        info = f"[Centreal] MEDIA  backend={key}  root={media_root}  url={media_url}"

    if key not in CLOUD_BACKENDS or not debug:
        return info, ""

    lines = [
        "",
        "!" * 78,
        f"!!  CLOUD MEDIA STORAGE IS ACTIVE WHILE DEBUG=True  (backend={key})",
        "!" * 78,
        f"!!  bucket : {bucket or '(unset)'}",
        "!!",
        "!!  Every upload from this machine — INCLUDING throwaway test uploads —",
        "!!  is written to that bucket, which is the production one. There is a",
        "!!  single bucket and a single set of credentials.",
        "!!",
        "!!  Deleting the database row afterwards does NOT delete the object:",
        "!!  nothing in this project removes stored files on delete. Junk stays.",
        "!!",
        "!!  FIX: set MEDIA_STORAGE_BACKEND=local in backend/.env.",
        "!!  r2 is for production hosting only.",
        "!" * 78,
        "",
    ]
    return info, "\n".join(lines)


def emit_media_startup_report(
    *,
    backend_key: str,
    media_root: str | Path,
    media_url: str,
    bucket: str = "",
    custom_domain: str = "",
    debug: bool = False,
) -> None:
    """
    Print the active media backend, loudly if it is cloud storage in DEBUG.

    Written to **stderr**, like the database line, so it stays visible in the
    "Centreal Backend" launcher window without corrupting the stdout of
    machine-readable management commands. Reads configuration only — it never
    contacts the bucket, so it cannot fail or add startup latency.
    """
    info, warning = build_media_startup_report(
        backend_key=backend_key,
        media_root=media_root,
        media_url=media_url,
        bucket=bucket,
        custom_domain=custom_domain,
        debug=debug,
    )
    print(info, file=sys.stderr, flush=True)
    if warning:
        print(warning, file=sys.stderr, flush=True)
