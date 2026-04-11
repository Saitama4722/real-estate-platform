import logging
import re
from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ObjectDoesNotExist, ValidationError
from django.db import IntegrityError, models, transaction

from common.models import BaseTimestampedModel
from common.slug_latin import join_slug_parts, slugify_latin
from locations.choices import (
    BathroomType,
    BuildingType,
    CommercialType,
    HeatingType,
    LandCategory,
    PermittedUse,
    RenovationType,
)
from properties.choices import (
    CurrencyType,
    DealType,
    MarketType,
    PropertyStatus,
    PropertyType,
    VideoPlatform,
)
from properties.property_photo_images import validate_property_photo_original_size

logger = logging.getLogger(__name__)

_PID_ID_PATTERN = re.compile(r"^PID(\d{6})$")


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
    crm_property_id = models.CharField(
        max_length=10,
        unique=True,
        db_index=True,
        blank=True,
        verbose_name="CRM ID объекта (PID)",
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
    slug = models.SlugField(
        max_length=320,
        unique=True,
        blank=True,
        null=True,
        db_index=True,
        verbose_name="ЧПУ (slug)",
    )
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
        return self.title_generated or f"Объект #{self.pk}"

    @classmethod
    def allocate_next_crm_property_id(cls) -> str:
        """Next PID###### from existing rows (retries on rare collisions in save)."""
        best = 0
        qs = cls.objects.exclude(crm_property_id="").values_list(
            "crm_property_id", flat=True
        )
        for cid in qs:
            m = _PID_ID_PATTERN.fullmatch(cid or "")
            if m:
                best = max(best, int(m.group(1)))
        return f"PID{best + 1:06d}"

    @staticmethod
    def _format_decimal_for_title(value) -> str | None:
        if value is None:
            return None
        if isinstance(value, Decimal):
            d = value
        else:
            d = Decimal(str(value))
        return f"{d:.2f}"

    def _city_suffix(self) -> str:
        if not self.city_id:
            return ""
        try:
            city = self.city
        except ObjectDoesNotExist:
            return ""
        if city and getattr(city, "name", None):
            return f", {city.name}"
        return ""

    def _build_fallback_title(self) -> str:
        if not self.pk:
            return ""
        label = self.get_property_type_display()
        if label:
            return f"{label} #{self.pk}"
        return f"Объект недвижимости #{self.pk}"

    def _build_apartment_title(self) -> str | None:
        if self.property_type != PropertyType.APARTMENT:
            return None
        try:
            d = self.apartment_details
        except ObjectDoesNotExist:
            return None
        area_s = self._format_decimal_for_title(d.area_total)
        if d.rooms is None or area_s is None:
            return None
        base = f"{d.rooms}-комн. квартира, {area_s} м²"
        return f"{base}{self._city_suffix()}"

    def _build_house_title(self) -> str | None:
        if self.property_type != PropertyType.HOUSE:
            return None
        try:
            d = self.house_details
        except ObjectDoesNotExist:
            return None
        ha = self._format_decimal_for_title(d.house_area)
        la = self._format_decimal_for_title(d.land_area)
        if ha is None or la is None:
            return None
        base = f"Дом {ha} м², участок {la} сот."
        return f"{base}{self._city_suffix()}"

    def _build_land_title(self) -> str | None:
        if self.property_type != PropertyType.LAND:
            return None
        try:
            d = self.land_plot_details
        except ObjectDoesNotExist:
            return None
        la = self._format_decimal_for_title(d.land_area)
        if la is None:
            return None
        base = f"Участок {la} сот."
        return f"{base}{self._city_suffix()}"

    def _build_commercial_title(self) -> str | None:
        if self.property_type != PropertyType.COMMERCIAL:
            return None
        try:
            d = self.commercial_details
        except ObjectDoesNotExist:
            return None
        area_s = self._format_decimal_for_title(d.area_total)
        if area_s is None:
            return None
        ct_label = (d.get_commercial_type_display() or "").strip()
        if not ct_label:
            ct_label = "Коммерция"
        base = f"{ct_label}, {area_s} м²"
        return f"{base}{self._city_suffix()}"

    def build_generated_title(self) -> str:
        builders = {
            PropertyType.APARTMENT: self._build_apartment_title,
            PropertyType.HOUSE: self._build_house_title,
            PropertyType.LAND: self._build_land_title,
            PropertyType.COMMERCIAL: self._build_commercial_title,
        }
        builder = builders.get(self.property_type)
        if builder:
            specific = builder()
            if specific:
                return specific
        if self.pk:
            return self._build_fallback_title()
        return ""

    def _slug_is_placeholder(self, value: str | None) -> bool:
        s = (value or "").strip()
        if not s:
            return True
        return bool(re.fullmatch(r"property-\d+", s))

    def build_generated_slug(self) -> str:
        """
        Latin, hyphen-separated, ends with stable id suffix.
        Uses property type, optional type-specific attributes, city, district.
        """
        if not self.pk:
            return ""
        parts: list[str] = []
        pt = self.property_type
        if pt == PropertyType.APARTMENT:
            parts.append("kvartira")
            try:
                ad = self.apartment_details
            except ObjectDoesNotExist:
                ad = None
            if ad is not None and ad.rooms is not None:
                parts.append(f"{ad.rooms}-komnaty")
        elif pt == PropertyType.HOUSE:
            parts.append("dom")
        elif pt == PropertyType.LAND:
            parts.append("uchastok")
        elif pt == PropertyType.COMMERCIAL:
            parts.append("kommercheskoe")
            try:
                cd = self.commercial_details
            except ObjectDoesNotExist:
                cd = None
            if cd is not None and cd.commercial_type:
                parts.append(str(cd.commercial_type))
        else:
            label = self.get_property_type_display() or ""
            seg = slugify_latin(label)
            if seg:
                parts.append(seg)

        try:
            city = self.city
        except ObjectDoesNotExist:
            city = None
        if city is not None and getattr(city, "name", None):
            cn = slugify_latin(city.name)
            if cn:
                parts.append(cn)

        try:
            district = self.district
        except ObjectDoesNotExist:
            district = None
        if district is not None and getattr(district, "name", None):
            dn = slugify_latin(district.name)
            if dn:
                parts.append(dn)

        parts.append(str(self.pk))
        base = join_slug_parts(*parts, max_length=320)
        return base or f"property-{self.pk}"

    def _title_matches_fallback(self) -> bool:
        if not self.pk:
            return False
        current = (self.title_generated or "").strip()
        if not current:
            return True
        return current == self._build_fallback_title()

    def clean(self):
        super().clean()
        if not self.assigned_realtor_id:
            raise ValidationError(
                {"assigned_realtor": "Укажите ответственного риэлтора."}
            )

    def save(self, *args, **kwargs):
        update_fields = kwargs.get("update_fields")
        if update_fields is None and self._state.adding and not self.assigned_realtor_id:
            raise ValidationError(
                {"assigned_realtor": "Укажите ответственного риэлтора."}
            )
        if update_fields is not None:
            return super().save(*args, **kwargs)

        is_new = self._state.adding

        if is_new and not (self.crm_property_id or "").strip():
            max_attempts = 12
            for attempt in range(max_attempts):
                self.crm_property_id = type(self).allocate_next_crm_property_id()
                if not (self.title_generated or "").strip():
                    self.title_generated = self.build_generated_title() or ""
                try:
                    super().save(*args, **kwargs)
                    break
                except IntegrityError:
                    if attempt >= max_attempts - 1:
                        raise
                    self.crm_property_id = ""
        else:
            if not (self.title_generated or "").strip():
                self.title_generated = self.build_generated_title() or ""
            super().save(*args, **kwargs)

        db_updates = {}
        if not (self.title_generated or "").strip():
            new_title = self.build_generated_title()
            if new_title:
                db_updates["title_generated"] = new_title
                self.title_generated = new_title

        if self._slug_is_placeholder(self.slug):
            new_slug = self.build_generated_slug()
            if new_slug:
                db_updates["slug"] = new_slug
                self.slug = new_slug

        if db_updates:
            Property.objects.filter(pk=self.pk).update(**db_updates)


def _sync_property_title_slug_after_detail_save(property_id: int | None) -> None:
    """
    When details are saved after the property row exists, upgrade auto title/slug
    if the property still has only the fallback title (or an empty title).
    """
    if not property_id:
        return
    try:
        prop = Property.objects.get(pk=property_id)
    except Property.DoesNotExist:
        return
    candidate = prop.build_generated_title()
    if not candidate:
        return
    if not prop._title_matches_fallback():
        return
    if candidate == (prop.title_generated or "").strip():
        return
    updates: dict = {"title_generated": candidate}
    if prop._slug_is_placeholder(prop.slug):
        new_slug = prop.build_generated_slug()
        if new_slug:
            updates["slug"] = new_slug
    Property.objects.filter(pk=prop.pk).update(**updates)


class ApartmentDetails(BaseTimestampedModel):
    property = models.OneToOneField(
        "properties.Property",
        on_delete=models.CASCADE,
        related_name="apartment_details",
        verbose_name="Объект недвижимости",
    )
    rooms = models.PositiveSmallIntegerField(
        verbose_name="Количество комнат",
    )
    area_total = models.DecimalField(
        max_digits=7,
        decimal_places=2,
        verbose_name="Общая площадь (м²)",
    )
    area_living = models.DecimalField(
        max_digits=7,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name="Жилая площадь (м²)",
    )
    area_kitchen = models.DecimalField(
        max_digits=7,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name="Площадь кухни (м²)",
    )
    floor = models.PositiveSmallIntegerField(
        verbose_name="Этаж",
    )
    floors_total = models.PositiveSmallIntegerField(
        verbose_name="Этажей в доме",
    )
    has_balcony = models.BooleanField(
        default=False,
        verbose_name="Есть балкон",
    )
    has_loggia = models.BooleanField(
        default=False,
        verbose_name="Есть лоджия",
    )
    renovation_type = models.CharField(
        max_length=32,
        choices=RenovationType.choices,
        null=True,
        blank=True,
        verbose_name="Ремонт",
    )
    bathroom_type = models.CharField(
        max_length=32,
        choices=BathroomType.choices,
        null=True,
        blank=True,
        verbose_name="Санузел",
    )

    class Meta:
        verbose_name = "Квартира — детали"
        verbose_name_plural = "Квартиры — детали"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        _sync_property_title_slug_after_detail_save(self.property_id)

    def __str__(self):
        return (
            f"{self.rooms}-комн., {self.area_total} м², "
            f"эт. {self.floor}/{self.floors_total}"
        )


class HouseDetails(BaseTimestampedModel):
    property = models.OneToOneField(
        "properties.Property",
        on_delete=models.CASCADE,
        related_name="house_details",
        verbose_name="Объект недвижимости",
    )
    house_area = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        verbose_name="Площадь дома (м²)",
    )
    land_area = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        verbose_name="Площадь участка",
    )
    floors_total = models.PositiveSmallIntegerField(
        verbose_name="Этажей",
    )
    heating_type = models.CharField(
        max_length=32,
        choices=HeatingType.choices,
        null=True,
        blank=True,
        verbose_name="Отопление",
    )
    has_gas = models.BooleanField(
        default=False,
        verbose_name="Есть газ",
    )
    has_water = models.BooleanField(
        default=False,
        verbose_name="Есть вода",
    )
    has_sewerage = models.BooleanField(
        default=False,
        verbose_name="Есть канализация",
    )
    has_electricity = models.BooleanField(
        default=False,
        verbose_name="Есть электричество",
    )
    building_type = models.CharField(
        max_length=32,
        choices=BuildingType.choices,
        null=True,
        blank=True,
        verbose_name="Тип дома",
    )

    class Meta:
        verbose_name = "Дом — детали"
        verbose_name_plural = "Дома — детали"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        _sync_property_title_slug_after_detail_save(self.property_id)

    def __str__(self):
        return (
            f"Дом {self.house_area} м², участок {self.land_area} сот., "
            f"эт. {self.floors_total}"
        )


