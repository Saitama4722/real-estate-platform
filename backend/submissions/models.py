from django.conf import settings
from django.db import models, transaction

from common.image_compression import compress_to_max_edge, validate_image_upload
from common.models import BaseTimestampedModel
from common.upload_paths import UniqueUploadTo

from .choices import SaleRequestPropertyType, SaleRequestStatus


class SaleRequest(BaseTimestampedModel):
    """
    Owner-submitted "Продать недвижимость" request from the public site.

    A DIFFERENT submission type from Lead (buyer inquiries). It never appears on
    the public site — it lands in the CRM for a realtor to review and, if
    suitable, convert into a real Property.

    PRIVACY (hard requirement): ``owner_phone`` is CRM-only. It MUST NOT appear in
    any public-facing serializer. The public write serializer accepts it
    write-only; there is no public read/list/detail endpoint for this model at
    all. When a request is converted to a Property, the published listing shows
    the AGENCY's contact phone — never the owner's.
    """

    # --- Owner contact (CRM-only) ---
    owner_name = models.CharField(max_length=255, verbose_name="ФИО собственника")
    # CRM-ONLY — never serialize this to any public endpoint.
    owner_phone = models.CharField(
        max_length=32, verbose_name="Телефон собственника (только для CRM)"
    )

    # --- Location (reuse existing taxonomy) ---
    city = models.ForeignKey(
        "locations.City",
        on_delete=models.PROTECT,
        related_name="sale_requests",
        verbose_name="Город",
    )
    district = models.ForeignKey(
        "locations.District",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="sale_requests",
        verbose_name="Район",
    )
    neighborhood = models.ForeignKey(
        "locations.Neighborhood",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sale_requests",
        verbose_name="Микрорайон / Населённый пункт",
    )

    # --- Precise address (street + house) picked by the owner ---
    #: REQUIRED at the API boundary (see PublicSaleRequestCreateSerializer).
    #: Kept `blank=True` on the model ONLY so the migration can add it to
    #: existing rows without a data backfill; new submissions cannot omit it.
    address = models.CharField(
        max_length=500,
        blank=True,
        verbose_name="Адрес (улица и дом)",
        help_text="Точный адрес, выбранный собственником в подсказках или на карте.",
    )
    #: The exact point the owner put the marker on, so a realtor sees the spot
    #: rather than re-guessing it from the text. Nullable for existing rows.
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

    # --- Owner's description ---
    description = models.TextField(verbose_name="Описание от собственника")

    # --- Optional structured details (speed up realtor review) ---
    property_type = models.CharField(
        max_length=20,
        choices=SaleRequestPropertyType.choices,
        blank=True,
        verbose_name="Тип недвижимости",
    )
    area = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name="Примерная площадь (м²)",
    )
    rooms = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        verbose_name="Количество комнат",
    )
    asking_price = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name="Желаемая цена",
    )

    # --- Workflow ---
    status = models.CharField(
        max_length=20,
        choices=SaleRequestStatus.choices,
        default=SaleRequestStatus.NEW,
        db_index=True,
        verbose_name="Статус",
    )
    # Traceability: which Property this request became (if converted).
    converted_property = models.ForeignKey(
        "properties.Property",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="source_sale_requests",
        verbose_name="Созданный объект",
    )
    converted_at = models.DateTimeField(
        null=True, blank=True, verbose_name="Дата конвертации"
    )
    converted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="converted_sale_requests",
        verbose_name="Кто создал объект",
    )

    class Meta:
        verbose_name = "Заявка на продажу"
        verbose_name_plural = "Заявки на продажу"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "-created_at"]),
        ]

    def __str__(self) -> str:
        label = (self.owner_name or "").strip() or "—"
        if self.pk:
            return f"Заявка на продажу #{self.pk}: {label}"
        return f"Заявка на продажу: {label}"


