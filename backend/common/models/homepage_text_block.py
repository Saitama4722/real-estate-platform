from django.db import models

from common.models.base import BaseTimestampedModel


class HomepageTextBlock(BaseTimestampedModel):
    """
    Single table for editable homepage copy (predefined keys only).
    """

    key = models.SlugField("Ключ", max_length=64, primary_key=True)
    label = models.CharField("Подпись для админки", max_length=160)
    value = models.TextField("Текст")

    class Meta:
        verbose_name = "Текст главной страницы"
        verbose_name_plural = "Тексты главной страницы"
        ordering = ("key",)

    def __str__(self):
        return self.label