class LandPlotDetails(BaseTimestampedModel):
    property = models.OneToOneField(
        "properties.Property",
        on_delete=models.CASCADE,
        related_name="land_plot_details",
        verbose_name="Объект недвижимости",
    )
    land_area = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        verbose_name="Площадь участка",
    )
    land_category = models.CharField(
        max_length=32,
        choices=LandCategory.choices,
        null=True,
        blank=True,
        verbose_name="Категория земли",
    )
    permitted_use = models.CharField(
        max_length=32,
        choices=PermittedUse.choices,
        null=True,
        blank=True,
        verbose_name="Разрешенное использование",
    )
    has_gas = models.BooleanField(
        default=False,
        verbose_name="Есть газ",
    )
    has_water = models.BooleanField(
        default=False,
        verbose_name="Есть вода",
    )
    has_electricity = models.BooleanField(
        default=False,
        verbose_name="Есть электричество",
    )

    class Meta:
        verbose_name = "Участок — детали"
        verbose_name_plural = "Участки — детали"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        _sync_property_title_slug_after_detail_save(self.property_id)

    def __str__(self):
        return (
            f"Участок {self.land_area} сот., категория {self.land_category or '—'}"
        )


class CommercialDetails(BaseTimestampedModel):
    property = models.OneToOneField(
        "properties.Property",
        on_delete=models.CASCADE,
        related_name="commercial_details",
        verbose_name="Объект недвижимости",
    )
    commercial_type = models.CharField(
        max_length=32,
        choices=CommercialType.choices,
        null=True,
        blank=True,
        verbose_name="Тип коммерции",
    )
    area_total = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        verbose_name="Общая площадь (м²)",
    )
    floor = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        verbose_name="Этаж",
    )
    floors_total = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        verbose_name="Этажей в здании",
    )
    entrance_type = models.CharField(
        max_length=128,
        null=True,
        blank=True,
        verbose_name="Тип входа",
    )
    parking_spaces = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        verbose_name="Парковочных мест",
    )

    class Meta:
        verbose_name = "Коммерция — детали"
        verbose_name_plural = "Коммерция — детали"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        _sync_property_title_slug_after_detail_save(self.property_id)

    def __str__(self):
        return (
            f"Коммерция {self.area_total} м², тип {self.commercial_type or '—'}"
        )