class SaleRequestPhoto(BaseTimestampedModel):
    """
    A photo attached to a SaleRequest — an owner upload from the public form.

    ⚠ THIS USED TO STORE THE RAW UPLOAD WITH NO PROCESSING AT ALL. It now goes
    through the SAME pipeline as ``PropertyPhoto``: the stored ``image`` is
    capped at 1920px/q85 on save, and ``image_large`` / ``image_medium`` /
    ``image_thumb`` are generated from it. Submissions arrive from phones, so
    EXIF orientation is applied before any resize (see
    ``common.image_compression``).

    ``image`` is never overwritten or deleted by derivative generation.
    """

    sale_request = models.ForeignKey(
        "submissions.SaleRequest",
        on_delete=models.CASCADE,
        related_name="photos",
        verbose_name="Заявка на продажу",
    )
    image = models.ImageField(
        upload_to=UniqueUploadTo("sale_requests/photos"),
        verbose_name="Фото",
    )
    image_large = models.ImageField(
        upload_to=UniqueUploadTo("sale_requests/photos/large"),
        null=True,
        blank=True,
        verbose_name="Крупное изображение",
    )
    image_medium = models.ImageField(
        upload_to=UniqueUploadTo("sale_requests/photos/medium"),
        null=True,
        blank=True,
        verbose_name="Среднее изображение",
    )
    image_thumb = models.ImageField(
        upload_to=UniqueUploadTo("sale_requests/photos/thumb"),
        null=True,
        blank=True,
        verbose_name="Миниатюра",
    )
    sort_order = models.PositiveIntegerField(default=0, verbose_name="Порядок")

    class Meta:
        verbose_name = "Фото заявки на продажу"
        verbose_name_plural = "Фото заявок на продажу"
        ordering = ["sort_order", "id"]

    def __str__(self) -> str:
        if self.pk:
            return f"Фото #{self.pk} (заявка #{self.sale_request_id})"
        return f"Фото (заявка #{self.sale_request_id})"

    def clean(self) -> None:
        super().clean()
        if self.image:
            validate_image_upload(self.image)

    def _compress_image_if_new(self) -> None:
        """Cap a NEW upload at 1920px/q85 before it reaches storage.

        No-ops for an already-stored file (``_committed`` True) and for images
        that already fit (``compress_to_max_edge`` returns None), so re-saving a
        row never re-compresses and never degrades quality a second time.
        """
        f = self.image
        if not f or getattr(f, "_committed", True):
            return
        try:
            compressed = compress_to_max_edge(f)
        except Exception:  # noqa: BLE001 — compression must never break the save
            return
        if compressed is not None:
            self.image.save(compressed.name, compressed, save=False)

    def save(self, *args, **kwargs):
        update_fields = kwargs.get("update_fields")
        # A targeted save that does not touch `image` (e.g. the derivative task
        # writing its own three fields) must not re-enter this whole dance.
        if update_fields is not None and "image" not in update_fields:
            return super().save(*args, **kwargs)

        self._compress_image_if_new()

        prev_name = ""
        if self.pk:
            row = type(self).objects.filter(pk=self.pk).only("image").first()
            if row and row.image:
                prev_name = row.image.name

        super().save(*args, **kwargs)

        if not self.image:
            return
        if self.image.name == prev_name:
            # Same underlying file — derivatives already match it.
            return

        pk = self.pk

        def _enqueue() -> None:
            from submissions.tasks import generate_sale_request_photo_derivatives

            generate_sale_request_photo_derivatives.delay(pk)

        transaction.on_commit(_enqueue)


class SaleRequestReadReceipt(models.Model):
    """
    «Этот риэлтор открывал эту заявку на продажу». ОДНА строка = одна пара
    (заявка, пользователь).

    ⛔ ПРОЧТЕНИЕ ПЕРСОНАЛЬНОЕ. Заявки на продажу — общий пул: их видят ВСЕ
    сотрудники CRM, поэтому счётчик обязан быть свой у каждого. Флаг
    `SaleRequest.is_read` был бы общим, и первый открывший погасил бы уведомление
    всем остальным — ровно то, чего здесь быть не должно. Наличие СТРОКИ и есть
    состояние «прочитано».

    Ставится ТОЛЬКО при открытии карточки конкретной заявки
    (`POST /api/crm/sale-requests/<pk>/mark-read/`), никогда при открытии списка.
    """

    sale_request = models.ForeignKey(
        "submissions.SaleRequest",
        on_delete=models.CASCADE,
        related_name="read_receipts",
        verbose_name="Заявка на продажу",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="sale_request_read_receipts",
        verbose_name="Сотрудник",
    )
    read_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
        verbose_name="Когда открыл",
    )

    class Meta:
        verbose_name = "Отметка о прочтении заявки на продажу"
        verbose_name_plural = "Отметки о прочтении заявок на продажу"
        constraints = [
            models.UniqueConstraint(
                fields=["sale_request", "user"],
                name="uniq_sale_request_read_receipt_per_user",
            ),
        ]
        indexes = [
            models.Index(
                fields=["user", "sale_request"], name="sr_read_user_request_idx"
            ),
        ]

    def __str__(self):
        return (
            f"Заявка на продажу #{self.sale_request_id} "
            f"прочитана пользователем #{self.user_id}"
        )
