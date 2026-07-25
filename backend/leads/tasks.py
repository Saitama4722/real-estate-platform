"""
Celery tasks for the leads app.

Currently: send a Telegram notification when a new public-form lead is created.
"""

from __future__ import annotations

import json
import logging
import urllib.error
import urllib.request
from zoneinfo import ZoneInfo

from celery import shared_task
from django.conf import settings

from leads.models import Lead

logger = logging.getLogger(__name__)

_TELEGRAM_API = "https://api.telegram.org/bot{token}/sendMessage"
_TELEGRAM_TIMEOUT = 10  # seconds
_MOSCOW_TZ = ZoneInfo("Europe/Moscow")


def _build_message(lead: Lead) -> str:
    """
    Plain-text notification body (no parse_mode, so client input cannot break
    formatting), matching the reference landing project's template.
    """
    name = (lead.client_name or "").strip() or "—"
    phone = (lead.client_phone or "").strip() or "—"
    message = (lead.client_message or "").strip() or "—"
    source = lead.get_source_display()

    page = "—"
    prop = lead.property  # nullable FK (on_delete=SET_NULL)
    if prop is not None and getattr(prop, "slug", None):
        page = f"{settings.SITE_URL}/catalog/{prop.slug}"

    # created_at is timezone-aware (USE_TZ); render in Moscow time as ДД.ММ.ГГГГ ЧЧ:ММ.
    time_str = lead.created_at.astimezone(_MOSCOW_TZ).strftime("%d.%m.%Y %H:%M")

    return "\n".join(
        [
            "Новая заявка с сайта",
            "",
            f"Имя:        {name}",
            f"Телефон:    {phone}",
            f"Сообщение:  {message}",
            f"Источник:   {source}",
            f"Страница:   {page}",
            f"Время:      {time_str} МСК",
        ]
    )


@shared_task(
    bind=True,
    max_retries=2,
    default_retry_delay=5,
    retry_backoff=True,
    retry_backoff_max=60,
)
def send_lead_telegram_notification(self, lead_id: int) -> None:
    """
    Notify the Telegram group about a newly created lead.

    A failed send must never affect lead creation or anything else: all errors
    are logged and swallowed. Only transient network errors trigger a retry
    (up to max_retries with exponential backoff); everything else returns.
    """
    if not getattr(settings, "LEADS_NOTIFICATIONS_ENABLED", True):
        logger.info(
            "send_lead_telegram_notification: notifications disabled, "
            "skip lead_id=%s",
            lead_id,
        )
        return

    token = settings.TELEGRAM_BOT_TOKEN
    chat_id = settings.TELEGRAM_CHAT_ID
    if not token or not chat_id:
        logger.warning(
            "send_lead_telegram_notification: TELEGRAM_BOT_TOKEN / "
            "TELEGRAM_CHAT_ID not configured, skip lead_id=%s",
            lead_id,
        )
        return

    lead = (
        Lead.objects.select_related("property")
        .filter(pk=lead_id)
        .first()
    )
    if lead is None:
        logger.warning(
            "send_lead_telegram_notification: lead id=%s not found", lead_id
        )
        return

    text = _build_message(lead)
    payload = json.dumps({"chat_id": chat_id, "text": text}).encode("utf-8")
    req = urllib.request.Request(
        _TELEGRAM_API.format(token=token),
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=_TELEGRAM_TIMEOUT) as resp:
            if resp.status >= 300:
                body = resp.read().decode("utf-8", errors="replace")
                logger.error(
                    "Telegram API non-2xx for lead_id=%s: %s %s",
                    lead_id,
                    resp.status,
                    body[:500],
                )
                return
    except urllib.error.HTTPError as exc:
        # 4xx/5xx from Telegram. 5xx is worth retrying; 4xx (bad token/chat) is not.
        body = ""
        try:
            body = exc.read().decode("utf-8", errors="replace")
        except Exception:
            pass
        logger.error(
            "Telegram HTTPError for lead_id=%s: %s %s",
            lead_id,
            exc.code,
            body[:500],
        )
        if exc.code >= 500:
            try:
                raise self.retry(exc=exc)
            except self.MaxRetriesExceededError:
                logger.error(
                    "Telegram send gave up after retries for lead_id=%s", lead_id
                )
        return
    except (urllib.error.URLError, TimeoutError) as exc:
        # Transient network failure — retry with backoff, then give up quietly.
        logger.warning(
            "Telegram network error for lead_id=%s: %s", lead_id, exc
        )
        try:
            raise self.retry(exc=exc)
        except self.MaxRetriesExceededError:
            logger.error(
                "Telegram send gave up after retries for lead_id=%s", lead_id
            )
        return
    except Exception:
        # Any unexpected error: log and swallow, never propagate.
        logger.exception(
            "Telegram send unexpected error for lead_id=%s", lead_id
        )
        return

    logger.info("Telegram lead notification sent for lead_id=%s", lead_id)
