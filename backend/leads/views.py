import logging
import random
import uuid

from django.core.cache import cache
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import filters, mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import Throttled
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import SimpleRateThrottle
from rest_framework.views import APIView

from leads.choices import LeadActionType, LeadStatus
from leads.models import (
    Lead,
    LeadActionLog,
    LeadComment,
    LeadNote,
    LeadPhoneRevealLog,
    LeadStatusHistory,
)
from leads.serializers import (
    CrmLeadActionLogReadSerializer,
    CrmLeadCommentCreateSerializer,
    CrmLeadCommentReadSerializer,
    CrmLeadDetailSerializer,
    CrmLeadListSerializer,
    CrmLeadNoteCreateSerializer,
    CrmLeadNoteReadSerializer,
    CrmLeadSetStatusSerializer,
    PublicLeadCreateSerializer,
)
from properties.views import PhoneRevealThrottle
from users.permissions import (
    IsCrmLeadStaffOrOwner,
    IsCrmUser,
    crm_lead_queryset_for_user,
    require_crm_capability,
)

logger = logging.getLogger(__name__)


def _crm_lead_status_label(value: str) -> str:
    try:
        return LeadStatus(value).label
    except ValueError:
        return value


class PublicLeadThrottle(SimpleRateThrottle):
    """Ограничение частоты публичной отправки заявок (по IP)."""

    scope = "public_lead"

    def get_rate(self):
        return "10/minute"

    def allow_request(self, request, view):
        if request.method != "POST":
            return True
        return super().allow_request(request, view)

    def get_cache_key(self, request, view):
        ident = self.get_ident(request)
        return self.cache_format % {"scope": self.scope, "ident": ident}


class PublicLeadCaptchaThrottle(SimpleRateThrottle):
    """Ограничение частоты выдачи капчи для публичной формы (по IP)."""

    scope = "public_lead_captcha"

    def get_rate(self):
        return "30/minute"

    def get_cache_key(self, request, view):
        ident = self.get_ident(request)
        return self.cache_format % {"scope": self.scope, "ident": ident}


_CAPTCHA_CACHE_KEY = "lead_captcha:{}"
_CAPTCHA_CACHE_TIMEOUT = 600


class PublicLeadCaptchaView(APIView):
    """Выдача простой арифметической капчи для POST /api/leads/."""

    permission_classes = [AllowAny]
    throttle_classes = [PublicLeadCaptchaThrottle]
    http_method_names = ["get", "head", "options"]

    def throttled(self, request, wait):
        raise Throttled(
            wait=wait,
            detail="Слишком много запросов. Пожалуйста, повторите позже.",
        )

    def get(self, request):
        a = random.randint(1, 9)
        b = random.randint(1, 9)
        answer = a + b
        captcha_id = uuid.uuid4()
        cache.set(
            _CAPTCHA_CACHE_KEY.format(captcha_id),
            answer,
            timeout=_CAPTCHA_CACHE_TIMEOUT,
        )
        return Response(
            {
                "captcha_id": str(captcha_id),
                "question": f"Сколько будет {a} + {b}?",
            }
        )


class PublicLeadViewSet(mixins.CreateModelMixin, viewsets.GenericViewSet):
    """Public website: create a lead (no CRM auth)."""

    permission_classes = [AllowAny]
    serializer_class = PublicLeadCreateSerializer
    throttle_classes = [PublicLeadThrottle]
    http_method_names = ["post", "head", "options"]

    def throttled(self, request, wait):
        raise Throttled(
            wait=wait,
            detail="Слишком много заявок с вашего адреса. Пожалуйста, повторите позже.",
        )

    def get_queryset(self):
        return Lead.objects.none()

    def perform_create(self, serializer):
        prop = serializer.validated_data.get("property")
        agency = prop.agency if prop is not None else None
        # Публичная заявка по объекту: ответственный риэлтор лида = ответственный объекта (если задан).
        assigned_realtor = (
            prop.assigned_realtor if prop is not None else None
        )
        lead = serializer.save(agency=agency, assigned_realtor=assigned_realtor)
        LeadStatusHistory.record(
            lead=lead,
            previous_status=None,
            new_status=lead.status,
            changed_by=None,
        )


class CrmLeadViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = [IsCrmUser, IsCrmLeadStaffOrOwner]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["client_name", "client_phone"]
    ordering_fields = ["created_at", "processed_at", "updated_at"]
    ordering = ["-created_at"]

    def get_queryset(self):
        prefetch = [
            "comments__author_user",
            "status_history__changed_by",
        ]
        if self.action == "retrieve":
            prefetch.append("notes__author")
        qs = (
            crm_lead_queryset_for_user(self.request.user)
            .select_related("property", "assigned_realtor", "agency")
            .prefetch_related(*prefetch)
        )
        st = self.request.query_params.get("status")
        if st:
            qs = qs.filter(status=st)
        src = self.request.query_params.get("source")
        if src:
            qs = qs.filter(source=src)
        assigned_to = self.request.query_params.get("assigned_to")
        if assigned_to:
            qs = qs.filter(assigned_realtor_id=assigned_to)
        return qs

    def get_object(self):
        """
        For DELETE, resolve the lead by primary key across all rows so that
        object-level permissions can return 403 for an inaccessible lead
        (retrieve/list still use the scoped queryset and return 404).
        """
        if self.action == "destroy":
            lookup_url_kwarg = self.lookup_url_kwarg or self.lookup_field
            filter_kwargs = {self.lookup_field: self.kwargs[lookup_url_kwarg]}
            obj = get_object_or_404(Lead.objects.all(), **filter_kwargs)
            self.check_object_permissions(self.request, obj)
            return obj
        return super().get_object()

    def get_serializer_class(self):
        if self.action == "list":
            return CrmLeadListSerializer
        if self.action == "retrieve":
            return CrmLeadDetailSerializer
        if self.action == "set_status":
            return CrmLeadSetStatusSerializer
        if self.action == "add_comment":
            return CrmLeadCommentCreateSerializer
        if self.action == "lead_notes":
            return CrmLeadNoteCreateSerializer
        return CrmLeadDetailSerializer

    def list(self, request, *args, **kwargs):
        require_crm_capability(request, "view_clients")
        return super().list(request, *args, **kwargs)

    def retrieve(self, request, *args, **kwargs):
        require_crm_capability(request, "view_clients")
        return super().retrieve(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        require_crm_capability(request, "delete_clients")
        return super().destroy(request, *args, **kwargs)

    def throttled(self, request, wait):
        raise Throttled(
            wait=wait,
            detail="Слишком много запросов на показ телефона. Пожалуйста, повторите позже.",
        )

    def update(self, request, *args, **kwargs):
        return Response(
            {"detail": "Полное обновление не поддерживается. Используйте PATCH."},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    def partial_update(self, request, *args, **kwargs):
        require_crm_capability(request, "change_status")
        lead = self.get_object()
        ser = CrmLeadSetStatusSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        return self._change_lead_status(request, lead, ser.validated_data["status"])

    def perform_destroy(self, instance):
        logger.info(
            "crm_lead_deleted lead_id=%s user_id=%s",
            instance.pk,
            getattr(self.request.user, "pk", None),
        )
        instance.delete()

    def _change_lead_status(self, request, lead, new_status):
        old_status = lead.status
        if old_status == new_status:
            out = CrmLeadDetailSerializer(lead, context={"request": request})
            return Response(out.data)

        with transaction.atomic():
            lead.status = new_status
            if (
                old_status == LeadStatus.NEW
                and new_status != LeadStatus.NEW
                and lead.processed_at is None
            ):
                lead.processed_at = timezone.now()
            lead.save()
            LeadStatusHistory.record(
                lead=lead,
                previous_status=old_status,
                new_status=new_status,
                changed_by=request.user,
            )
            LeadActionLog.objects.create(
                lead=lead,
                user=request.user,
                action_type=LeadActionType.STATUS_CHANGED,
                description=(
                    f"Статус изменён: {_crm_lead_status_label(old_status)}"
                    f" → {_crm_lead_status_label(new_status)}"
                ),
            )

        logger.info(
            "crm_lead_status_changed lead_id=%s user_id=%s %s -> %s",
            lead.pk,
            getattr(request.user, "pk", None),
            old_status,
            new_status,
        )

        lead.refresh_from_db()
        out = CrmLeadDetailSerializer(lead, context={"request": request})
        return Response(out.data)

    @action(detail=True, methods=["post"], url_path="set-status")
    def set_status(self, request, pk=None):
        require_crm_capability(request, "change_status")
        lead = self.get_object()
        ser = CrmLeadSetStatusSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        return self._change_lead_status(
            request, lead, ser.validated_data["status"]
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="reveal_phone",
        throttle_classes=[PhoneRevealThrottle],
    )
    def reveal_phone(self, request, pk=None):
        require_crm_capability(request, "view_clients")
        lead = self.get_object()
        raw_phone = (lead.client_phone or "").strip()
        if not raw_phone:
            return Response(
                {"detail": "Телефон не указан в заявке."},
                status=status.HTTP_404_NOT_FOUND,
            )
        ip = request.META.get("REMOTE_ADDR")
        ua = request.META.get("HTTP_USER_AGENT", "") or ""
        with transaction.atomic():
            LeadPhoneRevealLog.objects.create(
                lead=lead,
                revealed_by=request.user,
                ip_address=ip,
                user_agent=ua[:8000],
            )
            LeadActionLog.objects.create(
                lead=lead,
                user=request.user,
                action_type=LeadActionType.PHONE_REVEALED,
                description="Риэлтор открыл телефон",
            )
        logger.info(
            "crm_lead_phone_revealed lead_id=%s user_id=%s",
            lead.pk,
            getattr(request.user, "pk", None),
        )
        return Response({"phone": raw_phone})

    @action(detail=True, methods=["post"], url_path="comments")
    def add_comment(self, request, pk=None):
        require_crm_capability(request, "view_clients")
        lead = self.get_object()
        ser = CrmLeadCommentCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        comment = LeadComment.objects.create(
            lead=lead,
            author_user=request.user,
            text=ser.validated_data["text"],
        )
        logger.info(
            "crm_lead_comment_added lead_id=%s user_id=%s comment_id=%s",
            lead.pk,
            getattr(request.user, "pk", None),
            comment.pk,
        )
        comment.refresh_from_db()
        out = CrmLeadCommentReadSerializer(comment, context={"request": request})
        return Response(out.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get", "post"], url_path="notes")
    def lead_notes(self, request, pk=None):
        require_crm_capability(request, "view_clients")
        lead = self.get_object()
        if request.method == "GET":
            qs = lead.notes.select_related("author").order_by("-created_at")
            ser = CrmLeadNoteReadSerializer(
                qs, many=True, context={"request": request}
            )
            return Response(ser.data)
        ser = CrmLeadNoteCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        with transaction.atomic():
            note = LeadNote.objects.create(
                lead=lead,
                author=request.user,
                text=ser.validated_data["text"],
            )
            LeadActionLog.objects.create(
                lead=lead,
                user=request.user,
                action_type=LeadActionType.NOTE_ADDED,
                description="Добавлена внутренняя заметка",
            )
        logger.info(
            "crm_lead_note_added lead_id=%s user_id=%s note_id=%s",
            lead.pk,
            getattr(request.user, "pk", None),
            note.pk,
        )
        note.refresh_from_db()
        out = CrmLeadNoteReadSerializer(note, context={"request": request})
        return Response(out.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path="history")
    def action_history(self, request, pk=None):
        require_crm_capability(request, "view_clients")
        lead = self.get_object()
        qs = lead.action_logs.select_related("user").order_by("-created_at")
        ser = CrmLeadActionLogReadSerializer(
            qs, many=True, context={"request": request}
        )
        return Response(ser.data)
