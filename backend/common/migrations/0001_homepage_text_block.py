from django.db import migrations, models


def seed_homepage_text_blocks(apps, schema_editor):
    HomepageTextBlock = apps.get_model("common", "HomepageTextBlock")
    rows = (
        {
            "key": "hero_title",
            "label": "Главная: заголовок hero",
            "value": "Найдите недвижимость вашей мечты",
        },
        {
            "key": "hero_subtitle",
            "label": "Главная: подзаголовок hero",
            "value": "Квартиры, дома, участки и коммерция в Краснодаре и Геленджике",
        },
        {
            "key": "inquiry_section_title",
            "label": "Главная: заголовок блока вопроса",
            "value": "Остались вопросы?",
        },
        {
            "key": "inquiry_section_subtitle",
            "label": "Главная: текст под заголовком вопроса",
            "value": "Напишите нам — подскажем по каталогу и подбору объекта.",
        },
        {
            "key": "inquiry_button_label",
            "label": "Главная: кнопка «Задать вопрос»",
            "value": "Задать вопрос",
        },
        {
            "key": "inquiry_modal_title",
            "label": "Главная: заголовок модального окна вопроса",
            "value": "Задать вопрос",
        },
        {
            "key": "inquiry_modal_subtitle",
            "label": "Главная: текст в модальном окне вопроса",
            "value": "Оставьте контакты — мы перезвоним и ответим на ваш вопрос.",
        },
        {
            "key": "categories_section_title",
            "label": "Главная: заголовок «Категории»",
            "value": "Категории",
        },
        {
            "key": "properties_section_title",
            "label": "Главная: заголовок «Новые объекты»",
            "value": "Новые объекты",
        },
        {
            "key": "map_section_title",
            "label": "Главная: заголовок «Объекты на карте»",
            "value": "Объекты на карте",
        },
        {
            "key": "map_empty_message",
            "label": "Главная: текст при отсутствии точек на карте",
            "value": "Нет объектов с координатами для отображения на карте",
        },
        {
            "key": "articles_section_title",
            "label": "Главная: заголовок «Статьи»",
            "value": "Статьи",
        },
        {
            "key": "seo_section_title",
            "label": "Главная: заголовок SEO-блока",
            "value": "Недвижимость в Краснодарском крае",
        },
        {
            "key": "seo_section_body",
            "label": "Главная: текст SEO-блока",
            "value": (
                "Centreal помогает купить недвижимость в Краснодаре и Геленджике: квартиры, "
                "дома, участки и коммерческие помещения. На сайте — актуальный каталог "
                "опубликованных объектов, статьи для покупателей и форма заявки по выбранному объекту."
            ),
        },
    )
    for row in rows:
        HomepageTextBlock.objects.update_or_create(
            key=row["key"],
            defaults={"label": row["label"], "value": row["value"]},
        )


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="HomepageTextBlock",
            fields=[
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Создано")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="Обновлено")),
                ("key", models.SlugField(max_length=64, primary_key=True, serialize=False, verbose_name="Ключ")),
                ("label", models.CharField(max_length=160, verbose_name="Подпись для админки")),
                ("value", models.TextField(verbose_name="Текст")),
            ],
            options={
                "verbose_name": "Текст главной страницы",
                "verbose_name_plural": "Тексты главной страницы",
                "ordering": ("key",),
            },
        ),
        migrations.RunPython(seed_homepage_text_blocks, noop_reverse),
    ]
