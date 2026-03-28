from django.db import transaction
from django.db.models import Max
from django.shortcuts import get_object_or_404
from rest_framework import filters, mixins, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.viewsets import ReadOnlyModelViewSet

from properties.choices import PropertyStatus
from properties.crm_publication import (
    apply_crm_archive,
    apply_crm_publish,
    apply_crm_to_draft,
)
from properties.models import Property, PropertyPhoto, PropertyVideo
from properties.serializers import (
    CrmPropertyDetailSerializer,
    CrmPropertyListSerializer,
    CrmPropertyPhotoReorderSerializer,
    CrmPropertyPhotoSerializer,
    CrmPropertyPhotoSetMainSerializer,
    CrmPropertyPhotoUploadSerializer,
    CrmPropertyVideoSerializer,
    CrmPropertyVideoWriteSerializer,
    CrmPropertyWriteSerializer,
    PropertyDetailSerializer,
    PropertyListSerializer,
)
from users.permissions import (
    IsCrmPropertyStaffOrOwner,
    IsCrmUser,
    crm_property_queryset_for_user,
)


class PropertyViewSet(ReadOnlyModelViewSet):
    permission_classes = [AllowAny]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["title_generated", "public_address_text"]
    ordering_fields = ["published_at", "price"]
    ordering = ["-published_at"]

    def get_queryset(self):
        qs = Property.objects.filter(
            status=PropertyStatus.PUBLISHED,
            is_published=True,
        ).select_related(
            "city", "district", "neighborhood", "residential_complex", "assigned_realtor"
        )

        property_type = self.request.query_params.get("property_type")
        if property_type:
            qs = qs.filter(property_type=property_type)

        deal_type = self.request.query_params.get("deal_type")
        if deal_type:
            qs = qs.filter(deal_type=deal_type)

        city = self.request.query_params.get("city")
        if city:
            qs = qs.filter(city=city)

        district = self.request.query_params.get("district")
        if district:
            qs = qs.filter(district=district)

        return qs

    def get_serializer_class(self):
        if self.action == "retrieve":
            return PropertyDetailSerializer
        return PropertyListSerializer


class CrmPropertyViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    """
    Internal CRM CRUD for properties (no DELETE).
    Publication workflow: POST .../publish/, .../to_draft/, .../archive/.
    """

    permission_classes = [IsCrmUser, IsCrmPropertyStaffOrOwner]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["title_generated", "public_address_text"]
    ordering_fields = ["created_at", "updated_at", "price", "published_at"]
    ordering = ["-created_at"]

    def get_queryset(self):
        qs = crm_property_queryset_for_user(self.request.user).select_related(
            "city",
            "district",
            "neighborhood",
            "residential_complex",
            "assigned_realtor",
            "created_by",
            "agency",
        )

        status = self.request.query_params.get("status")
        if status:
            qs = qs.filter(status=status)

        property_type = self.request.query_params.get("property_type")
        if property_type:
            qs = qs.filter(property_type=property_type)

        deal_type = self.request.query_params.get("deal_type")
        if deal_type:
            qs = qs.filter(deal_type=deal_type)

        city = self.request.query_params.get("city")
        if city:
            qs = qs.filter(city=city)

        district = self.request.query_params.get("district")
        if district:
            qs = qs.filter(district=district)

        is_published = self.request.query_params.get("is_published")
        if is_published is not None and is_published != "":
            v = str(is_published).lower()
            if v in ("1", "true", "yes"):
                qs = qs.filter(is_published=True)
            elif v in ("0", "false", "no"):
                qs = qs.filter(is_published=False)

        return qs

    def get_serializer_class(self):
        if self.action == "list":
            return CrmPropertyListSerializer
        if self.action == "retrieve":
            return CrmPropertyDetailSerializer
        if self.action in ("archive", "publish", "to_draft"):
            return CrmPropertyDetailSerializer
        return CrmPropertyWriteSerializer

    @action(detail=True, methods=["post"], url_path="publish")
    def publish(self, request, pk=None):
        prop = self.get_object()
        apply_crm_publish(prop)
        prop.save()
        serializer = CrmPropertyDetailSerializer(prop, context={"request": request})
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="to_draft")
    def to_draft(self, request, pk=None):
        prop = self.get_object()
        apply_crm_to_draft(prop)
        prop.save()
        serializer = CrmPropertyDetailSerializer(prop, context={"request": request})
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="archive")
    def archive(self, request, pk=None):
        prop = self.get_object()
        apply_crm_archive(prop)
        prop.save()
        serializer = CrmPropertyDetailSerializer(prop, context={"request": request})
        return Response(serializer.data)


class CrmPropertyPhotoViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """
    CRM: upload, list, delete, reorder, and set main photo for a property.
    Nested under /api/crm/properties/<property_pk>/photos/.
    """

    permission_classes = [IsCrmUser, IsCrmPropertyStaffOrOwner]
    lookup_field = "pk"
    http_method_names = ["get", "post", "delete", "head", "options"]

    def get_queryset(self):
        property_pk = self.kwargs["property_pk"]
        allowed = crm_property_queryset_for_user(self.request.user)
        if not allowed.filter(pk=property_pk).exists():
            return PropertyPhoto.objects.none()
        return PropertyPhoto.objects.filter(property_id=property_pk).order_by(
            "sort_order", "id"
        )

    def get_serializer_class(self):
        if self.action == "create":
            return CrmPropertyPhotoUploadSerializer
        return CrmPropertyPhotoSerializer

    def _property(self):
        return get_object_or_404(
            crm_property_queryset_for_user(self.request.user),
            pk=self.kwargs["property_pk"],
        )

    def perform_create(self, serializer):
        prop = self._property()
        is_main = serializer.validated_data.get("is_main", False)
        extra = {}
        if "sort_order" not in serializer.validated_data:
            current_max = (
                PropertyPhoto.objects.filter(property=prop).aggregate(
                    m=Max("sort_order")
                )["m"]
            )
            extra["sort_order"] = (current_max if current_max is not None else -1) + 1
        with transaction.atomic():
            if is_main:
                PropertyPhoto.objects.filter(property=prop).update(is_main=False)
            serializer.save(property=prop, **extra)

    def reorder(self, request, property_pk=None):
        prop = get_object_or_404(
            crm_property_queryset_for_user(request.user), pk=property_pk
        )
        ser = CrmPropertyPhotoReorderSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        items = ser.validated_data["items"]
        id_to_order = {row["id"]: row["sort_order"] for row in items}
        photos = list(
            PropertyPhoto.objects.filter(property=prop, pk__in=id_to_order.keys())
        )
        if len(photos) != len(id_to_order):
            raise ValidationError(
                {"items": "Один или несколько id не принадлежат этому объекту."}
            )
        for p in photos:
            p.sort_order = id_to_order[p.pk]
        PropertyPhoto.objects.bulk_update(photos, ["sort_order"])
        qs = PropertyPhoto.objects.filter(property=prop).order_by("sort_order", "id")
        out = CrmPropertyPhotoSerializer(qs, many=True, context={"request": request})
        return Response(out.data)

    def set_main(self, request, property_pk=None):
        prop = get_object_or_404(
            crm_property_queryset_for_user(request.user), pk=property_pk
        )
        ser = CrmPropertyPhotoSetMainSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        photo_id = ser.validated_data["id"]
        photo = get_object_or_404(PropertyPhoto, pk=photo_id, property=prop)
        with transaction.atomic():
            PropertyPhoto.objects.filter(property=prop).update(is_main=False)
            PropertyPhoto.objects.filter(pk=photo.pk).update(is_main=True)
        photo.refresh_from_db()
        out = CrmPropertyPhotoSerializer(photo, context={"request": request})
        return Response(out.data)


class CrmPropertyVideoViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """
    CRM: add, edit, and delete video links for a property.
    Nested under /api/crm/properties/<property_pk>/videos/.
    """

    permission_classes = [IsCrmUser, IsCrmPropertyStaffOrOwner]
    lookup_field = "pk"
    http_method_names = ["get", "post", "put", "patch", "delete", "head", "options"]

    def get_queryset(self):
        property_pk = self.kwargs["property_pk"]
        allowed = crm_property_queryset_for_user(self.request.user)
        if not allowed.filter(pk=property_pk).exists():
            return PropertyVideo.objects.none()
        return PropertyVideo.objects.filter(property_id=property_pk).order_by("id")

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return CrmPropertyVideoWriteSerializer
        return CrmPropertyVideoSerializer

    def _property(self):
        return get_object_or_404(
            crm_property_queryset_for_user(self.request.user),
            pk=self.kwargs["property_pk"],
        )

    def perform_create(self, serializer):
        serializer.save(property=self._property())
