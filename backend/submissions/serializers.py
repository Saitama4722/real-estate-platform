import re

from django.core.cache import cache
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from common.image_compression import (
    ALLOWED_UPLOAD_FORMATS,
    MAX_IMAGE_UPLOAD_BYTES,
    validate_image_upload,
)
from common.city_bounds import SERVED_CITIES, city_for_point
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

# --- Precise address ---------------------------------------------------------
# ⚠ SCOPE IS TWO CITIES, NOT THE KRAI. This replaced a Krasnodar-Krai bbox
# (lat 43–47, lon 36–42) that accepted Сочи, Новороссийск, Армавир and the rest
# of the region. The boxes live in common/city_bounds.py, mirrored from
# frontend/src/shared/cityBounds.json with a test asserting they match.
#: Shortest thing that can plausibly be "street + house".
ADDRESS_MIN_LEN = 5


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
    # ⚠ REQUIRED here even though the model column is blank=True — the column is
    # permissive only so the migration needed no backfill for existing rows.
    address = serializers.CharField(max_length=500, required=True, allow_blank=False)
    # Optional BY DESIGN: if the geocoding provider is down the owner types the
    # address by hand and gets no coordinates. A third-party outage must never
    # block a lead. When they ARE sent, they are validated.
    latitude = serializers.DecimalField(
        max_digits=9, decimal_places=6, required=False, allow_null=True)
    longitude = serializers.DecimalField(
        max_digits=9, decimal_places=6, required=False, allow_null=True)
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
            "address",
            "latitude",
            "longitude",
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

    def validate_address(self, value):
        v = (value or "").strip()
        if len(v) < ADDRESS_MIN_LEN:
            raise serializers.ValidationError(
                "Укажите точный адрес: улицу и номер дома."
            )
        return v

    def _validate_point(self, attrs):
        """Coordinates are optional, but junk is never stored.

        NEVER TRUST THE CLIENT: this runs regardless of what the browser
        checked. Out-of-range values are rejected with a readable message —
        not stored, and never allowed to become a 500.
        """
        lat = attrs.get("latitude")
        lon = attrs.get("longitude")
        if lat is None and lon is None:
            return
        if lat is None or lon is None:
            raise serializers.ValidationError(
                {"latitude": "Координаты передаются парой: широта и долгота."}
            )
        if city_for_point(float(lat), float(lon)) is None:
            raise serializers.ValidationError(
                {
                    "latitude": (
                        "Точка на карте вне зоны работы: мы работаем только по "
                        f"городам {' и '.join(SERVED_CITIES)} и их окрестностям. "
                        "Уточните адрес."
                    )
                }
            )

    def validate_description(self, value):
        v = (value or "").strip()
        if len(v) < 10:
            raise serializers.ValidationError(
                "Опишите объект чуть подробнее (минимум 10 символов)."
            )
        return v

    def validate_photos(self, value):
        """
        Size + real-format check on every uploaded photo.

        ⚠ This endpoint is PUBLIC and unauthenticated, so it receives junk by
        design: renamed .exe files, truncated uploads, 50 MB camera RAWs. Before
        this existed there was NO byte limit and NO format whitelist here at all
        — only the count cap of 10 and Pillow's implicit decodability check.

        Every failure must surface as a 400 with a readable Russian message;
        nothing here may reach the view as an unhandled exception.
        """
        errors = {}
        for index, uploaded in enumerate(value):
            try:
                validate_image_upload(
                    uploaded,
                    max_bytes=MAX_IMAGE_UPLOAD_BYTES,
                    allowed_formats=ALLOWED_UPLOAD_FORMATS,
                )
            except DjangoValidationError as exc:
                # Name the offending file so the owner knows which one to swap.
                label = getattr(uploaded, "name", "") or f"#{index + 1}"
                errors[str(index)] = f"{label}: {' '.join(exc.messages)}"
        if errors:
            raise serializers.ValidationError(errors)
        return value

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
        self._validate_point(attrs)
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
# here — full for staff and for the realtor who took the request, masked for a
# realtor looking at a FREE one — and never on any public route.


