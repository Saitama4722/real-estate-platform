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
        "assigned_realtor",
        "converted_property",
        "created_at",
    )
    list_filter = ("status", "property_type", "city")
    search_fields = ("owner_name", "owner_phone", "description")
    raw_id_fields = ("assigned_realtor",)
    readonly_fields = (
        "created_at",
        "updated_at",
        "converted_at",
        "converted_by",
        "assigned_at",
        "assigned_by",
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
                    "assigned_realtor",
                    "assigned_at",
                    "assigned_by",
                    "converted_property",
                    "converted_at",
                    "converted_by",
                )
            },
        ),
        ("Даты", {"fields": ("created_at", "updated_at")}),
    )

    def save_model(self, request, obj, form, change):
        """Staff reassignment keeps the queue and the bell consistent."""
        from django.utils import timezone

        from common import crm_notify

        previous_owner_id = None
        if change and obj.pk:
            previous_owner_id = (
                SaleRequest.objects.filter(pk=obj.pk)
                .values_list("assigned_realtor_id", flat=True)
                .first()
            )
        owner_changed = change and previous_owner_id != obj.assigned_realtor_id
        if owner_changed:
            obj.assigned_at = timezone.now() if obj.assigned_realtor_id else None
            obj.assigned_by = request.user if obj.assigned_realtor_id else None
        super().save_model(request, obj, form, change)
        if owner_changed:
            crm_notify.on_sale_request_owner_changed(
                obj, previous_owner_id, obj.assigned_realtor, by_self=False
            )
