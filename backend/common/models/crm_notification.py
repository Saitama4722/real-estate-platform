from django.conf import settings
from django.db import models


class CrmNotificationType(models.TextChoices):
    NEW_LEAD = "new_lead", "Новая заявка"
    NEW_SALE_REQUEST = "new_sale_request", "Заявка на продажу"
    ASSIGNED = "assigned", "Заявка назначена вам"


class CrmNotification(models.Model):
    """
    Одно уведомление колокольчика: «этому риэлтору — про эту заявку».

    ⭐ ЭТО НЕ ЗАМЕНА КВИТАНЦИЯМ ПРОЧТЕНИЯ. `LeadReadReceipt` /
    `SaleRequestReadReceipt` отвечают на «открывал ли риэлтор заявку» и кормят
    счётчики в боковом меню. Уведомление отвечает на «сообщили ли ему о
    событии» и живёт только в колокольчике: оно короткоживущее (в колокольчике
    24 часа, в таблице до 7 дней — `common.tasks.purge_old_crm_notifications`).
    Открытие заявки гасит и то и другое; «Прочитать все» гасит только
    уведомления.

    Получатели — только активные риэлторы (`common.crm_notify`). Суперадмин и
    администратор не получают уведомлений никогда.

    Ровно одна цель: лид ИЛИ заявка на продажу (CheckConstraint). Каскад с
    обеих сторон, поэтому удалённая заявка не оставляет в колокольчике строки,
    ведущей на 404.
    """

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="crm_notifications",
        verbose_name="Получатель",
    )
    type = models.CharField(
        max_length=32,
        choices=CrmNotificationType.choices,
        verbose_name="Тип",
    )
    lead = models.ForeignKey(
        "leads.Lead",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="crm_notifications",
        verbose_name="Заявка",
    )
    sale_request = models.ForeignKey(
        "submissions.SaleRequest",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="crm_notifications",
        verbose_name="Заявка на продажу",
    )
    created_at = models.DateTimeField(
        auto_now_add=True, db_index=True, verbose_name="Создано"
    )
    read_at = models.DateTimeField(null=True, blank=True, verbose_name="Прочитано")

    class Meta:
        verbose_name = "Уведомление CRM"
        verbose_name_plural = "Уведомления CRM"
        ordering = ["-created_at", "-id"]
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(lead__isnull=False, sale_request__isnull=True)
                    | models.Q(lead__isnull=True, sale_request__isnull=False)
                ),
                name="crm_notification_exactly_one_target",
            ),
        ]
        indexes = [
            # Опрос колокольчика: «мои, непрочитанные, за последние 24 часа».
            models.Index(
                fields=["recipient", "read_at", "created_at"],
                name="crm_notif_recipient_idx",
            ),
        ]

    def __str__(self):
        target = f"лид #{self.lead_id}" if self.lead_id else f"продажа #{self.sale_request_id}"
        return f"{self.get_type_display()} → #{self.recipient_id} ({target})"
