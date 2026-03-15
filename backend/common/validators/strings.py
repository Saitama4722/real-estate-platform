"""
Generic string validators.
"""
from django.core.exceptions import ValidationError


def validate_not_empty_string(value, strip=True):
    """Raise ValidationError if value is empty or whitespace-only after optional strip."""
    if value is None:
        raise ValidationError("This field cannot be null.")
    s = value.strip() if strip and isinstance(value, str) else value
    if not s:
        raise ValidationError("This field cannot be empty.")
