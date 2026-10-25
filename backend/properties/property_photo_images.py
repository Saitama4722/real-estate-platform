"""
PropertyPhoto image processing (Stage 14.1).

⚠ THIS MODULE NO LONGER IMPLEMENTS ANYTHING ITSELF. It is a thin, backwards-
compatible facade over ``common.image_compression``, which is the ONE shared
image pipeline every upload path in the project must use. It used to carry its
own copy of the resize/encode/EXIF logic and its own size constants; that copy
was removed when the same pipeline was extended to the public owner form, so
there is exactly one place where "what a derivative is" is decided.

Do not reintroduce local resizing here. Add to ``common.image_compression``.

All derivatives are built only from ``original_file``, never from each other.
"""
from __future__ import annotations

import logging

from django.core.exceptions import ValidationError

from common.image_compression import (
    DERIVATIVE_LARGE_MAX_EDGE,
    DERIVATIVE_MEDIUM_MAX_EDGE,
    DERIVATIVE_THUMB_MAX_EDGE,
    JPEG_QUALITY,
    MAX_IMAGE_UPLOAD_BYTES,
    build_derivatives,
    compress_to_max_edge,
)

logger = logging.getLogger(__name__)

# --- Upload limit (original_file only; enforced before processing) ---
#: Kept as a module-level alias so existing imports keep working; the value now
#: comes from the shared module so the CRM and the public form cannot drift.
MAX_ORIGINAL_FILE_BYTES = MAX_IMAGE_UPLOAD_BYTES

# --- Per-property photo limit (2026-10-25) ---
#: ⭐ THE ONE backend definition of "how many photos a property may have".
#: Enforced in `CrmPropertyPhotoViewSet.perform_create` under a row lock on the
#: property, counting the photos that already exist. The frontend mirrors it in
#: `frontend/src/lib/crm/propertyPhotos.ts` (MAX_PROPERTY_PHOTOS) — change both.
#: A module constant, not a setting: it is a product rule, not per-environment.
MAX_PHOTOS_PER_PROPERTY = 50
PHOTO_LIMIT_MESSAGE = "Можно загрузить не более 50 фотографий для одного объекта"
#: Machine-readable `code` in the 400 body, so the client can stop its queue.
PHOTO_LIMIT_CODE = "photo_limit"

# --- Web-friendly output for derivatives (original_file kept as uploaded) ---
DERIVATIVE_IMAGE_FORMAT = "JPEG"
DERIVATIVE_JPEG_QUALITY = JPEG_QUALITY

__all__ = [
    "MAX_ORIGINAL_FILE_BYTES",
    "MAX_PHOTOS_PER_PROPERTY",
    "PHOTO_LIMIT_MESSAGE",
    "PHOTO_LIMIT_CODE",
    "DERIVATIVE_LARGE_MAX_EDGE",
    "DERIVATIVE_MEDIUM_MAX_EDGE",
    "DERIVATIVE_THUMB_MAX_EDGE",
    "DERIVATIVE_IMAGE_FORMAT",
    "DERIVATIVE_JPEG_QUALITY",
    "validate_property_photo_original_size",
    "compress_original_file",
    "build_property_photo_derivatives",
]

_ORIGINAL_TOO_LARGE_MSG = "Размер файла не должен превышать 12 МБ."


def validate_property_photo_original_size(uploaded_file) -> None:
    """Raise ValidationError if the upload exceeds ``MAX_ORIGINAL_FILE_BYTES``."""
    size = getattr(uploaded_file, "size", None)
    if size is not None and size > MAX_ORIGINAL_FILE_BYTES:
        raise ValidationError(_ORIGINAL_TOO_LARGE_MSG, code="file_too_large")


def compress_original_file(uploaded_file):
    """
    Compress a freshly-uploaded ``original_file`` to longest-side
    ``DERIVATIVE_LARGE_MAX_EDGE`` (1920) at JPEG quality 85, keeping aspect ratio.

    Returns a Django ``ContentFile`` (``*.jpg``) to assign to the ImageField, or
    ``None`` when the image already fits within 1920px on both sides AND is
    already a JPEG (skip-if-small — leave the upload untouched). Returns ``None``
    on any decode error so a bad upload never breaks the save (it is still
    validated/processed downstream).
    """
    try:
        return compress_to_max_edge(uploaded_file, max_edge=DERIVATIVE_LARGE_MAX_EDGE)
    except Exception:  # noqa: BLE001 — never let compression break the save
        logger.warning("compress_original_file: could not process image", exc_info=True)
        return None


def build_property_photo_derivatives(original_field_file) -> tuple[bytes, bytes, bytes]:
    """
    Read ``original_field_file`` (FieldFile or UploadedFile) once into memory, then
    return (large_jpeg, medium_jpeg, thumb_jpeg).

    Each JPEG is produced by its own decode of those bytes (EXIF transpose, RGB,
    resize, encode). No output is fed into another size — only the original bytes
    are the source for every derivative.
    """
    parts = build_derivatives(original_field_file)
    return (parts["large"], parts["medium"], parts["thumb"])
