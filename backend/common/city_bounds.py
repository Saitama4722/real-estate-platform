"""
⭐ THE SERVICE AREA OF THIS PLATFORM: a UNION OF PER-SETTLEMENT CIRCLES.

A point is inside the service area iff it lies within the radius of ANY
circle below. Each circle is one row of the Город/Район dropdown, which is
the authoritative definition of where the platform operates.

⚠ RECTANGLES WERE TRIED AND REJECTED — do not reintroduce one, not even as
an extra filter. The Krasnodar округ is too dispersed for a box: one holding
all 72 of its dropdown rows spans х. Дальний (45.404) to ст. Григорьевская
and east to ст. Михайловская (39.622), and on the way swallows Усть-Лабинск,
Абинск and Крымск — towns we do not serve.

⚠ THIS FILE IS GENERATED from frontend/src/shared/serviceArea.json and
MIRRORS it. It is duplicated rather than imported because the backend Docker
image is built from `backend/` alone — the frontend directory is NOT present
in a deployed backend. `common/tests.py::CityBoundsSyncTests` asserts the two
agree, so they cannot drift silently. Regenerate; do not hand-edit.
"""
from __future__ import annotations

import math

#: Radius in km by OSM settlement type. Sized to the built-up area the type
#: implies — NOT one global number. The binding constraint is
#: Кабардинка → Новороссийск (15.7 km apart), which is what caps `town` at 5.
RADIUS_BY_TYPE_KM: dict[str, float] = {
    "town": 5.0,
    "administrative": 4.0,
    "village": 3.5,
    "suburb": 3.0,
    "neighbourhood": 3.0,
    "quarter": 3.0,
    "residential": 3.0,
    "hamlet": 2.5,
    "locality": 2.5,
    "isolated_dwelling": 2.0,
    "allotments": 2.0,
    "farm": 2.0,
}

