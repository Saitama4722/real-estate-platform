from rest_framework import serializers

from properties.models import Property, PropertyPhoto, PropertyVideo


class AgencyShortSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    slug = serializers.SlugField(allow_null=True)


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


class CrmPropertyListSerializer(serializers.ModelSerializer):
    city = CityShortSerializer(read_only=True, allow_null=True)
    district = DistrictShortSerializer(read_only=True, allow_null=True)
    agency = AgencyShortSerializer(read_only=True, allow_null=True)
    created_by = RealtorShortSerializer(read_only=True, allow_null=True)
    assigned_realtor = RealtorShortSerializer(read_only=True, allow_null=True)

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
            "archived_at",
            "created_at",
            "updated_at",
            "agency",
            "created_by",
            "assigned_realtor",
        ]


class CrmPropertyDetailSerializer(serializers.ModelSerializer):
    city = CityShortSerializer(read_only=True, allow_null=True)
    district = DistrictShortSerializer(read_only=True, allow_null=True)
    neighborhood = NeighborhoodShortSerializer(read_only=True, allow_null=True)
    residential_complex = ResidentialComplexShortSerializer(
        read_only=True, allow_null=True
    )
    assigned_realtor = RealtorShortSerializer(read_only=True, allow_null=True)
    created_by = RealtorShortSerializer(read_only=True, allow_null=True)
    agency = AgencyShortSerializer(read_only=True, allow_null=True)

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
            "neighborhood",
            "residential_complex",
            "street",
            "house_number",
            "public_address_text",
            "hide_exact_address",
            "public_latitude",
            "public_longitude",
            "real_latitude",
            "real_longitude",
            "short_description",
            "description",
            "views_count",
            "phone_views_count",
            "published_at",
            "archived_at",
            "created_at",
            "updated_at",
            "agency",
            "created_by",
            "assigned_realtor",
        ]


class CrmPropertyWriteSerializer(serializers.ModelSerializer):
    """Create / update property in CRM (no hard delete; status via workflow actions)."""

    class Meta:
        model = Property
        fields = [
            "agency",
            "assigned_realtor",
            "deal_type",
            "property_type",
            "market_type",
            "title_generated",
            "slug",
            "short_description",
            "description",
            "price",
            "old_price",
            "currency",
            "city",
            "district",
            "neighborhood",
            "residential_complex",
            "street",
            "house_number",
            "public_address_text",
            "hide_exact_address",
            "public_latitude",
            "public_longitude",
            "real_latitude",
            "real_longitude",
        ]
        extra_kwargs = {
            "slug": {"required": False, "allow_null": True, "allow_blank": True},
            "title_generated": {"required": False, "allow_blank": True},
        }

    def create(self, validated_data):
        user = self.context["request"].user
        if user and user.is_authenticated:
            validated_data.setdefault("created_by", user)
        return super().create(validated_data)


class CrmPropertyPhotoSerializer(serializers.ModelSerializer):
    """CRM read representation for property photos."""

    class Meta:
        model = PropertyPhoto
        fields = [
            "id",
            "original_file",
            "image_large",
            "image_medium",
            "image_thumb",
            "sort_order",
            "is_main",
            "mime_type",
            "file_size",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class CrmPropertyPhotoUploadSerializer(serializers.ModelSerializer):
    """CRM create: multipart upload to ``original_file``."""

    class Meta:
        model = PropertyPhoto
        fields = ["original_file", "sort_order", "is_main"]
        extra_kwargs = {
            "sort_order": {"required": False},
            "is_main": {"required": False, "default": False},
        }

    def create(self, validated_data):
        f = validated_data["original_file"]
        ct = getattr(f, "content_type", None) or ""
        validated_data.setdefault("mime_type", ct)
        sz = getattr(f, "size", None)
        if sz is not None:
            validated_data["file_size"] = sz
        return super().create(validated_data)


class CrmPropertyPhotoReorderItemSerializer(serializers.Serializer):
    id = serializers.IntegerField(min_value=1)
    sort_order = serializers.IntegerField(min_value=0)


class CrmPropertyPhotoReorderSerializer(serializers.Serializer):
    items = CrmPropertyPhotoReorderItemSerializer(many=True, allow_empty=False)


class CrmPropertyPhotoSetMainSerializer(serializers.Serializer):
    id = serializers.IntegerField(min_value=1)


class CrmPropertyVideoSerializer(serializers.ModelSerializer):
    """CRM read representation for property videos."""

    class Meta:
        model = PropertyVideo
        fields = [
            "id",
            "platform",
            "video_url",
            "embed_url",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class CrmPropertyVideoWriteSerializer(serializers.ModelSerializer):
    """CRM create/update: platform, video_url, embed_url (caller-supplied; no auto-derivation)."""

    class Meta:
        model = PropertyVideo
        fields = ["platform", "video_url", "embed_url"]
        extra_kwargs = {
            "embed_url": {"required": False, "allow_blank": True},
        }
