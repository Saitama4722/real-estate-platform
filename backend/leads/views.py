import logging
import random
import uuid

from django.core.cache import cache
from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import filters, mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, Throttled
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import SimpleRateThrottle
from rest_framework.views import APIView

from common import crm_notify
from common.crm_unread import annotate_lead_unread, mark_lead_read
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


#: Ответ на любое действие со свободной заявкой, кроме просмотра и «взять».
FREE_LEAD_DETAIL = "Сначала возьмите заявку в работу."


class CrmLeadSearchFilter(filters.SearchFilter):
    """
    Поиск по имени — везде; поиск по ТЕЛЕФОНУ для риэлтора — только среди его
    собственных лидов. Иначе свободную очередь можно было бы использовать как
    оракул «есть ли у нас такой номер», обходя маску телефона.
    """

    def filter_queryset(self, request, queryset, view):
        user = request.user
        if getattr(user, "has_staff_level_access", False):
            return super().filter_queryset(request, queryset, view)
        terms = self.get_search_terms(request)
        if not terms:
            return queryset
        for term in terms:
            queryset = queryset.filter(
                Q(client_name__icontains=term)
                | Q(client_phone__icontains=term, assigned_realtor=user)
            )
        return queryset


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
        # Публичная заявка по объекту: ответственный риэлтор лида = ответственный
        # объекта (если задан). Заявка со страницы риэлтора (без объекта): берём
        # риэлтора, переданного через assigned_realtor_crm_id (уже резолвлен в
        # объект User валидатором сериализатора).
        if prop is not None:
            assigned_realtor = prop.assigned_realtor
        else:
            assigned_realtor = serializer.validated_data.get(
                "assigned_realtor_crm_id"
            )
        lead = serializer.save(agency=agency, assigned_realtor=assigned_realtor)
        LeadStatusHistory.record(
            lead=lead,
            previous_status=None,
            new_status=lead.status,
            changed_by=None,
        )
        # Notify the Telegram group — only after the DB transaction commits, so
        # the task never runs against a rolled-back lead. A failed send is
        # swallowed inside the task and never affects lead creation.
        from leads.tasks import send_lead_telegram_notification

        lead_id = lead.pk
        transaction.on_commit(
            lambda: send_lead_telegram_notification.delay(lead_id)
        )
        # Колокольчик CRM — тоже после коммита. Свободная заявка уходит всем
        # активным риэлторам, заявка по объекту/риэлтору — только ему.
        transaction.on_commit(
            lambda: crm_notify.run_safely(crm_notify.notify_new_lead, lead)
        )


class CrmLeadViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = [IsCrmUser, IsCrmLeadStaffOrOwner]
    filter_backends = [CrmLeadSearchFilter, filters.OrderingFilter]
    search_fields = ["client_name", "client_phone"]
    ordering_fields = ["created_at", "processed_at", "updated_at"]
    ordering = ["-created_at"]

    def get_queryset(self):
        # Each of these ends in `__realtor_profile` for the same reason as the
        # select_related block below: the nested serializers render the author /
        # editor through `RealtorShortSerializer`, whose `is_public` reads that
        # reverse OneToOne. Prefetching it keeps the cost flat instead of one
        # query per comment author.
        prefetch = [
            "comments__author_user__realtor_profile",
            "status_history__changed_by__realtor_profile",
        ]
        if self.action == "retrieve":
            prefetch.append("notes__author__realtor_profile")
        # `is_unread` — ОДИН коррелированный подзапрос NOT EXISTS на всю
        # выборку, а не запрос на строку. Для не-риэлторов это константа False
        # (см. common.crm_unread), поэтому суперадмин не видит «непрочитано» на
        # всём подряд.
        qs = annotate_lead_unread(
            crm_lead_queryset_for_user(self.request.user)
            .select_related(
                "property",
                "assigned_realtor",
                "agency",
                # ⭐ EVERY `realtor_profile` HOP BELOW IS AN N+1 FIX, NOT TIDINESS.
                # `RealtorShortSerializer.is_public` calls
                # `realtor_profile_is_public()`, which reads the reverse OneToOne
                # `User.realtor_profile`. Without these it is ONE query PER ROW
                # per realtor field. Measured on this endpoint: 14 rows cost 62
                # queries before, 8 after.
                #
                # ⚠ The fix lives HERE, in the view, not in the serializer —
                # `PropertyViewSet` and `CrmPropertyViewSet` already do exactly
                # this, so each surface states its own query shape and none of
                # them can be changed by an edit to a shared serializer.
                "assigned_realtor__realtor_profile",
                # `CrmLeadListSerializer.property` nests
                # `CrmPropertyListSerializer`, which serialises the property's
                # city/district/agency/owner AND two more realtor fields — so a
                # lead that HAS a property costs those too.
                "property__city",
                "property__district",
                "property__agency",
                "property__owner",
                "property__created_by",
                "property__created_by__realtor_profile",
                "property__assigned_realtor",
                "property__assigned_realtor__realtor_profile",
            )
            .prefetch_related(*prefetch),
            self.request.user,
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
        # «Свободные / Мои / Все доступные». Для сотрудника «mine» = назначенные
        # на него (обычно пусто — суперадмин в процессе не участвует).
        scope = self.request.query_params.get("scope")
        if scope == "free":
            qs = qs.filter(assigned_realtor__isnull=True)
        elif scope == "mine":
            qs = qs.filter(assigned_realtor=self.request.user)
        return qs

    def _require_owned(self, lead):
        """
        Свободная заявка для риэлтора — только посмотреть и взять. Сотрудники
        (суперадмин/админ) сохраняют прежние права над любой заявкой.
        """
        user = self.request.user
        if getattr(user, "has_staff_level_access", False):
            return
        if lead.assigned_realtor_id != user.pk:
            raise PermissionDenied(detail=FREE_LEAD_DETAIL)

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
            # A realtor may delete only their own leads, never the free queue.
            self._require_owned(obj)
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
        self._require_owned(lead)
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
        self._require_owned(lead)
        ser = CrmLeadSetStatusSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        return self._change_lead_status(
            request, lead, ser.validated_data["status"]
        )

    @action(detail=True, methods=["post"], url_path="take")
    def take(self, request, pk=None):
        """
        «Взять в работу»: атомарно назначить свободную заявку на себя.

        409 «Заявку уже взял другой риэлтор», если кто-то успел раньше. Только
        для риэлторов: суперадмин и админ в процессе не участвуют.
        """
        require_crm_capability(request, "view_clients")
        if not crm_notify.is_workflow_realtor(request.user):
            raise PermissionDenied(detail="Брать заявки в работу могут только риэлторы.")
        # NOT get_object(): once the other realtor has taken it, the lead has
        # left this user's queryset, and the loser of the race must see «уже
        # взял», not a 404.
        lead = get_object_or_404(Lead.objects.all(), pk=pk)
        if lead.assigned_realtor_id == request.user.pk:
            return Response(CrmLeadDetailSerializer(lead, context={"request": request}).data)
        if lead.assigned_realtor_id is not None:
            return Response(
                {"detail": "Заявку уже взял другой риэлтор."},
                status=status.HTTP_409_CONFLICT,
            )
        try:
            lead = crm_notify.take_lead(lead.pk, request.user)
        except crm_notify.AlreadyTaken:
            return Response(
                {"detail": "Заявку уже взял другой риэлтор."},
                status=status.HTTP_409_CONFLICT,
            )
        logger.info("crm_lead_taken lead_id=%s user_id=%s", lead.pk, request.user.pk)
        return Response(CrmLeadDetailSerializer(lead, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="return")
    def return_to_queue(self, request, pk=None):
        """«Вернуть в общие» — свою заявку без объекта. Остальным уйдёт уведомление."""
        require_crm_capability(request, "view_clients")
        if not crm_notify.is_workflow_realtor(request.user):
            raise PermissionDenied(detail="Возвращать заявки могут только риэлторы.")
        lead = self.get_object()
        try:
            lead = crm_notify.return_lead(lead.pk, request.user)
        except crm_notify.NotOwner:
            raise PermissionDenied(detail="Вернуть в общие может только ответственный риэлтор.")
        except crm_notify.NotReturnable:
            return Response(
                {"detail": "Заявка по объекту остаётся у риэлтора этого объекта."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        logger.info("crm_lead_returned lead_id=%s user_id=%s", lead.pk, request.user.pk)
        return Response(CrmLeadDetailSerializer(lead, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="mark-read")
    def mark_read(self, request, pk=None):
        """
        Отметить ЭТУ заявку прочитанной ТЕКУЩИМ сотрудником.

        ⛔ Вызывается ТОЛЬКО при открытии карточки лида, никогда при загрузке
        списка. Открытие списка, гасящее все счётчики, обессмысливает сам
        счётчик — ради этого метод сделан отдельным POST, а не побочным
        эффектом GET.

        Идемпотентно: повторный вызов возвращает 200 и `created=false`.
        """
        require_crm_capability(request, "view_clients")
        lead = self.get_object()
        created = mark_lead_read(request.user, lead)
        return Response({"id": lead.pk, "is_unread": False, "created": created})

    @action(
        detail=True,
        methods=["post"],
        url_path="reveal_phone",
        throttle_classes=[PhoneRevealThrottle],
    )
    def reveal_phone(self, request, pk=None):
        require_crm_capability(request, "view_clients")
        lead = self.get_object()
        self._require_owned(lead)
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
        self._require_owned(lead)
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
            # `author__realtor_profile`: CrmLeadNoteReadSerializer renders the
            # author via RealtorShortSerializer — see the get_queryset note.
            qs = lead.notes.select_related("author__realtor_profile").order_by(
                "-created_at"
            )
            ser = CrmLeadNoteReadSerializer(
                qs, many=True, context={"request": request}
            )
            return Response(ser.data)
        self._require_owned(lead)
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
        # `user__realtor_profile`: CrmLeadActionLogReadSerializer renders the
        # actor via RealtorShortSerializer — see the get_queryset note.
        qs = lead.action_logs.select_related("user__realtor_profile").order_by(
            "-created_at"
        )
        ser = CrmLeadActionLogReadSerializer(
            qs, many=True, context={"request": request}
        )
        return Response(ser.data)
