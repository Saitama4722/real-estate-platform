from django.conf import settings
from django.db import models

from common.models import BaseTimestampedModel

from .choices import LeadPriority, LeadSource, LeadStatus


class Lead(BaseTimestampedModel):
    property = models.ForeignKey(
        "properties.Property",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="leads",
        verbose_name="Объект недвижимости",
    )
    assigned_realtor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_leads",
        verbose_name="Ответственный риэлтор",
    )
    agency = models.ForeignKey(
        "agencies.Agency",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="leads",
        verbose_name="Агентство",
    )
    client_name = models.CharField(
        max_length=255,
        verbose_name="Имя клиента",
    )
    client_phone = models.CharField(
        max_length=32,
        verbose_name="Телефон клиента",
    )
    client_message = models.TextField(
        blank=True,
        verbose_name="Сообщение клиента",
    )
    source = models.CharField(
        max_length=32,
        choices=LeadSource.choices,
        default=LeadSource.WEBSITE,
        verbose_name="Источник",
        db_index=True,
    )
    status = models.CharField(
        max_length=32,
        choices=LeadStatus.choices,
        default=LeadStatus.NEW,
        verbose_name="Статус",
        db_index=True,
    )
    priority = models.CharField(
        max_length=32,
        choices=LeadPriority.choices,
        default=LeadPriority.NORMAL,
        verbose_name="Приоритет",
    )
    processed_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Обработан",
    )

    class Meta:
        verbose_name = "Лид"
        verbose_name_plural = "Лиды"
        ordering = ["-created_at"]

    def __str__(self):
        label = (self.client_name or "").strip() or "—"
        if self.pk:
            return f"Лид #{self.pk}: {label}"
        return f"Лид: {label}"


class LeadStatusHistory(BaseTimestampedModel):
    lead = models.ForeignKey(
        "leads.Lead",
        on_delete=models.CASCADE,
        related_name="status_history",
        verbose_name="Лид",
    )
    previous_status = models.CharField(
        max_length=32,
        choices=LeadStatus.choices,
        null=True,
        blank=True,
        verbose_name="Предыдущий статус",
    )
    new_status = models.CharField(
        max_length=32,
        choices=LeadStatus.choices,
        verbose_name="Новый статус",
    )
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="lead_status_history_entries",
        verbose_name="Кто изменил",
    )

    class Meta:
        verbose_name = "История статуса лида"
        verbose_name_plural = "История статусов лидов"
        ordering = ["-created_at"]

    def __str__(self):
        lead_id = self.lead_id
        if self.pk:
            return f"Статус лида #{lead_id} → {self.new_status} (#{self.pk})"
        return f"Статус лида #{lead_id} → {self.new_status}"

    @classmethod
    def record(cls, *, lead, previous_status, new_status, changed_by=None):
        if previous_status == new_status:
            return None
        return cls.objects.create(
            lead=lead,
            previous_status=previous_status,
            new_status=new_status,
            changed_by=changed_by,
        )


class LeadComment(BaseTimestampedModel):
    lead = models.ForeignKey(
        "leads.Lead",
        on_delete=models.CASCADE,
        related_name="comments",
        verbose_name="Лид",
    )
    author_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="lead_comments",
        verbose_name="Автор",
    )
    text = models.TextField(
        verbose_name="Текст комментария",
    )

    class Meta:
        verbose_name = "Комментарий к лиду"
        verbose_name_plural = "Комментарии к лидам"
        ordering = ["-created_at"]

    def __str__(self):
        lead_id = self.lead_id
        if self.pk:
            return f"Комментарий #{self.pk} (лид #{lead_id})"
        return f"Комментарий (лид #{lead_id})"
