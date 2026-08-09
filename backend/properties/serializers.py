import json
from datetime import timedelta

from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone
from rest_framework import serializers

from common.media_urls import MediaURLField, media_url

from users.models import User

from owners.models import Owner
from owners.serializers import OwnerShortSerializer
from locations.choices import CommercialType
from properties.choices import PropertyStatus, PropertyType
from properties.import_choices import ImportSourceFormat
from properties.models import (
    ApartmentDetails,
    CommercialDetails,
    HouseDetails,
    LandPlotDetails,
    ImportItem,
    ImportJob,
    PriceHistory,
    Property,
    PropertyPhoto,
    PropertyVideo,
)
from properties.property_photo_images import validate_property_photo_original_size
from users.permissions import (
    crm_user_has_capability,
    user_can_access_crm_property,
)


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
    crm_id = serializers.CharField()
    first_name = serializers.CharField()
    last_name = serializers.CharField()
    avatar = serializers.SerializerMethodField()
    # Whether /realtors/<crm_id> exists for this person. Consumers MUST gate
    # their link on it: the public detail view 404s an unpublished realtor, so
    # rendering the link anyway would be a link to a 404.
    is_public = serializers.SerializerMethodField()

    def get_avatar(self, obj):
        return media_url(getattr(obj, "avatar", None))

    def get_is_public(self, obj) -> bool:
        from users.models import realtor_profile_is_public

        return realtor_profile_is_public(obj)


class ApartmentDetailsPublicSerializer(serializers.ModelSerializer):
    class Meta:
        model = ApartmentDetails
        fields = ["rooms", "area_total", "floor", "floors_total"]


class HouseDetailsPublicSerializer(serializers.ModelSerializer):
    class Meta:
        model = HouseDetails
        fields = ["house_area", "land_area", "floors_total"]


class LandPlotDetailsPublicSerializer(serializers.ModelSerializer):
    class Meta:
        model = LandPlotDetails
        fields = ["land_area"]


class CommercialDetailsPublicSerializer(serializers.ModelSerializer):
    class Meta:
        model = CommercialDetails
        fields = ["commercial_type", "area_total", "floor", "floors_total"]


#: A listing counts as «Новый объект» for this long after publication.
#: DERIVED, never stored: no migration, no field for anyone to fill, no manual
#: toggle to forget — the badge ages out on its own. Computed server-side so
#: every consumer (card, future detail page, any other client) agrees on what
#: "new" means rather than each re-deriving it from a timestamp.
NEW_LISTING_DAYS = 7


def is_new_listing(obj) -> bool:
    """True when `published_at` is within the last NEW_LISTING_DAYS."""
    published = getattr(obj, "published_at", None)
    if not published:
        return False
    return (timezone.now() - published) <= timedelta(days=NEW_LISTING_DAYS)


class PropertyPhotoPublicSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = PropertyPhoto
        fields = ["url", "sort_order", "is_main"]

    def get_url(self, obj):
        return media_url(obj.image_medium or obj.image_thumb or obj.original_file)


class PropertyVideoPublicSerializer(serializers.ModelSerializer):
    class Meta:
        model = PropertyVideo
        fields = ["video_url"]


