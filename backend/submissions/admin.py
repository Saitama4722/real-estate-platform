from django.contrib import admin

from .models import SaleRequest, SaleRequestPhoto


class SaleRequestPhotoInline(admin.TabularInline):
    model = SaleRequestPhoto
    extra = 0
    fields = ("image", "sort_order")


@admin.register(SaleRequest)
class SaleRequestAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "owner_name",
        "city",
        "district",
        "property_type",
        "status",
        "converted_property",
        "created_at",
    )
    list_filter = ("status", "property_type", "city")
    search_fields = ("owner_name", "owner_phone", "description")
    readonly_fields = (
        "created_at",
        "updated_at",
        "converted_at",
        "converted_by",
    )
    autocomplete_fields = ("city", "district", "neighborhood", "converted_property")
    inlines = [SaleRequestPhotoInline]
    fieldsets = (
        ("Собственник (только для CRM)", {"fields": ("owner_name", "owner_phone")}),
        ("Местоположение", {"fields": ("city", "district", "neighborhood")}),
        (
            "Объект",
            {"fields": ("description", "property_type", "area", "rooms", "asking_price")},
        ),
        (
            "Обработка",
            {
                "fields": (
                    "status",
                    "converted_property",
                    "converted_at",
                    "converted_by",
                )
            },
        ),
        ("Даты", {"fields": ("created_at", "updated_at")}),
    )
