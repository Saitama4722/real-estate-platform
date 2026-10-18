"""Celery tasks for the common app."""

import logging

from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task(name="common.purge_old_crm_notifications")
def purge_old_crm_notifications() -> int:
    """
    Delete bell notifications older than `common.crm_notify.RETENTION` (7 days).

    Only the notifications go: leads and sale requests are never touched. The
    bell already hides anything older than 24 h; this just keeps the table
    from growing.
    """
    from common.crm_notify import RETENTION
    from common.models import CrmNotification

    cutoff = timezone.now() - RETENTION
    deleted, _ = CrmNotification.objects.filter(created_at__lt=cutoff).delete()
    logger.info("purge_old_crm_notifications deleted=%s cutoff=%s", deleted, cutoff.isoformat())
    return deleted
