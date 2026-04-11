# Generated manually for Stage 8 — stable CRM property identifier PID######

import re

from django.db import migrations, models

_PID_ID_PATTERN = re.compile(r"^PID(\d{6})$")


def _backfill_crm_property_ids(apps, schema_editor):
    Property = apps.get_model("properties", "Property")
    best = 0
    for cid in Property.objects.exclude(crm_property_id__isnull=True).values_list(
        "crm_property_id", flat=True
    ):
        m = _PID_ID_PATTERN.fullmatch(cid or "")
        if m:
            best = max(best, int(m.group(1)))
    n = best
    for p in Property.objects.filter(crm_property_id__isnull=True).order_by("pk"):
        n += 1
        Property.objects.filter(pk=p.pk).update(crm_property_id=f"PID{n:06d}")


class Migration(migrations.Migration):

    dependencies = [
        ("properties", "0017_alter_propertyphoto_options_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="property",
            name="crm_property_id",
            field=models.CharField(
                blank=True,
                db_index=True,
                max_length=10,
                null=True,
                unique=True,
                verbose_name="CRM ID объекта (PID)",
            ),
        ),
        migrations.RunPython(_backfill_crm_property_ids, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="property",
            name="crm_property_id",
            field=models.CharField(
                blank=True,
                db_index=True,
                max_length=10,
                unique=True,
                verbose_name="CRM ID объекта (PID)",
            ),
        ),
    ]
