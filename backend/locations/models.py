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
    (title/slug/excerpt/sections/cover_image + draft/published status) so it is
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
    # Структурированные разделы (2026-08-08). ФИКСИРОВАННЫЕ поля, а не
    # повторяемые блоки: каждый гид состоит из одних и тех же разделов, и пять
    # подписанных полей в порядке чтения — самая простая форма для одного
    # нетехнического автора ~90 гидов. Пустое поле просто не выводится: ни
    # заголовка без текста, ни дырки в оглавлении.
    #
    # ⚠ «Что за район» выводится КАК ВСТУПЛЕНИЕ, без подзаголовка: H1 уже
    # называет район, и перенесённые гиды (весь старый текст в этом поле)
    # обязаны выглядеть в точности как раньше.
    intro = models.TextField(
        verbose_name="Что за район",
        blank=True,
        help_text=(
            "Вступление под заголовком, выводится без подзаголовка. "
            "Абзацы — через пустую строку; «- » или «— » в начале строки — список; "
            "«Важно: » в начале абзаца — синяя врезка."
        ),
    )
    housing = models.TextField(
        verbose_name="Застройка и жильё", blank=True,
        help_text="Пустое поле не выводится на странице.",
    )
    infrastructure = models.TextField(
        verbose_name="Инфраструктура и транспорт", blank=True,
        help_text="Пустое поле не выводится на странице.",
    )
    audience = models.TextField(
        verbose_name="Кому подойдёт", blank=True,
        help_text="Пустое поле не выводится на странице.",
    )
    # Добавлено 2026-08-08. У каждого из 24 пилотных гидов есть блок «на что
    # обратить внимание» (обычно строка-подводка и список), и до этого поля ему
    # не находилось honest-заголовка: он попадал бы под «Инфраструктуру».
    # Порядок — после «Кому подойдёт», как гиды и написаны, чтобы автор
    # заполнял форму сверху вниз без перескоков.
    caveats = models.TextField(
        verbose_name="На что обратить внимание", blank=True,
        help_text=(
            "Оговорки и что проверить перед покупкой. "
            "Пустое поле не выводится на странице."
        ),
    )
    conclusion = models.TextField(
        verbose_name="Вывод", blank=True,
        help_text="Выводится карточкой «Главное» в конце гида.",
    )
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

    #: Section fields in reading order. One definition, so a sixth section
    #: cannot be added to the model and silently missed by word_count.
    SECTION_FIELDS = (
        "intro", "housing", "infrastructure", "audience", "caveats", "conclusion",
    )

    def section_texts(self):
        """Non-empty section texts in reading order."""
        return [
            text
            for text in (getattr(self, name) or "" for name in self.SECTION_FIELDS)
            if text.strip()
        ]

    def rendered_text_parts(self):
        """
        Every string the rendered guide shows, in order: each non-empty
        section's HEADING and text, «Вывод» included.

        The headings are the fields' own verbose_names — the same labels the
        admin shows and the page prints — so there is no second list to keep in
        sync. Counting them matters because the frontend counts them too
        (`countSectionsWords` in lib/articleContent.ts); otherwise the index
        card's clock and the page's clock could disagree by a minute.

        `intro` is the exception: it renders as the lead paragraph, with no
        heading of its own.
        """
        parts = []
        for name in self.SECTION_FIELDS:
            text = (getattr(self, name) or "").strip()
            if not text:
                continue
            if name != "intro":
                parts.append(str(self._meta.get_field(name).verbose_name))
            parts.append(text)
        return parts

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
