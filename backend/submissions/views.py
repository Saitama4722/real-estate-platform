import logging
import os

from django.core.files.base import ContentFile
from django.db import transaction
from django.utils import timezone
from rest_framework import filters, mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, Throttled
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import SimpleRateThrottle

from common import crm_notify
from common.crm_bulk import CrmBulkActionsMixin, hidden_ids
from common.crm_unread import annotate_sale_request_unread, mark_sale_request_read
from users.permissions import IsCrmUser, crm_sale_request_queryset_for_user

#: Ответ на любое действие со свободной заявкой, кроме просмотра и «взять».
FREE_SALE_REQUEST_DETAIL = "Сначала возьмите заявку в работу."


class CrmSaleRequestSearchFilter(filters.SearchFilter):
    """
    Phone search for staff only. For a realtor it would turn the free queue
    into an oracle around the masked owner phone, so realtors search by name
    and description (`search_fields` on the view).
    """

    def get_search_fields(self, view, request):
        if getattr(request.user, "has_staff_level_access", False):
            return ["owner_name", "owner_phone", "description"]
        return super().get_search_fields(view, request)

from .choices import SaleRequestStatus
from .models import SaleRequest
from .serializers import (
    CrmSaleRequestDetailSerializer,
    CrmSaleRequestListSerializer,
    CrmSaleRequestUpdateSerializer,
    PublicSaleRequestCreateSerializer,
)

logger = logging.getLogger(__name__)


class PublicSaleRequestThrottle(SimpleRateThrottle):
    """Rate-limit public sell-your-property submissions by IP (mirrors PublicLeadThrottle)."""

    scope = "public_sale_request"

    def get_rate(self):
        return "10/minute"

    def allow_request(self, request, view):
        if request.method != "POST":
            return True
        return super().allow_request(request, view)

    def get_cache_key(self, request, view):
        ident = self.get_ident(request)
        return self.cache_format % {"scope": self.scope, "ident": ident}


class PublicSaleRequestViewSet(mixins.CreateModelMixin, viewsets.GenericViewSet):
    """
    Public endpoint: create a SaleRequest ("Продать недвижимость").

    POST ONLY. There is deliberately NO list/retrieve here — this data must never
    be publicly readable. The response is a minimal confirmation and NEVER echoes
    owner_phone.
    """

    permission_classes = [AllowAny]
    serializer_class = PublicSaleRequestCreateSerializer
    throttle_classes = [PublicSaleRequestThrottle]
    parser_classes = [MultiPartParser, FormParser]
    http_method_names = ["post", "head", "options"]

    def get_queryset(self):
        return SaleRequest.objects.none()

    def throttled(self, request, wait):
        raise Throttled(
            wait=wait,
            detail="Слишком много заявок с вашего адреса. Пожалуйста, повторите позже.",
        )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        sale_request = serializer.save()
        logger.info("sale_request_created id=%s", sale_request.pk)
        # A new sale request starts FREE: every active realtor gets a bell entry.
        transaction.on_commit(
            lambda: crm_notify.run_safely(crm_notify.notify_new_sale_request, sale_request)
        )
        # Minimal confirmation only — do NOT serialize the object back (that would
        # risk leaking fields). Owner phone is never returned.
        return Response(
            {
                "id": sale_request.pk,
                "status": sale_request.status,
                "detail": "Заявка принята.",
            },
            status=status.HTTP_201_CREATED,
        )


