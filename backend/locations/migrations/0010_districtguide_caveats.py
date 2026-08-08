from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("locations", "0009_remove_districtguide_body"),
    ]

    operations = [
        migrations.AddField(
            model_name="districtguide",
            name="caveats",
            field=models.TextField(
                blank=True,
                help_text=(
                    "Оговорки и что проверить перед покупкой. "
                    "Пустое поле не выводится на странице."
                ),
                verbose_name="На что обратить внимание",
            ),
        ),
    ]
