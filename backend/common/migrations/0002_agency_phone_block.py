from django.db import migrations

# Frozen copy of the seed row. A migration is a historical record: it must NOT
# import `common.homepage_constants`, because a later edit to that module would
# silently change what this migration writes on a fresh database.
AGENCY_PHONE_KEY = "agency_phone"
AGENCY_PHONE_LABEL = "Контакты: телефон агентства (шапка сайта)"
AGENCY_PHONE_VALUE = "+79283330837"


def seed_agency_phone(apps, schema_editor):
    HomepageTextBlock = apps.get_model("common", "HomepageTextBlock")
    # `update_or_create` matches 0001's idiom and keeps a re-run harmless — but
    # an EXISTING value is preserved, so re-running this cannot overwrite a
    # number the superadmin has since changed or deliberately cleared.
    obj, created = HomepageTextBlock.objects.get_or_create(
        key=AGENCY_PHONE_KEY,
        defaults={"label": AGENCY_PHONE_LABEL, "value": AGENCY_PHONE_VALUE},
    )
    if not created and obj.label != AGENCY_PHONE_LABEL:
        obj.label = AGENCY_PHONE_LABEL
        obj.save(update_fields=["label"])


def remove_agency_phone(apps, schema_editor):
    HomepageTextBlock = apps.get_model("common", "HomepageTextBlock")
    HomepageTextBlock.objects.filter(key=AGENCY_PHONE_KEY).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("common", "0001_homepage_text_block"),
    ]

    operations = [
        migrations.AlterModelOptions(
            name="homepagetextblock",
            options={
                "ordering": ("key",),
                "verbose_name": "Текст / настройка сайта",
                "verbose_name_plural": "Тексты и настройки сайта",
            },
        ),
        migrations.RunPython(seed_agency_phone, remove_agency_phone),
    ]