class CrmSaleRequestViewSet(
    CrmBulkActionsMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """
    CRM management of sell-your-property submissions.

    QUEUE (2026-10-18, replaced the old «shared pool forever»): a realtor sees
    their own submissions plus the FREE ones (`assigned_realtor IS NULL`). A
    free one is look-only with a masked owner phone until «Взять в работу»;
    after that the other realtors no longer see it. Staff (admin/superadmin)
    see everything and keep their previous abilities, but never take or get
    notified (`common.crm_notify`).

    DELETE: admin/superadmin only (staff-level). Realtors may view, edit the
    description/details, and convert their own — but NOT delete.
    """

    permission_classes = [IsCrmUser]
    filter_backends = [CrmSaleRequestSearchFilter, filters.OrderingFilter]
    search_fields = ["owner_name", "description"]
    ordering_fields = ["created_at", "updated_at", "status"]
    ordering = ["-created_at"]

    def get_queryset(self):
        # `is_unread` is PER VIEWER (one NOT EXISTS subquery, not a column on
        # the row): one realtor opening a free submission must not clear it
        # from anyone else's counter.
        qs = annotate_sale_request_unread(
            crm_sale_request_queryset_for_user(self.request.user)
            .select_related(
                "city", "district", "neighborhood", "converted_property",
                "assigned_realtor",
            )
            .prefetch_related("photos"),
            self.request.user,
        )
        st = self.request.query_params.get("status")
        if st:
            qs = qs.filter(status=st)
        scope = self.request.query_params.get("scope")
        # Personal archive («Скрыть»): list and bulk only; the detail page and
        # actions still see hidden ones, otherwise nothing could be restored.
        if self.action == "list" or (self.action or "").startswith("bulk_"):
            hidden = hidden_ids(self.request.user, "sale_request")
            qs = qs.filter(pk__in=hidden) if scope == "archive" else qs.exclude(pk__in=hidden)
        if scope == "free":
            qs = qs.filter(assigned_realtor__isnull=True)
        elif scope == "mine":
            qs = qs.filter(assigned_realtor=self.request.user)
        return qs

    # --- bulk actions (common.crm_bulk) -----------------------------------
    bulk_kind = "sale_request"
    bulk_label = "заявок на продажу"

    def bulk_access_queryset(self):
        return crm_sale_request_queryset_for_user(self.request.user)

    @action(detail=False, methods=["post"], url_path="bulk-mark-read")
    def bulk_mark_read_action(self, request):
        return self.bulk_mark_read(request)

    @action(detail=False, methods=["post"], url_path="bulk-hide")
    def bulk_hide_action(self, request):
        return self.bulk_hide(request)

    @action(detail=False, methods=["post"], url_path="bulk-unhide")
    def bulk_unhide_action(self, request):
        return self.bulk_unhide(request)

    @action(detail=False, methods=["post"], url_path="bulk-delete")
    def bulk_delete_action(self, request):
        return self.bulk_delete(request)

    def _require_owned(self, sale_request):
        user = self.request.user
        if getattr(user, "has_staff_level_access", False):
            return
        if sale_request.assigned_realtor_id != user.pk:
            raise PermissionDenied(detail=FREE_SALE_REQUEST_DETAIL)

    @action(detail=True, methods=["post"], url_path="take")
    def take(self, request, pk=None):
        """«Взять в работу». 409 «Заявку уже взял другой риэлтор», если опоздал."""
        if not crm_notify.is_workflow_realtor(request.user):
            raise PermissionDenied(detail="Брать заявки в работу могут только риэлторы.")
        # Not get_object(): a request taken by someone else has left this
        # realtor's queryset, and the loser of the race must see «уже взял».
        sr = SaleRequest.objects.filter(pk=pk).first()
        if sr is None:
            return Response({"detail": "Не найдено."}, status=status.HTTP_404_NOT_FOUND)
        if sr.assigned_realtor_id not in (None, request.user.pk):
            return Response(
                {"detail": "Заявку уже взял другой риэлтор."},
                status=status.HTTP_409_CONFLICT,
            )
        if sr.assigned_realtor_id is None:
            try:
                crm_notify.take_sale_request(sr.pk, request.user)
            except crm_notify.AlreadyTaken:
                return Response(
                    {"detail": "Заявку уже взял другой риэлтор."},
                    status=status.HTTP_409_CONFLICT,
                )
            logger.info("sale_request_taken id=%s user_id=%s", sr.pk, request.user.pk)
        return Response(
            CrmSaleRequestDetailSerializer(
                self.get_object(), context=self.get_serializer_context()
            ).data
        )

    @action(detail=True, methods=["post"], url_path="return")
    def return_to_queue(self, request, pk=None):
        """«Вернуть в общие» — свою, ещё не превращённую в объект."""
        if not crm_notify.is_workflow_realtor(request.user):
            raise PermissionDenied(detail="Возвращать заявки могут только риэлторы.")
        sr = self.get_object()
        try:
            crm_notify.return_sale_request(sr.pk, request.user)
        except crm_notify.NotOwner:
            raise PermissionDenied(detail="Вернуть в общие может только ответственный риэлтор.")
        except crm_notify.NotReturnable:
            return Response(
                {"detail": "По заявке уже создан объект — она остаётся у вас."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        logger.info("sale_request_returned id=%s user_id=%s", sr.pk, request.user.pk)
        return Response(
            CrmSaleRequestDetailSerializer(
                self.get_object(), context=self.get_serializer_context()
            ).data
        )

    def get_serializer_class(self):
        if self.action == "list":
            return CrmSaleRequestListSerializer
        if self.action in ("update", "partial_update"):
            return CrmSaleRequestUpdateSerializer
        return CrmSaleRequestDetailSerializer

    def update(self, request, *args, **kwargs):
        return Response(
            {"detail": "Полное обновление не поддерживается. Используйте PATCH."},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        self._require_owned(instance)
        ser = self.get_serializer(instance, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        logger.info(
            "sale_request_updated id=%s user_id=%s",
            instance.pk,
            getattr(request.user, "pk", None),
        )
        out = CrmSaleRequestDetailSerializer(
            self.get_object(), context=self.get_serializer_context()
        )
        return Response(out.data)

    def destroy(self, request, *args, **kwargs):
        # ADMIN-ONLY delete. Realtors get 403 (mirrors the staff-only gate used
        # elsewhere, e.g. IsCrmStaffManager / has_staff_level_access).
        user = request.user
        if not getattr(user, "has_staff_level_access", False):
            raise PermissionDenied(
                detail="Удаление заявок на продажу доступно только администратору."
            )
        instance = self.get_object()
        logger.info(
            "sale_request_deleted id=%s user_id=%s",
            instance.pk,
            getattr(user, "pk", None),
        )
        instance.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], url_path="mark-read")
    def mark_read(self, request, pk=None):
        """
        Отметить ЭТУ заявку на продажу прочитанной ТЕКУЩИМ сотрудником.

        ⛔ Вызывается ТОЛЬКО при открытии карточки заявки, никогда при загрузке
        списка. Прочтение персональное: другие риэлторы своих счётчиков не
        теряют.

        Идемпотентно: повторный вызов возвращает 200 и `created=false`.
        """
        sale_request = self.get_object()
        created = mark_sale_request_read(request.user, sale_request)
        return Response(
            {"id": sale_request.pk, "is_unread": False, "created": created}
        )

    @staticmethod
    def _copy_photos_to_property(sale_request, prop) -> int:
        """COPY the owner's photos onto the new Property. Never move, never link.

        ⚠ EACH PropertyPhoto GETS ITS OWN FILE. Pointing a PropertyPhoto at the
        submission's stored path would look tidy and is a trap: deleting the
        property (or clearing its derivatives on re-save) deletes from storage,
        and this project has already lost a real listing's derivatives exactly
        that way. A copy means the submission's files can never be reached by
        anything acting on the property.

        Done SERVER-SIDE on purpose. The previous mechanism made the BROWSER
        download every photo and re-upload it: megabytes through the client, and
        under the R2 backend the media URL is cross-origin, so `fetch` would be
        blocked by CORS and the photos would be silently dropped — the old code
        swallowed per-photo failures. Reading the file through the storage API
        works under every backend.

        Derivatives are NOT generated here: `PropertyPhoto.save()` enqueues
        `generate_property_photo_derivatives` on commit whenever `original_file`
        changes, which is exactly what creating one of these does.
        """
        from properties.models import PropertyPhoto

        # Idempotent: re-marking an already-converted submission must not
        # duplicate the photos.
        if PropertyPhoto.objects.filter(property=prop).exists():
            return 0

        start = 0
        copied = 0
        for src in sale_request.photos.all().order_by("sort_order", "id"):
            if not src.image:
                continue
            try:
                src.image.open("rb")
                try:
                    data = src.image.read()
                finally:
                    src.image.close()
            except (OSError, ValueError) as exc:
                # One unreadable source file must not lose the others, and must
                # never fail the conversion the realtor just completed.
                logger.warning(
                    "sale_request_photo_copy_failed sale_request_id=%s photo_id=%s err=%s",
                    sale_request.pk, src.pk, exc,
                )
                continue
            base = os.path.basename(src.image.name) or "photo.jpg"
            photo = PropertyPhoto(property=prop, sort_order=start + copied)
            photo.original_file.save(
                f"sr{sale_request.pk}-{src.pk}-{base}", ContentFile(data), save=False
            )
            photo.save()
            copied += 1
        return copied

    @action(detail=True, methods=["post"], url_path="mark-converted")
    def mark_converted(self, request, pk=None):
        """
        Mark a submission converted and link it to the resulting Property.

        Called by the frontend right after it creates the Property from this
        submission's prefilled data. Body: {"property_id": <int>}. Idempotent-ish:
        re-marking updates the link. Available to any CRM user (a realtor who can
        create a property can mark the source submission converted).
        """
        sale_request = self.get_object()
        self._require_owned(sale_request)
        property_id = request.data.get("property_id")
        if not property_id:
            return Response(
                {"detail": "Не передан property_id."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from properties.models import Property

        prop = Property.objects.filter(pk=property_id).first()
        if prop is None:
            return Response(
                {"detail": "Объект не найден."}, status=status.HTTP_404_NOT_FOUND
            )

        with transaction.atomic():
            sale_request.converted_property = prop
            sale_request.converted_at = timezone.now()
            sale_request.converted_by = request.user
            sale_request.status = SaleRequestStatus.CONVERTED
            sale_request.save(
                update_fields=[
                    "converted_property",
                    "converted_at",
                    "converted_by",
                    "status",
                    "updated_at",
                ]
            )
            copied = self._copy_photos_to_property(sale_request, prop)
        logger.info(
            "sale_request_marked_converted id=%s property_id=%s user_id=%s photos_copied=%s",
            sale_request.pk,
            prop.pk,
            getattr(request.user, "pk", None),
            copied,
        )
        out = CrmSaleRequestDetailSerializer(
            sale_request, context=self.get_serializer_context()
        )
        data = dict(out.data)
        data["photos_copied"] = copied
        return Response(data)
