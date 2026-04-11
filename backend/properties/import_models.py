from django.conf import settings
from django.db import models

from common.models import BaseTimestampedModel

from properties.import_choices import (
    ImportDedupOutcome,
    ImportItemStatus,
    ImportJobStatus,
    ImportSourceFormat,
)


class ImportJob(BaseTimestampedModel):
    """
    One uploaded import run (CSV or XML). Field mapping is stored as JSON:
    ``{"external_column_or_tag": "internal_field", ...}`` — see import pipeline.
    """

    source_file = models.FileField(
        upload_to="imports/jobs/",
        verbose_name="Файл источника",
    )
    source_format = models.CharField(
        max_length=8,
        choices=ImportSourceFormat.choices,
        verbose_name="Формат",
        db_index=True,
    )
    status = models.CharField(
        max_length=16,
        choices=ImportJobStatus.choices,
        default=ImportJobStatus.PENDING,
        verbose_name="Статус",
        db_index=True,
    )
    field_mapping = models.JSONField(
        default=dict,
        verbose_name="Сопоставление полей",
        help_text='JSON: внешнее имя → внутреннее поле, напр. {"Price": "price"}.',
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="import_jobs",
        verbose_name="Инициатор",
    )
    agency = models.ForeignKey(
        "agencies.Agency",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="import_jobs",
        verbose_name="Агентство",
    )
    error_summary = models.TextField(blank=True, verbose_name="Сводка ошибок (задача)")
    row_count_total = models.PositiveIntegerField(default=0, verbose_name="Всего строк")
    row_count_created = models.PositiveIntegerField(default=0, verbose_name="Создано")
    row_count_skipped_duplicate = models.PositiveIntegerField(
        default=0, verbose_name="Пропущено (дубликат)"
    )
    row_count_error = models.PositiveIntegerField(default=0, verbose_name="Ошибок")
    finished_at = models.DateTimeField(
        null=True, blank=True, verbose_name="Завершено"
    )

    class Meta:
        verbose_name = "Импорт — задача"
        verbose_name_plural = "Импорт — задачи"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Импорт #{self.pk or '—'} ({self.get_source_format_display()})"


class ImportItem(BaseTimestampedModel):
    """One row/record inside an import job (traceability)."""

    job = models.ForeignKey(
        ImportJob,
        on_delete=models.CASCADE,
        related_name="items",
        verbose_name="Задача импорта",
    )
    row_index = models.PositiveIntegerField(
        verbose_name="Индекс строки",
        help_text="0-based порядок в файле.",
    )
    external_id = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="Внешний идентификатор",
    )
    raw_snapshot = models.JSONField(
        default=dict,
        verbose_name="Снимок данных (после маппинга)",
    )
    status = models.CharField(
        max_length=24,
        choices=ImportItemStatus.choices,
        default=ImportItemStatus.PENDING,
        verbose_name="Статус",
        db_index=True,
    )
    property = models.ForeignKey(
        "properties.Property",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="import_items",
        verbose_name="Созданный объект",
    )
    duplicate_candidate = models.ForeignKey(
        "properties.Property",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="import_duplicate_hits",
        verbose_name="Кандидат дубликата",
    )
    dedup_outcome = models.CharField(
        max_length=24,
        choices=ImportDedupOutcome.choices,
        default=ImportDedupOutcome.NONE,
        verbose_name="Итог дедупликации",
    )
    error_message = models.TextField(blank=True, verbose_name="Сообщение об ошибке")

    class Meta:
        verbose_name = "Импорт — строка"
        verbose_name_plural = "Импорт — строки"
        ordering = ["job", "row_index"]
        constraints = [
            models.UniqueConstraint(
                fields=["job", "row_index"],
                name="import_item_unique_job_row_index",
            ),
        ]
        indexes = [
            models.Index(fields=["job", "row_index"]),
        ]

    def __str__(self):
        return f"Строка импорта: задача {self.job_id}, строка {self.row_index}"