class PropertyListSerializer(serializers.ModelSerializer):
    city = CityShortSerializer(read_only=True, allow_null=True)
    district = DistrictShortSerializer(read_only=True, allow_null=True)
    neighborhood = NeighborhoodShortSerializer(read_only=True, allow_null=True)
    residential_complex = ResidentialComplexShortSerializer(
        read_only=True, allow_null=True
    )
    apartment_details = ApartmentDetailsPublicSerializer(
        read_only=True, allow_null=True
    )
    house_details = HouseDetailsPublicSerializer(read_only=True, allow_null=True)
    land_plot_details = LandPlotDetailsPublicSerializer(
        read_only=True, allow_null=True
    )
    commercial_details = CommercialDetailsPublicSerializer(
        read_only=True, allow_null=True
    )
    preview_image = serializers.SerializerMethodField()
    is_price_reduced = serializers.SerializerMethodField()
    is_new = serializers.SerializerMethodField()

    def get_is_new(self, obj) -> bool:
        return is_new_listing(obj)

    class Meta:
        model = Property
        fields = [
            "id",
            "title_generated",
            "slug",
            "property_type",
            "deal_type",
            # Рынок (Новостройка/Вторичка) — already a PUBLIC FILTER param on
            # this endpoint (?market_type=…), so returning it exposes nothing
            # that was not already publicly derivable; the card needs it for
            # the photo badge.
            "market_type",
            "price",
            # Старая цена — a display concept («Старая цена»), not an internal
            # figure. The detail endpoint already publishes the FULL
            # price_history, so a single previous price reveals strictly less
            # than what is public there. (The genuinely CRM-only fields —
            # `owner`, `real_latitude`, `real_longitude` — carry explicit
            # "never expose" markers in models.py and stay out.)
            "old_price",
            "currency",
            "city",
            "district",
            "neighborhood",
            "residential_complex",
            "public_address_text",
            "public_latitude",
            "public_longitude",
            "updated_at",
            "apartment_details",
            "house_details",
            "land_plot_details",
            "commercial_details",
            "preview_image",
            "is_price_reduced",
            "is_new",
            # Publication timestamp — what «Сначала новые» sorts by. Public-safe:
            # this endpoint already orders by it (?ordering=-published_at),
            # `is_new` already discloses its 7-day bucket, and updated_at is
            # already published. Without it the frontend's deterministic
            # re-sort fell back to updated_at, so any CRM edit bumped an old
            # listing to the top (review finding 4).
            "published_at",
        ]

    def get_is_price_reduced(self, obj) -> bool:
        """
        Current price below the PEAK historical price — same definition as the
        detail endpoint. Reads `peak_price`, annotated on the list queryset
        (Max("price_history__price")), so there's no per-row query. If the
        annotation is absent (serializer used off a non-annotated queryset), we
        conservatively return False rather than firing an N+1 lookup.
        """
        peak = getattr(obj, "peak_price", None)
        if peak is None or obj.price is None:
            return False
        return obj.price < peak

    def get_preview_image(self, obj):
        for photo in obj.photos.all()[:1]:
            url = media_url(photo.image_medium or photo.image_thumb or photo.original_file)
            if url:
                return url
        return None


class PriceHistoryPublicSerializer(serializers.ModelSerializer):
    """One price point (chronological). `price` is a plain decimal string."""

    class Meta:
        model = PriceHistory
        fields = ["price", "changed_at"]


class PropertyDetailSerializer(serializers.ModelSerializer):
    city = CityShortSerializer(read_only=True, allow_null=True)
    district = DistrictShortSerializer(read_only=True, allow_null=True)
    neighborhood = NeighborhoodShortSerializer(read_only=True, allow_null=True)
    residential_complex = ResidentialComplexShortSerializer(
        read_only=True, allow_null=True
    )
    assigned_realtor = RealtorShortSerializer(read_only=True, allow_null=True)
    price_history = serializers.SerializerMethodField()
    is_price_reduced = serializers.SerializerMethodField()
    # Same three card fields as the list endpoint. /favorites and /compare
    # hydrate their cards from THIS endpoint (they store only slugs), so
    # without them the identical card would render differently there.
    is_new = serializers.SerializerMethodField()

    def get_is_new(self, obj) -> bool:
        return is_new_listing(obj)
    apartment_details = ApartmentDetailsPublicSerializer(
        read_only=True, allow_null=True
    )
    house_details = HouseDetailsPublicSerializer(read_only=True, allow_null=True)
    land_plot_details = LandPlotDetailsPublicSerializer(
        read_only=True, allow_null=True
    )
    commercial_details = CommercialDetailsPublicSerializer(
        read_only=True, allow_null=True
    )
    photos = PropertyPhotoPublicSerializer(many=True, read_only=True)
    videos = PropertyVideoPublicSerializer(many=True, read_only=True)

    def _history(self, obj):
        # Prefetched by the view (`prefetch_related("price_history")`), so this is
        # already ordered ascending by the model's Meta.ordering.
        return list(obj.price_history.all())

    def get_price_history(self, obj):
        return PriceHistoryPublicSerializer(self._history(obj), many=True).data

    def get_is_price_reduced(self, obj) -> bool:
        """
        True when the current price is BELOW the highest price ever recorded for
        this listing. We compare against the PEAK (max) rather than the immediately
        previous price so a genuine markdown still reads as "снижена" even after a
        small later bump — which is the signal buyers actually care about.
        """
        history = self._history(obj)
        if len(history) < 2 or obj.price is None:
            return False
        peak = max(h.price for h in history)
        return obj.price < peak

    class Meta:
        model = Property
        fields = [
            "id",
            "title_generated",
            "slug",
            "property_type",
            "deal_type",
            "market_type",
            "price",
            "old_price",
            "currency",
            "city",
            "district",
            "public_address_text",
            "short_description",
            "description",
            "neighborhood",
            "residential_complex",
            "public_latitude",
            "public_longitude",
            "updated_at",
            "assigned_realtor",
            "apartment_details",
            "house_details",
            "land_plot_details",
            "commercial_details",
            "photos",
            "videos",
            "price_history",
            "is_price_reduced",
            "is_new",
        ]


