from django.contrib import admin

from properties.models import (
    ApartmentDetails,
    CommercialDetails,
    HouseDetails,
    ImportItem,
    ImportJob,
    LandPlotDetails,
    PhoneRevealLog,
    Property,
    PropertyContact,
    PropertyPhoto,
    PropertyVideo,
)


class PropertyPhotoInline(admin.TabularInline):
    model = PropertyPhoto
    extra = 1
    ordering = ("sort_order", "id")
    fields = (
        "original_file",
        "sort_order",
        "is_main",
    )
    verbose_name = "Фотография"
    verbose_name_plural = "Фотографии"


class PropertyVideoInline(admin.TabularInline):
    model = PropertyVideo
    extra = 0
    fields = ("platform", "video_url", "embed_url")
    verbose_name = "Видео"
    verbose_name_plural = "Видео"


@admin.register(ImportJob)
class ImportJobAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "source_format",
        "status",
        "row_count_total",
        "row_count_created",
        "row_count_skipped_duplicate",
        "row_count_error",
        "created_by",
        "created_at",
        "finished_at",
    )
    list_filter = ("source_format", "status")
    raw_id_fields = ("created_by", "agency")
    readonly_fields = ("created_at", "updated_at", "finished_at")
    fieldsets = (
        (
            "Файл и формат",
            {"fields": ("source_file", "source_format", "status", "finished_at")},
        ),
        (
            "Сопоставление и участники",
            {"fields": ("field_mapping", "created_by", "agency")},
        ),
        (
            "Итоги по строкам",
            {
                "fields": (
                    "row_count_total",
                    "row_count_created",
                    "row_count_skipped_duplicate",
                    "row_count_error",
                )
            },
        ),
        ("Ошибки", {"fields": ("error_summary",)}),
        ("Даты", {"fields": ("created_at", "updated_at")}),
    )


@admin.register(ImportItem)
class ImportItemAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "job",
        "row_index",
        "status",
        "property",
        "duplicate_candidate",
        "dedup_outcome",
    )
    list_filter = ("status", "dedup_outcome")
    raw_id_fields = ("job", "property", "duplicate_candidate")
    readonly_fields = ("created_at", "updated_at")
    fieldsets = (
        (
            "Задача и строка",
            {"fields": ("job", "row_index", "external_id", "status")},
        ),
        ("Данные", {"fields": ("raw_snapshot",)}),
        (
            "Результат",
            {
                "fields": (
                    "property",
                    "duplicate_candidate",
                    "dedup_outcome",
                    "error_message",
                )
            },
        ),
        ("Даты", {"fields": ("created_at", "updated_at")}),
    )


@admin.register(Property)
class PropertyAdmin(admin.ModelAdmin):
    save_on_top = True
    inlines = (PropertyPhotoInline, PropertyVideoInline)
    list_display = (
        "crm_property_id",
        "title_generated",
        "price",
        "property_type",
        "location_short",
        "publication_short",
    )
    list_display_links = ("title_generated",)
    list_filter = (
        "property_type",
        "city",
        "district",
        "status",
        "is_published",
        "deal_type",
    )
    search_fields = (
        "title_generated",
        "public_address_text",
        "street",
        "house_number",
    )
    prepopulated_fields = {"slug": ("title_generated",)}
    raw_id_fields = (
        "agency",
        "created_by",
        "assigned_realtor",
        "city",
        "district",
        "neighborhood",
        "residential_complex",
    )
    readonly_fields = (
        "crm_property_id",
        "views_count",
        "phone_views_count",
        "published_at",
        "archived_at",
        "created_at",
        "updated_at",
    )
    fieldsets = (
        (
            "Основная информация",
            {
                "fields": (
                    "agency",
                    "created_by",
                    "assigned_realtor",
                    "title_generated",
                    "short_description",
                    "description",
                )
            },
        ),
        (
            "Цена и тип",
            {
                "fields": (
                    "deal_type",
                    "property_type",
                    "market_type",
                    "price",
                    "old_price",
                    "currency",
                )
            },
        ),
        (
            "Локация",
            {
                "fields": (
                    "city",
                    "district",
                    "neighborhood",
                    "residential_complex",
                    "street",
                    "house_number",
                    "public_address_text",
                    "hide_exact_address",
                )
            },
        ),
        (
            "Координаты",
            {
                "fields": (
                    ("public_latitude", "public_longitude"),
                    ("real_latitude", "real_longitude"),
                ),
                "description": "Публичные координаты — для карты на сайте; реальные — только для CRM.",
            },
        ),
        (
            "URL и идентификатор",
            {
                "fields": ("crm_property_id", "slug"),
            },
        ),
        (
            "Публикация",
            {
                "fields": (
                    "status",
                    "is_published",
                    "published_at",
                    "archived_at",
                )
            },
        ),
        (
            "Статистика",
            {
                "fields": ("views_count", "phone_views_count"),
                "classes": ("collapse",),
            },
        ),
        (
            "Системные даты",
            {
                "fields": ("created_at", "updated_at"),
                "classes": ("collapse",),
            },
        ),
    )

    @admin.display(description="Город / район", ordering="city__name")
    def location_short(self, obj):
        parts = []
        city = getattr(obj, "city", None)
        if city is not None:
            parts.append(city.name)
        district = getattr(obj, "district", None)
        if district is not None:
            parts.append(district.name)
        return ", ".join(parts) if parts else "—"

    @admin.display(description="Публикация", ordering="is_published")
    def publication_short(self, obj):
        pub = "На сайте" if obj.is_published else "Не на сайте"
        return f"{obj.get_status_display()} · {pub}"


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
    search_fields = ("property__id", "property__title_generated")
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
    search_fields = ("property__id", "property__title_generated")
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
    search_fields = ("property__id", "property__title_generated")
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
    search_fields = ("property__id", "property__title_generated")
    raw_id_fields = ("property",)


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
    fieldsets = (
        (None, {"fields": ("property", "realtor_profile", "contact_name")}),
        (
            "Телефон",
            {
                "fields": (
                    "phone",
                    "phone_masked",
                    "show_phone_enabled",
                )
            },
        ),
        ("Даты", {"fields": ("created_at", "updated_at")}),
    )


@admin.register(PhoneRevealLog)
class PhoneRevealLogAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "property",
        "realtor_profile",
        "ip_address",
        "revealed_at",
    )
    list_filter = ("revealed_at",)
    search_fields = (
        "id",
        "property__id",
        "property__title_generated",
        "realtor_profile__id",
        "realtor_profile__public_name",
        "realtor_profile__user__email",
    )
    raw_id_fields = ("property", "realtor_profile")
    readonly_fields = (
        "id",
        "property",
        "realtor_profile",
        "ip_address",
        "user_agent",
        "revealed_at",
    )

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
