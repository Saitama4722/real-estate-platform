from django.contrib import admin

from articles.models import Article


@admin.register(Article)
class ArticleAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "title",
        "slug",
        "status",
        "published_at",
        "updated_at",
    )
    list_filter = ("status",)
    search_fields = ("title", "slug", "excerpt")
    readonly_fields = ("created_at", "updated_at")
    prepopulated_fields = {"slug": ("title",)}
    fieldsets = (
        ("Содержание", {"fields": ("title", "slug", "excerpt", "body", "cover_image")}),
        ("Публикация", {"fields": ("status", "published_at")}),
        ("Даты", {"fields": ("created_at", "updated_at")}),
    )
