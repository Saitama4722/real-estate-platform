from django.db import models


class PropertyStatus(models.TextChoices):
    DRAFT      = "draft",      "Черновик"
    MODERATION = "moderation", "На модерации"
    PUBLISHED  = "published",  "Опубликован"
    ARCHIVED   = "archived",   "В архиве"


class DealType(models.TextChoices):
    SALE = "sale", "Продажа"


class PropertyType(models.TextChoices):
    APARTMENT  = "apartment",  "Квартира"
    HOUSE      = "house",      "Дом"
    LAND       = "land",       "Участок"
    COMMERCIAL = "commercial", "Коммерция"


class MarketType(models.TextChoices):
    NEW_BUILDING = "new_building", "Новостройка"
    SECONDARY    = "secondary",    "Вторичка"
    OTHER        = "other",        "Иное"


class CurrencyType(models.TextChoices):
    RUB = "rub", "₽"
    USD = "usd", "$"
    EUR = "eur", "€"
