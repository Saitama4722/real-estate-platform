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

from common.crm_unread import annotate_sale_request_unread, mark_sale_request_read
from users.permissions import IsCrmUser

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
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """
    CRM management of sell-your-property submissions.

    SHARED POOL: every CRM user (realtor / admin / superadmin) sees ALL
    submissions — not a per-realtor assigned subset (unlike Lead/Property).

    DELETE: admin/superadmin only (staff-level). Realtors may view, edit the
    description/details, and convert — but NOT delete.
    """

    permission_classes = [IsCrmUser]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["owner_name", "owner_phone", "description"]
    ordering_fields = ["created_at", "updated_at", "status"]
    ordering = ["-created_at"]

    def get_queryset(self):
        # Shared pool: all submissions for any CRM user. No assigned-realtor filter.
        # `is_unread` is PER VIEWER (one NOT EXISTS subquery, not a column on the
        # row) precisely because the pool is shared: one realtor opening a
        # submission must not clear it from anyone else's counter.
        qs = annotate_sale_request_unread(
            SaleRequest.objects.select_related(
                "city", "district", "neighborhood", "converted_property"
            ).prefetch_related("photos"),
            self.request.user,
        )
        st = self.request.query_params.get("status")
        if st:
            qs = qs.filter(status=st)
        return qs

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
