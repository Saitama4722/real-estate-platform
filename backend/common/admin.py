from django.contrib import admin

from common.models import HomepageTextBlock


@admin.register(HomepageTextBlock)
class HomepageTextBlockAdmin(admin.ModelAdmin):
    list_display = ("key", "label", "value_preview", "updated_at")
    search_fields = ("key", "label", "value")
    readonly_fields = ("key", "created_at", "updated_at")

    @admin.display(description="Текст")
    def value_preview(self, obj):
        v = (obj.value or "").strip().replace("\n", " ")
        return (v[:80] + "…") if len(v) > 80 else v
