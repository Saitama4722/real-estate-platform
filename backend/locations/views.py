from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page
from rest_framework import filters
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ReadOnlyModelViewSet

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
from .models import City, District, Neighborhood, ResidentialComplex
from .serializers import (
    CitySerializer,
    DistrictSerializer,
    NeighborhoodSerializer,
    ResidentialComplexSerializer,
)

# Публичные справочники: короткий TTL — баланс нагрузки и актуальности после правок в админке
_REFERENCE_CACHE_SEC = 300
# Словарь TextChoices из кода — можно дольше
_CHOICES_CACHE_SEC = 3600


@method_decorator(cache_page(_REFERENCE_CACHE_SEC), name="list")
@method_decorator(cache_page(_REFERENCE_CACHE_SEC), name="retrieve")
class CityViewSet(ReadOnlyModelViewSet):
    serializer_class = CitySerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        return City.objects.filter(is_active=True)


@method_decorator(cache_page(_REFERENCE_CACHE_SEC), name="list")
@method_decorator(cache_page(_REFERENCE_CACHE_SEC), name="retrieve")
class DistrictViewSet(ReadOnlyModelViewSet):
    serializer_class = DistrictSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        queryset = District.objects.all()
        city_id = self.request.query_params.get("city")
        if city_id:
            queryset = queryset.filter(city_id=city_id)
        return queryset


@method_decorator(cache_page(_REFERENCE_CACHE_SEC), name="list")
@method_decorator(cache_page(_REFERENCE_CACHE_SEC), name="retrieve")
class NeighborhoodViewSet(ReadOnlyModelViewSet):
    serializer_class = NeighborhoodSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        queryset = Neighborhood.objects.all()
        city_id = self.request.query_params.get("city")
        if city_id:
            queryset = queryset.filter(city_id=city_id)
        district_id = self.request.query_params.get("district")
        if district_id:
            queryset = queryset.filter(district_id=district_id)
        return queryset


@method_decorator(cache_page(_REFERENCE_CACHE_SEC), name="list")
@method_decorator(cache_page(_REFERENCE_CACHE_SEC), name="retrieve")
class ResidentialComplexViewSet(ReadOnlyModelViewSet):
    serializer_class = ResidentialComplexSerializer
    permission_classes = [AllowAny]
    filter_backends = [filters.SearchFilter]
    search_fields = ["name"]

    def get_queryset(self):
        queryset = ResidentialComplex.objects.all()
        city_id = self.request.query_params.get("city")
        if city_id:
            queryset = queryset.filter(city_id=city_id)
        district_id = self.request.query_params.get("district")
        if district_id:
            queryset = queryset.filter(district_id=district_id)
        return queryset


@method_decorator(cache_page(_CHOICES_CACHE_SEC), name="dispatch")
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