#: key -> circle. ⚠ City keys carry a «город » prefix because «Геленджик»
#: is BOTH a city and a dropdown row (a suburb district); without the prefix
#: the row's 5 km circle silently replaced the city's 10 km one in this dict.
SERVICE_CIRCLES: dict[str, dict[str, float | str]] = {
    "город Краснодар": {"lat": 45.0355, "lon": 38.9753, "radius_km": 16.0, "city": "Краснодар"},
    "город Геленджик": {"lat": 44.5622, "lon": 38.0848, "radius_km": 10.0, "city": "Геленджик"},
    "Авиагородок": {"lat": 45.076199, "lon": 38.97247, "radius_km": 3.0, "city": "Краснодар"},
    "Адербиевка": {"lat": 44.60482, "lon": 38.104103, "radius_km": 3.5, "city": "Геленджик"},
    "Архипо-Осиповка": {"lat": 44.370318, "lon": 38.533611, "radius_km": 5.0, "city": "Геленджик"},
    "Береговое": {"lat": 44.418835, "lon": 38.360098, "radius_km": 3.5, "city": "Геленджик"},
    "Бетта": {"lat": 44.372802, "lon": 38.395614, "radius_km": 3.5, "city": "Геленджик"},
    "Витаминкомбинат": {"lat": 45.150234, "lon": 38.997012, "radius_km": 2.5, "city": "Краснодар"},
    "Возрождение": {"lat": 44.550869, "lon": 38.214794, "radius_km": 3.5, "city": "Геленджик"},
    "Геленджик": {"lat": 44.560945, "lon": 38.076683, "radius_km": 5.0, "city": "Геленджик"},
    "Голубая бухта": {"lat": 44.580122, "lon": 37.986923, "radius_km": 3.0, "city": "Геленджик"},
    "Джанхот": {"lat": 44.464607, "lon": 38.156178, "radius_km": 3.5, "city": "Геленджик"},
    "Дивноморское": {"lat": 44.504033, "lon": 38.132551, "radius_km": 3.5, "city": "Геленджик"},
    "Дубинка": {"lat": 45.02738, "lon": 38.840676, "radius_km": 4.0, "city": "Краснодар"},
    "Западный": {"lat": 44.600308, "lon": 38.028179, "radius_km": 3.0, "city": "Геленджик"},
    "Кабардинка": {"lat": 44.651572, "lon": 37.939529, "radius_km": 5.0, "city": "Геленджик"},
    "Калинино": {"lat": 45.108682, "lon": 38.938652, "radius_km": 3.0, "city": "Краснодар"},
    "Криница": {"lat": 44.390468, "lon": 38.339652, "radius_km": 3.5, "city": "Геленджик"},
    "Магилат": {"lat": 44.5514, "lon": 38.09774, "radius_km": 3.0, "city": "Геленджик"},
    "Марьина Роща": {"lat": 44.618471, "lon": 38.027112, "radius_km": 3.5, "city": "Геленджик"},
    "Михайловский перевал": {"lat": 44.511723, "lon": 38.320261, "radius_km": 3.5, "city": "Геленджик"},
    "Нахаловка": {"lat": 44.598162, "lon": 38.048596, "radius_km": 2.5, "city": "Геленджик"},
    "Немецкая деревня": {"lat": 45.119807, "lon": 38.927158, "radius_km": 3.0, "city": "Краснодар"},
    "Новознаменский": {"lat": 45.052185, "lon": 39.118744, "radius_km": 3.0, "city": "Краснодар"},
    "Парус": {"lat": 44.547922, "lon": 38.077949, "radius_km": 3.0, "city": "Геленджик"},
    "Прасковеевка": {"lat": 44.454246, "lon": 38.212907, "radius_km": 2.0, "city": "Геленджик"},
    "Пшада": {"lat": 44.472083, "lon": 38.397112, "radius_km": 3.5, "city": "Геленджик"},
    "Российский": {"lat": 45.117473, "lon": 39.045271, "radius_km": 3.5, "city": "Краснодар"},
    "СНТ Сосновое": {"lat": 44.535693, "lon": 38.098612, "radius_km": 2.0, "city": "Геленджик"},
    "Северный": {"lat": 44.602042, "lon": 38.031183, "radius_km": 3.0, "city": "Геленджик"},
    "Текос": {"lat": 44.440897, "lon": 38.465368, "radius_km": 3.5, "city": "Геленджик"},
    "Тешебс": {"lat": 44.371673, "lon": 38.585997, "radius_km": 3.5, "city": "Геленджик"},
    "Толстый мыс": {"lat": 44.554076, "lon": 38.054251, "radius_km": 3.0, "city": "Геленджик"},
    "Тонкий мыс": {"lat": 44.56476, "lon": 38.026615, "radius_km": 3.0, "city": "Геленджик"},
    "Энка": {"lat": 45.100348, "lon": 38.977088, "radius_km": 3.0, "city": "Краснодар"},
    "Южный": {"lat": 44.560945, "lon": 38.076683, "radius_km": 5.0, "city": "Геленджик"},
    "аул Гатлукай": {"lat": 44.892022, "lon": 39.23662, "radius_km": 3.5, "city": "Краснодар"},
    "аул Козет": {"lat": 44.996096, "lon": 38.998804, "radius_km": 3.5, "city": "Краснодар"},
    "аул Новая Адыгея": {"lat": 45.024767, "lon": 38.933164, "radius_km": 3.5, "city": "Краснодар"},
    "аул Новый": {"lat": 45.006898, "lon": 38.979749, "radius_km": 3.5, "city": "Краснодар"},
    "аул Псекупс": {"lat": 44.831163, "lon": 39.211196, "radius_km": 3.5, "city": "Краснодар"},
    "аул Тахтамукай": {"lat": 44.921286, "lon": 38.994718, "radius_km": 5.0, "city": "Краснодар"},
    "п. Агроном": {"lat": 45.139199, "lon": 39.191763, "radius_km": 3.5, "city": "Краснодар"},
    "п. Афипский": {"lat": 44.904044, "lon": 38.842682, "radius_km": 5.0, "city": "Краснодар"},
    "п. Белозёрный": {"lat": 45.069405, "lon": 38.720773, "radius_km": 3.5, "city": "Краснодар"},
    "п. Берёзовый": {"lat": 45.154958, "lon": 38.963483, "radius_km": 2.5, "city": "Краснодар"},
    "п. Дорожный": {"lat": 45.117535, "lon": 39.35225, "radius_km": 3.5, "city": "Краснодар"},
    "п. Дружелюбный": {"lat": 45.123724, "lon": 39.150132, "radius_km": 3.5, "city": "Краснодар"},
    "п. Зарождение": {"lat": 45.158178, "lon": 39.235701, "radius_km": 3.5, "city": "Краснодар"},
    "п. Зеленопольский": {"lat": 45.120742, "lon": 39.177781, "radius_km": 3.5, "city": "Краснодар"},
    "п. Знаменский": {"lat": 45.053167, "lon": 39.14839, "radius_km": 3.5, "city": "Краснодар"},
    "п. Зональный": {"lat": 45.087912, "lon": 39.118603, "radius_km": 3.5, "city": "Краснодар"},
    "п. Ильский": {"lat": 44.845854, "lon": 38.560825, "radius_km": 5.0, "city": "Краснодар"},
    "п. Индустриальный": {"lat": 45.093737, "lon": 39.108942, "radius_km": 3.5, "city": "Краснодар"},
    "п. Колосистый": {"lat": 45.132966, "lon": 38.904663, "radius_km": 3.5, "city": "Краснодар"},
    "п. Краснодарский": {"lat": 45.06769, "lon": 39.051119, "radius_km": 2.0, "city": "Краснодар"},
    "п. Краснолит": {"lat": 45.152167, "lon": 38.841275, "radius_km": 3.5, "city": "Краснодар"},
    "п. Красносельское": {"lat": 45.285773, "lon": 39.157696, "radius_km": 4.0, "city": "Краснодар"},
    "п. Лазурный": {"lat": 45.154004, "lon": 39.126304, "radius_km": 3.5, "city": "Краснодар"},
    "п. Лорис": {"lat": 45.087912, "lon": 39.118603, "radius_km": 3.5, "city": "Краснодар"},
    "п. Новая Адыгея": {"lat": 45.024767, "lon": 38.933164, "radius_km": 3.5, "city": "Краснодар"},
    "п. Плодородный": {"lat": 45.06769, "lon": 39.051119, "radius_km": 2.0, "city": "Краснодар"},
    "п. Победитель": {"lat": 45.123185, "lon": 39.099448, "radius_km": 3.5, "city": "Краснодар"},
    "п. Пригородный": {"lat": 45.074058, "lon": 39.193525, "radius_km": 3.5, "city": "Краснодар"},
    "п. Разъезд": {"lat": 45.073551, "lon": 39.257695, "radius_km": 2.5, "city": "Краснодар"},
    "п. Российский": {"lat": 45.117473, "lon": 39.045271, "radius_km": 3.5, "city": "Краснодар"},
    "п. Северный": {"lat": 44.825507, "lon": 39.21296, "radius_km": 2.5, "city": "Краснодар"},
    "п. Тлюстенхабль": {"lat": 44.9811, "lon": 39.089185, "radius_km": 5.0, "city": "Краснодар"},
    "п. Учхоз Кубань": {"lat": 45.062256, "lon": 38.885539, "radius_km": 3.0, "city": "Краснодар"},
    "п. Черноморский": {"lat": 44.849996, "lon": 38.494406, "radius_km": 5.0, "city": "Краснодар"},
    "п. Энем": {"lat": 44.923073, "lon": 38.907142, "radius_km": 5.0, "city": "Краснодар"},
    "п. Южный": {"lat": 44.986688, "lon": 39.009046, "radius_km": 3.0, "city": "Краснодар"},
    "п. Яблоновский": {"lat": 44.986434, "lon": 38.938284, "radius_km": 5.0, "city": "Краснодар"},
    "пгт Калинино": {"lat": 45.108682, "lon": 38.938652, "radius_km": 3.0, "city": "Краснодар"},
    "пгт Пашковский": {"lat": 45.023866, "lon": 39.094968, "radius_km": 3.0, "city": "Краснодар"},
    "ст. Азовская": {"lat": 44.790831, "lon": 38.620682, "radius_km": 3.5, "city": "Краснодар"},
    "ст. Афипская": {"lat": 44.904044, "lon": 38.842682, "radius_km": 5.0, "city": "Краснодар"},
    "ст. Васюринская": {"lat": 45.114541, "lon": 39.380507, "radius_km": 2.5, "city": "Краснодар"},
    "ст. Григорьевская": {"lat": 44.773793, "lon": 38.837955, "radius_km": 3.5, "city": "Краснодар"},
    "ст. Динская": {"lat": 45.216871, "lon": 39.224976, "radius_km": 5.0, "city": "Краснодар"},
    "ст. Елизаветинская": {"lat": 45.048057, "lon": 38.792896, "radius_km": 5.0, "city": "Краснодар"},
    "ст. Ильская": {"lat": 44.845854, "lon": 38.560825, "radius_km": 5.0, "city": "Краснодар"},
    "ст. Марьянская": {"lat": 45.099123, "lon": 38.63679, "radius_km": 5.0, "city": "Краснодар"},
    "ст. Михайловская": {"lat": 44.854145, "lon": 39.621854, "radius_km": 3.5, "city": "Краснодар"},
    "ст. Нововеличковская": {"lat": 45.274869, "lon": 38.843059, "radius_km": 4.0, "city": "Краснодар"},
    "ст. Новотитаровская": {"lat": 45.243247, "lon": 38.975662, "radius_km": 4.0, "city": "Краснодар"},
    "ст. Пластуновская": {"lat": 45.29411, "lon": 39.269323, "radius_km": 4.0, "city": "Краснодар"},
    "ст. Северская": {"lat": 44.853421, "lon": 38.678125, "radius_km": 5.0, "city": "Краснодар"},
    "ст. Старокорсунская": {"lat": 45.050655, "lon": 39.313027, "radius_km": 5.0, "city": "Краснодар"},
    "ст. Старомышастовская": {"lat": 45.341947, "lon": 39.072969, "radius_km": 5.0, "city": "Краснодар"},
    "ст. Черноморская": {"lat": 44.702022, "lon": 39.362944, "radius_km": 3.5, "city": "Краснодар"},
    "х. Восточный": {"lat": 44.856954, "lon": 38.852692, "radius_km": 3.5, "city": "Краснодар"},
    "х. Дальний": {"lat": 45.4036, "lon": 38.852913, "radius_km": 4.0, "city": "Краснодар"},
    "х. Копанской": {"lat": 45.17056, "lon": 38.803573, "radius_km": 3.5, "city": "Краснодар"},
    "х. Красный": {"lat": 44.944727, "lon": 38.569106, "radius_km": 2.5, "city": "Краснодар"},
    "х. Ленина": {"lat": 45.018556, "lon": 39.21034, "radius_km": 3.5, "city": "Краснодар"},
    "х. Найдорф": {"lat": 45.329353, "lon": 38.818993, "radius_km": 4.0, "city": "Краснодар"},
    "х. Новый": {"lat": 45.006898, "lon": 38.979749, "radius_km": 3.5, "city": "Краснодар"},
    "х. Октябрьский": {"lat": 44.921286, "lon": 38.994718, "radius_km": 5.0, "city": "Краснодар"},
    "х. Первомайский": {"lat": 44.934013, "lon": 38.449732, "radius_km": 2.5, "city": "Краснодар"},
    "х. Украинский": {"lat": 45.248157, "lon": 39.346362, "radius_km": 3.5, "city": "Краснодар"},
    "х. Черников": {"lat": 45.185262, "lon": 38.837565, "radius_km": 2.5, "city": "Краснодар"},
    "х. Янтарный": {"lat": 45.128726, "lon": 39.245526, "radius_km": 3.5, "city": "Краснодар"},
}

