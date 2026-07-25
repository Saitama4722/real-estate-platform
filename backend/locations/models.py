from django.db import models
from django.db.models import Q

from common.models import BaseTimestampedModel


class City(BaseTimestampedModel):
    name = models.CharField(max_length=100, verbose_name="Название")
    slug = models.SlugField("ЧПУ (slug)", unique=True)
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
    class DistrictType(models.TextChoices):
        CITY_DISTRICT = "city_district", "Городской район (есть микрорайоны)"
        SUBURB = "suburb", "Пригород / населённый пункт (конечная точка)"

    city = models.ForeignKey(
        City,
        on_delete=models.CASCADE,
        related_name="districts",
        verbose_name="Город",
    )
    name = models.CharField(max_length=150, verbose_name="Название")
    slug = models.SlugField(verbose_name="ЧПУ (slug)")
    district_type = models.CharField(
        max_length=20,
        choices=DistrictType.choices,
        default=DistrictType.CITY_DISTRICT,
        db_index=True,
        verbose_name="Тип района",
    )
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
        verbose_name="Город",
    )
    district = models.ForeignKey(
        District,
        on_delete=models.CASCADE,
        related_name="neighborhoods",
        null=True,
        blank=True,
        verbose_name="Район",
    )
    name = models.CharField(max_length=150, verbose_name="Название")
    slug = models.SlugField(verbose_name="ЧПУ (slug)")
    sort_order = models.PositiveIntegerField(
        default=0, verbose_name="Порядок сортировки"
    )

    class Meta:
        unique_together = [("city", "slug")]
        verbose_name = "Микрорайон / Населённый пункт"
        verbose_name_plural = "Микрорайоны / Населённые пункты"
        ordering = ["sort_order", "name"]

    def __str__(self):
        return f"{self.city.name} — {self.name}"


class ResidentialComplex(BaseTimestampedModel):
    city = models.ForeignKey(
        City,
        on_delete=models.CASCADE,
        related_name="residential_complexes",
        verbose_name="Город",
    )
    district = models.ForeignKey(
        District,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="residential_complexes",
        verbose_name="Район",
    )
    neighborhood = models.ForeignKey(
        Neighborhood,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="residential_complexes",
        verbose_name="Микрорайон",
    )
    name = models.CharField(max_length=200, verbose_name="Название")
    slug = models.SlugField("ЧПУ (slug)", unique=True)
    address_text = models.CharField(
        max_length=300, blank=True, verbose_name="Адрес"
    )
    latitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        null=True,
        blank=True,
        verbose_name="Широта",
    )
    longitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        null=True,
        blank=True,
        verbose_name="Долгота",
    )
    description = models.TextField(blank=True, verbose_name="Описание")

    class Meta:
        verbose_name = "Жилой комплекс"
        verbose_name_plural = "Жилые комплексы"
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.city.name})"


class DistrictGuide(BaseTimestampedModel):
    """
    Editorial "guide" describing one District or one Neighborhood — a content
    layer on top of the existing location taxonomy (NOT a new Article row, NOT a
    new location table). Each guide targets exactly one of `district` /
    `neighborhood`; the paired one stays null. Mirrors the Article pattern
    (title/slug/excerpt/body/cover_image + draft/published status) so it is
    editable and photo-uploadable via Django admin the same way articles are.
    """

    class GuideStatus(models.TextChoices):
        DRAFT = "draft", "Черновик"
        PUBLISHED = "published", "Опубликован"
        ARCHIVED = "archived", "В архиве"

    # A guide is about EITHER a district OR a neighborhood — exactly one is set.
    district = models.OneToOneField(
        District,
        on_delete=models.CASCADE,
        related_name="guide",
        null=True,
        blank=True,
        verbose_name="Район",
    )
    neighborhood = models.OneToOneField(
        Neighborhood,
        on_delete=models.CASCADE,
        related_name="guide",
        null=True,
        blank=True,
        verbose_name="Микрорайон / Населённый пункт",
    )
    title = models.CharField(max_length=300, verbose_name="Заголовок")
    slug = models.SlugField(
        max_length=320,
        unique=True,
        db_index=True,
        allow_unicode=True,
        verbose_name="ЧПУ (slug)",
    )
    excerpt = models.CharField(max_length=500, verbose_name="Анонс")
    body = models.TextField(verbose_name="Текст")
    cover_image = models.ImageField(
        upload_to="districts/covers/",
        blank=True,
        null=True,
        verbose_name="Обложка",
    )
    status = models.CharField(
        max_length=20,
        choices=GuideStatus.choices,
        default=GuideStatus.DRAFT,
        db_index=True,
        verbose_name="Статус",
    )
    published_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Дата публикации",
    )

    class Meta:
        verbose_name = "Гид по району"
        verbose_name_plural = "Гиды по районам"
        ordering = ["-published_at", "-created_at"]
        constraints = [
            # Exactly one target: either district xor neighborhood must be set.
            models.CheckConstraint(
                name="districtguide_exactly_one_target",
                check=(
                    Q(district__isnull=False, neighborhood__isnull=True)
                    | Q(district__isnull=True, neighborhood__isnull=False)
                ),
            ),
        ]

    def __str__(self) -> str:
        return self.title

    @property
    def city(self):
        """City of whichever target the guide points at."""
        target = self.district or self.neighborhood
        return target.city if target else None

    @property
    def catalog_filter(self):
        """
        The catalog query param + slug to browse listings for this guide's area.
        Mirrors the DistrictCombobox mapping: districts → district_slug,
        neighborhoods → neighborhood_slug. Returns (param, slug).
        """
        if self.neighborhood_id:
            return ("neighborhood_slug", self.neighborhood.slug)
        return ("district_slug", self.district.slug)
