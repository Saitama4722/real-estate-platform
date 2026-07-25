"""
Backfill one initial PriceHistory row per existing property, so already-published
listings aren't left with an empty price chart. Uses the property's current price
and dates the entry to published_at (falling back to created_at).

`changed_at` is auto_now_add, so we create the rows first, then stamp the intended
timestamp with a follow-up update() keyed by property.
"""
from django.db import migrations


def backfill_price_history(apps, schema_editor):
    Property = apps.get_model("properties", "Property")
    PriceHistory = apps.get_model("properties", "PriceHistory")

    for prop in Property.objects.all().iterator():
        if prop.price is None:
            continue
        if PriceHistory.objects.filter(property=prop).exists():
            continue
        entry = PriceHistory.objects.create(property=prop, price=prop.price)
        stamp = prop.published_at or prop.created_at
        if stamp is not None:
            # auto_now_add ignored the intended date on create; set it explicitly.
            PriceHistory.objects.filter(pk=entry.pk).update(changed_at=stamp)


def reverse_backfill(apps, schema_editor):
    # Non-destructive to real data: only removes rows this migration could have
    # created is hard to distinguish, so we no-op the reverse (leave history).
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("properties", "0024_pricehistory"),
    ]

    operations = [
        migrations.RunPython(backfill_price_history, reverse_backfill),
    ]