class CrmSaleRequestPhotoSerializer(serializers.ModelSerializer):
    """
    CRM read representation. Exposes the derivative ladder so the cabinet can
    render a sized preview instead of loading (or navigating to) the full
    original — which is what it used to do.

    ``image`` remains the stored original for anyone who genuinely needs it;
    the CRM UI picks ``image_thumb`` for the grid and ``image_large`` for the
    lightbox, falling back down the ladder when a derivative is missing (the
    Celery worker may not have run yet).
    """

    image = serializers.SerializerMethodField()
    image_large = serializers.SerializerMethodField()
    image_medium = serializers.SerializerMethodField()
    image_thumb = serializers.SerializerMethodField()

    class Meta:
        model = SaleRequestPhoto
        fields = ["id", "image", "image_large", "image_medium", "image_thumb", "sort_order"]

    def get_image(self, obj):
        return media_url(obj.image)

    def get_image_large(self, obj):
        return media_url(obj.image_large)

    def get_image_medium(self, obj):
        return media_url(obj.image_medium)

    def get_image_thumb(self, obj):
        return media_url(obj.image_thumb)


class _CrmLocationShortSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    slug = serializers.CharField()


class _CrmSaleRequestQueueMixin(serializers.Serializer):
    """
    Queue fields shared by the CRM list and detail (2026-10-18).

    `owner_phone` is MASKED for a realtor until the request is theirs: a free
    request is look-only, exactly like a free lead. Staff keep the full number
    they always had.
    """

    owner_phone = serializers.SerializerMethodField()
    is_free = serializers.SerializerMethodField()
    assigned_realtor = serializers.SerializerMethodField()

    def _viewer(self):
        request = self.context.get("request")
        return getattr(request, "user", None)

    def get_owner_phone(self, obj):
        user = self._viewer()
        if getattr(user, "has_staff_level_access", False):
            return obj.owner_phone
        if user is not None and obj.assigned_realtor_id == getattr(user, "pk", None):
            return obj.owner_phone
        from leads.serializers import mask_client_phone  # lazy: avoids an import cycle

        return mask_client_phone(obj.owner_phone)

    def get_is_free(self, obj):
        return obj.assigned_realtor_id is None

    def get_assigned_realtor(self, obj):
        u = obj.assigned_realtor
        if u is None:
            return None
        name = f"{(u.first_name or '').strip()} {(u.last_name or '').strip()}".strip()
        return {"id": u.pk, "name": name or u.email}


class CrmSaleRequestListSerializer(_CrmSaleRequestQueueMixin, serializers.ModelSerializer):
    city = _CrmLocationShortSerializer(read_only=True)
    district = _CrmLocationShortSerializer(read_only=True)
    neighborhood = _CrmLocationShortSerializer(read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    photos_count = serializers.IntegerField(source="photos.count", read_only=True)
    #: Аннотация из `CrmSaleRequestViewSet.get_queryset`, а не поле модели:
    #: пул общий, а прочтение личное. См. `common.crm_unread`.
    is_unread = serializers.BooleanField(read_only=True, default=False)

    class Meta:
        model = SaleRequest
        fields = [
            "id",
            "owner_name",
            "owner_phone",  # CRM-only, masked for realtors until taken.
            "is_free",
            "assigned_realtor",
            "city",
            "district",
            "neighborhood",
            "address",
            "property_type",
            "asking_price",
            "status",
            "status_label",
            "converted_property",
            "photos_count",
            "is_unread",
            "created_at",
        ]


class CrmSaleRequestDetailSerializer(_CrmSaleRequestQueueMixin, serializers.ModelSerializer):
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
            "owner_phone",  # CRM-only, masked for realtors until taken.
            "is_free",
            "assigned_realtor",
            "city",
            "district",
            "neighborhood",
            "address",
            "latitude",
            "longitude",
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
