from django.contrib import admin

from .models import Owner


@admin.register(Owner)
class OwnerAdmin(admin.ModelAdmin):
    list_display = ("id", "full_name", "phone", "properties_count", "updated_at")
    search_fields = ("full_name", "phone")
    readonly_fields = ("created_at", "updated_at")
    fieldsets = (
        ("Собственник (только для CRM)", {"fields": ("full_name", "phone", "photo", "note")}),
        ("Даты", {"fields": ("created_at", "updated_at")}),
    )

    @admin.display(description="Объектов")
    def properties_count(self, obj):
        return obj.properties.count()
