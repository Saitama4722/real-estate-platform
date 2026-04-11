"""
Celery tasks for the properties app (Stage 14.5+).
"""

from __future__ import annotations

import logging

from celery import shared_task
from django.core.files.base import ContentFile

from properties.import_choices import ImportJobStatus
from properties.import_models import ImportJob
from properties.models import PropertyPhoto
from properties.property_photo_images import build_property_photo_derivatives

logger = logging.getLogger(__name__)


@shared_task
def generate_property_photo_derivatives(photo_id: int) -> None:
    """
    Build image_large / image_medium / image_thumb from original_file.

    Safe if the row or file is missing: logs and returns without touching
    original_file.
    """
    try:
        photo = PropertyPhoto.objects.get(pk=photo_id)
    except PropertyPhoto.DoesNotExist:
        logger.warning("PropertyPhoto id=%s not found, skip derivatives", photo_id)
        return

    if not photo.original_file:
        logger.warning("PropertyPhoto id=%s has no original_file", photo_id)
        return

    try:
        large_b, medium_b, thumb_b = build_property_photo_derivatives(
            photo.original_file
        )
    except Exception:
        logger.exception(
            "PropertyPhoto derivative generation failed pk=%s", photo_id
        )
        try:
            photo = PropertyPhoto.objects.get(pk=photo_id)
        except PropertyPhoto.DoesNotExist:
            return
        photo._clear_derivative_image_fields()
        photo.save(
            update_fields=[
                "image_large",
                "image_medium",
                "image_thumb",
                "updated_at",
            ]
        )
        return

    base = f"photo_{photo.pk}"
    photo.image_large.save(
        f"{base}_large.jpg", ContentFile(large_b), save=False
    )
    photo.image_medium.save(
        f"{base}_medium.jpg", ContentFile(medium_b), save=False
    )
    photo.image_thumb.save(
        f"{base}_thumb.jpg", ContentFile(thumb_b), save=False
    )
    photo.save(
        update_fields=[
            "image_large",
            "image_medium",
            "image_thumb",
            "updated_at",
        ]
    )


@shared_task
def process_property_import_job(job_id: int) -> None:
    """
    Run CSV/XML import pipeline for one ImportJob (Stage 14.6).
    """
    from django.utils import timezone

    from properties.import_pipeline import run_import_job
    from users.permissions import crm_property_queryset_for_user

    job = ImportJob.objects.filter(pk=job_id).first()
    if not job:
        logger.warning("process_property_import_job: job id=%s not found", job_id)
        return

    user = job.created_by
    if user is None:
        logger.error("process_property_import_job: job id=%s has no created_by", job_id)
        job.status = ImportJobStatus.FAILED
        job.error_summary = "Нет пользователя-инициатора."
        job.finished_at = timezone.now()
        job.save(
            update_fields=["status", "error_summary", "finished_at", "updated_at"]
        )
        return

    base_qs = crm_property_queryset_for_user(user)
    run_import_job(job_id, base_qs=base_qs)
