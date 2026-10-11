"""
Celery tasks for the submissions app.

Derivative generation for owner-submitted photos, using the ONE shared pipeline
in ``common.image_compression``.
"""
from __future__ import annotations

import logging

from celery import shared_task
from django.core.files.base import ContentFile

from common.image_compression import build_derivatives

logger = logging.getLogger(__name__)

DERIVATIVE_FIELDS = {
    "large": "image_large",
    "medium": "image_medium",
    "thumb": "image_thumb",
}


@shared_task
def generate_sale_request_photo_derivatives(photo_id: int) -> None:
    """
    Build image_large / image_medium / image_thumb from ``image``.

    ⚠ NO DELETION PATH. On failure this logs and returns, leaving whatever
    derivatives already exist untouched. It deliberately does NOT mirror the
    property task's habit of clearing the derivative fields on error: clearing
    calls ``FieldFile.delete()``, which removes bytes from storage, and this
    project has already lost real media that way once. A stale-but-present
    derivative is strictly better than a deleted one; the backfill command can
    always regenerate.

    ``image`` itself is never read-modified-written here — only the three
    derivative fields are assigned.
    """
    from submissions.models import SaleRequestPhoto

    photo = SaleRequestPhoto.objects.filter(pk=photo_id).first()
    if photo is None:
        logger.warning("SaleRequestPhoto id=%s not found, skip derivatives", photo_id)
        return
    if not photo.image:
        logger.warning("SaleRequestPhoto id=%s has no image", photo_id)
        return

    try:
        parts = build_derivatives(photo.image)
    except Exception:  # noqa: BLE001 — a bad upload must not crash the worker
        logger.exception(
            "SaleRequestPhoto derivative generation failed pk=%s (original left intact)",
            photo_id,
        )
        return

    base = f"salephoto_{photo.pk}"
    for suffix, field_name in DERIVATIVE_FIELDS.items():
        getattr(photo, field_name).save(
            f"{base}_{suffix}.jpg", ContentFile(parts[suffix]), save=False
        )
    photo.save(update_fields=["image_large", "image_medium", "image_thumb", "updated_at"])
