from django.db import models


class SeoPageType(models.TextChoices):
    CITY_PROPERTY_TYPE = "city_property_type", "Город + тип недвижимости"
    CITY_ROOMS = "city_rooms", "Город + комнатность"
    CITY_DISTRICT = "city_district", "Город + район"
    CITY_NEIGHBORHOOD = "city_neighborhood", "Город + микрорайон"
    RESIDENTIAL_COMPLEX = "residential_complex", "Жилой комплекс"
