from django.contrib import admin

from articles.models import Article, ArticleSection


class ArticleSectionInline(admin.StackedInline):
    """
    Repeatable sections, in reading order.

    Stacked (not tabular) because `text` is a multi-paragraph TextField —
    a tabular row would squeeze it into a one-line cell. `order` is the only
    knob the author touches to rearrange; leaving equal values falls back to
    creation order via the model's `["order", "id"]` ordering.
    """

    model = ArticleSection
    extra = 1
    fields = ("order", "heading", "text")
    verbose_name = "Раздел"
    verbose_name_plural = "Разделы (в порядке чтения)"


@admin.register(Article)
class ArticleAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "title",
        "slug",
        "category",
        "status",
        "published_at",
        "updated_at",
    )
    list_filter = ("status", "category")
    search_fields = ("title", "slug", "excerpt")
    readonly_fields = ("created_at", "updated_at")
    prepopulated_fields = {"slug": ("title",)}
    inlines = [ArticleSectionInline]
    fieldsets = (
        (
            "Заголовок и анонс",
            {"fields": ("title", "slug", "category", "excerpt", "cover_image")},
        ),
        (
            "Вступление",
            {
                "description": (
                    "Первые абзацы под заголовком, без подзаголовка. "
                    "Разделы статьи добавляются ниже, под этой формой."
                ),
                "fields": ("intro",),
            },
        ),
        (
            "Вывод",
            {
                "description": (
                    "Выводится карточкой «Главное» в конце статьи. "
                    "Оставьте текст пустым — карточки не будет."
                ),
                "fields": ("conclusion_title", "conclusion"),
            },
        ),
        ("Публикация", {"fields": ("status", "published_at")}),
        ("Даты", {"fields": ("created_at", "updated_at")}),
    )
