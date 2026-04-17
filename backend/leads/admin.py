from django.contrib import admin

from leads.models import (
    Lead,
    LeadActionLog,
    LeadComment,
    LeadNote,
    LeadPhoneRevealLog,
    LeadStatusHistory,
)


@admin.register(LeadPhoneRevealLog)
class LeadPhoneRevealLogAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "lead",
        "revealed_by",
        "ip_address",
        "revealed_at",
    )
    list_filter = ("revealed_at",)
    raw_id_fields = ("lead", "revealed_by")
    readonly_fields = ("revealed_at",)

    def has_add_permission(self, request):
        return False


@admin.register(LeadNote)
class LeadNoteAdmin(admin.ModelAdmin):
    list_display = ("id", "lead", "author", "created_at")
    search_fields = ("text",)
    raw_id_fields = ("lead", "author")
    readonly_fields = ("created_at", "updated_at")
    fieldsets = (
        (None, {"fields": ("lead", "author", "text")}),
        ("Даты", {"fields": ("created_at", "updated_at")}),
    )


@admin.register(LeadActionLog)
class LeadActionLogAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "lead",
        "action_type",
        "user",
        "created_at",
    )
    list_filter = ("action_type",)
    search_fields = ("description",)
    raw_id_fields = ("lead", "user")
    readonly_fields = ("created_at",)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(LeadComment)
class LeadCommentAdmin(admin.ModelAdmin):
    list_display = ("id", "lead", "author_user", "created_at")
    search_fields = ("text",)
    raw_id_fields = ("lead", "author_user")
    readonly_fields = ("created_at", "updated_at")
    fieldsets = (
        (None, {"fields": ("lead", "author_user", "text")}),
        ("Даты", {"fields": ("created_at", "updated_at")}),
    )


@admin.register(LeadStatusHistory)
class LeadStatusHistoryAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "lead",
        "previous_status",
        "new_status",
        "changed_by",
        "created_at",
    )
    list_filter = ("new_status", "previous_status")
    raw_id_fields = ("lead", "changed_by")
    readonly_fields = (
        "lead",
        "previous_status",
        "new_status",
        "changed_by",
        "created_at",
        "updated_at",
    )
    fieldsets = (
        (None, {"fields": ("lead", "previous_status", "new_status", "changed_by")}),
        ("Даты", {"fields": ("created_at", "updated_at")}),
    )

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Lead)
class LeadAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "client_name",
        "client_phone",
        "status",
        "priority",
        "source",
        "property",
        "agency",
        "assigned_realtor",
        "created_at",
    )
    list_filter = ("status", "priority", "source")
    search_fields = ("client_name", "client_phone", "id")
    raw_id_fields = ("property", "assigned_realtor", "agency")
    readonly_fields = ("created_at", "updated_at")
    fieldsets = (
        (
            "Клиент",
            {"fields": ("client_name", "client_phone", "client_message")},
        ),
        (
            "Обработка",
            {"fields": ("status", "priority", "source", "processed_at")},
        ),
        (
            "Привязки",
            {"fields": ("property", "agency", "assigned_realtor")},
        ),
        ("Даты", {"fields": ("created_at", "updated_at")}),
    )

    def save_model(self, request, obj, form, change):
        previous_status = None
        if change and obj.pk:
            previous_status = (
                Lead.objects.filter(pk=obj.pk).values_list("status", flat=True).first()
            )
        super().save_model(request, obj, form, change)
        user = (
            request.user
            if getattr(request, "user", None) and request.user.is_authenticated
            else None
        )
        if not change:
            LeadStatusHistory.record(
                lead=obj,
                previous_status=None,
                new_status=obj.status,
                changed_by=user,
            )
        elif previous_status is not None and previous_status != obj.status:
            LeadStatusHistory.record(
                lead=obj,
                previous_status=previous_status,
                new_status=obj.status,
                changed_by=user,
            )
