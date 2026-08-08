from django.db import migrations, models

# The help text below was `articles.models.ARTICLE_BODY_HELP` when this migration
# was written. It is INLINED now: a migration is a historical record, and reading
# a live module attribute means a later rename (here: the 2026-08-08 move to
# structured section fields, which removed the constant) breaks the whole
# migration graph on import. Never reference app-module constants from a migration.
_ARTICLE_BODY_HELP_AT_THE_TIME = (
    "Обычный текст. Абзацы разделяйте пустой строкой. Короткая строка без точки в "
    "конце, отделённая пустыми строками, станет подзаголовком. Строки, начинающиеся "
    "с «- », станут списком. Последний раздел «Вывод» оформляется как карточка "
    "«Главное». Также поддерживаются явные «## Подзаголовок» и «> цитата»."
)


class Migration(migrations.Migration):

    dependencies = [
        ("articles", "0002_alter_article_created_at_alter_article_slug_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="article",
            name="category",
            field=models.CharField(
                choices=[
                    ("pokupka", "Покупка"),
                    ("prodazha", "Продажа"),
                    ("ipoteka-i-finansy", "Ипотека и финансы"),
                    ("rayony-i-lokacii", "Районы и локации"),
                    ("investicii", "Инвестиции"),
                    ("yuridicheskie-voprosy", "Юридические вопросы"),
                ],
                db_index=True,
                # One-off default for existing rows only; 0004 backfills the real
                # values per slug. The model field itself has no default, so the
                # admin form forces an explicit choice for new articles.
                default="pokupka",
                max_length=40,
                verbose_name="Категория",
            ),
            preserve_default=False,
        ),
        migrations.AlterField(
            model_name="article",
            name="body",
            field=models.TextField(
                help_text=_ARTICLE_BODY_HELP_AT_THE_TIME,
                verbose_name="Текст",
            ),
        ),
    ]
