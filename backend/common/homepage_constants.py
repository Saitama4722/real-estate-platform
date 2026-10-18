"""
Predefined editable site values (Stage 15). Keys are the only editable zones; no
free-form DOM editing.

Originally homepage copy only. The table is now also the home of SITE-WIDE
contact values (`agency_phone`), because it is this project's ONLY key-value
config mechanism and a second one would immediately be a second source of truth.
Keys outside the homepage carry their own permission and validation — see
`SUPERADMIN_ONLY_TEXT_BLOCK_KEYS` and `PHONE_TEXT_BLOCK_KEYS` below.
"""

#: Site-wide agency phone rendered in the header. See CLAUDE.md — SINGLE SOURCE.
AGENCY_PHONE_BLOCK_KEY = "agency_phone"

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
            "ЦЕНТРЕАЛЪ помогает купить недвижимость в Краснодаре и Геленджике: квартиры, "
            "дома, участки и коммерческие помещения. На сайте — актуальный каталог "
            "опубликованных объектов, статьи для покупателей и форма заявки по выбранному объекту."
        ),
    },
    {
        "key": AGENCY_PHONE_BLOCK_KEY,
        "label": "Контакты: телефон агентства (шапка сайта)",
        # The number already published on the only real listing — seeding it
        # means the header shows the same phone visitors could already reach.
        "value": "+79283330837",
    },
)

HOMEPAGE_TEXT_BLOCK_KEYS = frozenset(d["key"] for d in HOMEPAGE_TEXT_BLOCK_DEFINITIONS)

#: Keys only a SUPERADMIN may PATCH. Homepage copy stays staff-level (superadmin
#: or admin) — unchanged. A site-wide contact number is a different weight of
#: decision, so it is narrowed to the single-superadmin role this project uses.
SUPERADMIN_ONLY_TEXT_BLOCK_KEYS = frozenset({AGENCY_PHONE_BLOCK_KEY})

#: Keys stored as a canonical phone rather than free text.
PHONE_TEXT_BLOCK_KEYS = frozenset({AGENCY_PHONE_BLOCK_KEY})
