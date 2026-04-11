"""
Agency model — expanded entity for realtor profiles and future property assignment (Stage 3.5).
"""
from django.db import models
from django.utils.text import slugify

from common.models import BaseTimestampedModel


class Agency(BaseTimestampedModel):
    """Агентство: юридическая/организационная единица для риэлторов и привязки объектов."""

    name = models.CharField("Название", max_length=255)
    slug = models.SlugField(
        "ЧПУ (slug)", max_length=100, unique=True, blank=True, null=True
    )
    logo = models.ImageField(
        "Логотип",
        upload_to="agencies/logos/",
        blank=True,
        null=True,
    )
    phone = models.CharField("Телефон", max_length=32, blank=True)
    email = models.EmailField("Email", blank=True)
    description = models.TextField("Описание", blank=True)
    is_active = models.BooleanField("Активно", default=True)

    class Meta:
        verbose_name = "Агентство"
        verbose_name_plural = "Агентства"
        ordering = ["name"]

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug and self.name:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)
