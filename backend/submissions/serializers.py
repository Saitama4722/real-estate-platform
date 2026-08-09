import re

from django.core.cache import cache
from rest_framework import serializers

from common.media_urls import media_url
from locations.models import City, District, Neighborhood

from .choices import SaleRequestStatus
from .models import SaleRequest, SaleRequestPhoto

# Reuse the SAME arithmetic captcha as the public lead form: same cache namespace,
# populated by the shared PublicLeadCaptchaView (GET /api/leads/captcha). The /sell
# form fetches its captcha from that same endpoint — no duplicate captcha service.
_CAPTCHA_CACHE_KEY = "lead_captcha:{}"

# Digits, optional leading +, spaces/dashes/parens allowed on input.
_PHONE_ALLOWED = re.compile(r"^\+?[\d\s\-()]{7,32}$")
# Name: Cyrillic + Latin letters (incl. ё/Ё), spaces, hyphen. No digits.
_NAME_ALLOWED = re.compile(r"^[A-Za-zА-Яа-яЁё\s\-]+$")


class SaleRequestPhotoPublicSerializer(serializers.Serializer):
    """Read-back of a created photo (URL only) — no owner data here."""

    id = serializers.IntegerField(read_only=True)
    image = serializers.SerializerMethodField()

    def get_image(self, obj):
        return media_url(obj.image)


class PublicSaleRequestCreateSerializer(serializers.ModelSerializer):
    """
    Public "Продать недвижимость" submission.

    SECURITY: this is the ONLY public entry point for SaleRequest, and it is
    WRITE-ONLY for sensitive fields. `owner_phone` is declared write_only so it
    can NEVER appear in the response, and there is no public read/list/detail
    endpoint at all. The success response returns only a minimal confirmation
    (id + status) — never echoes the phone.
    """

    owner_phone = serializers.CharField(max_length=32, write_only=True)
    # Arithmetic captcha (same mechanism as the public lead form).
    captcha_id = serializers.UUIDField(write_only=True)
    captcha_answer = serializers.CharField(
        write_only=True, max_length=16, trim_whitespace=True, allow_blank=True
    )
    # Photos accepted as a list of uploaded files (multipart). At least one.
    photos = serializers.ListField(
        child=serializers.ImageField(),
        write_only=True,
        allow_empty=False,
        min_length=1,
        max_length=10,
    )
    # Write-only FK ids that reuse the existing location taxonomy.
    city = serializers.PrimaryKeyRelatedField(queryset=City.objects.all())
    district = serializers.PrimaryKeyRelatedField(
        queryset=District.objects.all(), required=False, allow_null=True
    )
    neighborhood = serializers.PrimaryKeyRelatedField(
        queryset=Neighborhood.objects.all(), required=False, allow_null=True
    )

    class Meta:
        model = SaleRequest
        fields = [
            "id",
            "owner_name",
            "owner_phone",
            "city",
            "district",
            "neighborhood",
            "description",
            "property_type",
            "area",
            "rooms",
            "asking_price",
            "photos",
            "captcha_id",
            "captcha_answer",
            "status",
        ]
        # id + status are all the public caller ever reads back. owner_phone is
        # write_only above; everything else write-echoed is non-sensitive, but we
        # deliberately keep the create response minimal in the view.
        read_only_fields = ["id", "status"]

    def validate_owner_name(self, value):
        v = (value or "").strip()
        if not v:
            raise serializers.ValidationError("Укажите ФИО.")
        if not _NAME_ALLOWED.match(v):
            raise serializers.ValidationError(
                "ФИО может содержать только буквы, пробелы и дефис."
            )
        return v

    def validate_owner_phone(self, value):
        v = (value or "").strip()
        digits = re.sub(r"\D", "", v)
        if len(digits) < 10 or not _PHONE_ALLOWED.match(v):
            raise serializers.ValidationError("Укажите корректный номер телефона.")
        return v

    def validate_description(self, value):
        v = (value or "").strip()
        if len(v) < 10:
            raise serializers.ValidationError(
                "Опишите объект чуть подробнее (минимум 10 символов)."
            )
        return v

    def _validate_captcha(self, attrs):
        # Mirrors PublicLeadCreateSerializer.validate captcha logic exactly.
        captcha_id = attrs.pop("captcha_id", None)
        raw_answer = attrs.pop("captcha_answer", None)
        if captcha_id is None:
            raise serializers.ValidationError(
                {"captcha_id": "Отсутствует идентификатор проверки."}
            )
        cache_key = _CAPTCHA_CACHE_KEY.format(captcha_id)
        expected = cache.get(cache_key)
        if expected is None:
            raise serializers.ValidationError(
                {"captcha": "Срок действия проверки истёк. Запросите новую задачу."}
            )
        if raw_answer is None or not str(raw_answer).strip():
            raise serializers.ValidationError(
                {"captcha_answer": "Введите ответ на пример."}
            )
        try:
            user_answer = int(str(raw_answer).strip(), 10)
        except ValueError:
            raise serializers.ValidationError(
                {"captcha_answer": "Ответ должен быть целым числом."}
            )
        if user_answer != expected:
            raise serializers.ValidationError(
                {"captcha_answer": "Неверный ответ. Попробуйте снова."}
            )
        cache.delete(cache_key)

    def validate(self, attrs):
        self._validate_captcha(attrs)
        # Ensure district/neighborhood, if given, belong to the chosen city — keeps
        # the CRM data clean and prevents cross-city mismatches.
        city = attrs.get("city")
        district = attrs.get("district")
        neighborhood = attrs.get("neighborhood")
        if district is not None and city is not None and district.city_id != city.id:
            raise serializers.ValidationError(
                {"district": "Район не относится к выбранному городу."}
            )
        if (
            neighborhood is not None
            and city is not None
            and neighborhood.city_id != city.id
        ):
            raise serializers.ValidationError(
                {"neighborhood": "Микрорайон не относится к выбранному городу."}
            )
        return attrs

    def create(self, validated_data):
        photos = validated_data.pop("photos", [])
        sale_request = SaleRequest.objects.create(**validated_data)
        for i, image in enumerate(photos):
            SaleRequestPhoto.objects.create(
                sale_request=sale_request, image=image, sort_order=i
            )
        return sale_request