class PropertyPhoto(BaseTimestampedModel):
    """
    Фото объекта недвижимости.

    Стратегия производных размеров (этап 7.2):
    - ``original_file`` — единственный источник правды (загруженный оригинал).
    - ``image_large``, ``image_medium``, ``image_thumb`` — необязательные
      производные файлы; каждый генерируется только из ``original_file``, не из
      друг друга (без цепочек medium → thumb и т.п.).
    - Отсутствие или сбой генерации производных не должен затрагивать
      ``original_file``; при отсутствии дериватов можно показывать оригинал.
    - Генерация производных и лимит размера загрузки — ``property_photo_images``
      и ``save()`` модели (этап 14.1).
    """

    property = models.ForeignKey(
        "properties.Property",
        on_delete=models.CASCADE,
        related_name="photos",
        verbose_name="Объект недвижимости",
    )
    original_file = models.ImageField(
        upload_to="properties/photos/",
        verbose_name="Исходный файл",
    )
    image_large = models.ImageField(
        upload_to="properties/photos/large/",
        null=True,
        blank=True,
        verbose_name="Крупное изображение",
    )
    image_medium = models.ImageField(
        upload_to="properties/photos/medium/",
        null=True,
        blank=True,
        verbose_name="Среднее изображение",
    )
    image_thumb = models.ImageField(
        upload_to="properties/photos/thumb/",
        null=True,
        blank=True,
        verbose_name="Миниатюра",
    )
    sort_order = models.PositiveIntegerField(
        default=0,
        verbose_name="Порядок сортировки",
    )
    is_main = models.BooleanField(
        default=False,
        verbose_name="Главное фото",
    )
    mime_type = models.CharField(
        max_length=127,
        blank=True,
        verbose_name="MIME-тип",
    )
    file_size = models.PositiveBigIntegerField(
        null=True,
        blank=True,
        verbose_name="Размер файла (байт)",
    )

    class Meta:
        verbose_name = "Фотография"
        verbose_name_plural = "Фотографии"
        ordering = ["sort_order", "id"]

    def __str__(self):
        prop_id = self.property_id
        if self.pk:
            return f"Фото #{self.pk} (объект #{prop_id})"
        return f"Фото (объект #{prop_id})"

    def clean(self):
        super().clean()
        if self.original_file:
            validate_property_photo_original_size(self.original_file)

    def _clear_derivative_image_fields(self) -> None:
        for name in ("image_large", "image_medium", "image_thumb"):
            field = getattr(self, name)
            if field:
                field.delete(save=False)
                setattr(self, name, None)

    def save(self, *args, **kwargs):
        update_fields = kwargs.get("update_fields")
        if update_fields is not None and "original_file" not in update_fields:
            return super().save(*args, **kwargs)

        prev_original_name = ""
        if self.pk:
            row = (
                type(self)
                .objects.filter(pk=self.pk)
                .only("original_file")
                .first()
            )
            if row and row.original_file:
                prev_original_name = row.original_file.name

        super().save(*args, **kwargs)

        if not self.original_file:
            return

        current_name = self.original_file.name
        if current_name == prev_original_name:
            return

        self._clear_derivative_image_fields()
        super().save(
            update_fields=[
                "image_large",
                "image_medium",
                "image_thumb",
                "updated_at",
            ]
        )

        pk = self.pk

        def _enqueue():
            from properties.tasks import generate_property_photo_derivatives

            generate_property_photo_derivatives.delay(pk)

        transaction.on_commit(_enqueue)


