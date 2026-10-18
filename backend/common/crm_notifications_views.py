"""
Лёгкие ручки уведомлений CRM: счётчики (опрос каждые 30 секунд) и колокольчик.

`unread-counts/` обязана оставаться ДЕШЁВОЙ: несколько `COUNT(*)` и один id,
никаких данных самих заявок. Список колокольчика (`GET /api/crm/notifications/`)
грузится только при открытии выпадающего меню.
"""
from django.utils import timezone
from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from common.crm_notify import BELL_LIST_LIMIT, bell_queryset
from common.crm_unread import unread_counts_for_user
from common.models import CrmNotification


class CrmUnreadCountsView(APIView):
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


class CrmNotificationListView(APIView):
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


class CrmNotificationMarkReadView(APIView):
    """POST /api/crm/notifications/<id>/mark-read/ — только своё (чужое = 404)."""

    permission_classes = [IsAuthenticated]
    http_method_names = ["post", "options"]

    def post(self, request, pk):
        updated = (
            CrmNotification.objects.filter(pk=pk, recipient=request.user)
            .filter(read_at__isnull=True)
            .update(read_at=timezone.now())
        )
        if not updated and not CrmNotification.objects.filter(
            pk=pk, recipient=request.user
        ).exists():
            return Response({"detail": "Не найдено."}, status=404)
        return Response({"id": pk, "is_read": True})


class CrmNotificationMarkAllReadView(APIView):
    """POST /api/crm/notifications/mark-all-read/ — все свои непрочитанные."""

    permission_classes = [IsAuthenticated]
    http_method_names = ["post", "options"]

    def post(self, request):
        updated = bell_queryset(request.user).filter(read_at__isnull=True).update(
            read_at=timezone.now()
        )
        return Response({"marked": updated})
