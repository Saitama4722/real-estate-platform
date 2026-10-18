"""
Лёгкие ручки уведомлений CRM: счётчики (опрос каждые 30 секунд) и колокольчик.

`unread-counts/` обязана оставаться ДЕШЁВОЙ: несколько `COUNT(*)` и один id,
никаких данных самих заявок. Список колокольчика (`GET /api/crm/notifications/`)
грузится только при открытии выпадающего меню.
"""
from django.utils import timezone
from django.utils.cache import add_never_cache_headers
from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from common.crm_bulk import mark_items_read
from common.crm_notify import BELL_LIST_LIMIT, bell_queryset
from common.crm_unread import unread_counts_for_user
from common.models import CrmNotification


class _NoStoreMixin:
    """
    Every response here is per-user live state: `Cache-Control: no-store`
    (plus no-cache/must-revalidate/max-age=0 from Django's helper), so no
    browser, proxy or framework layer can ever answer the 15 s poll from a
    stale copy. `[measured]` before this, the endpoint sent no Cache-Control
    at all.
    """

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        add_never_cache_headers(response)
        return response


def _mark_targets_read(user, notifications) -> None:
    """
    «Прочитано» в колокольчике = прочитана и САМА заявка (квитанция), иначе
    бейдж в боковом меню и точки в строках остались бы гореть (2026-10-18:
    это и был баг «бейдж не гаснет»). Одно действие гасит оба слоя.
    """
    from leads.models import Lead
    from submissions.models import SaleRequest

    rows = list(notifications.values_list("lead_id", "sale_request_id"))
    lead_ids = {a for a, _ in rows if a}
    sr_ids = {b for _, b in rows if b}
    if lead_ids:
        mark_items_read(user, "lead", Lead.objects.filter(pk__in=lead_ids))
    if sr_ids:
        mark_items_read(user, "sale_request", SaleRequest.objects.filter(pk__in=sr_ids))


class CrmUnreadCountsView(_NoStoreMixin, APIView):
    """
    GET /api/crm/notifications/unread-counts/
    → {"inquiries": 2, "sale_requests": 1, "total": 3,
       "notifications": 4, "latest_notification_id": 917}

    ⚠ Намеренно `IsAuthenticated`, а НЕ `IsCrmUser`: для суперадмина и
    администратора ручка возвращает нули (см. `common.crm_unread`), и это
    честный ответ, а не отказ. Опрос из шапки не должен получать 403 просто
    потому, что вошёл не риэлтор — фронтенд обязан молча получить нули и не
    рисовать бейдж.
    """

    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "head", "options"]

    def get(self, request):
        return Response(unread_counts_for_user(request.user))


class CrmNotificationSerializer(serializers.ModelSerializer):
    """
    Одна строка колокольчика. `title` — имя клиента/собственника, `context` —
    PID объекта, источник или город, `target` — что открыть по клику.
    Телефонов здесь нет и быть не должно.
    """

    type_label = serializers.CharField(source="get_type_display", read_only=True)
    title = serializers.SerializerMethodField()
    context = serializers.SerializerMethodField()
    target = serializers.SerializerMethodField()
    is_read = serializers.SerializerMethodField()

    class Meta:
        model = CrmNotification
        fields = [
            "id", "type", "type_label", "title", "context", "target",
            "is_read", "created_at",
        ]

    def get_title(self, obj):
        if obj.lead_id:
            return (obj.lead.client_name or "").strip() or "Без имени"
        return (obj.sale_request.owner_name or "").strip() or "Без имени"

    def get_context(self, obj):
        if obj.lead_id:
            lead = obj.lead
            prop = lead.property
            if prop is not None and prop.crm_property_id:
                return f"Объект {prop.crm_property_id}"
            if lead.assigned_realtor_id is None:
                return "Свободная · с сайта"
            return lead.get_source_display()
        sr = obj.sale_request
        city = sr.city.name if sr.city_id else ""
        return ", ".join(x for x in (city, (sr.address or "").strip()) if x) or "Заявка на продажу"

    def get_target(self, obj):
        if obj.lead_id:
            return {"kind": "lead", "id": obj.lead_id}
        return {"kind": "sale_request", "id": obj.sale_request_id}

    def get_is_read(self, obj):
        return obj.read_at is not None


class CrmNotificationListView(_NoStoreMixin, APIView):
    """GET /api/crm/notifications/ — свои, за последние 24 часа, новые сверху."""

    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "head", "options"]

    def get(self, request):
        qs = (
            bell_queryset(request.user)
            .select_related("lead__property", "sale_request__city")
            .order_by("-created_at", "-id")[:BELL_LIST_LIMIT]
        )
        return Response(
            {"results": CrmNotificationSerializer(qs, many=True).data}
        )


class CrmNotificationMarkReadView(_NoStoreMixin, APIView):
    """
    POST /api/crm/notifications/<id>/mark-read/ — только своё (чужое = 404).
    Заодно ставит квитанцию прочтения на саму заявку.
    """

    permission_classes = [IsAuthenticated]
    http_method_names = ["post", "options"]

    def post(self, request, pk):
        mine = CrmNotification.objects.filter(pk=pk, recipient=request.user)
        if not mine.exists():
            return Response({"detail": "Не найдено."}, status=404)
        mine.filter(read_at__isnull=True).update(read_at=timezone.now())
        _mark_targets_read(request.user, mine)
        return Response({"id": pk, "is_read": True})


class CrmNotificationMarkAllReadView(_NoStoreMixin, APIView):
    """
    POST /api/crm/notifications/mark-all-read/ — все свои непрочитанные за 24 ч
    И их заявки (квитанции): после «Прочитать все» гаснут и колокольчик, и
    бейдж в боковом меню, и точки в строках.
    """

    permission_classes = [IsAuthenticated]
    http_method_names = ["post", "options"]

    def post(self, request):
        unread = bell_queryset(request.user).filter(read_at__isnull=True)
        targets = list(unread.values_list("id", flat=True))
        updated = unread.update(read_at=timezone.now())
        _mark_targets_read(request.user, CrmNotification.objects.filter(pk__in=targets))
        return Response({"marked": updated})
