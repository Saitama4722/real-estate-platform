"""
Serializers for auth and current user.
"""
from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer


User = get_user_model()


def _absolute_media_url(request, file_field):
    if not file_field:
        return None
    try:
        url = file_field.url
    except ValueError:
        return None
    if request:
        return request.build_absolute_uri(url)
    return url


class CurrentUserSerializer(serializers.ModelSerializer):
    """Safe, minimal serializer for the current authenticated user."""

    avatar = serializers.SerializerMethodField()
    crm_capabilities = serializers.SerializerMethodField()

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
        ]
        read_only_fields = fields

    def get_avatar(self, obj):
        return _absolute_media_url(self.context.get("request"), obj.avatar)

    def get_crm_capabilities(self, obj):
        from .permissions import CRM_CAPABILITY_FIELD, crm_user_has_capability

        return {
            key: crm_user_has_capability(obj, key) for key in CRM_CAPABILITY_FIELD
        }


class CurrentUserUpdateSerializer(serializers.ModelSerializer):
    """PATCH текущего пользователя: только имя, фамилия, телефон, фото (без роли и прав)."""

    class Meta:
        model = User
        fields = ["first_name", "last_name", "phone", "avatar"]
        extra_kwargs = {
            "first_name": {"required": False},
            "last_name": {"required": False},
            "phone": {"required": False, "allow_blank": True},
            "avatar": {"required": False, "allow_null": True},
        }


class EmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    JWT token pair using email + password.
    Request body: {"email": "...", "password": "..."}.
    Only active users can obtain tokens.
    """
    username_field = User.USERNAME_FIELD  # "email"

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        # Optional: add role to token payload if needed later
        token["role"] = user.role
        return token


class RealtorCrmReadSerializer(serializers.ModelSerializer):
    """Список / деталь риэлтора для администратора кабинета."""

    display_name = serializers.SerializerMethodField()
    avatar = serializers.SerializerMethodField()

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
        ]
        read_only_fields = fields

    def get_display_name(self, obj):
        name = f"{obj.first_name} {obj.last_name}".strip()
        return name or obj.email

    def get_avatar(self, obj):
        return _absolute_media_url(self.context.get("request"), obj.avatar)


class RealtorCrmWriteSerializer(serializers.ModelSerializer):
    """Создание и правка риэлтора (роль всегда realtor)."""

    password = serializers.CharField(write_only=True, required=False, allow_blank=True)

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
        ]

    def validate(self, attrs):
        if self.instance is None:
            pwd = attrs.get("password")
            if not pwd or not str(pwd).strip():
                raise serializers.ValidationError(
                    {"password": "Укажите пароль для новой учётной записи."}
                )
        return attrs

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.role = User.Role.REALTOR
        user.set_password(password)
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        for key, value in validated_data.items():
            setattr(instance, key, value)
        if password and str(password).strip():
            instance.set_password(password)
        instance.save()
        return instance
