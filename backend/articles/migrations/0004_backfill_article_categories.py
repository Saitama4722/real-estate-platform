from django.db import migrations

# Slug → category for the 15 seeded articles (2026-08). The mapping reproduces
# the design mockup's chip counts exactly: Покупка 6, Продажа 1, Ипотека и
# финансы 1, Районы и локации 4, Инвестиции 2, Юридические вопросы 1.
CATEGORY_BY_SLUG = {
    "kak-kupit-kvartiru-v-krasnodare-pervaya-pokupka": "pokupka",
    "pokupka-zemelnogo-uchastka-na-chto-obratit-vnimanie": "pokupka",
    "novostroyka-ili-vtorichka-kak-vybrat": "pokupka",
    "oformlenie-sdelki-kupli-prodazhi-kvartiry": "pokupka",
    "arenda-ili-pokupka-chto-vygodnee": "pokupka",
    "kak-otsenit-realnuyu-stoimost-kvartiry": "pokupka",
    "kak-podgotovit-kvartiru-k-prodazhe": "prodazha",
    "ipoteka-v-krasnodare-kak-vybrat-bank": "ipoteka-i-finansy",
    "rayony-krasnodara-dlya-pokupatelya": "rayony-i-lokacii",
    "gelendzhik-vtoroe-zhile-u-morya": "rayony-i-lokacii",
    "pereezd-v-krasnodar-chto-nuzhno-znat": "rayony-i-lokacii",
    "gelendzhik-prigorody-i-poselki": "rayony-i-lokacii",
    "investicii-v-nedvizhimost-krasnodarskogo-kraya": "investicii",
    "kommercheskaya-nedvizhimost-v-krasnodare": "investicii",
    "kak-proverit-yuridicheskuyu-chistotu-kvartiry": "yuridicheskie-voprosy",
}


def backfill_categories(apps, schema_editor):
    Article = apps.get_model("articles", "Article")
    for slug, category in CATEGORY_BY_SLUG.items():
        Article.objects.filter(slug=slug).update(category=category)


class Migration(migrations.Migration):

    dependencies = [
        ("articles", "0003_article_category"),
    ]

    operations = [
        migrations.RunPython(backfill_categories, migrations.RunPython.noop),
    ]
