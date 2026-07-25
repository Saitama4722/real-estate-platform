"""
Signal handlers for the properties app.

Price history: keep an append-only `PriceHistory` log in sync with
`Property.price`. A row is written when the price changes (and one seed row at
creation) so the public detail page can render a "цена снижена" badge and a
price-over-time chart.
"""
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import PriceHistory, Property


@receiver(post_save, sender=Property, dispatch_uid="properties.record_price_history")
def record_price_history(sender, instance: Property, created: bool, **kwargs):
    # `update_fields` saves that don't touch price can't have changed it — skip
    # the extra query. (The intricate Property.save() re-saves title/slug via
    # QuerySet.update(), which does NOT emit post_save, so no double-counting.)
    update_fields = kwargs.get("update_fields")
    if update_fields is not None and "price" not in update_fields:
        return

    if instance.price is None:
        return

    if created:
        # Seed the first data point ("listed at X") so the very first price drop
        # yields a 2-point chart rather than an empty one.
        PriceHistory.objects.create(property=instance, price=instance.price)
        return

    # On update, append only when the price differs from the most recent entry.
    last = (
        PriceHistory.objects.filter(property=instance)
        .order_by("-changed_at", "-id")
        .first()
    )
    if last is None:
        # Existing property predating history (backfill missed / race) — seed now.
        PriceHistory.objects.create(property=instance, price=instance.price)
        return

    if last.price != instance.price:
        PriceHistory.objects.create(property=instance, price=instance.price)
