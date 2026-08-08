from django.db import models

from common.models import BaseTimestampedModel

from .choices import ArticleCategory, ArticleStatus

# The public site parses `body` at render time — plain text with this convention:
# paragraphs separated by a blank line; a short line without ending punctuation on
# its own paragraph = subheading; lines starting with "- " = list items; the final
# «Вывод» section renders as the highlighted takeaway card. Explicit "## " / "> "
# markers are also honored. See frontend/src/lib/articleContent.ts.
ARTICLE_BODY_HELP = (
    "Обычный текст. Абзацы разделяйте пустой строкой. Короткая строка без точки в "
    "конце, отделённая пустыми строками, станет подзаголовком. Строки, начинающиеся "
    "с «- », станут списком. Последний раздел «Вывод» оформляется как карточка "
    "«Главное». Также поддерживаются явные «## Подзаголовок» и «> цитата»."
)


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
    body = models.TextField(verbose_name="Текст", help_text=ARTICLE_BODY_HELP)
    category = models.CharField(
        max_length=40,
        choices=ArticleCategory.choices,
        verbose_name="Категория",
        db_index=True,
    )
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
