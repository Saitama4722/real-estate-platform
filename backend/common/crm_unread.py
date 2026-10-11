"""
Непрочитанные заявки в CRM: ОДНО определение «непрочитанного» на весь проект.

⭐ ДВА ПРАВИЛА, КОТОРЫЕ ЗДЕСЬ ЗАКРЕПЛЕНЫ СТРУКТУРНО

1. **Прочтение ПЕРСОНАЛЬНОЕ.** «Непрочитано» = нет строки-квитанции
   (`LeadReadReceipt` / `SaleRequestReadReceipt`) для ЭТОЙ пары
   (объект, пользователь). Никакого общего флага на самой заявке — иначе
   первый открывший погасил бы счётчик всем остальным.

2. **Счётчик считает РОВНО ТО, ЧТО СОТРУДНИК МОЖЕТ ОТКРЫТЬ.** Выборка лидов
   берётся из `crm_lead_queryset_for_user` — той же функции, что отдаёт список.
   Поэтому счётчик и видимость не могут разойтись: если политика доступа к
   лидам когда-нибудь изменится, счётчик поедет за ней сам. Показать бейдж на
   заявку, которая на открытии вернёт 404, — худший из возможных багов такого
   счётчика.

ИНДИКАТОР ТОЛЬКО ДЛЯ РИЭЛТОРОВ (`role=realtor`). Суперадминистратор и
администратор видят весь пул и работают с ним иначе; им счётчик не нужен, а
квитанций они не создают — значит для них «непрочитано» вообще не определено, и
подставлять им сырой подсчёт означало бы вечный бейдж на всём. Для них здесь
везде ноль / False. Если владелец захочет включить роль `admin`, менять надо
только `user_gets_unread_indicator` — одно место.
"""
from django.db.models import Exists, OuterRef, Value
from django.db.models import BooleanField as _BooleanField


def user_gets_unread_indicator(user) -> bool:
    """Единственное определение «кому положен индикатор непрочитанного»."""
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if not getattr(user, "is_active", False):
        return False
    return bool(getattr(user, "is_realtor_role", False))


def unread_lead_count(user) -> int:
    """
    Сколько заявок (лидов) этот риэлтор ещё не открывал.

    Область = `crm_lead_queryset_for_user(user)`, т.е. лиды, назначенные ему.
    ⚠ Лиды БЕЗ ответственного (`assigned_realtor IS NULL` — заявки с главной
    страницы) сюда не попадают, потому что риэлтор их и открыть не может:
    та же выборка отдаёт список и карточку. Это осознанное решение, а не
    потеря — см. отчёт и CLAUDE.md.
    """
    if not user_gets_unread_indicator(user):
        return 0
    from leads.models import LeadReadReceipt
    from users.permissions import crm_lead_queryset_for_user

    read = LeadReadReceipt.objects.filter(user=user, lead=OuterRef("pk"))
    return (
        crm_lead_queryset_for_user(user)
        .filter(~Exists(read))
        .count()
    )


def unread_sale_request_count(user) -> int:
    """
    Сколько заявок на продажу этот риэлтор ещё не открывал.

    Заявки на продажу — ОБЩИЙ ПУЛ (`CrmSaleRequestViewSet`: их видят все), так
    что область здесь — все строки, а личным остаётся только прочтение.
    """
    if not user_gets_unread_indicator(user):
        return 0
    from submissions.models import SaleRequest, SaleRequestReadReceipt

    read = SaleRequestReadReceipt.objects.filter(
        user=user, sale_request=OuterRef("pk")
    )
    return SaleRequest.objects.filter(~Exists(read)).count()


def unread_counts_for_user(user) -> dict:
    """Полезная нагрузка `GET /api/crm/notifications/unread-counts/`."""
    inquiries = unread_lead_count(user)
    sale_requests = unread_sale_request_count(user)
    return {
        "inquiries": inquiries,
        "sale_requests": sale_requests,
        "total": inquiries + sale_requests,
    }


def _annotate_unread(qs, user, receipt_model, outer_field: str):
    """
    Общая часть двух аннотаций ниже.

    Для тех, кому индикатор не положен, подставляется КОНСТАНТА False, а не
    вычисление: иначе суперадмин, который квитанций не создаёт, увидел бы
    «непрочитано» вообще на всём.
    """
    if not user_gets_unread_indicator(user):
        return qs.annotate(
            is_unread=Value(False, output_field=_BooleanField())
        )
    read = receipt_model.objects.filter(
        user=user, **{outer_field: OuterRef("pk")}
    )
    return qs.annotate(is_unread=~Exists(read))


def annotate_lead_unread(qs, user):
    """`is_unread` на каждой строке списка лидов — одним подзапросом, без N+1."""
    from leads.models import LeadReadReceipt

    return _annotate_unread(qs, user, LeadReadReceipt, "lead")


def annotate_sale_request_unread(qs, user):
    """`is_unread` на каждой строке списка заявок на продажу."""
    from submissions.models import SaleRequestReadReceipt

    return _annotate_unread(qs, user, SaleRequestReadReceipt, "sale_request")


def mark_lead_read(user, lead) -> bool:
    """
    Отметить лид прочитанным ЭТИМ пользователем. Идемпотентно.

    Возвращает True, если квитанция появилась именно сейчас. Для сотрудника без
    индикатора — no-op: строка не создаётся, чтобы таблица не набивалась
    записями, которые никто никогда не прочитает.
    """
    if not user_gets_unread_indicator(user):
        return False
    from leads.models import LeadReadReceipt

    _, created = LeadReadReceipt.objects.get_or_create(lead=lead, user=user)
    return created


def mark_sale_request_read(user, sale_request) -> bool:
    """Отметить заявку на продажу прочитанной ЭТИМ пользователем. Идемпотентно."""
    if not user_gets_unread_indicator(user):
        return False
    from submissions.models import SaleRequestReadReceipt

    _, created = SaleRequestReadReceipt.objects.get_or_create(
        sale_request=sale_request, user=user
    )
    return created


__all__ = [
    "user_gets_unread_indicator",
    "unread_lead_count",
    "unread_sale_request_count",
    "unread_counts_for_user",
    "annotate_lead_unread",
    "annotate_sale_request_unread",
    "mark_lead_read",
    "mark_sale_request_read",
]
