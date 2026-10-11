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

from django.core.exceptions import ValidationError
from django.core.files.base import ContentFile
from PIL import Image, ImageOps, UnidentifiedImageError

logger = logging.getLogger(__name__)

# --- Avatar: square, fixed size ---
AVATAR_SIZE = 400

# --- Generic resize: max length of the longer side ---
PROPERTY_PHOTO_MAX_EDGE = 1920

# --- Output ---
JPEG_QUALITY = 85

# ---------------------------------------------------------------------------
#  Canonical derivative ladder — THE single source of truth for every model.
#
#  ⚠ These constants live HERE, not in an app, because every upload path is
#  required to reuse them (see the image-pipeline rule in CLAUDE.md).
#  ``properties.property_photo_images`` re-exports them for backwards
#  compatibility; it does not define its own.
#
#  Longest edge in px. Images smaller than a step are NEVER upscaled.
# ---------------------------------------------------------------------------
DERIVATIVE_LARGE_MAX_EDGE = 1920
DERIVATIVE_MEDIUM_MAX_EDGE = 1024
DERIVATIVE_THUMB_MAX_EDGE = 400

#: Ordered so callers can iterate deterministically: suffix -> max edge.
DERIVATIVE_SIZES: dict[str, int] = {
    "large": DERIVATIVE_LARGE_MAX_EDGE,
    "medium": DERIVATIVE_MEDIUM_MAX_EDGE,
    "thumb": DERIVATIVE_THUMB_MAX_EDGE,
}

# --- Upload guards (shared; the public owner form is the strictest consumer) ---
MAX_IMAGE_UPLOAD_BYTES = 12 * 1024 * 1024  # 12 MiB — same budget as CRM photos

#: Whitelist checked against the DECODED Pillow format, never the filename
#: extension or the client-supplied Content-Type — both are trivially forged.
ALLOWED_UPLOAD_FORMATS = frozenset({"JPEG", "PNG", "WEBP"})

_TOO_LARGE_MSG = "Размер файла не должен превышать 12 МБ."
_NOT_AN_IMAGE_MSG = "Файл повреждён или не является изображением."
_BAD_FORMAT_MSG = "Поддерживаются только JPEG, PNG и WebP."


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


def _open(raw: bytes) -> tuple[Image.Image, str]:
    """Decode ``raw``, apply EXIF orientation, and return ``(image, format)``.

    ⚠ THE FORMAT MUST BE READ BEFORE ``exif_transpose``. That call returns a
    COPY, and a copied Pillow image has ``format = None`` — so the previous code,
    which checked ``img.format`` afterwards, saw None for every input and its
    "skip if already a small JPEG" branch could never fire. Every small JPEG was
    therefore re-encoded at q85 on upload, losing quality for nothing.
    """
    img = Image.open(BytesIO(raw))
    original_format = (img.format or "").upper()
    img = ImageOps.exif_transpose(img)  # honor phone-photo rotation
    img.load()
    return img, original_format


def compress_avatar(uploaded_file, *, size: int = AVATAR_SIZE) -> ContentFile | None:
    """
    Center-crop to a square and resize to ``size`` x ``size``, JPEG quality 85.

    Returns a ``ContentFile`` (``*.jpg``), or ``None`` if the image is already a
    square at exactly ``size`` x ``size`` (so we don't needlessly recompress).
    """
    raw = _read_bytes(uploaded_file)
    try:
        img, source_format = _open(raw)
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        logger.warning("compress_avatar: could not open image (%s); skipping", exc)
        return None

    w, h = img.size
    if w <= 0 or h <= 0:
        return None

    # Skip if already a square at the target size and a JPEG — nothing to gain.
    if w == size and h == size and source_format == "JPEG":
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
        img, source_format = _open(raw)
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        logger.warning("compress_to_max_edge: could not open image (%s); skipping", exc)
        return None

    w, h = img.size
    if w <= 0 or h <= 0:
        return None

    already_small = max(w, h) <= max_edge
    already_jpeg = source_format == "JPEG"
    if already_small and already_jpeg:
        return None

    rgb = _to_rgb_for_jpeg(img)
    if not already_small:
        rgb = rgb.copy()
        rgb.thumbnail((max_edge, max_edge), Image.Resampling.LANCZOS)
    encoded = _encode_jpeg(rgb)

    # ⚠ DO NOT "compress" a file into a BIGGER one. A PNG that is already within
    # max_edge — a logo, a flat graphic, a screenshot — often encodes smaller as
    # PNG than as JPEG. Measured: a 1500x1000 RGBA PNG of 9,860 B became a
    # 37,072 B JPEG, i.e. 3.8x LARGER, lossy, and with its transparency flattened
    # onto white. When no resize was needed and the JPEG is not actually smaller,
    # keep the upload exactly as it is.
    #
    # This guard is deliberately limited to the already-small case: when a resize
    # DID happen the JPEG is the point, and behaviour is unchanged from before.
    if already_small and len(encoded) >= len(raw):
        logger.debug(
            "compress_to_max_edge: JPEG (%d B) not smaller than source (%d B); keeping original",
            len(encoded),
            len(raw),
        )
        return None

    return ContentFile(encoded, name=_jpeg_name(uploaded_file))


