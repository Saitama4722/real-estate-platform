from django.db import models

from common.models import BaseTimestampedModel

from .choices import ArticleStatus


class Article(BaseTimestampedModel):
    title = models.CharField(max_length=300, verbose_name="Заголовок")
    slug = models.SlugField(
        max_length=320,
        unique=True,
        db_index=True,
        verbose_name="ЧПУ (slug)",
    )
    excerpt = models.CharField(
        max_length=500,
        verbose_name="Анонс",
    )
    body = models.TextField(verbose_name="Текст")
    cover_image = models.ImageField(
        upload_to="articles/covers/",
        blank=True,
        null=True,
        verbose_name="Обложка",
    )
    status = models.CharField(
        max_length=20,
        choices=ArticleStatus.choices,
        default=ArticleStatus.DRAFT,
        verbose_name="Статус",
        db_index=True,
    )
    published_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Дата публикации",
    )

    class Meta:
        verbose_name = "Статья"
        verbose_name_plural = "Статьи"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.title
