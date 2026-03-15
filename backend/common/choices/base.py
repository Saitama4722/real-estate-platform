"""
Base TextChoices for reuse. Add app-specific choices in other apps or here when needed.
"""
from django.db import models


class GenericStatus(models.TextChoices):
    """Generic status for entities that need draft/active/archived."""
    DRAFT = "draft", "Draft"
    ACTIVE = "active", "Active"
    ARCHIVED = "archived", "Archived"
