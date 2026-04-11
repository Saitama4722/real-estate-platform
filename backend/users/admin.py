from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import RealtorProfile, User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = (
        "crm_id",
        "email",
        "first_name",
        "last_name",
        "role",
        "is_active",
        "is_staff",
    )
    list_filter = ("role", "is_active", "is_staff")
    search_fields = ("email", "first_name", "last_name", "crm_id", "phone")
    ordering = ("crm_id", "email")
    readonly_fields = ("crm_id", "last_login", "date_joined")

    fieldsets = (
        (None, {"fields": ("email", "password")}),
        (
            "Личные данные",
            {"fields": ("first_name", "last_name", "phone", "avatar", "crm_id")},
        ),
        ("Роль и статус", {"fields": ("role", "is_active", "is_staff")}),
        (
            "CRM: доп. права (для роли «Риэлтор»)",
            {
                "fields": (
                    "perm_create_property",
                    "perm_edit_property",
                    "perm_delete_property",
                    "perm_view_clients",
                    "perm_delete_clients",
                    "perm_change_status",
                ),
            },
        ),
        (
            "Права доступа",
            {"fields": ("is_superuser", "groups", "user_permissions")},
        ),
        ("Важные даты", {"fields": ("last_login", "date_joined")}),
    )

    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": (
                    "email",
                    "first_name",
                    "last_name",
                    "phone",
                    "avatar",
                    "password1",
                    "password2",
                ),
            },
        ),
        ("Роль и статус", {"fields": ("role", "is_active", "is_staff")}),
    )


@admin.register(RealtorProfile)
class RealtorProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "public_name", "public_phone", "agency", "is_public")
    list_filter = ("is_public", "agency")
    search_fields = ("user__email", "public_name", "public_phone")
    raw_id_fields = ("user",)
    autocomplete_fields = ("agency",)
    fieldsets = (
        (None, {"fields": ("user", "agency")}),
        (
            "Публичные данные",
            {"fields": ("public_name", "public_phone", "photo", "short_bio", "is_public")},
        ),
    )
