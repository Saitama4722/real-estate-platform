"""
Serializers for auth and current user.
"""
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from rest_framework.validators import UniqueValidator
from rest_framework_simplejwt.exceptions import InvalidToken
from rest_framework_simplejwt.serializers import (
    TokenObtainPairSerializer,
    TokenRefreshSerializer,
)

from .authentication import TOKEN_VERSION_CLAIM
from .models import EmployeeActivityLog, RealtorProfile

User = get_user_model()

#: Один текст для всех мест, где email занят. DRF по умолчанию отдаёт английское
#: «This field must be unique.» — сотруднику это ничего не объясняет.
EMAIL_TAKEN_MESSAGE = "Этот email уже используется другой учётной записью."

# Максимальная длина публичной «продающей» биографии риэлтора. Ограничение
# держим синхронным с фронтендом (textarea maxLength).
SHORT_BIO_MAX = 1500


def _realtor_profile_or_none(user):
    """RealtorProfile пользователя или None (без создания)."""
    return RealtorProfile.objects.filter(user_id=user.pk).first()


def _apply_realtor_profile_fields(user, fields: dict) -> None:
    """
    Записать публичные поля профиля риэлтора (`short_bio`, `public_name`,
    `public_phone`, `is_public`) через get_or_create — профиль создаётся лениво
    только для пользователей с ролью «Риэлтор» (паттерн get_or_create-by-user,
    как у PhoneRevealLog). Для не-риэлторов вызов игнорируется.
    """
    if not fields:
        return
    if user.role != User.Role.REALTOR:
        return
    profile, _ = RealtorProfile.objects.get_or_create(user=user)
    for key, value in fields.items():
        setattr(profile, key, value)
    profile.save()


def _absolute_media_url(request, file_field):
    # Return relative /media/... so Next.js can proxy it (build_absolute_uri would
    # embed the private backend host, unreachable from the browser in production).
    if not file_field:
        return None
    try:
        url = file_field.url
    except ValueError:
        return None
    return url


class CurrentUserSerializer(serializers.ModelSerializer):
    """Safe, minimal serializer for the current authenticated user."""

    avatar = serializers.SerializerMethodField()
    crm_capabilities = serializers.SerializerMethodField()
    short_bio = serializers.SerializerMethodField()
    public_name = serializers.SerializerMethodField()
    public_phone = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "first_name",
            "last_name",
            "phone",
            "crm_id",
            "avatar",
            "role",
            "is_active",
            "is_staff",
            "crm_capabilities",
            "short_bio",
            "public_name",
            "public_phone",
        ]
        read_only_fields = fields

    def get_avatar(self, obj):
        return _absolute_media_url(self.context.get("request"), obj.avatar)

    def get_short_bio(self, obj):
        profile = _realtor_profile_or_none(obj)
        return profile.short_bio if profile else ""

    def get_public_name(self, obj):
        profile = _realtor_profile_or_none(obj)
        return profile.public_name if profile else ""

    def get_public_phone(self, obj):
        profile = _realtor_profile_or_none(obj)
        return profile.public_phone if profile else ""

    def get_crm_capabilities(self, obj):
        from .permissions import CRM_CAPABILITY_FIELD, crm_user_has_capability

        return {
            key: crm_user_has_capability(obj, key) for key in CRM_CAPABILITY_FIELD
        }


class CurrentUserUpdateSerializer(serializers.ModelSerializer):
    """
    PATCH текущего пользователя: имя, фамилия, телефон, фото + публичные поля
    профиля риэлтора (`short_bio`, `public_name`, `public_phone`). Роль и права не
    редактируются. Поля профиля применяются только для роли «Риэлтор».
    """

    short_bio = serializers.CharField(
        required=False, allow_blank=True, max_length=SHORT_BIO_MAX
    )
    public_name = serializers.CharField(
        required=False, allow_blank=True, max_length=255
    )
    public_phone = serializers.CharField(
        required=False, allow_blank=True, max_length=32
    )

    class Meta:
        model = User
        fields = [
            "first_name",
            "last_name",
            "phone",
            "avatar",
            "short_bio",
            "public_name",
            "public_phone",
        ]
        extra_kwargs = {
            "first_name": {"required": False},
            "last_name": {"required": False},
            "phone": {"required": False, "allow_blank": True},
            "avatar": {"required": False, "allow_null": True},
        }

    def update(self, instance, validated_data):
        profile_fields = {
            key: validated_data.pop(key)
            for key in ("short_bio", "public_name", "public_phone")
            if key in validated_data
        }
        instance = super().update(instance, validated_data)
        _apply_realtor_profile_fields(instance, profile_fields)
        return instance


class EmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    JWT token pair using email + password.
    Request body: {"email": "...", "password": "..."}.
    Only active users can obtain tokens.
    """
    username_field = User.USERNAME_FIELD  # "email"

    def validate(self, attrs):
        data = super().validate(attrs)
        from .activity import record_employee_activity

        record_employee_activity(
            self.context.get("request"),
            self.user,
            EmployeeActivityLog.ActionType.LOGIN,
        )
        return data

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        # Optional: add role to token payload if needed later
        token["role"] = user.role
        # Generation stamp — VersionedJWTAuthentication rejects the token once
        # this falls behind the user's token_version (password reset).
        token[TOKEN_VERSION_CLAIM] = user.token_version
        return token


class VersionedTokenRefreshSerializer(TokenRefreshSerializer):
    """
    Refresh that also honours `token_version`.

    Without this the refresh would succeed and mint an access token carrying the
    STALE `tv` claim (simplejwt copies custom claims across), which
    VersionedJWTAuthentication would then reject — the user gets logged out, but
    only after a pointless extra round trip and a confusing intermediate 200.
    Failing here makes a revoked session fail at the first opportunity.
    """

    def validate(self, attrs):
        data = super().validate(attrs)
        refresh = self.token_class(attrs["refresh"])
        user_id = refresh.get("user_id")
        claimed = refresh.get(TOKEN_VERSION_CLAIM, 0)
        current = (
            User.objects.filter(pk=user_id)
            .values_list("token_version", flat=True)
            .first()
        )
        if current is None or int(claimed) != int(current):
            raise InvalidToken("Сессия завершена: пароль был изменён. Войдите заново.")
        return data


class SetEmployeePasswordSerializer(serializers.Serializer):
    """
    Суперадмин задаёт новый пароль сотруднику.

    ⚠ Пароль только принимается и проверяется; он не логируется, не возвращается
    в ответе и нигде не сохраняется в открытом виде.
    """

    password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate_password(self, value):
        # Django's configured validators (AUTH_PASSWORD_VALIDATORS): длина,
        # схожесть с данными пользователя, словарь частых паролей, «только
        # цифры». Своё правило не изобретаем.
        try:
            validate_password(value, user=self.context.get("target_user"))
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages))
        return value


class ChangeOwnEmailSerializer(serializers.Serializer):
    """
    Смена собственного email с подтверждением текущим паролем.

    Email — это логин, поэтому его подмена равносильна захвату аккаунта. Пароль
    просят у того, кто меняет СВОЙ адрес (защита от «оставленного открытым
    ноутбука»); суперадмин, меняющий чужой адрес, уже привилегирован и его
    действие пишется в журнал под его именем.
    """

    email = serializers.EmailField()
    current_password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate_email(self, value):
        value = value.strip().lower()
        user = self.context["user"]
        if User.objects.filter(email__iexact=value).exclude(pk=user.pk).exists():
            raise serializers.ValidationError(EMAIL_TAKEN_MESSAGE)
        return value

    def validate_current_password(self, value):
        if not self.context["user"].check_password(value):
            raise serializers.ValidationError("Неверный текущий пароль.")
        return value


class EmployeeActivityLogSerializer(serializers.ModelSerializer):
    """Список журнала активности для CRM (только чтение администратором)."""

    user_email = serializers.EmailField(source="user.email", read_only=True)
    user_display_name = serializers.SerializerMethodField()
    action_label = serializers.CharField(source="get_action_type_display", read_only=True)

    class Meta:
        model = EmployeeActivityLog
        fields = [
            "id",
            "user",
            "user_email",
            "user_display_name",
            "action_type",
            "action_label",
            "created_at",
            "ip_address",
            "user_agent",
        ]
        read_only_fields = fields

    def get_user_display_name(self, obj):
        name = f"{obj.user.first_name} {obj.user.last_name}".strip()
        return name or obj.user.email


class RealtorCrmReadSerializer(serializers.ModelSerializer):
    """Список / деталь риэлтора для администратора кабинета."""

    display_name = serializers.SerializerMethodField()
    avatar = serializers.SerializerMethodField()
    short_bio = serializers.SerializerMethodField()
    public_name = serializers.SerializerMethodField()
    public_phone = serializers.SerializerMethodField()
    is_public = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "crm_id",
            "email",
            "first_name",
            "last_name",
            "display_name",
            "phone",
            "role",
            "is_active",
            "avatar",
            "last_login",
            "perm_create_property",
            "perm_edit_property",
            "perm_delete_property",
            "perm_view_clients",
            "perm_delete_clients",
            "perm_change_status",
            "short_bio",
            "public_name",
            "public_phone",
            "is_public",
        ]
        read_only_fields = fields

    def get_display_name(self, obj):
        name = f"{obj.first_name} {obj.last_name}".strip()
        return name or obj.email

    def get_avatar(self, obj):
        return _absolute_media_url(self.context.get("request"), obj.avatar)

    def get_short_bio(self, obj):
        profile = _realtor_profile_or_none(obj)
        return profile.short_bio if profile else ""

    def get_public_name(self, obj):
        profile = _realtor_profile_or_none(obj)
        return profile.public_name if profile else ""

    def get_public_phone(self, obj):
        profile = _realtor_profile_or_none(obj)
        return profile.public_phone if profile else ""

    def get_is_public(self, obj):
        profile = _realtor_profile_or_none(obj)
        return bool(profile.is_public) if profile else False


class PublicRealtorSerializer(serializers.Serializer):
    """Публичная карточка риэлтора для сайта (без email и внутренних полей)."""

    crm_id = serializers.CharField()
    display_name = serializers.CharField()
    # CharField (not URLField): `_absolute_media_url` intentionally returns a
    # relative `/media/...` path so Next.js can proxy it (an absolute URL would
    # leak the private backend host in prod). URLField rejects relative paths and
    # would 400 for any realtor that actually has an avatar/photo.
    avatar = serializers.CharField(allow_null=True)
    phone = serializers.CharField(allow_blank=True)
    published_properties_count = serializers.IntegerField()
    short_bio = serializers.CharField(allow_blank=True, required=False)


class RealtorCrmWriteSerializer(serializers.ModelSerializer):
    """
    Создание и правка риэлтора (роль всегда realtor). Помимо полей User
    принимает публичные поля профиля риэлтора (`short_bio`, `public_name`,
    `public_phone`, `is_public`), которые пишутся в связанный RealtorProfile.
    """

    #: Пароль принимается ТОЛЬКО при создании учётной записи. Смена пароля
    #: существующего сотрудника идёт через отдельную ручку set_password,
    #: доступную одному суперадмину (см. update() ниже).
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    email = serializers.EmailField(
        validators=[
            UniqueValidator(
                queryset=User.objects.all(),
                message=EMAIL_TAKEN_MESSAGE,
                lookup="iexact",
            )
        ]
    )
    short_bio = serializers.CharField(
        required=False, allow_blank=True, max_length=SHORT_BIO_MAX
    )
    public_name = serializers.CharField(
        required=False, allow_blank=True, max_length=255
    )
    public_phone = serializers.CharField(
        required=False, allow_blank=True, max_length=32
    )
    is_public = serializers.BooleanField(required=False)

    #: Поля, уходящие в RealtorProfile, а не в User.
    _PROFILE_FIELDS = ("short_bio", "public_name", "public_phone", "is_public")

    class Meta:
        model = User
        fields = [
            "email",
            "password",
            "first_name",
            "last_name",
            "phone",
            "is_active",
            "avatar",
            "perm_create_property",
            "perm_edit_property",
            "perm_delete_property",
            "perm_view_clients",
            "perm_delete_clients",
            "perm_change_status",
            "short_bio",
            "public_name",
            "public_phone",
            "is_public",
        ]

    def validate(self, attrs):
        if self.instance is None:
            pwd = attrs.get("password")
            if not pwd or not str(pwd).strip():
                raise serializers.ValidationError(
                    {"password": "Укажите пароль для новой учётной записи."}
                )
        return attrs

    def _pop_profile_fields(self, validated_data) -> dict:
        return {
            key: validated_data.pop(key)
            for key in self._PROFILE_FIELDS
            if key in validated_data
        }

    def create(self, validated_data):
        profile_fields = self._pop_profile_fields(validated_data)
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.role = User.Role.REALTOR
        user.set_password(password)
        # post_save (users.signals) creates the profile with DEFAULT_REALTOR_BIO.
        user.save()
        # ⚠ An EMPTY short_bio on CREATE must not overwrite that default. The
        # CRM form posts the field unconditionally, and its bio box starts
        # blank, so writing it through would blank the template on every new
        # realtor — the superadmin would never see the text they are meant to
        # tailor. On UPDATE an empty value is respected: clearing the bio there
        # is a deliberate act.
        if not str(profile_fields.get("short_bio", "")).strip():
            profile_fields.pop("short_bio", None)
        _apply_realtor_profile_fields(user, profile_fields)
        return user

    def update(self, instance, validated_data):
        profile_fields = self._pop_profile_fields(validated_data)
        # ⚠ Пароль здесь ИГНОРИРУЕТСЯ намеренно. Раньше PATCH на риэлтора
        # менял пароль, и это мог сделать любой админ (IsCrmStaffManager).
        # Теперь смена пароля — только POST set_password под суперадмином, с
        # проверкой валидаторами, записью в журнал и сбросом сессий.
        validated_data.pop("password", None)
        if "email" in validated_data:
            validated_data["email"] = validated_data["email"].strip().lower()
        for key, value in validated_data.items():
            setattr(instance, key, value)
        instance.save()
        _apply_realtor_profile_fields(instance, profile_fields)
        return instance
