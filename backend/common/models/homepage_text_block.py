from django.db import models

from common.models.base import BaseTimestampedModel


class HomepageTextBlock(BaseTimestampedModel):
    """
    Single table for editable site values (predefined keys only).

    Started as homepage copy; it is now also the home of site-wide contact
    values such as `agency_phone`. The CLASS name is kept because renaming a
    model means a table rename for no behavioural gain — the verbose names below
    are what a superadmin actually reads in Django admin.
    """

    key = models.SlugField("Ключ", max_length=64, primary_key=True)
    label = models.CharField("Подпись для админки", max_length=160)
    value = models.TextField("Текст")

    class Meta:
        verbose_name = "Текст / настройка сайта"
        verbose_name_plural = "Тексты и настройки сайта"
        ordering = ("key",)

    def __str__(self):
        return self.label