# ─────────────────────────── CRM serializers ───────────────────────────
# These are served ONLY by CRM-authenticated endpoints. owner_phone IS included
# here (CRM realtors need it) — but never on any public route.


class CrmSaleRequestPhotoSerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()

    class Meta:
        model = SaleRequestPhoto
        fields = ["id", "image", "sort_order"]

    def get_image(self, obj):
        return media_url(obj.image)


class _CrmLocationShortSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    slug = serializers.CharField()


class CrmSaleRequestListSerializer(serializers.ModelSerializer):
    city = _CrmLocationShortSerializer(read_only=True)
    district = _CrmLocationShortSerializer(read_only=True)
    neighborhood = _CrmLocationShortSerializer(read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    photos_count = serializers.IntegerField(source="photos.count", read_only=True)

    class Meta:
        model = SaleRequest
        fields = [
            "id",
            "owner_name",
            "owner_phone",  # CRM-only endpoint — allowed here, never public.
            "city",
            "district",
            "neighborhood",
            "property_type",
            "asking_price",
            "status",
            "status_label",
            "converted_property",
            "photos_count",
            "created_at",
        ]


class CrmSaleRequestDetailSerializer(serializers.ModelSerializer):
    city = _CrmLocationShortSerializer(read_only=True)
    district = _CrmLocationShortSerializer(read_only=True)
    neighborhood = _CrmLocationShortSerializer(read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    property_type_label = serializers.CharField(
        source="get_property_type_display", read_only=True
    )
    photos = CrmSaleRequestPhotoSerializer(many=True, read_only=True)
    converted_property_pid = serializers.SerializerMethodField()

    class Meta:
        model = SaleRequest
        fields = [
            "id",
            "owner_name",
            "owner_phone",  # CRM-only endpoint.
            "city",
            "district",
            "neighborhood",
            "description",
            "property_type",
            "property_type_label",
            "area",
            "rooms",
            "asking_price",
            "status",
            "status_label",
            "converted_property",
            "converted_property_pid",
            "converted_at",
            "photos",
            "created_at",
            "updated_at",
        ]

    def get_converted_property_pid(self, obj):
        if obj.converted_property_id and obj.converted_property:
            return obj.converted_property.crm_property_id
        return None


class CrmSaleRequestUpdateSerializer(serializers.ModelSerializer):
    """
    Realtor edit of a submission before converting. Allows cleaning up the raw
    description + structured details + status. Owner contact and location are NOT
    editable here (they're the owner's submitted facts); status changes to
    "converted" happen only via the convert action, not here.
    """

    class Meta:
        model = SaleRequest
        fields = [
            "owner_name",
            "description",
            "property_type",
            "area",
            "rooms",
            "asking_price",
            "status",
        ]

    def validate_status(self, value):
        # The "converted" status is set only by the convert action, never by a
        # plain edit — prevents marking a request converted without a real object.
        if value == SaleRequestStatus.CONVERTED:
            raise serializers.ValidationError(
                "Статус «Создан объект» устанавливается только при создании объекта."
            )
        return value
