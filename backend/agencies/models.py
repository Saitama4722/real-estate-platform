"""
Agency model — expanded entity for realtor profiles and future property assignment (Stage 3.5).
"""
from django.db import models
from django.utils.text import slugify

from common.models import BaseTimestampedModel


class Agency(BaseTimestampedModel):
    """Agency entity: organizational unit for realtor profiles and future property assignment."""

    name = models.CharField("name", max_length=255)
    slug = models.SlugField("slug", max_length=100, unique=True, blank=True, null=True)
    logo = models.ImageField(
        "logo",
        upload_to="agencies/logos/",
        blank=True,
        null=True,
    )
    phone = models.CharField("phone", max_length=32, blank=True)
    email = models.EmailField("email", blank=True)
    description = models.TextField("description", blank=True)
    is_active = models.BooleanField("active", default=True)

    class Meta:
        verbose_name = "agency"
        verbose_name_plural = "agencies"
        ordering = ["name"]

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug and self.name:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)