class PropertyVideo(BaseTimestampedModel):
    property = models.ForeignKey(
        "properties.Property",
        on_delete=models.CASCADE,
        related_name="videos",
        verbose_name="Объект недвижимости",
    )
    platform = models.CharField(
        max_length=16,
        choices=VideoPlatform.choices,
        verbose_name="Платформа",
    )
    video_url = models.URLField(
        max_length=2048,
        verbose_name="Ссылка на видео",
    )
    embed_url = models.URLField(
        max_length=2048,
        blank=True,
        verbose_name="Ссылка для встраивания",
    )

    class Meta:
        verbose_name = "Видео объекта"
        verbose_name_plural = "Видео объектов"
        ordering = ["id"]

    def __str__(self):
        prop_id = self.property_id
        label = self.get_platform_display() if self.platform else ""
        if self.pk:
            return f"Видео #{self.pk} ({label}, объект #{prop_id})"
        return f"Видео ({label}, объект #{prop_id})"


class PropertyContact(BaseTimestampedModel):
    """
    Контакт по объекту недвижимости (риэлтор и телефон для отображения).
    Логика маскирования и раскрытия номера — на последующих этапах.
    """

    property = models.ForeignKey(
        "properties.Property",
        on_delete=models.CASCADE,
        related_name="contacts",
        verbose_name="Объект недвижимости",
    )
    realtor_profile = models.ForeignKey(
        "users.RealtorProfile",
        on_delete=models.CASCADE,
        related_name="property_contacts",
        verbose_name="Профиль риэлтора",
    )
    contact_name = models.CharField(
        max_length=255,
        verbose_name="Имя контакта",
    )
    phone = models.CharField(
        max_length=32,
        blank=True,
        verbose_name="Телефон",
    )
    phone_masked = models.CharField(
        max_length=64,
        blank=True,
        verbose_name="Телефон (маскированный)",
    )
    show_phone_enabled = models.BooleanField(
        default=False,
        verbose_name="Показ телефона включён",
    )

    class Meta:
        verbose_name = "Контакт объекта"
        verbose_name_plural = "Контакты объектов"
        ordering = ["id"]

    def __str__(self):
        prop_id = self.property_id
        if self.pk:
            return f"Контакт #{self.pk}: {self.contact_name} (объект #{prop_id})"
        return f"Контакт: {self.contact_name} (объект #{prop_id})"


