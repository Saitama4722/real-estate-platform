"""
Default file storage configuration for Django ``STORAGES["default"]`` (Stage 14.4).

Active backend: local filesystem (``FileSystemStorage``). S3 and R2 are reserved
names only; selecting them raises ``ImproperlyConfigured`` until a real backend
is wired (e.g. django-storages) in this module and settings.

Switch: set ``MEDIA_STORAGE_BACKEND`` in environment (see ``config.settings``).
"""
from __future__ import annotations

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

    ``local`` uses Django's filesystem storage with the same roots as
    ``MEDIA_ROOT`` / ``MEDIA_URL`` (passed explicitly so this module stays
    free of import cycles with full settings).
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
    # Reserved for a future step: configure S3 / R2 (e.g. S3Boto3Storage) here.
    raise ImproperlyConfigured(
        f"MEDIA_STORAGE_BACKEND={key!r} is not implemented yet. "
        "Use 'local', or add cloud storage in common.media_storage and settings."
    )
