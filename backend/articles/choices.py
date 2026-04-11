from django.db import models


class ArticleStatus(models.TextChoices):
    DRAFT = "draft", "Черновик"
    PUBLISHED = "published", "Опубликована"
    ARCHIVED = "archived", "В архиве"