def _jpeg_name(uploaded_file) -> str:
    """Derive a ``.jpg`` filename from the upload's name (default ``image.jpg``)."""
    name = getattr(uploaded_file, "name", "") or "image"
    base = name.rsplit("/", 1)[-1].rsplit("\\", 1)[-1]
    stem = base.rsplit(".", 1)[0] or "image"
    return f"{stem}.jpg"


# ---------------------------------------------------------------------------
#  Shared upload validation
# ---------------------------------------------------------------------------
def validate_image_upload(
    uploaded_file,
    *,
    max_bytes: int = MAX_IMAGE_UPLOAD_BYTES,
    allowed_formats: frozenset[str] = ALLOWED_UPLOAD_FORMATS,
) -> None:
    """
    Reject an upload that is too large, undecodable, or not a whitelisted format.

    Raises Django's ``ValidationError`` with a Russian message. Callers on DRF
    serializers translate it into a 400; nothing here may raise anything a view
    would turn into a 500 — this runs on a PUBLIC, unauthenticated endpoint that
    receives junk by design.

    ⚠ The format check reads the DECODED Pillow format. Neither the filename
    extension nor ``content_type`` is trusted: both come from the client.
    """
    size = getattr(uploaded_file, "size", None)
    if size is not None and size > max_bytes:
        raise ValidationError(_TOO_LARGE_MSG, code="file_too_large")

    raw = _read_bytes(uploaded_file)
    if not raw:
        raise ValidationError(_NOT_AN_IMAGE_MSG, code="not_an_image")

    try:
        # Pass 1 — structural check. verify() must be the last call on a handle,
        # so the format is captured first and the handle is then spent.
        with Image.open(BytesIO(raw)) as probe:
            fmt = (probe.format or "").upper()
            probe.verify()
        # Pass 2 — FULL DECODE on a fresh handle. ⚠ verify() alone is NOT enough:
        # it validates headers/structure and happily passes a JPEG whose scan
        # data is cut short (measured — a file truncated to a third of its bytes
        # was accepted by verify() and only load() rejected it). Only an actual
        # decode proves every pixel is there.
        with Image.open(BytesIO(raw)) as full:
            full.load()
    except Exception as exc:  # noqa: BLE001 — any decode failure is a bad upload
        logger.info("validate_image_upload: rejected undecodable upload (%s)", exc)
        raise ValidationError(_NOT_AN_IMAGE_MSG, code="not_an_image") from exc

    if fmt not in allowed_formats:
        raise ValidationError(_BAD_FORMAT_MSG, code="unsupported_format")


# ---------------------------------------------------------------------------
#  Shared derivative builder
# ---------------------------------------------------------------------------
def build_derivatives(
    source,
    *,
    sizes: dict[str, int] | None = None,
) -> dict[str, bytes]:
    """
    Decode ``source`` once and return ``{suffix: jpeg_bytes}`` for each size.

    ``source`` may be a ``FieldFile`` (stored original) or an ``UploadedFile``.
    Every derivative is decoded **independently from the original bytes** — no
    output is ever fed into another size, so a thumb is never a re-compression
    of a medium.

    EXIF orientation is applied via ``exif_transpose`` BEFORE resizing, and the
    re-encode drops all metadata (no ``exif=`` is passed to ``save``), so
    derivatives are upright and carry no GPS/camera data.

    Raises ``ValidationError`` if the source cannot be decoded — callers that
    must not fail (a Celery task) should catch it.
    """
    ladder = sizes if sizes is not None else DERIVATIVE_SIZES

    opened = False
    try:
        source.open("rb")
        opened = True
    except (AttributeError, ValueError, OSError):
        pass
    try:
        raw = _read_bytes(source)
    finally:
        if opened:
            try:
                source.close()
            except (AttributeError, ValueError, OSError):
                pass

    if not raw:
        raise ValidationError(_NOT_AN_IMAGE_MSG, code="not_an_image")

    out: dict[str, bytes] = {}
    for suffix, max_edge in ladder.items():
        try:
            with Image.open(BytesIO(raw)) as img:
                img = ImageOps.exif_transpose(img)
                img.load()
                rgb = _to_rgb_for_jpeg(img)
                if max(rgb.size) > max_edge:
                    rgb = rgb.copy()
                    rgb.thumbnail((max_edge, max_edge), Image.Resampling.LANCZOS)
                out[suffix] = _encode_jpeg(rgb)
        except (UnidentifiedImageError, OSError, ValueError) as exc:
            raise ValidationError(_NOT_AN_IMAGE_MSG, code="not_an_image") from exc
    return out


def compress_field_in_place(field_file, *, max_edge: int = PROPERTY_PHOTO_MAX_EDGE) -> None:
    """
    Cap a freshly-uploaded ``ImageField`` at ``max_edge`` before it reaches storage.

    Call from a model ``save()`` for single-image fields that have no derivative
    ladder (covers, logos, owner photos). No-ops unless the field holds a NEW,
    uncommitted upload, so re-saving a row never re-processes a stored file, and
    never raises — a broken image is left for field validation to reject.
    """
    if not field_file:
        return
    if getattr(field_file, "_committed", True):
        return
    try:
        compressed = compress_to_max_edge(field_file, max_edge=max_edge)
    except Exception:  # noqa: BLE001 — compression must never break a save
        logger.warning("compress_field_in_place: compression failed", exc_info=True)
        return
    if compressed is not None:
        field_file.save(compressed.name, compressed, save=False)
