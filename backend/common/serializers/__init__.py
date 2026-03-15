"""
Shared serializers for the project.
Import from here: from common.serializers import ...
"""
from common.serializers.base import BaseModelSerializer, TimestampedModelSerializer

__all__ = ["BaseModelSerializer", "TimestampedModelSerializer"]
