import re

from django.core.cache import cache
from rest_framework import serializers

from leads.choices import LeadSource, LeadStatus
from leads.models import Lead, LeadComment, LeadStatusHistory
from properties.choices import PropertyStatus
from properties.serializers import (
    AgencyShortSerializer,
    CrmPropertyListSerializer,
    RealtorShortSerializer,
)

_CLIENT_MESSAGE_MAX = 4000
_PHONE_MAX_LEN = 32
_PHONE_MIN_DIGITS = 10


_CAPTCHA_CACHE_KEY = "lead_captcha:{}"
_CAPTCHA_CACHE_TIMEOUT = 600


class PublicLeadCreateSerializer(serializers.ModelSerializer):
    captcha_id = serializers.UUIDField(write_only=True)
    captcha_answer = serializers.CharField(
        write_only=True,
        max_length=16,
        trim_whitespace=True,
        allow_blank=True,
    )

    class Meta:
        model = Lead
        fields = [
            "id",
            "property",
            "client_name",
            "client_phone",
            "client_message",
            "captcha_id",
            "captcha_answer",
            "source",
            "status",
            "created_at",
        ]
        read_only_fields = ["id", "source", "status", "created_at"]
        extra_kwargs = {
            "property": {"required": False, "allow_null": True},
            "client_message": {"required": False, "allow_blank": True},
            "client_name": {"max_length": 255},
            "client_phone": {"max_length": _PHONE_MAX_LEN},
        }

    def validate_client_name(self, value):
        s = (value or "").strip()
        if not s:
            raise serializers.ValidationError("Укажите имя.")
        if len(s) > 255:
            raise serializers.ValidationError("Имя слишком длинное.")
        return s

    def validate_client_phone(self, value):
        s = (value or "").strip()
        if not s:
            raise serializers.ValidationError("Укажите телефон.")
        digits = re.sub(r"\D", "", s)
        if len(digits) < _PHONE_MIN_DIGITS:
            raise serializers.ValidationError("Укажите корректный номер телефона.")
        if len(s) > _PHONE_MAX_LEN:
            raise serializers.ValidationError("Номер телефона слишком длинный.")
        return s

    def validate_client_message(self, value):
        if value is None:
            return ""
        s = value.strip()
        if len(s) > _CLIENT_MESSAGE_MAX:
            raise serializers.ValidationError("Текст сообщения слишком длинный.")
        return s

    def validate_property(self, value):
        if value is None:
            return value
        if (
            not value.is_published
            or value.status != PropertyStatus.PUBLISHED
        ):
            raise serializers.ValidationError(
                "Указанный объект недвижимости недоступен."
            )
        return value

    def validate(self, attrs):
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
        return attrs

    def create(self, validated_data):
        validated_data["source"] = LeadSource.WEBSITE
        validated_data.setdefault("status", LeadStatus.NEW)
        return super().create(validated_data)


class CrmLeadListSerializer(serializers.ModelSerializer):
    property = CrmPropertyListSerializer(read_only=True, allow_null=True)
    assigned_realtor = RealtorShortSerializer(read_only=True, allow_null=True)
    agency = AgencyShortSerializer(read_only=True, allow_null=True)

    class Meta:
        model = Lead
        fields = [
            "id",
            "property",
            "client_name",
            "client_phone",
            "client_message",
            "source",
            "status",
            "priority",
            "processed_at",
            "assigned_realtor",
            "agency",
            "created_at",
            "updated_at",
        ]


class LeadStatusHistoryReadSerializer(serializers.ModelSerializer):
    changed_by = RealtorShortSerializer(read_only=True, allow_null=True)

    class Meta:
        model = LeadStatusHistory
        fields = [
            "id",
            "previous_status",
            "new_status",
            "changed_by",
            "created_at",
        ]


class CrmLeadCommentReadSerializer(serializers.ModelSerializer):
    author_user = RealtorShortSerializer(read_only=True, allow_null=True)

    class Meta:
        model = LeadComment
        fields = ["id", "text", "author_user", "created_at", "updated_at"]


class CrmLeadDetailSerializer(serializers.ModelSerializer):
    property = CrmPropertyListSerializer(read_only=True, allow_null=True)
    assigned_realtor = RealtorShortSerializer(read_only=True, allow_null=True)
    agency = AgencyShortSerializer(read_only=True, allow_null=True)
    comments = CrmLeadCommentReadSerializer(many=True, read_only=True)
    status_history = LeadStatusHistoryReadSerializer(many=True, read_only=True)

    class Meta:
        model = Lead
        fields = [
            "id",
            "property",
            "client_name",
            "client_phone",
            "client_message",
            "source",
            "status",
            "priority",
            "processed_at",
            "assigned_realtor",
            "agency",
            "comments",
            "status_history",
            "created_at",
            "updated_at",
        ]


class CrmLeadSetStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=LeadStatus.choices)


class CrmLeadCommentCreateSerializer(serializers.Serializer):
    text = serializers.CharField(max_length=8000, min_length=1)

    def validate_text(self, value):
        s = (value or "").strip()
        if not s:
            raise serializers.ValidationError("Введите текст комментария.")
        if len(s) > 8000:
            raise serializers.ValidationError("Текст комментария слишком длинный.")
        return s
