from django.contrib import admin

from .models import (
    City,
    District,
    DistrictGuide,
    Neighborhood,
    ResidentialComplex,
)


@admin.register(City)
class CityAdmin(admin.ModelAdmin):
    list_display = ["name", "region_name", "is_active"]
    list_filter = ["is_active"]
    search_fields = ["name"]
    prepopulated_fields = {"slug": ("name",)}
    fieldsets = (
        (None, {"fields": ("name", "slug", "region_name", "is_active")}),
        ("Даты", {"fields": ("created_at", "updated_at")}),
    )
    readonly_fields = ("created_at", "updated_at")


@admin.register(District)
class DistrictAdmin(admin.ModelAdmin):
    list_display = ["name", "city", "sort_order"]
    list_filter = ["city"]
    ordering = ["city", "sort_order"]
    search_fields = ["name", "slug"]
    prepopulated_fields = {"slug": ("name",)}
    fieldsets = (
        (None, {"fields": ("city", "name", "slug", "sort_order")}),
        ("Даты", {"fields": ("created_at", "updated_at")}),
    )
    readonly_fields = ("created_at", "updated_at")


@admin.register(Neighborhood)
class NeighborhoodAdmin(admin.ModelAdmin):
    list_display = ["name", "city", "district", "sort_order"]
    list_filter = ["city", "district"]
    search_fields = ["name", "slug"]
    prepopulated_fields = {"slug": ("name",)}
    fieldsets = (
        (None, {"fields": ("city", "district", "name", "slug", "sort_order")}),
        ("Даты", {"fields": ("created_at", "updated_at")}),
    )
    readonly_fields = ("created_at", "updated_at")


@admin.register(ResidentialComplex)
class ResidentialComplexAdmin(admin.ModelAdmin):
    list_display = ["name", "city", "district", "neighborhood"]
    list_filter = ["city", "district"]
    search_fields = ["name"]
    prepopulated_fields = {"slug": ("name",)}
    fieldsets = (
        (
            "Основное",
            {"fields": ("name", "slug", "city", "district", "neighborhood")},
        ),
        ("Адрес и карта", {"fields": ("address_text", "latitude", "longitude")}),
        ("Описание", {"fields": ("description",)}),
        ("Даты", {"fields": ("created_at", "updated_at")}),
    )
    readonly_fields = ("created_at", "updated_at")


@admin.register(DistrictGuide)
class DistrictGuideAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "target_label", "status", "published_at", "updated_at")
    list_filter = ("status", "district__city")
    search_fields = ("title", "slug", "excerpt")
    autocomplete_fields = ("district", "neighborhood")
    prepopulated_fields = {"slug": ("title",)}
    readonly_fields = ("created_at", "updated_at")
    fieldsets = (
        (
            "Привязка (заполните ТОЛЬКО одно поле — район ИЛИ микрорайон)",
            {"fields": ("district", "neighborhood")},
        ),
        ("Заголовок и анонс", {"fields": ("title", "slug", "excerpt", "cover_image")}),
        (
            "Текст гида",
            {
                "description": (
                    "Пять разделов в порядке чтения. Пишите обычным текстом — "
                    "подзаголовки подставляются сами. Любой раздел можно "
                    "оставить пустым: он просто не появится на странице."
                ),
                "fields": (
                    "intro",
                    "housing",
                    "infrastructure",
                    "audience",
                    "conclusion",
                ),
            },
        ),
        ("Публикация", {"fields": ("status", "published_at")}),
        ("Даты", {"fields": ("created_at", "updated_at")}),
    )

    @admin.display(description="Привязан к")
    def target_label(self, obj):
        target = obj.district or obj.neighborhood
        return str(target) if target else "—"
