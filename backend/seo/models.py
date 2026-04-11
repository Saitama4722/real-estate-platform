from django.db import models

from common.models import BaseTimestampedModel
from properties.choices import PropertyType

from .choices import SeoPageType


class SeoPage(BaseTimestampedModel):
    page_type = models.CharField(
        max_length=32,
        choices=SeoPageType.choices,
        verbose_name="Тип страницы",
        db_index=True,
    )
    city = models.ForeignKey(
        "locations.City",
        on_delete=models.CASCADE,
        related_name="seo_pages",
        verbose_name="Город",
    )
    district = models.ForeignKey(
        "locations.District",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="seo_pages",
        verbose_name="Район",
    )
    neighborhood = models.ForeignKey(
        "locations.Neighborhood",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="seo_pages",
        verbose_name="Микрорайон",
    )
    residential_complex = models.ForeignKey(
        "locations.ResidentialComplex",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="seo_pages",
        verbose_name="Жилой комплекс",
    )
    property_type = models.CharField(
        max_length=20,
        choices=PropertyType.choices,
        null=True,
        blank=True,
        verbose_name="Тип недвижимости",
        db_index=True,
    )
    rooms = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        verbose_name="Комнат",
    )
    slug = models.SlugField(
        max_length=320,
        unique=True,
        db_index=True,
        verbose_name="ЧПУ (slug)",
    )
    h1 = models.CharField(max_length=500, verbose_name="Заголовок H1")
    title = models.CharField(max_length=300, verbose_name="Заголовок (title)")
    meta_description = models.CharField(
        max_length=320,
        verbose_name="Meta description (описание)",
    )
    seo_text = models.TextField(verbose_name="SEO-текст")
    is_indexable = models.BooleanField(
        default=True,
        verbose_name="Индексировать",
        db_index=True,
    )

    class Meta:
        verbose_name = "SEO-страница"
        verbose_name_plural = "SEO-страницы"
        ordering = ["city", "page_type", "slug"]

    def __str__(self):
        return f"{self.slug} ({self.get_page_type_display()})"
