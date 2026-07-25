import re

from rest_framework import serializers

from .models import Owner

# Name: Cyrillic + Latin letters (incl. ё/Ё), spaces, hyphen, dot (initials). No digits.
_NAME_ALLOWED = re.compile(r"^[A-Za-zА-Яа-яЁё\s.\-]+$")
_PHONE_ALLOWED = re.compile(r"^\+?[\d\s\-()]{7,32}$")


class OwnerSerializer(serializers.ModelSerializer):
    """
    CRM read/write for an Owner. Served ONLY by CRM-authenticated endpoints —
    never public. `properties` is a derived, read-only list of linked property
    references (the owner's 'addresses' come from the relationship, not a field).
    """

    photo = serializers.ImageField(required=False, allow_null=True)
    properties = serializers.SerializerMethodField()
    properties_count = serializers.IntegerField(
        source="properties.count", read_only=True
    )

    class Meta:
        model = Owner
        fields = [
            "id",
            "full_name",
            "phone",
            "photo",
            "note",
            "properties",
            "properties_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_properties(self, obj):
        rows = obj.properties.all().only(
            "id", "crm_property_id", "title_generated", "status"
        )
        return [
            {
                "id": p.id,
                "crm_property_id": p.crm_property_id,
                "title_generated": p.title_generated,
                "status": p.status,
                "status_label": p.get_status_display(),
            }
            for p in rows
        ]

    def validate_full_name(self, value):
        v = (value or "").strip()
        if not v:
            raise serializers.ValidationError("Укажите ФИО собственника.")
        if not _NAME_ALLOWED.match(v):
            raise serializers.ValidationError(
                "ФИО может содержать только буквы, пробелы, точку и дефис."
            )
        return v

    def validate_phone(self, value):
        v = (value or "").strip()
        digits = re.sub(r"\D", "", v)
        if len(digits) < 10 or not _PHONE_ALLOWED.match(v):
            raise serializers.ValidationError("Укажите корректный номер телефона.")
        return v


class OwnerShortSerializer(serializers.ModelSerializer):
    """
    Compact owner representation nested inside CRM property serializers. CRM-only.
    """

    photo = serializers.SerializerMethodField()

    class Meta:
        model = Owner
        fields = ["id", "full_name", "phone", "photo", "note"]

    def get_photo(self, obj):
        if not obj.photo:
            return None
        request = self.context.get("request")
        url = obj.photo.url
        return request.build_absolute_uri(url) if request else url
