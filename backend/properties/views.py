from rest_framework import filters
from rest_framework.permissions import AllowAny
from rest_framework.viewsets import ReadOnlyModelViewSet

from properties.choices import PropertyStatus
from properties.models import Property
from properties.serializers import PropertyDetailSerializer, PropertyListSerializer


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
