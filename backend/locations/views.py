from rest_framework import filters, mixins, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import GenericViewSet, ReadOnlyModelViewSet

from users.permissions import IsCrmUser

from .choices import (
    BathroomType,
    BuildingType,
    CommercialType,
    HeatingType,
    LandCategory,
    ParkingType,
    PermittedUse,
    RenovationType,
)
from .models import City, District, DistrictGuide, Neighborhood, ResidentialComplex
from .serializers import (
    CitySerializer,
    DistrictCreateSerializer,
    DistrictGuideDetailSerializer,
    DistrictGuideListSerializer,
    DistrictSerializer,
    NeighborhoodCreateSerializer,
    NeighborhoodSerializer,
    ResidentialComplexCreateSerializer,
    ResidentialComplexSerializer,
)


class CityViewSet(ReadOnlyModelViewSet):
    serializer_class = CitySerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        return City.objects.filter(is_active=True)


class DistrictViewSet(
    mixins.CreateModelMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, GenericViewSet
):
    permission_classes = [AllowAny]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return DistrictCreateSerializer
        return DistrictSerializer

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsCrmUser()]
        return [AllowAny()]

    def get_queryset(self):
        # select_related("guide") so the guide_slug field never fires N+1.
        queryset = District.objects.select_related("guide")
        city_id = self.request.query_params.get("city")
        if city_id:
            queryset = queryset.filter(city_id=city_id)
        return queryset


class NeighborhoodViewSet(
    mixins.CreateModelMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, GenericViewSet
):
    permission_classes = [AllowAny]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return NeighborhoodCreateSerializer
        return NeighborhoodSerializer

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsCrmUser()]
        return [AllowAny()]

    def get_queryset(self):
        queryset = Neighborhood.objects.select_related("guide")
        city_id = self.request.query_params.get("city")
        if city_id:
            queryset = queryset.filter(city_id=city_id)
        district_id = self.request.query_params.get("district")
        if district_id:
            queryset = queryset.filter(district_id=district_id)
        return queryset


class ResidentialComplexViewSet(
    mixins.CreateModelMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, GenericViewSet
):
    filter_backends = [filters.SearchFilter]
    search_fields = ["name"]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return ResidentialComplexCreateSerializer
        return ResidentialComplexSerializer

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsCrmUser()]
        return [AllowAny()]

    def get_queryset(self):
        queryset = ResidentialComplex.objects.all()
        city_id = self.request.query_params.get("city")
        if city_id:
            queryset = queryset.filter(city_id=city_id)
        district_id = self.request.query_params.get("district")
        if district_id:
            queryset = queryset.filter(district_id=district_id)
        return queryset


class DistrictGuidePublicViewSet(ReadOnlyModelViewSet):
    """Public read-only guides: list (published) + retrieve by slug."""

    permission_classes = [AllowAny]
    lookup_field = "slug"
    # Guide slugs may contain non-ASCII (allow_unicode) — match anything but "/".
    lookup_value_regex = "[^/]+"

    def get_serializer_class(self):
        if self.action == "retrieve":
            return DistrictGuideDetailSerializer
        return DistrictGuideListSerializer

    def get_queryset(self):
        return (
            DistrictGuide.objects.filter(
                status=DistrictGuide.GuideStatus.PUBLISHED,
                published_at__isnull=False,
            )
            .select_related(
                "district", "district__city", "neighborhood", "neighborhood__city"
            )
            .order_by("-published_at", "-created_at")
        )


class choices_view(APIView):
    permission_classes = [AllowAny]

    def get(self, request, *args, **kwargs):
        choice_map = {
            "renovation_types": RenovationType,
            "bathroom_types": BathroomType,
            "heating_types": HeatingType,
            "commercial_types": CommercialType,
            "land_categories": LandCategory,
            "permitted_uses": PermittedUse,
            "building_types": BuildingType,
            "parking_types": ParkingType,
        }

        data = {}
        for key, choice_cls in choice_map.items():
            data[key] = [
                {"value": v, "label": l} for v, l in choice_cls.choices
            ]

        return Response(data)
