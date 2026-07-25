import logging

from django.db import transaction
from django.utils import timezone
from rest_framework import filters, mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, Throttled
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import SimpleRateThrottle

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
        qs = SaleRequest.objects.select_related(
            "city", "district", "neighborhood", "converted_property"
        ).prefetch_related("photos")
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
        logger.info(
            "sale_request_marked_converted id=%s property_id=%s user_id=%s",
            sale_request.pk,
            prop.pk,
            getattr(request.user, "pk", None),
        )
        out = CrmSaleRequestDetailSerializer(
            sale_request, context=self.get_serializer_context()
        )
        return Response(out.data)
