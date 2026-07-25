from django.db import models

from common.models import BaseTimestampedModel


class Owner(BaseTimestampedModel):
    """
    Property owner (собственник) — an INTERNAL CRM record tied to Property rows.

    A standalone, reusable entity: one Owner can be linked to many Property
    records (Property.owner is a nullable FK, not OneToOne). The owner's
    "addresses" are DERIVED from that relationship (the list of linked
    Properties) — there is deliberately no free-text address field here.

    PRIVACY (hard requirement): Owner data (name, phone, photo, note) is CRM-only
    and MUST NOT appear in any public API or public page. It is served solely by
    CRM-authenticated endpoints (IsCrmUser). This mirrors the owner_phone privacy
    rule of the SaleRequest ("Продать недвижимость") feature.
    """

    full_name = models.CharField(max_length=255, verbose_name="ФИО")
    phone = models.CharField(max_length=32, verbose_name="Телефон")
    photo = models.ImageField(
        upload_to="owners/photos/",
        blank=True,
        null=True,
        verbose_name="Фото",
    )
    note = models.TextField(blank=True, verbose_name="Примечание")

    class Meta:
        verbose_name = "Собственник"
        verbose_name_plural = "Собственники"
        ordering = ["full_name", "id"]
        indexes = [
            models.Index(fields=["phone"]),
            models.Index(fields=["full_name"]),
        ]

    def __str__(self) -> str:
        label = (self.full_name or "").strip() or "—"
        if self.pk:
            return f"Собственник #{self.pk}: {label}"
        return f"Собственник: {label}"
