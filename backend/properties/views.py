import logging
from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.db.models import F, Max, Prefetch, Q
from django.http import Http404
from django.shortcuts import get_object_or_404
from django.utils import timezone
from locations.choices import CommercialType
from rest_framework import filters, mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.exceptions import Throttled, ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import SimpleRateThrottle
from rest_framework.viewsets import ReadOnlyModelViewSet

from properties.choices import MarketType, PropertyStatus
from properties.crm_publication import (
    apply_crm_archive,
    apply_crm_publish,
    apply_crm_to_draft,
)
from properties.duplicate_detection import run_duplicate_check
from properties.models import PhoneRevealLog, Property, PropertyContact, PropertyPhoto, PropertyVideo
from properties.serializers import (
    CrmImportJobCreateSerializer,
    CrmImportJobDetailSerializer,
    CrmImportJobListSerializer,
    CrmPropertyDetailSerializer,
    CrmPropertyListSerializer,
    CrmPropertyPhotoReorderSerializer,
    CrmPropertyPhotoSerializer,
    CrmPropertyPhotoSetMainSerializer,
    CrmPropertyPhotoUploadSerializer,
    CrmPropertyVideoSerializer,
    CrmPropertyVideoWriteSerializer,
    CrmPropertyWriteSerializer,
    DuplicateCheckSerializer,
    PropertyDetailSerializer,
    PropertyListSerializer,
)
from users.models import RealtorProfile
from users.permissions import (
    IsCrmImportJobOwnerOrStaff,
    IsCrmPropertyStaffOrOwner,
    IsCrmUser,
    crm_import_job_queryset_for_user,
    crm_property_queryset_for_user,
    require_crm_capability,
)

logger = logging.getLogger(__name__)


class PhoneRevealThrottle(SimpleRateThrottle):
    scope = "phone_reveal"

    def get_rate(self):
        return "5/minute"

    def allow_request(self, request, view):
        if request.method != "POST":
            return True
        return super().allow_request(request, view)

    def get_cache_key(self, request, view):
        ident = self.get_ident(request)
        return self.cache_format % {"scope": self.scope, "ident": ident}


#: Этаж presets accepted by `?floor_preset=` on the public list endpoint.
FLOOR_PRESETS = {"not_first", "not_last", "not_first_not_last"}

#: Header carrying how many listings the floor preset dropped for an unknown
#: `floors_total`. A header rather than a JSON envelope: the list response is a
#: bare array that every consumer already depends on.
HIDDEN_UNKNOWN_FLOORS_HEADER = "X-Hidden-Unknown-Floors"


