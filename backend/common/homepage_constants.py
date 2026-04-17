"""
Predefined homepage text blocks (Stage 15). Keys are the only editable zones; no free-form DOM editing.
"""

HOMEPAGE_TEXT_BLOCK_DEFINITIONS = (
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

HOMEPAGE_TEXT_BLOCK_KEYS = frozenset(d["key"] for d in HOMEPAGE_TEXT_BLOCK_DEFINITIONS)
