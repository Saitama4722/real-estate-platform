from django.conf import settings
from django.db import models

from common.models import BaseTimestampedModel

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
    A photo attached to a SaleRequest. Kept intentionally simpler than
    PropertyPhoto (no derivative sizes): these are raw owner uploads for realtor
    review. When the request is converted, the realtor re-uploads/attaches the
    kept photos to the real Property through the normal property-photo pipeline.
    """

    sale_request = models.ForeignKey(
        "submissions.SaleRequest",
        on_delete=models.CASCADE,
        related_name="photos",
        verbose_name="Заявка на продажу",
    )
    image = models.ImageField(
        upload_to="sale_requests/photos/",
        verbose_name="Фото",
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
