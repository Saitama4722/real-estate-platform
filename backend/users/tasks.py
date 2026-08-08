"""
Periodic maintenance for the JWT blacklist.

WHY THIS EXISTS. `SIMPLE_JWT.ROTATE_REFRESH_TOKENS` + `BLACKLIST_AFTER_ROTATION`
mean every refresh writes an `OutstandingToken` row and blacklists the spent
one. Nothing removes them, so the two tables grow forever — see the sizing note
in CLAUDE.md. `flushexpiredtokens` deletes outstanding tokens whose expiry has
passed (blacklist rows cascade with them), which bounds the tables at roughly
one REFRESH_TOKEN_LIFETIME of history.

⚠ THIS TASK ONLY RUNS IF CELERY BEAT IS RUNNING. The project's launcher starts
a Celery WORKER but no beat process, so today the schedule below is declarative
only. Starting beat is a go-live step (CLAUDE.md pre-production checklist); the
manual fallback is `python manage.py flushexpiredtokens`.
"""
import logging

from celery import shared_task
from django.core.management import call_command

logger = logging.getLogger(__name__)


@shared_task(name="users.flush_expired_tokens")
def flush_expired_tokens() -> str:
    """Drop expired OutstandingToken rows (and their blacklist entries)."""
    from rest_framework_simplejwt.token_blacklist.models import (
        BlacklistedToken,
        OutstandingToken,
    )

    before_out = OutstandingToken.objects.count()
    before_black = BlacklistedToken.objects.count()
    call_command("flushexpiredtokens")
    after_out = OutstandingToken.objects.count()
    after_black = BlacklistedToken.objects.count()

    message = (
        f"flushexpiredtokens: outstanding {before_out} → {after_out}, "
        f"blacklisted {before_black} → {after_black}"
    )
    logger.info(message)
    return message