class CrmPropertyListSerializer(serializers.ModelSerializer):
    city = CityShortSerializer(read_only=True, allow_null=True)
    district = DistrictShortSerializer(read_only=True, allow_null=True)
    agency = AgencyShortSerializer(read_only=True, allow_null=True)
    created_by = RealtorShortSerializer(read_only=True, allow_null=True)
    assigned_realtor = RealtorShortSerializer(read_only=True, allow_null=True)
    # Owner presence flag for the "⚠ Собственник не указан" list indicator.
    # CRM-only serializer; owner data is never exposed publicly.
    has_owner = serializers.SerializerMethodField()
    owner_name = serializers.CharField(source="owner.full_name", read_only=True, default=None)
    can_delete = serializers.SerializerMethodField()
    can_archive = serializers.SerializerMethodField()
    can_restore = serializers.SerializerMethodField()

    def _user(self):
        request = self.context.get("request")
        return getattr(request, "user", None)

    def get_can_delete(self, obj) -> bool:
        """
        Whether the current user may HARD delete this property — owner or staff
        AND holding the delete_property capability. Gates the red delete button.
        """
        user = self._user()
        if user is None:
            return False
        return user_can_access_crm_property(user, obj) and crm_user_has_capability(
            user, "delete_property"
        )

    def get_can_archive(self, obj) -> bool:
        """
        Whether the current user may archive (soft delete) this property: access
        + delete_property capability, and the property is not already archived.
        Gates the grey archive button.
        """
        user = self._user()
        if user is None:
            return False
        return (
            obj.status != PropertyStatus.ARCHIVED
            and user_can_access_crm_property(user, obj)
            and crm_user_has_capability(user, "delete_property")
        )

    def get_can_restore(self, obj) -> bool:
        """
        Whether the current user may restore this property from archive (status
        -> draft via to_draft): access + edit_property capability, and the
        property is currently archived. Gates the "Восстановить" button.
        """
        user = self._user()
        if user is None:
            return False
        return (
            obj.status == PropertyStatus.ARCHIVED
            and user_can_access_crm_property(user, obj)
            and crm_user_has_capability(user, "edit_property")
        )

    def get_has_owner(self, obj) -> bool:
        return obj.owner_id is not None

    class Meta:
        model = Property
        fields = [
            "id",
            "crm_property_id",
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
            "has_owner",
            "owner_name",
            "can_delete",
            "can_archive",
            "can_restore",
        ]


class CrmApartmentDetailsSerializer(serializers.ModelSerializer):
    """CRM: полные характеристики квартиры (чтение и вложенная запись)."""

    class Meta:
        model = ApartmentDetails
        fields = [
            "rooms",
            "area_total",
            "area_living",
            "area_kitchen",
            "floor",
            "floors_total",
            "has_balcony",
            "has_loggia",
            "renovation_type",
            "bathroom_type",
        ]


class CrmHouseDetailsSerializer(serializers.ModelSerializer):
    class Meta:
        model = HouseDetails
        fields = [
            "house_area",
            "land_area",
            "floors_total",
            "heating_type",
            "has_gas",
            "has_water",
            "has_sewerage",
            "has_electricity",
            "building_type",
        ]


class CrmLandPlotDetailsSerializer(serializers.ModelSerializer):
    class Meta:
        model = LandPlotDetails
        fields = [
            "land_area",
            "land_category",
            "permitted_use",
            "has_gas",
            "has_water",
            "has_electricity",
        ]


