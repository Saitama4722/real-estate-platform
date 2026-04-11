"""
Reusable abstract base model with timestamp fields.
"""
from django.db import models


class BaseTimestampedModel(models.Model):
    """
    Abstract base model with created_at and updated_at.
    Inherit from this in app models to get automatic timestamps.
    """
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Создано")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Обновлено")

    class Meta:
        abstract = True
