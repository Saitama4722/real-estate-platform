from django.db import models


class RenovationType(models.TextChoices):
    WITHOUT = "without", "Без ремонта"
    COSMETIC = "cosmetic", "Косметический"
    EURO = "euro", "Евроремонт"
    DESIGNER = "designer", "Дизайнерский"


class BathroomType(models.TextChoices):
    COMBINED = "combined", "Совмещённый"
    SEPARATE = "separate", "Раздельный"
    MULTIPLE = "multiple", "Несколько"


class HeatingType(models.TextChoices):
    CENTRAL = "central", "Центральное"
    AUTONOMOUS = "autonomous", "Автономное"
    ELECTRIC = "electric", "Электрическое"
    NONE = "none", "Отсутствует"


class CommercialType(models.TextChoices):
    OFFICE = "office", "Офис"
    RETAIL = "retail", "Торговая площадь"
    WAREHOUSE = "warehouse", "Склад"
    PRODUCTION = "production", "Производство"
    FREE_PURPOSE = "free_purpose", "Свободного назначения"
    CATERING = "catering", "Общественное питание"


class LandCategory(models.TextChoices):
    IZHS = "izhs", "ИЖС"
    SNT = "snt", "СНТ"
    DNP = "dnp", "ДНП"
    FARM = "farm", "Фермерское хозяйство"
    INDUSTRIAL = "industrial", "Промышленность"
    OTHER = "other", "Иное"


class PermittedUse(models.TextChoices):
    RESIDENTIAL = "residential", "Жилое строительство"
    GARDEN = "garden", "Садоводство"
    FARMING = "farming", "Фермерство"
    COMMERCIAL = "commercial", "Коммерческое использование"
    OTHER = "other", "Иное"


class BuildingType(models.TextChoices):
    BRICK = "brick", "Кирпич"
    PANEL = "panel", "Панель"
    MONOLITH = "monolith", "Монолит"
    WOOD = "wood", "Дерево"
    FOAM_BLOCK = "foam_block", "Пеноблок"
    OTHER = "other", "Иное"


class ParkingType(models.TextChoices):
    NONE = "none", "Нет"
    OPEN = "open", "Открытая"
    UNDERGROUND = "underground", "Подземная"
    MULTILEVEL = "multilevel", "Многоуровневая"
    GARAGE = "garage", "Гараж"
