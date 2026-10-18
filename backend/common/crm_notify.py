"""
Очередь заявок и колокольчик уведомлений CRM (2026-10-18).

⭐ ПРАВИЛА, ЗАКРЕПЛЁННЫЕ ЗДЕСЬ

1. **Суперадмин и администратор — НЕ участники процесса.** Им не приходят
   уведомления, они не берут и не возвращают заявки, на них ничего не
   назначается автоматически. Получатели и исполнители — только активные
   пользователи с `role=realtor` (`workflow_realtors`). Их прежние права
   (смена статуса, удаление, переназначение в Django admin) не тронуты.
2. **Взять заявку = условный UPDATE**, а не «прочитал — проверил — записал»:
   `UPDATE … SET assigned_realtor = me WHERE pk = X AND assigned_realtor IS NULL`.
   Изменилась ровно одна строка — заявка ваша; ноль строк — её уже взял
   другой. Гонку двух риэлторов решает база, а не Python.
3. **Взял один — уведомления остальных удаляются.** Свободная заявка после
   взятия им больше не видна, и строка в колокольчике вела бы на 404.
4. **Вернуть в общие можно только заявку без объекта** (лид без `property`,
   заявку на продажу без `converted_property`). Заявка по объекту всегда
   остаётся у риэлтора этого объекта. Возврат снова уведомляет всех остальных.
5. Уведомления создаются в `transaction.on_commit`, рядом с отправкой в
   Telegram (которая не менялась), — откаченная заявка никого не уведомит.
"""
from __future__ import annotations

import logging
from datetime import timedelta

from django.db import transaction
from django.utils import timezone

logger = logging.getLogger(__name__)

#: Сколько уведомление видно в колокольчике.
BELL_WINDOW = timedelta(hours=24)
#: Сколько строк хранится, прежде чем их удалит ежедневная задача.
RETENTION = timedelta(days=7)
#: Сколько последних уведомлений отдаёт список колокольчика.
BELL_LIST_LIMIT = 20


class AlreadyTaken(Exception):
    """Заявку уже взял другой риэлтор (условный UPDATE изменил 0 строк)."""


class NotOwner(Exception):
    """Вернуть в общие может только тот, кто её взял."""


class NotReturnable(Exception):
    """Заявка привязана к объекту — её нельзя вернуть в общие."""


def is_workflow_realtor(user) -> bool:
    """Единственное определение «участник процесса»: активный риэлтор."""
    return bool(
        user
        and getattr(user, "is_authenticated", False)
        and getattr(user, "is_active", False)
        and getattr(user, "is_realtor_role", False)
    )


def workflow_realtors(*, needs_view_clients: bool):
    """
    Кому рассылать свободные заявки. Лиды открываются только с правом
    `view_clients` (иначе список лидов отдаёт 403), поэтому уведомление о
    лиде получает лишь тот, кто сможет его открыть.
    """
    from users.models import User

    qs = User.objects.filter(role=User.Role.REALTOR, is_active=True)
    if needs_view_clients:
        qs = qs.filter(perm_view_clients=True)
    return qs


def bell_window_start():
    return timezone.now() - BELL_WINDOW


# --------------------------------------------------------------------------
# Создание уведомлений
# --------------------------------------------------------------------------


def _bulk_notify(type_, *, recipients, lead=None, sale_request=None) -> int:
    from common.models import CrmNotification

    rows = [
        CrmNotification(recipient=u, type=type_, lead=lead, sale_request=sale_request)
        for u in recipients
        if is_workflow_realtor(u)
    ]
    CrmNotification.objects.bulk_create(rows)
    return len(rows)


def notify_new_lead(lead) -> int:
    """
    Новый лид: назначенный — только своему риэлтору, свободный — всем
    активным риэлторам с `view_clients`.
    """
    from common.models import CrmNotificationType

    if lead.assigned_realtor_id:
        return _bulk_notify(
            CrmNotificationType.NEW_LEAD, recipients=[lead.assigned_realtor], lead=lead
        )
    return _bulk_notify(
        CrmNotificationType.NEW_LEAD,
        recipients=workflow_realtors(needs_view_clients=True),
        lead=lead,
    )


