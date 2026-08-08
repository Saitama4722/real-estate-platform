from django.db import migrations, models

import articles.models


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
                help_text=articles.models.ARTICLE_BODY_HELP,
                verbose_name="Текст",
            ),
        ),
    ]
