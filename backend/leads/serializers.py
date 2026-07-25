import re

from django.core.cache import cache
from rest_framework import serializers

from leads.choices import LeadSource, LeadStatus
from leads.models import Lead, LeadActionLog, LeadComment, LeadNote, LeadStatusHistory
from properties.choices import PropertyStatus
from users.models import User
from properties.serializers import (
    AgencyShortSerializer,
    CrmPropertyListSerializer,
    RealtorShortSerializer,
)

_CLIENT_MESSAGE_MAX = 300
_PHONE_MAX_LEN = 32
_PHONE_MIN_DIGITS = 10

# Имя: только буквы (кириллица/латиница) и пробелы — тот же набор, что и маска на
# фронте. Дефисы и цифры запрещены (defense in depth против прямых вызовов API).
_NAME_DISALLOWED_RE = re.compile(r"[^a-zA-Zа-яА-ЯёЁ\s]")


def mask_client_phone(value: str) -> str:
    """Маска для CRM-списков и карточек; полный номер — только через reveal_phone."""
    raw = (value or "").strip()
    if not raw:
        return "—"
    digits = re.sub(r"\D", "", raw)
    if len(digits) < 4:
        return "••••"
    tail = digits[-4:]
    return f"+7 ••• •••-{tail[:2]}-{tail[2:]}"


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
    # Публичный CRM ID риэлтора (RID######) — заявка «связаться с риэлтором» со
    # страницы профиля. Необязателен; резолвится в объект User и в perform_create
    # проставляется как assigned_realtor, если объект недвижимости не задан.
    assigned_realtor_crm_id = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True,
        allow_null=True,
        max_length=32,
    )

    class Meta:
        model = Lead
        fields = [
            "id",
            "property",
            "client_name",
            "client_phone",
            "client_message",
            "assigned_realtor_crm_id",
            "captcha_id",
            "captcha_answer",
            "source",
            "status",
            "created_at",
        ]
        read_only_fields = ["id", "source", "status", "created_at"]
        extra_kwargs = {
            "property": {"required": False, "allow_null": True},
            "client_name": {"max_length": 255},
            "client_phone": {"max_length": _PHONE_MAX_LEN},
        }

    def validate_client_name(self, value):
        s = (value or "").strip()
        if not s:
            raise serializers.ValidationError("Укажите имя.")
        if len(s) > 255:
            raise serializers.ValidationError("Имя слишком длинное.")
        if _NAME_DISALLOWED_RE.search(s):
            raise serializers.ValidationError(
                "Имя должно содержать только буквы."
            )
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
        s = (value or "").strip()
        if not s:
            raise serializers.ValidationError(
                "Укажите ваш вопрос или комментарий."
            )
        if len(s) > _CLIENT_MESSAGE_MAX:
            raise serializers.ValidationError(
                "Текст сообщения слишком длинный. Максимум 300 символов."
            )
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

    def validate_assigned_realtor_crm_id(self, value):
        raw = (value or "").strip()
        if not raw:
            return None
        realtor = User.objects.filter(
            role=User.Role.REALTOR,
            is_active=True,
            crm_id__iexact=raw,
        ).first()
        if realtor is None:
            raise serializers.ValidationError("Риэлтор не найден.")
        return realtor

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
        # Не модельное поле — резолвится в perform_create во view; убираем перед
        # созданием, иначе ModelSerializer.create() передаст его в Lead(**data).
        validated_data.pop("assigned_realtor_crm_id", None)
        validated_data["source"] = LeadSource.WEBSITE
        validated_data.setdefault("status", LeadStatus.NEW)
        return super().create(validated_data)


class CrmLeadListSerializer(serializers.ModelSerializer):
    property = CrmPropertyListSerializer(read_only=True, allow_null=True)
    assigned_realtor = RealtorShortSerializer(read_only=True, allow_null=True)
    agency = AgencyShortSerializer(read_only=True, allow_null=True)
    client_phone = serializers.SerializerMethodField()

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

    def get_client_phone(self, obj):
        return mask_client_phone(obj.client_phone)


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


class CrmLeadNoteReadSerializer(serializers.ModelSerializer):
    author = RealtorShortSerializer(read_only=True, allow_null=True)

    class Meta:
        model = LeadNote
        fields = ["id", "text", "author", "created_at"]


class CrmLeadActionLogReadSerializer(serializers.ModelSerializer):
    user = serializers.SerializerMethodField()

    class Meta:
        model = LeadActionLog
        fields = ["id", "action_type", "description", "user", "created_at"]

    def get_user(self, obj):
        if obj.user_id is None:
            return None
        return RealtorShortSerializer(obj.user, context=self.context).data


class CrmLeadDetailSerializer(serializers.ModelSerializer):
    property = CrmPropertyListSerializer(read_only=True, allow_null=True)
    assigned_realtor = RealtorShortSerializer(read_only=True, allow_null=True)
    agency = AgencyShortSerializer(read_only=True, allow_null=True)
    comments = CrmLeadCommentReadSerializer(many=True, read_only=True)
    notes = CrmLeadNoteReadSerializer(many=True, read_only=True)
    status_history = LeadStatusHistoryReadSerializer(many=True, read_only=True)
    client_phone = serializers.SerializerMethodField()

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
            "notes",
            "status_history",
            "created_at",
            "updated_at",
        ]

    def get_client_phone(self, obj):
        return mask_client_phone(obj.client_phone)


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


class CrmLeadNoteCreateSerializer(serializers.Serializer):
    text = serializers.CharField(max_length=8000, min_length=1)

    def validate_text(self, value):
        s = (value or "").strip()
        if not s:
            raise serializers.ValidationError("Введите текст комментария.")
        if len(s) > 8000:
            raise serializers.ValidationError("Текст комментария слишком длинный.")
        return s
