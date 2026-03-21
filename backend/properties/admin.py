from django.contrib import admin

from properties.models import Property


@admin.register(Property)
class PropertyAdmin(admin.ModelAdmin):
    list_display = [
        "id",
        "title_generated",
        "property_type",
        "deal_type",
        "status",
        "is_published",
        "city",
        "price",
        "created_by",
        "assigned_realtor",
        "created_at",
    ]
    list_filter = [
        "status",
        "is_published",
        "property_type",
        "deal_type",
        "market_type",
        "city",
    ]
    search_fields = ["title_generated", "id", "public_address_text", "street"]
    readonly_fields = [
        "views_count",
        "phone_views_count",
        "published_at",
        "archived_at",
        "created_at",
        "updated_at",
    ]
    prepopulated_fields = {"slug": ("title_generated",)}
    raw_id_fields = [
        "agency",
        "created_by",
        "assigned_realtor",
        "city",
        "district",
        "neighborhood",
        "residential_complex",
    ]
