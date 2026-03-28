from django.contrib import admin

from properties.models import (
    ApartmentDetails,
    CommercialDetails,
    HouseDetails,
    LandPlotDetails,
    Property,
    PropertyContact,
    PropertyPhoto,
    PropertyVideo,
)


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


@admin.register(ApartmentDetails)
class ApartmentDetailsAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "property",
        "rooms",
        "area_total",
        "floor",
        "has_balcony",
        "has_loggia",
    )
    search_fields = ("property__id",)
    raw_id_fields = ("property",)


@admin.register(HouseDetails)
class HouseDetailsAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "property",
        "house_area",
        "land_area",
        "floors_total",
        "has_gas",
        "has_water",
    )
    search_fields = ("property__id",)
    raw_id_fields = ("property",)


@admin.register(LandPlotDetails)
class LandPlotDetailsAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "property",
        "land_area",
        "land_category",
        "permitted_use",
        "has_gas",
        "has_water",
        "has_electricity",
    )
    search_fields = ("property__id",)
    raw_id_fields = ("property",)


@admin.register(CommercialDetails)
class CommercialDetailsAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "property",
        "commercial_type",
        "area_total",
        "floor",
        "floors_total",
        "parking_spaces",
    )
    search_fields = ("property__id",)
    raw_id_fields = ("property",)


@admin.register(PropertyPhoto)
class PropertyPhotoAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "property",
        "sort_order",
        "is_main",
        "mime_type",
        "file_size",
        "created_at",
    )
    list_filter = ("is_main",)
    search_fields = ("property__id", "property__title_generated")
    raw_id_fields = ("property",)
    readonly_fields = ("created_at", "updated_at")


@admin.register(PropertyVideo)
class PropertyVideoAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "property",
        "platform",
        "created_at",
    )
    list_filter = ("platform",)
    search_fields = ("property__id", "property__title_generated")
    raw_id_fields = ("property",)
    readonly_fields = ("created_at", "updated_at")


@admin.register(PropertyContact)
class PropertyContactAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "property",
        "realtor_profile",
        "contact_name",
        "show_phone_enabled",
        "created_at",
    )
    list_filter = ("show_phone_enabled",)
    search_fields = ("contact_name", "property__id", "property__title_generated")
    raw_id_fields = ("property", "realtor_profile")
    readonly_fields = ("created_at", "updated_at")
