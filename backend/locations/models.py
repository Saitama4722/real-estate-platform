from django.db import models

from common.models import BaseTimestampedModel


class City(BaseTimestampedModel):
    name = models.CharField(max_length=100, verbose_name="Название")
    slug = models.SlugField(unique=True)
    region_name = models.CharField(
        max_length=150, blank=True, verbose_name="Регион"
    )
    is_active = models.BooleanField(default=True, verbose_name="Активен")

    class Meta:
        verbose_name = "Город"
        verbose_name_plural = "Города"
        ordering = ["name"]

    def __str__(self):
        return self.name


class District(BaseTimestampedModel):
    city = models.ForeignKey(
        City,
        on_delete=models.CASCADE,
        related_name="districts",
    )
    name = models.CharField(max_length=150, verbose_name="Название")
    slug = models.SlugField(verbose_name="Slug")
    sort_order = models.PositiveIntegerField(
        default=0, verbose_name="Порядок сортировки"
    )

    class Meta:
        unique_together = [("city", "slug")]
        verbose_name = "Район"
        verbose_name_plural = "Районы"
        ordering = ["sort_order", "name"]

    def __str__(self):
        return f"{self.city.name} — {self.name}"


class Neighborhood(BaseTimestampedModel):
    city = models.ForeignKey(
        City,
        on_delete=models.CASCADE,
        related_name="neighborhoods",
    )
    district = models.ForeignKey(
        District,
        on_delete=models.CASCADE,
        related_name="neighborhoods",
        null=True,
        blank=True,
    )
    name = models.CharField(max_length=150, verbose_name="Название")
    slug = models.SlugField()
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = [("city", "slug")]
        verbose_name = "Микрорайон"
        verbose_name_plural = "Микрорайоны"
        ordering = ["sort_order", "name"]

    def __str__(self):
        return f"{self.city.name} — {self.name}"


class ResidentialComplex(BaseTimestampedModel):
    city = models.ForeignKey(
        City,
        on_delete=models.CASCADE,
        related_name="residential_complexes",
    )
    district = models.ForeignKey(
        District,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="residential_complexes",
    )
    neighborhood = models.ForeignKey(
        Neighborhood,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="residential_complexes",
    )
    name = models.CharField(max_length=200, verbose_name="Название")
    slug = models.SlugField(unique=True)
    address_text = models.CharField(
        max_length=300, blank=True, verbose_name="Адрес"
    )
    latitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True
    )
    longitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True
    )
    description = models.TextField(blank=True, verbose_name="Описание")

    class Meta:
        verbose_name = "Жилой комплекс"
        verbose_name_plural = "Жилые комплексы"
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.city.name})"