class CrmCommercialDetailsSerializer(serializers.ModelSerializer):
    class Meta:
        model = CommercialDetails
        fields = [
            "commercial_type",
            "area_total",
            "floor",
            "floors_total",
            "entrance_type",
            "parking_spaces",
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
    # Owner (собственник) — CRM-only nested read. Never in any public serializer.
    owner = OwnerShortSerializer(read_only=True, allow_null=True)
    apartment_details = CrmApartmentDetailsSerializer(
        read_only=True, allow_null=True
    )
    house_details = CrmHouseDetailsSerializer(read_only=True, allow_null=True)
    land_plot_details = CrmLandPlotDetailsSerializer(
        read_only=True, allow_null=True
    )
    commercial_details = CrmCommercialDetailsSerializer(
        read_only=True, allow_null=True
    )

    class Meta:
        model = Property
        fields = [
            "id",
            "crm_property_id",
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
            "owner",
            "apartment_details",
            "house_details",
            "land_plot_details",
            "commercial_details",
        ]


class CrmPropertyWriteSerializer(serializers.ModelSerializer):
    """Create / update property in CRM (no hard delete; status via workflow actions)."""

    id = serializers.IntegerField(read_only=True)
    crm_property_id = serializers.CharField(read_only=True)
    title_generated = serializers.CharField(read_only=True)
    slug = serializers.SlugField(read_only=True, allow_null=True)

    assigned_realtor = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(role=User.Role.REALTOR).order_by("pk"),
        required=False,
        allow_null=False,
    )
    # Owner link — optional (nullable). Standard FK write; the Owner record itself
    # is created/edited via /api/crm/owners/ (the modal), then linked here by id.
    owner = serializers.PrimaryKeyRelatedField(
        queryset=Owner.objects.all(),
        required=False,
        allow_null=True,
    )

    class Meta:
        model = Property
        fields = [
            "id",
            "crm_property_id",
            "agency",
            "assigned_realtor",
            "owner",
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
            "apartment_details",
            "house_details",
            "land_plot_details",
            "commercial_details",
        ]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        partial = bool(kwargs.get("partial", False))
        self.fields["apartment_details"] = CrmApartmentDetailsSerializer(
            required=False, allow_null=True, partial=partial
        )
        self.fields["house_details"] = CrmHouseDetailsSerializer(
            required=False, allow_null=True, partial=partial
        )
        self.fields["land_plot_details"] = CrmLandPlotDetailsSerializer(
            required=False, allow_null=True, partial=partial
        )
        self.fields["commercial_details"] = CrmCommercialDetailsSerializer(
            required=False, allow_null=True, partial=partial
        )

    def _pop_detail_payloads(self, validated_data: dict) -> dict:
        return {
            "apartment": validated_data.pop("apartment_details", None),
            "house": validated_data.pop("house_details", None),
            "land": validated_data.pop("land_plot_details", None),
            "commercial": validated_data.pop("commercial_details", None),
        }

    def _validate_nested_matches_type(self, attrs: dict) -> None:
        pt = attrs.get("property_type") or (
            self.instance.property_type if self.instance else None
        )
        if not pt:
            return
        nested_map = [
            (PropertyType.APARTMENT, "apartment_details", attrs.get("apartment_details")),
            (PropertyType.HOUSE, "house_details", attrs.get("house_details")),
            (PropertyType.LAND, "land_plot_details", attrs.get("land_plot_details")),
            (
                PropertyType.COMMERCIAL,
                "commercial_details",
                attrs.get("commercial_details"),
            ),
        ]
        for expected, key, payload in nested_map:
            if payload is not None and pt != expected:
                raise serializers.ValidationError(
                    {
                        key: "Этот блок характеристик не соответствует выбранному типу объекта."
                    }
                )

    def validate(self, attrs):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if self.instance is None and user and isinstance(user, User):
            if user.has_staff_level_access and not attrs.get("assigned_realtor"):
                raise serializers.ValidationError(
                    {"assigned_realtor": "Укажите ответственного риэлтора."}
                )
        self._validate_nested_matches_type(attrs)
        return attrs

    def _merged_detail_defaults(self, model_cls, instance: Property, incoming: dict) -> dict:
        """При PATCH объединяем переданные поля характеристик с уже сохранённой строкой."""
        if not self.partial:
            return incoming
        try:
            existing = model_cls.objects.get(property=instance)
        except model_cls.DoesNotExist:
            return incoming
        skip = {"id", "property", "property_id", "created_at", "updated_at"}
        out: dict = {}
        for f in model_cls._meta.fields:
            if f.name in skip:
                continue
            if f.name in incoming:
                out[f.name] = incoming[f.name]
            else:
                out[f.name] = getattr(existing, f.name)
        return out

    def _save_type_details(self, instance: Property, payloads: dict) -> None:
        apt, house, land_d, comm = (
            payloads["apartment"],
            payloads["house"],
            payloads["land"],
            payloads["commercial"],
        )
        pt = instance.property_type
        if pt == PropertyType.APARTMENT and apt is not None:
            defaults = self._merged_detail_defaults(ApartmentDetails, instance, apt)
            ApartmentDetails.objects.update_or_create(
                property=instance, defaults=defaults
            )
        if pt == PropertyType.HOUSE and house is not None:
            defaults = self._merged_detail_defaults(HouseDetails, instance, house)
            HouseDetails.objects.update_or_create(property=instance, defaults=defaults)
        if pt == PropertyType.LAND and land_d is not None:
            defaults = self._merged_detail_defaults(LandPlotDetails, instance, land_d)
            LandPlotDetails.objects.update_or_create(
                property=instance, defaults=defaults
            )
        if pt == PropertyType.COMMERCIAL and comm is not None:
            defaults = self._merged_detail_defaults(CommercialDetails, instance, comm)
            CommercialDetails.objects.update_or_create(
                property=instance, defaults=defaults
            )

    def create(self, validated_data):
        request = self.context["request"]
        user = request.user
        payloads = self._pop_detail_payloads(validated_data)
        if isinstance(user, User) and user.is_realtor_role and not user.has_staff_level_access:
            validated_data["assigned_realtor"] = user
        if user and user.is_authenticated:
            validated_data.setdefault("created_by", user)
        instance = super().create(validated_data)
        self._save_type_details(instance, payloads)
        instance.refresh_from_db()
        return instance

    def update(self, instance, validated_data):
        request = self.context["request"]
        user = request.user
        if isinstance(user, User) and user.is_realtor_role and not user.has_staff_level_access:
            validated_data.pop("assigned_realtor", None)
        elif "assigned_realtor" in validated_data and validated_data["assigned_realtor"] is None:
            raise serializers.ValidationError(
                {"assigned_realtor": "Ответственный риэлтор обязателен."}
            )
        payloads = self._pop_detail_payloads(validated_data)
        instance = super().update(instance, validated_data)
        self._save_type_details(instance, payloads)
        instance.refresh_from_db()
        return instance


