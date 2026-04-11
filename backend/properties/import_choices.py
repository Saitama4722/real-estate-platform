from django.db import models


class ImportSourceFormat(models.TextChoices):
    CSV = "csv", "CSV"
    XML = "xml", "XML"


class ImportJobStatus(models.TextChoices):
    PENDING = "pending", "Ожидает"
    PROCESSING = "processing", "Обработка"
    COMPLETED = "completed", "Завершён"
    FAILED = "failed", "Ошибка"


class ImportItemStatus(models.TextChoices):
    PENDING = "pending", "Ожидает"
    CREATED = "created", "Создан объект"
    SKIPPED_DUPLICATE = "skipped_duplicate", "Пропуск (дубликат)"
    ERROR = "error", "Ошибка"


class ImportDedupOutcome(models.TextChoices):
    NONE = "none", "—"
    EXACT_MATCH = "exact_match", "Точное совпадение (кандидат)"
