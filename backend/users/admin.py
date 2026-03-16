from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import RealtorProfile, User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ("email", "first_name", "last_name", "role", "is_active", "is_staff")
    list_filter = ("role", "is_active", "is_staff")
    search_fields = ("email", "first_name", "last_name")
    ordering = ("email",)

    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Personal", {"fields": ("first_name", "last_name", "phone")}),
        ("Role & status", {"fields": ("role", "is_active", "is_staff")}),
        ("Permissions", {"fields": ("is_superuser", "groups", "user_permissions")}),
        ("Important dates", {"fields": ("last_login", "date_joined")}),
    )

    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("email", "first_name", "last_name", "password1", "password2"),
            },
        ),
        ("Role & status", {"fields": ("role", "is_active", "is_staff")}),
    )


@admin.register(RealtorProfile)
class RealtorProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "public_name", "public_phone", "agency", "is_public")
    list_filter = ("is_public", "agency")
    search_fields = ("user__email", "public_name", "public_phone")
    raw_id_fields = ("user",)
    autocomplete_fields = ("agency",)
