from django.contrib import admin

from .models import City, District, Neighborhood, ResidentialComplex


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
