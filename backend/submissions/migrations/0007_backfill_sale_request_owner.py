"""
Sale-request queue backfill (2026-10-18).

The shared pool became a queue. A request someone already turned into a
property belongs to the REALTOR who converted it; everything else starts free.
A conversion done by an admin/superadmin assigns nobody: staff are never part
of the workflow.

Historical models only (`apps.get_model`), per docs/claude/django-and-migrations.md.
"""
from django.db import migrations


def forwards(apps, schema_editor):
    SaleRequest = apps.get_model("submissions", "SaleRequest")
    rows = SaleRequest.objects.filter(
        assigned_realtor__isnull=True,
        converted_by__isnull=False,
        converted_by__role="realtor",
        converted_by__is_active=True,
    ).values_list("pk", "converted_by_id", "converted_at")
    for pk, user_id, converted_at in rows:
        SaleRequest.objects.filter(pk=pk).update(
            assigned_realtor_id=user_id,
            assigned_by_id=user_id,
            assigned_at=converted_at,
        )


def backwards(apps, schema_editor):
    # The fields themselves are dropped by reversing 0006; nothing to undo here.
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("submissions", "0006_salerequest_queue_fields"),
        ("users", "__first__"),
    ]

    operations = [migrations.RunPython(forwards, backwards)]
