"""
Base DRF serializers for reuse with model serializers.
"""
from rest_framework import serializers


class BaseModelSerializer(serializers.ModelSerializer):
    """Generic base model serializer. Override Meta.model in subclasses."""

    class Meta:
        model = None
        fields = "__all__"


class TimestampedModelSerializer(BaseModelSerializer):
    """
    Base for models that have created_at / updated_at (e.g. BaseTimestampedModel).
    Exposes timestamps as read-only.
    """
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)
