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
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured

BACKEND_LOCAL = "local"
BACKEND_S3 = "s3"
BACKEND_R2 = "r2"

KNOWN_BACKENDS = frozenset({BACKEND_LOCAL, BACKEND_S3, BACKEND_R2})


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
            # Prevent django-storages from overwriting files with the same name
            # (keeps the original filename so URLs stay stable).
            "file_overwrite": True,
        }

        endpoint = os.environ.get("AWS_S3_ENDPOINT_URL", "").strip()
        if endpoint:
            options["endpoint_url"] = endpoint

        custom_domain = os.environ.get("AWS_S3_CUSTOM_DOMAIN", "").strip()
        if custom_domain:
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
