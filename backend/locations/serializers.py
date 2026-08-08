from django.utils.text import slugify

from rest_framework import serializers

from .models import City, District, DistrictGuide, Neighborhood, ResidentialComplex


def _published_guide_slug(target):
    """Return the slug of a target's guide only if it exists AND is published."""
    guide = getattr(target, "guide", None)
    if guide is not None and guide.status == DistrictGuide.GuideStatus.PUBLISHED:
        return guide.slug
    return None


def _unique_slug(model, base_slug, extra_filter=None):
    """Return base_slug, appending -2/-3/… until unique within (extra_filter or {})."""
    slug = base_slug[:50]
    filters = dict(extra_filter or {})
    candidate = slug
    n = 2
    while model.objects.filter(**{**filters, "slug": candidate}).exists():
        candidate = f"{slug[:47]}-{n}"
        n += 1
    return candidate


class DistrictCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = District
        fields = ["id", "city_id", "name", "slug", "district_type", "sort_order"]
        read_only_fields = ["id", "slug"]

    def create(self, validated_data):
        base = slugify(validated_data["name"], allow_unicode=True) or "district"
        validated_data["slug"] = _unique_slug(
            District, base, {"city_id": validated_data["city_id"]}
        )
        return super().create(validated_data)


class NeighborhoodCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Neighborhood
        fields = [
            "id", "city_id", "district_id", "name", "slug",
            "sort_order",
        ]
        read_only_fields = ["id", "slug"]

    def create(self, validated_data):
        base = slugify(validated_data["name"], allow_unicode=True) or "neighborhood"
        validated_data["slug"] = _unique_slug(
            Neighborhood, base, {"city_id": validated_data["city_id"]}
        )
        return super().create(validated_data)


class ResidentialComplexCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ResidentialComplex
        fields = ["id", "city_id", "district_id", "neighborhood_id", "name", "slug"]
        read_only_fields = ["id", "slug"]

    def create(self, validated_data):
        base = slugify(validated_data["name"], allow_unicode=True) or "rc"
        validated_data["slug"] = _unique_slug(ResidentialComplex, base)
        return super().create(validated_data)


class CityShortSerializer(serializers.ModelSerializer):
    class Meta:
        model = City
        fields = ["id", "name", "slug"]


class DistrictShortSerializer(serializers.ModelSerializer):
    """
    Short nested representation used inside Neighborhood/ResidentialComplex.
    """

    class Meta:
        model = District
        fields = ["id", "name", "slug"]


class NeighborhoodShortSerializer(serializers.ModelSerializer):
    """
    Short nested representation used inside ResidentialComplex.
    """

    class Meta:
        model = Neighborhood
        fields = ["id", "name", "slug"]


class CitySerializer(serializers.ModelSerializer):
    class Meta:
        model = City
        fields = "__all__"


class DistrictSerializer(serializers.ModelSerializer):
    city = CityShortSerializer(read_only=True)
    # Slug of a PUBLISHED guide for this district, if one exists (else null).
    # Lets the frontend link a location to its guide without a second lookup.
    guide_slug = serializers.SerializerMethodField()

    class Meta:
        model = District
        fields = [
            "id", "city", "city_id", "name", "slug",
            "district_type", "sort_order", "guide_slug",
        ]

    def get_guide_slug(self, obj):
        return _published_guide_slug(obj)


class NeighborhoodSerializer(serializers.ModelSerializer):
    city = CityShortSerializer(read_only=True)
    district = DistrictShortSerializer(read_only=True)
    guide_slug = serializers.SerializerMethodField()

    class Meta:
        model = Neighborhood
        fields = "__all__"

    def get_guide_slug(self, obj):
        return _published_guide_slug(obj)


class ResidentialComplexSerializer(serializers.ModelSerializer):
    city = CityShortSerializer(read_only=True)
    district = DistrictShortSerializer(read_only=True)
    neighborhood = NeighborhoodShortSerializer(read_only=True)

    class Meta:
        model = ResidentialComplex
        fields = "__all__"


class _GuideCommonMixin(serializers.Serializer):
    """Shared computed fields for district-guide list + detail."""

    city = serializers.SerializerMethodField()
    catalog_param = serializers.SerializerMethodField()
    catalog_slug = serializers.SerializerMethodField()
    cover_image = serializers.SerializerMethodField()
    word_count = serializers.SerializerMethodField()

    def get_city(self, obj):
        city = obj.city
        return CityShortSerializer(city).data if city else None

    def get_catalog_param(self, obj):
        return obj.catalog_filter[0]

    def get_catalog_slug(self, obj):
        return obj.catalog_filter[1]

    def get_cover_image(self, obj):
        if not obj.cover_image:
            return None
        request = self.context.get("request")
        path = obj.cover_image.url
        return request.build_absolute_uri(path) if request else path

    def get_word_count(self, obj):
        """
        Whitespace-token count of the text — a MEASUREMENT, not a reading time.

        Sums every section field, because that is what the page renders. A
        section left empty contributes nothing, which is also what it does
        visually.

        The list endpoint deliberately omits the section texts (an index of ~90 guides
        would ship every full text just to render a clock), so the card needs
        some measure of length from here. It is a raw count on purpose: the
        reading-time RULE — 170 wpm, a one-minute floor, the rounding mode —
        stays in exactly one place, frontend/src/lib/articleContent.ts. Do not
        turn this into `reading_minutes`; that would be a second definition
        that can silently drift from the first (and `round()` here is banker's
        rounding, which already disagrees with JS `Math.round` at .5).

        `str.split()` with no argument splits on arbitrary whitespace runs and
        drops empties — identical to the frontend's
        `trim().split(/\\s+/).filter(Boolean)`.
        """
        return sum(len(part.split()) for part in obj.rendered_text_parts())


class DistrictGuideListSerializer(_GuideCommonMixin, serializers.ModelSerializer):
    class Meta:
        model = DistrictGuide
        fields = [
            "slug", "title", "excerpt", "published_at",
            "cover_image", "city", "catalog_param", "catalog_slug",
            "word_count",
        ]


class DistrictGuideDetailSerializer(_GuideCommonMixin, serializers.ModelSerializer):
    class Meta:
        model = DistrictGuide
        fields = [
            "slug", "title", "excerpt", "published_at",
            "intro", "housing", "infrastructure", "audience", "caveats",
            "conclusion",
            "cover_image", "city", "catalog_param", "catalog_slug",
            "word_count",
        ]

