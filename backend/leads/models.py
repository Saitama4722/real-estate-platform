from django.conf import settings
from django.db import models

from common.models import BaseTimestampedModel

from .choices import LeadActionType, LeadPriority, LeadSource, LeadStatus


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


class LeadPhoneRevealLog(models.Model):
    """
    Аудит раскрытия телефона клиента в CRM (аналогично PhoneRevealLog для объекта).
    """

    lead = models.ForeignKey(
        "leads.Lead",
        on_delete=models.CASCADE,
        related_name="phone_reveal_logs",
        verbose_name="Лид",
    )
    revealed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="lead_phone_reveal_logs",
        verbose_name="Сотрудник",
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
        verbose_name = "Лог раскрытия телефона (лид)"
        verbose_name_plural = "Логи раскрытия телефона (лиды)"
        ordering = ["-revealed_at"]

    def __str__(self):
        lid = self.lead_id
        if self.pk:
            return f"Раскрытие телефона лида #{lid} (#{self.pk})"
        return f"Раскрытие телефона лида #{lid}"


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


class LeadNote(BaseTimestampedModel):
    lead = models.ForeignKey(
        "leads.Lead",
        on_delete=models.CASCADE,
        related_name="notes",
        verbose_name="Лид",
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="lead_notes",
        verbose_name="Автор",
    )
    text = models.TextField(
        verbose_name="Текст",
    )

    class Meta:
        verbose_name = "Комментарий к лиду (заметка)"
        verbose_name_plural = "Комментарии к лидам (заметки)"
        ordering = ["-created_at"]

    def __str__(self):
        lid = self.lead_id
        if self.pk:
            return f"Заметка #{self.pk} (лид #{lid})"
        return f"Заметка (лид #{lid})"


class LeadActionLog(models.Model):
    lead = models.ForeignKey(
        "leads.Lead",
        on_delete=models.CASCADE,
        related_name="action_logs",
        verbose_name="Лид",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="lead_action_logs",
        verbose_name="Сотрудник",
    )
    action_type = models.CharField(
        max_length=32,
        choices=LeadActionType.choices,
        verbose_name="Тип действия",
        db_index=True,
    )
    description = models.TextField(
        verbose_name="Описание",
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Создано",
        db_index=True,
    )

    class Meta:
        verbose_name = "Действие по лиду"
        verbose_name_plural = "История действий по лидам"
        ordering = ["-created_at"]

    def __str__(self):
        lid = self.lead_id
        if self.pk:
            return f"{self.action_type} (лид #{lid}, #{self.pk})"
        return f"{self.action_type} (лид #{lid})"
