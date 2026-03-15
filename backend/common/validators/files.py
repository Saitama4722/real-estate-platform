"""
Generic file/image validators.
"""
import os

from django.core.exceptions import ValidationError


def validate_file_size(value, max_size_mb=10):
    """Raise ValidationError if file size exceeds max_size_mb (default 10 MB)."""
    if value.size > max_size_mb * 1024 * 1024:
        raise ValidationError(
            f"File size must not exceed {max_size_mb} MB."
        )


def validate_image_extension(value, allowed=None):
    """Raise ValidationError if file extension is not in allowed (default: common image exts)."""
    if allowed is None:
        allowed = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
    ext = os.path.splitext(value.name)[1].lower()
    if ext not in allowed:
        raise ValidationError(
            f"Invalid image extension. Allowed: {', '.join(sorted(allowed))}"
        )
