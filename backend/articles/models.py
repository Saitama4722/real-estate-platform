from django.db import models

from common.models import BaseTimestampedModel

from .choices import ArticleCategory, ArticleStatus

# Content is STRUCTURED since 2026-08-08: headings come from fields, not from a
# text convention. Inside any text field the only syntax is paragraph-level:
# blank line between paragraphs; lines starting with «- », «— » or «• » become
# list items; a paragraph starting with «Важно: » becomes the blue callout;
# «> » is a quote. There is nothing to remember for headings — they are the
# field labels. Rendering: frontend/src/lib/articleContent.ts.
SECTION_TEXT_HELP = (
    "Обычный текст. Абзацы разделяйте пустой строкой; строки, начинающиеся "
    "с «- » или «— », станут списком; абзац, начинающийся с «Важно: », — синей "
    "врезкой."
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
    #: Вступление — первый абзац(ы) под заголовком статьи, без подзаголовка.
    #: Именно он получает буквицу.
    #:
    #: Названо intro, а не lead, по двум причинам: в этом проекте Lead — это
    #: заявка из CRM (leads/models.py), и «lead» в PostgreSQL ещё и оконная
    #: функция, из-за чего отсутствующая колонка даёт не «column does not
    #: exist», а «для оконной функции lead требуется предложение OVER».
    #: Совпадает с DistrictGuide.intro.
    intro = models.TextField(
        verbose_name="Вступление",
        blank=True,
        help_text="Первые абзацы под заголовком, без подзаголовка. " + SECTION_TEXT_HELP,
    )
    #: Заголовок карточки «Главное». Отдельное поле, а не константа, потому что
    #: одна реальная статья заканчивается «Совет», и жёсткое «Вывод» изменило бы
    #: её страницу.
    conclusion_title = models.CharField(
        max_length=100,
        default="Вывод",
        verbose_name="Заголовок вывода",
    )
    #: Текст карточки «Главное» в конце статьи. Пусто — карточки нет.
    conclusion = models.TextField(
        verbose_name="Вывод (карточка «Главное»)",
        blank=True,
        help_text=SECTION_TEXT_HELP,
    )
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


class ArticleSection(models.Model):
    """
    Один раздел статьи: подзаголовок + текст.

    Повторяемые разделы, а не фиксированные поля, потому что заголовки статей
    зависят от содержания («Кабардинка», «Как проходит сделка», …) — их не
    выразить фиксированным набором. Гиды по районам — наоборот: у них разделы
    одинаковые, поэтому там именованные поля на самой модели (locations).
    """

    article = models.ForeignKey(
        Article,
        on_delete=models.CASCADE,
        related_name="sections",
        verbose_name="Статья",
    )
    heading = models.CharField(max_length=200, verbose_name="Подзаголовок")
    text = models.TextField(
        verbose_name="Текст раздела",
        blank=True,
        help_text=SECTION_TEXT_HELP,
    )
    #: Порядок на странице. Обычно достаточно порядка добавления; число нужно,
    #: только чтобы переставить разделы без пересоздания.
    order = models.PositiveIntegerField(default=0, verbose_name="Порядок")

    class Meta:
        verbose_name = "Раздел статьи"
        verbose_name_plural = "Разделы статьи"
        ordering = ["order", "id"]

    def __str__(self) -> str:
        return self.heading
