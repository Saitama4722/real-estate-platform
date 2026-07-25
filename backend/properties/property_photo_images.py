"""
PropertyPhoto image processing (Stage 14.1).

All derivatives are built only from ``original_file``, never from each other.
"""
from __future__ import annotations

import logging
from io import BytesIO

from django.core.exceptions import ValidationError
from django.core.files.base import ContentFile
from PIL import Image, ImageOps

logger = logging.getLogger(__name__)

# --- Upload limit (original_file only; enforced before processing) ---
MAX_ORIGINAL_FILE_BYTES = 12 * 1024 * 1024  # 12 MiB

# --- Resize: max length of the longer side; smaller images are not upscaled ---
DERIVATIVE_LARGE_MAX_EDGE = 1920
DERIVATIVE_MEDIUM_MAX_EDGE = 1024
DERIVATIVE_THUMB_MAX_EDGE = 400

# --- Web-friendly output for derivatives (original_file kept as uploaded) ---
DERIVATIVE_IMAGE_FORMAT = "JPEG"
DERIVATIVE_JPEG_QUALITY = 85

_ORIGINAL_TOO_LARGE_MSG = (
    "Размер файла не должен превышать 12 МБ."
)


def validate_property_photo_original_size(uploaded_file) -> None:
    """Raise ValidationError if the upload exceeds ``MAX_ORIGINAL_FILE_BYTES``."""
    size = getattr(uploaded_file, "size", None)
    if size is not None and size > MAX_ORIGINAL_FILE_BYTES:
        raise ValidationError(_ORIGINAL_TOO_LARGE_MSG, code="file_too_large")


def _to_rgb_for_jpeg(image: Image.Image) -> Image.Image:
    if image.mode in ("RGBA", "LA"):
        background = Image.new("RGB", image.size, (255, 255, 255))
        alpha = image.split()[-1]
        background.paste(image, mask=alpha)
        return background
    if image.mode == "P":
        image = image.convert("RGBA")
        return _to_rgb_for_jpeg(image)
    if image.mode != "RGB":
        return image.convert("RGB")
    return image


def _resize_to_max_edge(image: Image.Image, max_edge: int) -> Image.Image:
    image = image.copy()
    w, h = image.size
    if w <= 0 or h <= 0:
        return image
    if max(w, h) <= max_edge:
        return image
    image.thumbnail((max_edge, max_edge), Image.Resampling.LANCZOS)
    return image


def _encode_derivative_jpeg(image: Image.Image) -> bytes:
    buffer = BytesIO()
    image.save(
        buffer,
        format=DERIVATIVE_IMAGE_FORMAT,
        quality=DERIVATIVE_JPEG_QUALITY,
        optimize=True,
    )
    return buffer.getvalue()


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
    from PIL import UnidentifiedImageError

    try:
        uploaded_file.seek(0)
    except (AttributeError, ValueError, OSError):
        pass
    try:
        raw = uploaded_file.read()
    finally:
        try:
            uploaded_file.seek(0)
        except (AttributeError, ValueError, OSError):
            pass

    try:
        with Image.open(BytesIO(raw)) as img:
            img = ImageOps.exif_transpose(img)
            img.load()
            w, h = img.size
            if w <= 0 or h <= 0:
                return None
            already_small = max(w, h) <= DERIVATIVE_LARGE_MAX_EDGE
            already_jpeg = (img.format or "").upper() == "JPEG"
            if already_small and already_jpeg:
                return None
            rgb = _to_rgb_for_jpeg(img)
            resized = _resize_to_max_edge(rgb, DERIVATIVE_LARGE_MAX_EDGE)
            data = _encode_derivative_jpeg(resized)
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        logger.warning("compress_original_file: could not process image (%s); skipping", exc)
        return None

    name = getattr(uploaded_file, "name", "") or "photo"
    base = name.rsplit("/", 1)[-1].rsplit("\\", 1)[-1]
    stem = base.rsplit(".", 1)[0] or "photo"
    return ContentFile(data, name=f"{stem}.jpg")


def build_property_photo_derivatives(original_field_file) -> tuple[bytes, bytes, bytes]:
    """
    Read ``original_field_file`` (FieldFile or UploadedFile) once into memory, then
    return (large_jpeg, medium_jpeg, thumb_jpeg).

    Each JPEG is produced by its own ``Image.open`` on those bytes (EXIF transpose,
    RGB, resize, encode). No output is fed into another size — only the original
    bytes are the source for every derivative.
    """
    original_field_file.open("rb")
    try:
        raw = original_field_file.read()
    finally:
        original_field_file.close()

    def _jpeg_for_max_edge(max_edge: int) -> bytes:
        with Image.open(BytesIO(raw)) as img:
            img = ImageOps.exif_transpose(img)
            img.load()
            rgb = _to_rgb_for_jpeg(img)
            return _encode_derivative_jpeg(_resize_to_max_edge(rgb, max_edge))

    return (
        _jpeg_for_max_edge(DERIVATIVE_LARGE_MAX_EDGE),
        _jpeg_for_max_edge(DERIVATIVE_MEDIUM_MAX_EDGE),
        _jpeg_for_max_edge(DERIVATIVE_THUMB_MAX_EDGE),
    )
