from django.contrib import admin

from seo.models import SeoPage


@admin.register(SeoPage)
class SeoPageAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "slug",
        "page_type",
        "city",
        "is_indexable",
        "updated_at",
    )
    list_filter = ("page_type", "is_indexable", "city")
    search_fields = ("slug", "h1", "title")
    raw_id_fields = (
        "city",
        "district",
        "neighborhood",
        "residential_complex",
    )
    readonly_fields = ("created_at", "updated_at")
    fieldsets = (
        (
            "Локация и тип",
            {
                "fields": (
                    "page_type",
                    "city",
                    "district",
                    "neighborhood",
                    "residential_complex",
                    "property_type",
                    "rooms",
                )
            },
        ),
        (
            "Мета и текст",
            {
                "fields": (
                    "slug",
                    "h1",
                    "title",
                    "meta_description",
                    "seo_text",
                    "is_indexable",
                )
            },
        ),
        ("Даты", {"fields": ("created_at", "updated_at")}),
    )
