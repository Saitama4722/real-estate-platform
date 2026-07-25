"""
Shared image compression helpers (Pillow).

Used by model ``save()`` overrides to shrink user-uploaded images *before* they
are written to storage:

  * ``compress_avatar``       — square crop to ``AVATAR_SIZE`` (400x400), JPEG q85
  * ``compress_to_max_edge``  — longest side <= ``max_edge``, keep aspect, JPEG q85

Both **skip recompression** when the image is already small enough (and, for
avatars, already square at the target size). They return a Django
``ContentFile`` ready to assign to an ``ImageField`` via ``.save(name, content,
save=False)``, or ``None`` when no change is needed so the caller leaves the
uploaded file untouched.

RGBA/LA/P modes are flattened onto white before JPEG encoding (JPEG has no
alpha). EXIF orientation is applied so rotated phone photos save upright.
"""
from __future__ import annotations

import logging
from io import BytesIO

from django.core.files.base import ContentFile
from PIL import Image, ImageOps, UnidentifiedImageError

logger = logging.getLogger(__name__)

# --- Avatar: square, fixed size ---
AVATAR_SIZE = 400

# --- Generic resize: max length of the longer side ---
PROPERTY_PHOTO_MAX_EDGE = 1920

# --- Output ---
JPEG_QUALITY = 85


def _to_rgb_for_jpeg(image: Image.Image) -> Image.Image:
    """Flatten transparency / palette modes onto white so JPEG can encode it."""
    if image.mode in ("RGBA", "LA"):
        background = Image.new("RGB", image.size, (255, 255, 255))
        alpha = image.split()[-1]
        background.paste(image, mask=alpha)
        return background
    if image.mode == "P":
        return _to_rgb_for_jpeg(image.convert("RGBA"))
    if image.mode != "RGB":
        return image.convert("RGB")
    return image


def _encode_jpeg(image: Image.Image) -> bytes:
    buffer = BytesIO()
    image.save(buffer, format="JPEG", quality=JPEG_QUALITY, optimize=True)
    return buffer.getvalue()


def _read_bytes(field_or_uploaded_file) -> bytes:
    """Read all bytes from a FieldFile or an UploadedFile, leaving it usable."""
    f = field_or_uploaded_file
    try:
        f.seek(0)
    except (AttributeError, ValueError, OSError):
        pass
    data = f.read()
    try:
        f.seek(0)
    except (AttributeError, ValueError, OSError):
        pass
    return data


def _open(raw: bytes) -> Image.Image:
    img = Image.open(BytesIO(raw))
    img = ImageOps.exif_transpose(img)  # honor phone-photo rotation
    img.load()
    return img


def compress_avatar(uploaded_file, *, size: int = AVATAR_SIZE) -> ContentFile | None:
    """
    Center-crop to a square and resize to ``size`` x ``size``, JPEG quality 85.

    Returns a ``ContentFile`` (``*.jpg``), or ``None`` if the image is already a
    square at exactly ``size`` x ``size`` (so we don't needlessly recompress).
    """
    raw = _read_bytes(uploaded_file)
    try:
        img = _open(raw)
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        logger.warning("compress_avatar: could not open image (%s); skipping", exc)
        return None

    w, h = img.size
    if w <= 0 or h <= 0:
        return None

    # Skip if already a square at the target size and a JPEG — nothing to gain.
    if w == size and h == size and (img.format or "").upper() == "JPEG":
        return None

    rgb = _to_rgb_for_jpeg(img)
    # ImageOps.fit center-crops to the requested aspect (square) then resizes.
    square = ImageOps.fit(rgb, (size, size), Image.Resampling.LANCZOS)
    return ContentFile(_encode_jpeg(square), name=_jpeg_name(uploaded_file))


def compress_to_max_edge(
    uploaded_file, *, max_edge: int = PROPERTY_PHOTO_MAX_EDGE
) -> ContentFile | None:
    """
    Resize so the longest side is <= ``max_edge`` (keep aspect), JPEG quality 85.

    Returns a ``ContentFile`` (``*.jpg``), or ``None`` when the image already
    fits within ``max_edge`` on both sides AND is already a JPEG — in that case
    the upload is left exactly as-is (skip-if-small).
    """
    raw = _read_bytes(uploaded_file)
    try:
        img = _open(raw)
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        logger.warning("compress_to_max_edge: could not open image (%s); skipping", exc)
        return None

    w, h = img.size
    if w <= 0 or h <= 0:
        return None

    already_small = max(w, h) <= max_edge
    already_jpeg = (img.format or "").upper() == "JPEG"
    if already_small and already_jpeg:
        return None

    rgb = _to_rgb_for_jpeg(img)
    if not already_small:
        rgb = rgb.copy()
        rgb.thumbnail((max_edge, max_edge), Image.Resampling.LANCZOS)
    return ContentFile(_encode_jpeg(rgb), name=_jpeg_name(uploaded_file))


def _jpeg_name(uploaded_file) -> str:
    """Derive a ``.jpg`` filename from the upload's name (default ``image.jpg``)."""
    name = getattr(uploaded_file, "name", "") or "image"
    base = name.rsplit("/", 1)[-1].rsplit("\\", 1)[-1]
    stem = base.rsplit(".", 1)[0] or "image"
    return f"{stem}.jpg"