#: Dropdown rows with no circle, and why. `unmapped` rows are absent from
#: OpenStreetMap entirely, so a map pin in them cannot be accepted — the
#: address is still submittable as text, which is what those owners do.
WITHOUT_CIRCLE: dict[str, str] = {
    "9-й километр": "microdistrict",
    "ГМР (Гидростроителей)": "microdistrict",
    "ЗИП": "microdistrict",
    "КМР (Комсомольский микрорайон)": "microdistrict",
    "Микрорайоны Краснодара": "container",
    "Музыкальный": "microdistrict",
    "ПМР (Пашковский микрорайон)": "microdistrict",
    "Покровка": "microdistrict",
    "Пятый микрорайон": "microdistrict",
    "СМР (Славянский микрорайон)": "microdistrict",
    "СХИ (Сельхозинститут)": "microdistrict",
    "Сосновая роща": "microdistrict",
    "ФМР (Фестивальный микрорайон)": "microdistrict",
    "ХБК (Хлопчато-бумажный комбинат)": "microdistrict",
    "ЦМР (Центральный микрорайон)": "microdistrict",
    "Центр": "microdistrict",
    "ЧМР (Черёмушки)": "microdistrict",
    "Черёмушки": "microdistrict",
    "ЮМР (Юбилейный микрорайон)": "microdistrict",
    "п. Титоровка": "unmapped",
    "х. Навагинка": "unmapped",
}

#: Names of the two cities, for messages.
SERVED_CITIES = ("Краснодар", "Геленджик")


def distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in kilometres."""
    r1, r2 = math.radians(lat1), math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    h = (math.sin(dlat / 2) ** 2
         + math.cos(r1) * math.cos(r2) * math.sin(dlon / 2) ** 2)
    return 6371.0 * 2 * math.asin(math.sqrt(h))


def city_for_point(lat: float, lon: float) -> str | None:
    """City owning the NEAREST circle containing the point, else None."""
    best: str | None = None
    best_d = float('inf')
    for c in SERVICE_CIRCLES.values():
        d = distance_km(lat, lon, c['lat'], c['lon'])
        if d <= c['radius_km'] and d < best_d:
            best, best_d = c['city'], d
    return best


def is_within_served_cities(lat: float, lon: float) -> bool:
    return city_for_point(lat, lon) is not None
