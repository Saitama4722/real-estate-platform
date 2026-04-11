from django.db import models


class LeadSource(models.TextChoices):
    WEBSITE = "website", "Сайт"
    PHONE = "phone", "Телефон"
    CRM = "crm", "CRM"
    OTHER = "other", "Прочее"


class LeadStatus(models.TextChoices):
    NEW = "new", "Новый"
    IN_PROGRESS = "in_progress", "В работе"
    CALLED = "called", "Связан с клиентом"
    NO_ANSWER = "no_answer", "Нет ответа"
    RECALL_LATER = "recall_later", "Перезвонить позже"
    CLOSED = "closed", "Закрыт"
    REJECTED = "rejected", "Отклонён"


class LeadPriority(models.TextChoices):
    LOW = "low", "Низкий"
    NORMAL = "normal", "Обычный"
    HIGH = "high", "Высокий"
