from django.db import migrations, models
import django.db.models.deletion

# Copied literally from articles.models.SECTION_TEXT_HELP as of this migration.
# NOT imported: migration 0003 once referenced a live module constant and broke
# the entire migration graph the day that constant was renamed.
_SECTION_TEXT_HELP = (
    "Обычный текст. Абзацы разделяйте пустой строкой; строки, начинающиеся "
    "с «- » или «— », станут списком; абзац, начинающийся с «Важно: », — синей "
    "врезкой."
)


class Migration(migrations.Migration):
    """
    Step 1 of 3: ADD the structured fields alongside `body`.

    `body` is removed in 0007, AFTER the 0006 data migration has split it —
    a combined add+remove migration would leave the data step no source column.
    """

    dependencies = [
        ("articles", "0004_backfill_article_categories"),
    ]

    operations = [
        migrations.AddField(
            model_name="article",
            name="intro",
            field=models.TextField(
                blank=True,
                help_text="Первые абзацы под заголовком, без подзаголовка. "
                + _SECTION_TEXT_HELP,
                verbose_name="Вступление",
            ),
        ),
        migrations.AddField(
            model_name="article",
            name="conclusion_title",
            field=models.CharField(
                default="Вывод", max_length=100, verbose_name="Заголовок вывода"
            ),
        ),
        migrations.AddField(
            model_name="article",
            name="conclusion",
            field=models.TextField(
                blank=True,
                help_text=_SECTION_TEXT_HELP,
                verbose_name="Вывод (карточка «Главное»)",
            ),
        ),
        migrations.CreateModel(
            name="ArticleSection",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("heading", models.CharField(max_length=200, verbose_name="Подзаголовок")),
                (
                    "text",
                    models.TextField(
                        blank=True,
                        help_text=_SECTION_TEXT_HELP,
                        verbose_name="Текст раздела",
                    ),
                ),
                ("order", models.PositiveIntegerField(default=0, verbose_name="Порядок")),
                (
                    "article",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="sections",
                        to="articles.article",
                        verbose_name="Статья",
                    ),
                ),
            ],
            options={
                "verbose_name": "Раздел статьи",
                "verbose_name_plural": "Разделы статьи",
                "ordering": ["order", "id"],
            },
        ),
    ]
