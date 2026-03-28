"""
CRM-only publication workflow: explicit transitions for Property.status
and related publication fields (is_published, published_at, archived_at).
"""

from django.utils import timezone
from rest_framework.exceptions import ValidationError

from properties.choices import PropertyStatus


def _deny(message: str) -> None:
    raise ValidationError({"detail": message})


def apply_crm_publish(prop) -> None:
    """
    draft | moderation -> published (sets is_published, published_at; clears archived_at).
    published -> no-op. archived -> forbidden (use to_draft first).
    """
    status = prop.status
    if status == PropertyStatus.PUBLISHED:
        return
    if status == PropertyStatus.ARCHIVED:
        _deny(
            "Публикация из архива недоступна. Сначала переведите объект в черновик "
            "(POST .../to_draft/)."
        )
    if status not in (PropertyStatus.DRAFT, PropertyStatus.MODERATION):
        _deny("Публикация из текущего статуса недоступна.")
    prop.status = PropertyStatus.PUBLISHED
    prop.is_published = True
    prop.published_at = timezone.now()
    prop.archived_at = None


def apply_crm_to_draft(prop) -> None:
    """
    published | archived | moderation -> draft (clears publication and archive timestamps).
    draft -> no-op.
    """
    status = prop.status
    if status == PropertyStatus.DRAFT:
        return
    if status not in (
        PropertyStatus.PUBLISHED,
        PropertyStatus.ARCHIVED,
        PropertyStatus.MODERATION,
    ):
        _deny("Перевод в черновик из текущего статуса недоступен.")
    prop.status = PropertyStatus.DRAFT
    prop.is_published = False
    prop.published_at = None
    prop.archived_at = None


def apply_crm_archive(prop) -> None:
    """
    draft | published | moderation -> archived (same side effects as Stage 8.2).
    archived -> no-op.
    """
    status = prop.status
    if status == PropertyStatus.ARCHIVED:
        return
    if status not in (
        PropertyStatus.DRAFT,
        PropertyStatus.PUBLISHED,
        PropertyStatus.MODERATION,
    ):
        _deny("Архивация из текущего статуса недоступна.")
    prop.status = PropertyStatus.ARCHIVED
    prop.is_published = False
    prop.published_at = None
    prop.archived_at = timezone.now()
