from django.db import migrations, models

# Help texts copied literally from locations.models.DistrictGuide as of this
# migration — NOT imported. Migration 0003 in the articles app once referenced a
# live module constant and broke the whole migration graph when it was renamed.
_INTRO_HELP = (
    "Вступление под заголовком, выводится без подзаголовка. "
    "Абзацы — через пустую строку; «- » или «— » в начале строки — список; "
    "«Важно: » в начале абзаца — синяя врезка."
)
_OPTIONAL_HELP = "Пустое поле не выводится на странице."
_CONCLUSION_HELP = "Выводится карточкой «Главное» в конце гида."


class Migration(migrations.Migration):
    """Step 1 of 3: add the five section fields alongside `body`."""

    dependencies = [
        ("locations", "0006_districtguide"),
    ]

    operations = [
        migrations.AddField(
            model_name="districtguide",
            name="intro",
            field=models.TextField(
                blank=True, help_text=_INTRO_HELP, verbose_name="Что за район"
            ),
        ),
        migrations.AddField(
            model_name="districtguide",
            name="housing",
            field=models.TextField(
                blank=True, help_text=_OPTIONAL_HELP, verbose_name="Застройка и жильё"
            ),
        ),
        migrations.AddField(
            model_name="districtguide",
            name="infrastructure",
            field=models.TextField(
                blank=True,
                help_text=_OPTIONAL_HELP,
                verbose_name="Инфраструктура и транспорт",
            ),
        ),
        migrations.AddField(
            model_name="districtguide",
            name="audience",
            field=models.TextField(
                blank=True, help_text=_OPTIONAL_HELP, verbose_name="Кому подойдёт"
            ),
        ),
        migrations.AddField(
            model_name="districtguide",
            name="conclusion",
            field=models.TextField(
                blank=True, help_text=_CONCLUSION_HELP, verbose_name="Вывод"
            ),
        ),
    ]
