from django.conf import settings
from django.db import models


class CrmHiddenItem(models.Model):
    """
    «Скрыть» — ЛИЧНЫЙ архив риэлтора: эта заявка не показывается в ЕГО списке
    и не входит в ЕГО счётчики (2026-10-18).

    Как и квитанции прочтения, это строка на пару (заявка, пользователь), а не
    флаг на заявке: скрытие одним риэлтором не должно ничего менять у других.
    Данные заявки не трогаются; «Архив» в фильтре списка показывает скрытые и
    позволяет вернуть их (`bulk-unhide`). Удалённая заявка или удалённый
    пользователь уносят строку каскадом.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="crm_hidden_items",
        verbose_name="Сотрудник",
    )
    lead = models.ForeignKey(
        "leads.Lead",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="hidden_by",
        verbose_name="Заявка",
    )
    sale_request = models.ForeignKey(
        "submissions.SaleRequest",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="hidden_by",
        verbose_name="Заявка на продажу",
    )
    hidden_at = models.DateTimeField(auto_now_add=True, verbose_name="Скрыта")

    class Meta:
        verbose_name = "Скрытая заявка (архив сотрудника)"
        verbose_name_plural = "Скрытые заявки (архивы сотрудников)"
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(lead__isnull=False, sale_request__isnull=True)
                    | models.Q(lead__isnull=True, sale_request__isnull=False)
                ),
                name="crm_hidden_exactly_one_target",
            ),
            models.UniqueConstraint(
                fields=["user", "lead"],
                condition=models.Q(lead__isnull=False),
                name="uniq_crm_hidden_lead_per_user",
            ),
            models.UniqueConstraint(
                fields=["user", "sale_request"],
                condition=models.Q(sale_request__isnull=False),
                name="uniq_crm_hidden_sale_request_per_user",
            ),
        ]

    def __str__(self):
        target = f"лид #{self.lead_id}" if self.lead_id else f"продажа #{self.sale_request_id}"
        return f"Скрыто #{self.user_id}: {target}"
