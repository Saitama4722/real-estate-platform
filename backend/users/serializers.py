"""
Serializers for auth and current user.
"""
from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer


User = get_user_model()


class CurrentUserSerializer(serializers.ModelSerializer):
    """Safe, minimal serializer for the current authenticated user."""

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "first_name",
            "last_name",
            "role",
            "is_active",
            "is_staff",
        ]
        read_only_fields = fields


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
