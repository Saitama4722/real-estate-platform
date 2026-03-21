from django.conf import settings
from django.db import models

from common.models import BaseTimestampedModel
from properties.choices import (
    CurrencyType,
    DealType,
    MarketType,
    PropertyStatus,
    PropertyType,
)


class Property(BaseTimestampedModel):
    # --- Relations ---
    agency = models.ForeignKey(
        "agencies.Agency",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="properties",
        verbose_name="Агентство",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_properties",
        verbose_name="Создал",
    )
    assigned_realtor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_properties",
        verbose_name="Ответственный риэлтор",
    )

    # --- Status & Publication ---
    status = models.CharField(
        max_length=20,
        choices=PropertyStatus.choices,
        default=PropertyStatus.DRAFT,
        verbose_name="Статус",
        db_index=True,
    )
    is_published = models.BooleanField(
        default=False, verbose_name="Опубликован", db_index=True
    )
    published_at = models.DateTimeField(
        null=True, blank=True, verbose_name="Дата публикации"
    )
    archived_at = models.DateTimeField(
        null=True, blank=True, verbose_name="Дата архивации"
    )

    # --- Property Type ---
    deal_type = models.CharField(
        max_length=10,
        choices=DealType.choices,
        default=DealType.SALE,
        verbose_name="Тип сделки",
        db_index=True,
    )
    property_type = models.CharField(
        max_length=20,
        choices=PropertyType.choices,
        verbose_name="Тип недвижимости",
        db_index=True,
    )
    market_type = models.CharField(
        max_length=20,
        choices=MarketType.choices,
        null=True,
        blank=True,
        verbose_name="Рынок",
    )

    # --- Title & Description ---
    title_generated = models.CharField(
        max_length=300, blank=True, verbose_name="Заголовок (авто)"
    )
    slug = models.SlugField(max_length=320, unique=True, verbose_name="Slug")
    short_description = models.CharField(
        max_length=500, blank=True, verbose_name="Краткое описание"
    )
    description = models.TextField(blank=True, verbose_name="Полное описание")

    # --- Price ---
    price = models.DecimalField(
        max_digits=15, decimal_places=2, verbose_name="Цена"
    )
    old_price = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name="Старая цена",
    )
    currency = models.CharField(
        max_length=3,
        choices=CurrencyType.choices,
        default=CurrencyType.RUB,
        verbose_name="Валюта",
    )

    # --- Address & Geography ---
    city = models.ForeignKey(
        "locations.City",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="properties",
        verbose_name="Город",
    )
    district = models.ForeignKey(
        "locations.District",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="properties",
        verbose_name="Район",
    )
    neighborhood = models.ForeignKey(
        "locations.Neighborhood",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="properties",
        verbose_name="Микрорайон",
    )
    residential_complex = models.ForeignKey(
        "locations.ResidentialComplex",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="properties",
        verbose_name="ЖК",
    )
    street = models.CharField(max_length=200, blank=True, verbose_name="Улица")
    house_number = models.CharField(
        max_length=20, blank=True, verbose_name="Номер дома"
    )
    public_address_text = models.CharField(
        max_length=300, blank=True, verbose_name="Публичный адрес"
    )
    hide_exact_address = models.BooleanField(
        default=False, verbose_name="Скрыть точный адрес"
    )

    # --- Coordinates ---
    public_latitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        null=True,
        blank=True,
        verbose_name="Публичная широта",
    )
    public_longitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        null=True,
        blank=True,
        verbose_name="Публичная долгота",
    )
    # CRM-only — never expose in public API
    real_latitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        null=True,
        blank=True,
        verbose_name="Реальная широта",
    )
    real_longitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        null=True,
        blank=True,
        verbose_name="Реальная долгота",
    )

    # --- Stats ---
    views_count = models.PositiveIntegerField(default=0, verbose_name="Просмотры")
    phone_views_count = models.PositiveIntegerField(
        default=0, verbose_name="Показы телефона"
    )

    class Meta:
        verbose_name = "Объект недвижимости"
        verbose_name_plural = "Объекты недвижимости"
        ordering = ["-published_at", "-created_at"]
        indexes = [
            models.Index(fields=["status", "is_published"]),
            models.Index(fields=["property_type", "deal_type"]),
            models.Index(fields=["city", "district"]),
            models.Index(fields=["price"]),
        ]

    def __str__(self):
        return self.title_generated or f"Property #{self.pk}"
