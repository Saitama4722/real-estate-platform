from django.db import models


class SaleRequestStatus(models.TextChoices):
    """Workflow status for an owner's sell-your-property submission."""

    NEW = "new", "Новая"
    IN_PROGRESS = "in_progress", "В работе"
    CONVERTED = "converted", "Создан объект"
    REJECTED = "rejected", "Отклонена"


class SaleRequestPropertyType(models.TextChoices):
    """
    Optional property type the owner may pick. Mirrors properties.PropertyType
    value strings so a converted SaleRequest maps 1:1 onto a Property.
    """

    APARTMENT = "apartment", "Квартира"
    HOUSE = "house", "Дом"
    LAND = "land", "Участок"
    COMMERCIAL = "commercial", "Коммерция"