class CrmPropertyPhotoSerializer(serializers.ModelSerializer):
    """CRM read representation for property photos."""

    # Declared explicitly so these render through `media_url` like every other
    # media path. Left to DRF, ModelSerializer would use its own FileField, which
    # applies build_absolute_uri and would put `http://<backend-host>/media/…`
    # here under the local backend while the public photo serializer next door
    # returned `/media/…`. That split is what common/media_urls.py removed.
    original_file = MediaURLField()
    image_large = MediaURLField()
    image_medium = MediaURLField()
    image_thumb = MediaURLField()

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

    def validate_original_file(self, value):
        try:
            validate_property_photo_original_size(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.messages)
        return value

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

    video_url = serializers.URLField(max_length=2048)
    embed_url = serializers.URLField(
        max_length=2048,
        required=False,
        allow_blank=True,
        default="",
    )

    class Meta:
        model = PropertyVideo
        fields = ["platform", "video_url", "embed_url"]

    def validate_embed_url(self, value):
        return (value or "").strip()


class CrmImportItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = ImportItem
        fields = [
            "id",
            "row_index",
            "external_id",
            "raw_snapshot",
            "status",
            "property",
            "duplicate_candidate",
            "dedup_outcome",
            "error_message",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class CrmImportJobListSerializer(serializers.ModelSerializer):
    class Meta:
        model = ImportJob
        fields = [
            "id",
            "source_format",
            "status",
            "row_count_total",
            "row_count_created",
            "row_count_skipped_duplicate",
            "row_count_error",
            "error_summary",
            "created_at",
            "updated_at",
            "finished_at",
        ]
        read_only_fields = fields


class CrmImportJobDetailSerializer(serializers.ModelSerializer):
    items = CrmImportItemSerializer(many=True, read_only=True)

    class Meta:
        model = ImportJob
        fields = [
            "id",
            "source_format",
            "status",
            "field_mapping",
            "row_count_total",
            "row_count_created",
            "row_count_skipped_duplicate",
            "row_count_error",
            "error_summary",
            "created_at",
            "updated_at",
            "finished_at",
            "items",
        ]
        read_only_fields = fields


class CrmImportJobCreateSerializer(serializers.ModelSerializer):
    """
    Multipart: ``source_file``, ``source_format`` (csv|xml),
    ``field_mapping`` — JSON-строка вида {\"ВнешнийСтолбец\": \"price\", ...}.
    """

    field_mapping = serializers.CharField()

    class Meta:
        model = ImportJob
        fields = ["source_file", "source_format", "field_mapping"]

    def validate_source_format(self, value):
        v = (value or "").strip().lower()
        allowed = {c.value for c in ImportSourceFormat}
        if v not in allowed:
            raise serializers.ValidationError("Допустимо: csv или xml.")
        return v

    def validate_field_mapping(self, value):
        if isinstance(value, dict):
            raw = value
        else:
            s = (value or "").strip()
            if not s:
                raise serializers.ValidationError(
                    "Укажите field_mapping (JSON-объект: внешнее имя → внутреннее поле)."
                )
            try:
                raw = json.loads(s)
            except json.JSONDecodeError as exc:
                raise serializers.ValidationError(
                    "field_mapping: невалидный JSON."
                ) from exc
        if not isinstance(raw, dict):
            raise serializers.ValidationError("field_mapping должен быть JSON-объектом.")
        out = {}
        for k, v in raw.items():
            if not isinstance(k, str) or not isinstance(v, str):
                raise serializers.ValidationError(
                    "Ключи и значения сопоставления должны быть строками."
                )
            out[k.strip()] = (v or "").strip()
        return out

    def create(self, validated_data):
        request = self.context["request"]
        user = request.user
        mapping = validated_data.pop("field_mapping")
        agency = None
        if user and user.is_authenticated:
            from users.models import RealtorProfile

            prof = (
                RealtorProfile.objects.filter(user=user)
                .select_related("agency")
                .first()
            )
            if prof:
                agency = prof.agency
        return ImportJob.objects.create(
            created_by=user if user.is_authenticated else None,
            agency=agency,
            field_mapping=mapping,
            **validated_data,
        )


class DuplicateCheckSerializer(serializers.Serializer):
    """
    Input for POST /api/crm/properties/check_duplicates/.

    Accepts base property fields plus optional type-specific detail signals.
    City / district / residential_complex are passed as integer PKs (no FK
    validation — this endpoint has no side effects).

    The optional `ignore_duplicate_warning` field is accepted and ignored
    server-side; it exists to support the client-side two-step flow contract
    where the UI calls check_duplicates first, shows warnings, and then
    calls the real create endpoint with this flag to signal explicit confirmation.
    """

    property_type = serializers.ChoiceField(choices=PropertyType.choices)
    city = serializers.IntegerField(required=False, allow_null=True)
    district = serializers.IntegerField(required=False, allow_null=True)
    residential_complex = serializers.IntegerField(required=False, allow_null=True)
    street = serializers.CharField(required=False, allow_blank=True, default="")
    house_number = serializers.CharField(required=False, allow_blank=True, default="")
    price = serializers.DecimalField(
        max_digits=15, decimal_places=2, required=False, allow_null=True
    )
    # Apartment-specific
    rooms = serializers.IntegerField(required=False, allow_null=True, min_value=0)
    area_total = serializers.DecimalField(
        max_digits=8, decimal_places=2, required=False, allow_null=True
    )
    floor = serializers.IntegerField(required=False, allow_null=True, min_value=0)
    floors_total = serializers.IntegerField(required=False, allow_null=True, min_value=0)
    # House-specific
    house_area = serializers.DecimalField(
        max_digits=8, decimal_places=2, required=False, allow_null=True
    )
    land_area = serializers.DecimalField(
        max_digits=10, decimal_places=2, required=False, allow_null=True
    )
    # Commercial-specific
    commercial_type = serializers.ChoiceField(
        choices=CommercialType.choices, required=False, allow_null=True, allow_blank=True
    )
    # Client-side flow signal — accepted but not enforced server-side
    ignore_duplicate_warning = serializers.BooleanField(required=False, default=False)
