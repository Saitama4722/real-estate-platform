from rest_framework import serializers

from properties.models import Property


class CityShortSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    slug = serializers.SlugField()


class DistrictShortSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    slug = serializers.SlugField()


class NeighborhoodShortSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    slug = serializers.SlugField()


class ResidentialComplexShortSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    slug = serializers.SlugField()


class RealtorShortSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    first_name = serializers.CharField()
    last_name = serializers.CharField()


class PropertyListSerializer(serializers.ModelSerializer):
    city = CityShortSerializer(read_only=True)
    district = DistrictShortSerializer(read_only=True)

    class Meta:
        model = Property
        fields = [
            "id",
            "title_generated",
            "slug",
            "property_type",
            "deal_type",
            "market_type",
            "status",
            "is_published",
            "price",
            "old_price",
            "currency",
            "city",
            "district",
            "public_address_text",
            "views_count",
            "published_at",
            "created_at",
        ]


class PropertyDetailSerializer(serializers.ModelSerializer):
    city = CityShortSerializer(read_only=True)
    district = DistrictShortSerializer(read_only=True)
    neighborhood = NeighborhoodShortSerializer(read_only=True)
    residential_complex = ResidentialComplexShortSerializer(read_only=True)
    assigned_realtor = RealtorShortSerializer(read_only=True)

    class Meta:
        model = Property
        fields = [
            "id",
            "title_generated",
            "slug",
            "property_type",
            "deal_type",
            "market_type",
            "status",
            "is_published",
            "price",
            "old_price",
            "currency",
            "city",
            "district",
            "public_address_text",
            "views_count",
            "published_at",
            "created_at",
            # detail-only fields
            "short_description",
            "description",
            "neighborhood",
            "residential_complex",
            "public_latitude",
            "public_longitude",
            "hide_exact_address",
            "phone_views_count",
            "updated_at",
            "assigned_realtor",
        ]