class PropertyViewSet(ReadOnlyModelViewSet):
    permission_classes = [AllowAny]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["title_generated", "public_address_text"]
    ordering_fields = ["published_at", "price"]
    ordering = ["-published_at"]
    lookup_field = "pk"
    lookup_value_regex = "[^/]+"

    def get_queryset(self):
        qs = Property.objects.filter(
            status=PropertyStatus.PUBLISHED,
            is_published=True,
        ).select_related(
            "city",
            "district",
            "neighborhood",
            "residential_complex",
            "assigned_realtor",
            # RealtorShortSerializer.is_public reads the reverse OneToOne;
            # without this it would be one extra query per row.
            "assigned_realtor__realtor_profile",
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

        city_slug = self.request.query_params.get("city_slug")
        if city_slug:
            qs = qs.filter(city__slug=city_slug)

        district_slug = self.request.query_params.get("district_slug")
        if district_slug:
            qs = qs.filter(district__slug=district_slug)

        neighborhood_slug = self.request.query_params.get("neighborhood_slug")
        if neighborhood_slug:
            qs = qs.filter(neighborhood__slug=neighborhood_slug)

        rc_slug = self.request.query_params.get("residential_complex_slug")
        if rc_slug:
            qs = qs.filter(residential_complex__slug=rc_slug)

        rooms = self.request.query_params.get("rooms")
        if rooms is not None and str(rooms).strip().isdigit():
            qs = qs.filter(apartment_details__rooms=int(str(rooms).strip()))

        rooms_min = self.request.query_params.get("rooms_min")
        if rooms_min is not None and str(rooms_min).strip().isdigit():
            qs = qs.filter(
                apartment_details__rooms__gte=int(str(rooms_min).strip())
            )

        def _query_decimal(name):
            raw = self.request.query_params.get(name)
            if raw is None or str(raw).strip() == "":
                return None
            try:
                return Decimal(str(raw).strip().replace(",", "."))
            except InvalidOperation:
                return None

        price_min = _query_decimal("price_min")
        if price_min is not None:
            qs = qs.filter(price__gte=price_min)
        price_max = _query_decimal("price_max")
        if price_max is not None:
            qs = qs.filter(price__lte=price_max)

        market_type = self.request.query_params.get("market_type")
        if market_type and market_type in {c[0] for c in MarketType.choices}:
            qs = qs.filter(market_type=market_type)

        # --- Этаж -----------------------------------------------------------
        # Presets rather than a numeric band: buyers state objections ("not the
        # ground floor", "not the top floor"), not floor ranges.
        #
        # Apartments only — `floor` lives on ApartmentDetails, where it is
        # REQUIRED, so "not first" is always evaluable. `floors_total` is
        # NULLABLE, so "not last" cannot be evaluated when the building height
        # is unknown. Those listings are EXCLUDED (the preset is a hard
        # constraint, and showing a possibly-top-floor flat would violate it)
        # and COUNTED, so the UI can say how many disappeared instead of
        # dropping them silently. The count is returned as a response header by
        # `list()` below — it needs no change to the array response shape.
        self._hidden_unknown_floors = 0
        floor_preset = self.request.query_params.get("floor_preset")
        if floor_preset in FLOOR_PRESETS:
            if floor_preset in ("not_first", "not_first_not_last"):
                qs = qs.filter(apartment_details__floor__gt=1)
            if floor_preset in ("not_last", "not_first_not_last"):
                # `apartment_details__isnull=False` matters: a plain
                # `floors_total__isnull=True` would LEFT JOIN and also match
                # houses/land, which have no apartment_details at all.
                count_qs = qs.filter(
                    apartment_details__isnull=False,
                    apartment_details__floors_total__isnull=True,
                )
                # The SearchFilter backend runs in filter_queryset(), AFTER
                # this method — the main queryset gets ?search for free, this
                # count would not, and it over-reported hidden listings that
                # never matched the search (review finding 6). Reusing the
                # backend itself (same search_fields on this view) means the
                # count can never drift from what the list actually matches.
                count_qs = filters.SearchFilter().filter_queryset(
                    self.request, count_qs, self
                )
                self._hidden_unknown_floors = count_qs.count()
                qs = qs.filter(
                    apartment_details__floors_total__isnull=False,
                    apartment_details__floor__lt=F("apartment_details__floors_total"),
                )

        house_area_min = _query_decimal("house_area_min")
        if house_area_min is not None:
            qs = qs.filter(house_details__house_area__gte=house_area_min)
        house_area_max = _query_decimal("house_area_max")
        if house_area_max is not None:
            qs = qs.filter(house_details__house_area__lte=house_area_max)

        house_land_area_min = _query_decimal("house_land_area_min")
        if house_land_area_min is not None:
            qs = qs.filter(house_details__land_area__gte=house_land_area_min)
        house_land_area_max = _query_decimal("house_land_area_max")
        if house_land_area_max is not None:
            qs = qs.filter(house_details__land_area__lte=house_land_area_max)

        land_area_min = _query_decimal("land_area_min")
        if land_area_min is not None:
            qs = qs.filter(land_plot_details__land_area__gte=land_area_min)
        land_area_max = _query_decimal("land_area_max")
        if land_area_max is not None:
            qs = qs.filter(land_plot_details__land_area__lte=land_area_max)

        commercial_type = self.request.query_params.get("commercial_type")
        if commercial_type and commercial_type in {
            c[0] for c in CommercialType.choices
        }:
            qs = qs.filter(commercial_details__commercial_type=commercial_type)

        commercial_area_min = _query_decimal("commercial_area_min")
        if commercial_area_min is not None:
            qs = qs.filter(
                commercial_details__area_total__gte=commercial_area_min
            )
        commercial_area_max = _query_decimal("commercial_area_max")
        if commercial_area_max is not None:
            qs = qs.filter(
                commercial_details__area_total__lte=commercial_area_max
            )

        realtor_crm = (self.request.query_params.get("assigned_realtor_crm_id") or "").strip()
        if realtor_crm:
            qs = qs.filter(assigned_realtor__crm_id__iexact=realtor_crm)

        if self.action == "list":
            qs = qs.select_related(
                "apartment_details",
                "house_details",
                "land_plot_details",
                "commercial_details",
            ).annotate(
                # Peak historical price per row via a single aggregate join (no
                # N+1) — the list serializer's is_price_reduced reads this.
                peak_price=Max("price_history__price"),
            ).prefetch_related(
                Prefetch(
                    "photos",
                    queryset=PropertyPhoto.objects.order_by("sort_order", "pk"),
                )
            )
        elif self.action == "retrieve":
            qs = qs.select_related(
                "apartment_details",
                "house_details",
                "land_plot_details",
                "commercial_details",
            ).prefetch_related("photos", "videos", "price_history")

        return qs

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        # Set by get_queryset() while applying the floor preset. Emitted only
        # when non-zero so nothing changes for every other request.
        hidden = getattr(self, "_hidden_unknown_floors", 0)
        if hidden:
            response[HIDDEN_UNKNOWN_FLOORS_HEADER] = str(hidden)
        return response

    def get_object(self):
        lookup = self.kwargs.get(self.lookup_field)
        queryset = self.filter_queryset(self.get_queryset())
        if lookup is None:
            raise Http404
        s = str(lookup)
        if s.isdigit():
            obj = get_object_or_404(queryset, pk=int(s))
        else:
            obj = get_object_or_404(queryset, slug=s)
        self.check_object_permissions(self.request, obj)
        return obj

    def get_serializer_class(self):
        if self.action == "retrieve":
            return PropertyDetailSerializer
        return PropertyListSerializer

    def throttled(self, request, wait):
        raise Throttled(
            wait=wait,
            detail="Слишком много запросов на показ телефона. Пожалуйста, повторите позже.",
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="reveal_phone",
        permission_classes=[AllowAny],
        throttle_classes=[PhoneRevealThrottle],
    )
    def reveal_phone(self, request, pk=None):
        prop = self.get_object()
        contact = (
            PropertyContact.objects.select_related("realtor_profile")
            .filter(property=prop, show_phone_enabled=True)
            .first()
        )
        phone = None
        profile_for_log = None
        if contact:
            raw = (contact.phone or "").strip()
            if raw:
                phone = raw
                profile_for_log = contact.realtor_profile
        if not phone and prop.assigned_realtor_id:
            ru = prop.assigned_realtor
            if ru:
                raw_u = (getattr(ru, "phone", None) or "").strip()
                if raw_u:
                    phone = raw_u
                    profile_for_log, _ = RealtorProfile.objects.get_or_create(
                        user=ru,
                        defaults={},
                    )
        if not phone or not profile_for_log:
            return Response(
                {"detail": "Телефон недоступен для данного объекта."},
                status=status.HTTP_404_NOT_FOUND,
            )
        ip = request.META.get("REMOTE_ADDR")
        ua = request.META.get("HTTP_USER_AGENT", "")
        with transaction.atomic():
            PhoneRevealLog.objects.create(
                property=prop,
                realtor_profile=profile_for_log,
                ip_address=ip,
                user_agent=ua,
            )
            Property.objects.filter(pk=prop.pk).update(
                phone_views_count=F("phone_views_count") + 1
            )
        return Response({"phone": phone})


class CrmImportJobViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """
    CRM: загрузка файла импорта (CSV/XML), маппинг полей JSON, фоновая обработка.
    """

    permission_classes = [IsCrmUser, IsCrmImportJobOwnerOrStaff]
    parser_classes = [MultiPartParser, FormParser]
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        qs = crm_import_job_queryset_for_user(self.request.user)
        if self.action == "retrieve":
            qs = qs.prefetch_related("items")
        return qs.order_by("-created_at")

    def get_serializer_class(self):
        if self.action == "create":
            return CrmImportJobCreateSerializer
        if self.action == "retrieve":
            return CrmImportJobDetailSerializer
        return CrmImportJobListSerializer

    def create(self, request, *args, **kwargs):
        require_crm_capability(request, "create_property")
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        job = serializer.save()
        from django.db import transaction

        from properties.tasks import process_property_import_job

        transaction.on_commit(lambda: process_property_import_job.delay(job.pk))
        logger.info(
            "crm_import_job_created job_id=%s user_id=%s format=%s",
            job.pk,
            getattr(self.request.user, "pk", None),
            job.source_format,
        )


class CrmPropertyViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """
    Internal CRM CRUD for properties.

    Soft delete: POST .../archive/  (status -> archived, recoverable).
    Restore:     POST .../to_draft/ (status -> draft).
    Hard delete: DELETE .../{id}/   (permanent; requires delete_property).
    Publication workflow: POST .../publish/, .../to_draft/, .../archive/.
    """

    permission_classes = [IsCrmUser, IsCrmPropertyStaffOrOwner]
    # `search` is handled manually in get_queryset() (see below) so a pure-integer
    # query can also match the numeric primary key, which DRF's SearchFilter cannot
    # do. OrderingFilter is still applied for ?ordering=.
    filter_backends = [filters.OrderingFilter]
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
            # Same reason as the public list: RealtorShortSerializer.is_public
            # reads the reverse OneToOne on BOTH of these.
            "assigned_realtor__realtor_profile",
            "created_by__realtor_profile",
            "agency",
            "owner",
            "apartment_details",
            "house_details",
            "land_plot_details",
            "commercial_details",
        )

        search = (self.request.query_params.get("search") or "").strip()
        if search:
            # Match PID / title / public address (case-insensitive substring),
            # plus an exact numeric primary-key match when the query is an integer.
            search_q = (
                Q(crm_property_id__icontains=search)
                | Q(title_generated__icontains=search)
                | Q(public_address_text__icontains=search)
            )
            if search.isdigit():
                search_q |= Q(id=int(search))
            qs = qs.filter(search_q)

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

    def create(self, request, *args, **kwargs):
        require_crm_capability(request, "create_property")
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        require_crm_capability(request, "edit_property")
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        require_crm_capability(request, "edit_property")
        return super().partial_update(request, *args, **kwargs)

    def perform_create(self, serializer):
        # New CRM properties go live immediately: published on create.
        serializer.save(
            status=PropertyStatus.PUBLISHED,
            is_published=True,
            published_at=timezone.now(),
        )

    def destroy(self, request, *args, **kwargs):
        # Hard delete — permanent. Gated by the same capability as archiving.
        require_crm_capability(request, "delete_property")
        return super().destroy(request, *args, **kwargs)

    def perform_destroy(self, instance):
        logger.info(
            "crm_property_hard_deleted property_id=%s crm_property_id=%s user_id=%s",
            instance.pk,
            getattr(instance, "crm_property_id", None),
            getattr(self.request.user, "pk", None),
        )
        instance.delete()

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
        require_crm_capability(request, "edit_property")
        prop = self.get_object()
        prev_status = prop.status
        apply_crm_publish(prop)
        prop.save()
        logger.info(
            "crm_property_publish property_id=%s user_id=%s status_was=%s",
            prop.pk,
            getattr(request.user, "pk", None),
            prev_status,
        )
        serializer = CrmPropertyDetailSerializer(prop, context={"request": request})
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="to_draft")
    def to_draft(self, request, pk=None):
        require_crm_capability(request, "edit_property")
        prop = self.get_object()
        prev_status = prop.status
        apply_crm_to_draft(prop)
        prop.save()
        logger.info(
            "crm_property_to_draft property_id=%s user_id=%s status_was=%s",
            prop.pk,
            getattr(request.user, "pk", None),
            prev_status,
        )
        serializer = CrmPropertyDetailSerializer(prop, context={"request": request})
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="archive")
    def archive(self, request, pk=None):
        require_crm_capability(request, "delete_property")
        prop = self.get_object()
        prev_status = prop.status
        apply_crm_archive(prop)
        prop.save()
        logger.info(
            "crm_property_archive property_id=%s user_id=%s status_was=%s",
            prop.pk,
            getattr(request.user, "pk", None),
            prev_status,
        )
        serializer = CrmPropertyDetailSerializer(prop, context={"request": request})
        return Response(serializer.data)

    @action(detail=False, methods=["post"], url_path="check_duplicates")
    def check_duplicates(self, request):
        """
        Soft duplicate pre-check for CRM property creation.

        Accepts a flat payload with base property fields and optional
        type-specific detail signals. Returns a scored list of suspicious
        existing properties. Never creates anything.

        Two-step client flow:
          1. POST /api/crm/properties/check_duplicates/  → inspect warnings
          2. If user confirms → POST /api/crm/properties/ (normal create)
             The create payload may include `ignore_duplicate_warning=true`
             as a client-side audit signal; the server does not enforce it.

        Response shape:
          {
            "has_warnings": bool,
            "likely_duplicates": [{id, title, price, location, status, score, reasons}],
            "suspicious":        [{id, title, price, location, status, score, reasons}]
          }

        Thresholds: likely >= 80 points, suspicious 60–79 points.
        """
        require_crm_capability(request, "create_property")
        ser = DuplicateCheckSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        base_qs = crm_property_queryset_for_user(request.user)
        result = run_duplicate_check(ser.validated_data, base_qs=base_qs)
        return Response(result)


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

    def create(self, request, *args, **kwargs):
        require_crm_capability(request, "edit_property")
        return super().create(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        require_crm_capability(request, "edit_property")
        return super().destroy(request, *args, **kwargs)

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
            instance = serializer.save(property=prop, **extra)
        logger.info(
            "crm_property_photo_created property_id=%s photo_id=%s user_id=%s",
            prop.pk,
            instance.pk,
            getattr(self.request.user, "pk", None),
        )

    def perform_destroy(self, instance):
        logger.info(
            "crm_property_photo_deleted property_id=%s photo_id=%s user_id=%s",
            instance.property_id,
            instance.pk,
            getattr(self.request.user, "pk", None),
        )
        instance.delete()

    def reorder(self, request, property_pk=None):
        require_crm_capability(request, "edit_property")
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
        require_crm_capability(request, "edit_property")
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

    def create(self, request, *args, **kwargs):
        require_crm_capability(request, "edit_property")
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        require_crm_capability(request, "edit_property")
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        require_crm_capability(request, "edit_property")
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        require_crm_capability(request, "edit_property")
        return super().destroy(request, *args, **kwargs)

    def _property(self):
        return get_object_or_404(
            crm_property_queryset_for_user(self.request.user),
            pk=self.kwargs["property_pk"],
        )

    def perform_create(self, serializer):
        prop = self._property()
        instance = serializer.save(property=prop)
        logger.info(
            "crm_property_video_created property_id=%s video_id=%s user_id=%s",
            prop.pk,
            instance.pk,
            getattr(self.request.user, "pk", None),
        )

    def perform_destroy(self, instance):
        logger.info(
            "crm_property_video_deleted property_id=%s video_id=%s user_id=%s",
            instance.property_id,
            instance.pk,
            getattr(self.request.user, "pk", None),
        )
        instance.delete()