def notify_new_sale_request(sale_request, *, exclude_user_id=None) -> int:
    from common.models import CrmNotificationType

    recipients = workflow_realtors(needs_view_clients=False)
    if exclude_user_id:
        recipients = recipients.exclude(pk=exclude_user_id)
    return _bulk_notify(
        CrmNotificationType.NEW_SALE_REQUEST,
        recipients=recipients,
        sale_request=sale_request,
    )


def run_safely(fn, *args, **kwargs) -> None:
    """
    Для `on_commit` публичных форм: заявка УЖЕ сохранена, и сбой колокольчика
    не имеет права превратить её в 500 для посетителя. Логируем и молчим.
    """
    try:
        fn(*args, **kwargs)
    except Exception:
        logger.exception("crm_notify %s failed", getattr(fn, "__name__", fn))


def notify_assigned(realtor, *, lead=None, sale_request=None) -> int:
    """«Заявка назначена вам» — когда назначил НЕ сам риэлтор (Django admin)."""
    from common.models import CrmNotificationType

    return _bulk_notify(
        CrmNotificationType.ASSIGNED,
        recipients=[realtor],
        lead=lead,
        sale_request=sale_request,
    )


def clear_others(*, lead=None, sale_request=None, keep_user_id=None) -> int:
    """Удалить уведомления об этой заявке у всех, кроме нового владельца."""
    from common.models import CrmNotification

    qs = CrmNotification.objects.filter(lead=lead) if lead is not None else (
        CrmNotification.objects.filter(sale_request=sale_request)
    )
    if keep_user_id:
        qs = qs.exclude(recipient_id=keep_user_id)
    deleted, _ = qs.delete()
    return deleted


def on_lead_owner_changed(lead, previous_owner_id, new_owner, *, by_self: bool) -> None:
    """
    Общая развязка для взятия, возврата и переназначения (Django admin).

    * стал чьим-то → чужие уведомления удаляются; если назначил НЕ сам
      риэлтор — ему «заявка назначена вам»;
    * стал свободным → всем остальным риэлторам «новая заявка».
    """
    if new_owner is not None:
        clear_others(lead=lead, keep_user_id=new_owner.pk)
        if not by_self and new_owner.pk != previous_owner_id:
            notify_assigned(new_owner, lead=lead)
        return
    clear_others(lead=lead)
    from common.models import CrmNotificationType

    _bulk_notify(
        CrmNotificationType.NEW_LEAD,
        recipients=workflow_realtors(needs_view_clients=True).exclude(
            pk=previous_owner_id or 0
        ),
        lead=lead,
    )


def on_sale_request_owner_changed(
    sale_request, previous_owner_id, new_owner, *, by_self: bool
) -> None:
    if new_owner is not None:
        clear_others(sale_request=sale_request, keep_user_id=new_owner.pk)
        if not by_self and new_owner.pk != previous_owner_id:
            notify_assigned(new_owner, sale_request=sale_request)
        return
    clear_others(sale_request=sale_request)
    notify_new_sale_request(sale_request, exclude_user_id=previous_owner_id)


# --------------------------------------------------------------------------
# Взять / вернуть
# --------------------------------------------------------------------------


def take_lead(lead_id: int, user):
    """Атомарно назначить свободный лид на `user`. AlreadyTaken — если опоздал."""
    from leads.choices import LeadActionType
    from leads.models import Lead, LeadActionLog

    with transaction.atomic():
        updated = Lead.objects.filter(pk=lead_id, assigned_realtor__isnull=True).update(
            assigned_realtor=user, updated_at=timezone.now()
        )
        if updated != 1:
            raise AlreadyTaken()
        lead = Lead.objects.get(pk=lead_id)
        LeadActionLog.objects.create(
            lead=lead,
            user=user,
            action_type=LeadActionType.TAKEN,
            description="Заявка взята в работу из общих",
        )
        on_lead_owner_changed(lead, None, user, by_self=True)
    return lead


