from django.db import models


class ArticleStatus(models.TextChoices):
    DRAFT = "draft", "Черновик"
    PUBLISHED = "published", "Опубликована"
    ARCHIVED = "archived", "В архиве"


class ArticleCategory(models.TextChoices):
    # Values double as the public ?category= URL slugs — changing one breaks
    # shared/bookmarked filter URLs, so treat them as append-only.
    POKUPKA = "pokupka", "Покупка"
    PRODAZHA = "prodazha", "Продажа"
    IPOTEKA = "ipoteka-i-finansy", "Ипотека и финансы"
    RAYONY = "rayony-i-lokacii", "Районы и локации"
    INVESTICII = "investicii", "Инвестиции"
    PRAVO = "yuridicheskie-voprosy", "Юридические вопросы"
