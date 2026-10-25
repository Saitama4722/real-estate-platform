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
    MAX_PROPERTY_PHOTO_UPLOAD_BYTES,
    build_derivatives,
    compress_property_original,
    validate_photo_dimensions,
)

logger = logging.getLogger(__name__)

# --- Upload limit (original_file only; enforced before processing) ---
#: 40 MiB since 2026-10-26 (was 12 MiB): the browser compresses big photos to
#: about 1 MB before upload, so users are never blocked by size; this is only the
#: hard cap on the ORIGINAL. The public sale-request form keeps its own, smaller
#: server cap (`common.image_compression.MAX_IMAGE_UPLOAD_BYTES`): its client
#: compresses too, and a public endpoint should not accept 40 MiB x 10 photos.
#: SEPARATE from the photo COUNT limit below. The client mirrors this number in
#: `frontend/src/lib/photoCompression.ts` (MAX_ORIGINAL_PHOTO_BYTES).
MAX_ORIGINAL_FILE_BYTES = MAX_PROPERTY_PHOTO_UPLOAD_BYTES

# --- Per-property photo limit (2026-10-25) ---
#: ⭐ THE ONE backend definition of "how many photos a property may have".
#: Enforced in `CrmPropertyPhotoViewSet.perform_create` under a row lock on the
#: property, counting the photos that already exist. The frontend mirrors it in
#: `frontend/src/lib/crmPropertyPhotos.ts` (MAX_PROPERTY_PHOTOS) — change both.
#: A module constant, not a setting: it is a product rule, not per-environment.
#: 50 until 2026-10-26, then lowered to 10 by the owner (stability first).
MAX_PHOTOS_PER_PROPERTY = 10
PHOTO_LIMIT_MESSAGE = (
    f"Можно загрузить не более {MAX_PHOTOS_PER_PROPERTY} фотографий для одного объекта"
)
#: Machine-readable `code` in the 400 body, so the client can stop its queue.
PHOTO_LIMIT_CODE = "photo_limit"

#: ⭐ THE ONE definition of a property's COVER photo (card / catalog / first in
#: the gallery): the main photo first, then manual order, then id. Used by the
#: list annotations, the detail prefetch and the CRM, so they can never disagree.
COVER_PHOTO_ORDER = ("-is_main", "sort_order", "id")

# --- Web-friendly output for derivatives (original_file kept as uploaded) ---
DERIVATIVE_IMAGE_FORMAT = "JPEG"
DERIVATIVE_JPEG_QUALITY = JPEG_QUALITY

__all__ = [
    "MAX_ORIGINAL_FILE_BYTES",
    "COVER_PHOTO_ORDER",
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

_ORIGINAL_TOO_LARGE_MSG = (
    f"Размер файла не должен превышать {MAX_ORIGINAL_FILE_BYTES // (1024 * 1024)} МБ."
)


def validate_property_photo_original_size(uploaded_file) -> None:
    """Raise ValidationError if the upload is too big in bytes or in pixels."""
    size = getattr(uploaded_file, "size", None)
    if size is not None and size > MAX_ORIGINAL_FILE_BYTES:
        raise ValidationError(_ORIGINAL_TOO_LARGE_MSG, code="file_too_large")
    validate_photo_dimensions(uploaded_file)


def compress_original_file(uploaded_file):
    """
    Safety-net compression of a freshly-uploaded ``original_file`` (rules:
    ``common.image_compression.compress_property_original``).

    Returns a Django ``ContentFile`` (``*.jpg``) to assign to the ImageField, or
    ``None`` when the upload must be stored unchanged (already <= 1.5 MiB and
    <= 2560 px). Returns ``None`` on any decode error so a bad upload never breaks
    the save (it is validated before this runs).
    """
    try:
        return compress_property_original(uploaded_file)
    except Exception:  # noqa: BLE001 - never let compression break the save
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