class PhoneRevealLog(models.Model):
    """
    Запись о раскрытии телефона по объекту (эндпоинт и бизнес-логика — позже).
    """

    property = models.ForeignKey(
        "properties.Property",
        on_delete=models.CASCADE,
        related_name="phone_reveal_logs",
        verbose_name="Объект недвижимости",
    )
    realtor_profile = models.ForeignKey(
        "users.RealtorProfile",
        on_delete=models.CASCADE,
        related_name="phone_reveal_logs",
        verbose_name="Профиль риэлтора",
    )
    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True,
        verbose_name="IP-адрес",
    )
    user_agent = models.TextField(
        blank=True,
        verbose_name="User-Agent (браузер)",
    )
    revealed_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Время раскрытия",
        db_index=True,
    )

    class Meta:
        verbose_name = "Лог раскрытия телефона"
        verbose_name_plural = "Логи раскрытия телефона"
        ordering = ["-revealed_at"]

    def __str__(self):
        prop_id = self.property_id
        if self.pk:
            return f"Раскрытие телефона #{self.pk} (объект #{prop_id})"
        return f"Раскрытие телефона (объект #{prop_id})"


# Stage 14.6 — import foundation (models live in import_models.py)
from .import_models import ImportItem, ImportJob  # noqa: E402, F401