def return_lead(lead_id: int, user):
    """Вернуть свой лид без объекта в общие."""
    from leads.choices import LeadActionType
    from leads.models import Lead, LeadActionLog

    with transaction.atomic():
        lead = Lead.objects.select_for_update().get(pk=lead_id)
        if lead.assigned_realtor_id != user.pk:
            raise NotOwner()
        if lead.property_id is not None:
            raise NotReturnable()
        updated = Lead.objects.filter(pk=lead_id, assigned_realtor=user).update(
            assigned_realtor=None, updated_at=timezone.now()
        )
        if updated != 1:
            raise NotOwner()
        lead.refresh_from_db()
        LeadActionLog.objects.create(
            lead=lead,
            user=user,
            action_type=LeadActionType.RETURNED,
            description="Заявка возвращена в общие",
        )
        on_lead_owner_changed(lead, user.pk, None, by_self=True)
    return lead


def take_sale_request(sale_request_id: int, user):
    from submissions.models import SaleRequest

    now = timezone.now()
    with transaction.atomic():
        updated = SaleRequest.objects.filter(
            pk=sale_request_id, assigned_realtor__isnull=True
        ).update(assigned_realtor=user, assigned_at=now, assigned_by=user, updated_at=now)
        if updated != 1:
            raise AlreadyTaken()
        sale_request = SaleRequest.objects.get(pk=sale_request_id)
        on_sale_request_owner_changed(sale_request, None, user, by_self=True)
    return sale_request


def return_sale_request(sale_request_id: int, user):
    from submissions.models import SaleRequest

    with transaction.atomic():
        sr = SaleRequest.objects.select_for_update().get(pk=sale_request_id)
        if sr.assigned_realtor_id != user.pk:
            raise NotOwner()
        if sr.converted_property_id is not None:
            raise NotReturnable()
        updated = SaleRequest.objects.filter(
            pk=sale_request_id, assigned_realtor=user
        ).update(
            assigned_realtor=None, assigned_at=None, assigned_by=None,
            updated_at=timezone.now(),
        )
        if updated != 1:
            raise NotOwner()
        sr.refresh_from_db()
        on_sale_request_owner_changed(sr, user.pk, None, by_self=True)
    return sr


# --------------------------------------------------------------------------
# Чтение колокольчика
# --------------------------------------------------------------------------


def bell_queryset(user):
    """Свои уведомления за последние 24 часа. Для не-риэлторов — пусто."""
    from common.models import CrmNotification

    if not is_workflow_realtor(user):
        return CrmNotification.objects.none()
    return CrmNotification.objects.filter(
        recipient=user, created_at__gte=bell_window_start()
    )


def bell_summary(user) -> dict:
    """Часть ответа unread-counts: сколько непрочитанных и id самого свежего."""
    qs = bell_queryset(user).filter(read_at__isnull=True)
    latest = qs.order_by("-id").values_list("id", flat=True).first()
    return {"notifications": qs.count(), "latest_notification_id": latest or 0}


def mark_target_notifications_read(user, *, lead=None, sale_request=None) -> int:
    """Открыл заявку — её уведомления у этого пользователя прочитаны."""
    from common.models import CrmNotification

    if not is_workflow_realtor(user):
        return 0
    qs = CrmNotification.objects.filter(recipient=user, read_at__isnull=True)
    qs = qs.filter(lead=lead) if lead is not None else qs.filter(sale_request=sale_request)
    return qs.update(read_at=timezone.now())


__all__ = [
    "AlreadyTaken",
    "NotOwner",
    "NotReturnable",
    "BELL_WINDOW",
    "RETENTION",
    "BELL_LIST_LIMIT",
    "is_workflow_realtor",
    "workflow_realtors",
    "notify_new_lead",
    "notify_new_sale_request",
    "notify_assigned",
    "run_safely",
    "clear_others",
    "on_lead_owner_changed",
    "on_sale_request_owner_changed",
    "take_lead",
    "return_lead",
    "take_sale_request",
    "return_sale_request",
    "bell_queryset",
    "bell_summary",
    "mark_target_notifications_read",
]
