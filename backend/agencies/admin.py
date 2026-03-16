from django.contrib import admin

from .models import Agency


@admin.register(Agency)
class AgencyAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "phone", "email", "is_active", "created_at")
    search_fields = ("name", "slug", "phone", "email")
    list_filter = ("is_active",)
