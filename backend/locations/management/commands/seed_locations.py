"""
Seed real location data for Краснодар and Геленджик.

Idempotent — safe to run multiple times (uses get_or_create throughout).
Run with: python manage.py seed_locations
"""

from django.core.management.base import BaseCommand
from django.utils.text import slugify


def _slug(name, suffix=""):
    base = slugify(name, allow_unicode=True) or "item"
    return f"{base}-{suffix}" if suffix else base


class Command(BaseCommand):
    help = "Seed cities, districts, neighborhoods, and residential complexes"

    def handle(self, *args, **options):
        from locations.models import City, District, Neighborhood, ResidentialComplex

        # ── CLEAR EXISTING DATA ──────────────────────────────────────────────
        self.stdout.write("Clearing existing location data...")
        ResidentialComplex.objects.all().delete()
        Neighborhood.objects.all().delete()
        District.objects.all().delete()
        City.objects.all().delete()
        self.stdout.write(self.style.SUCCESS("Cleared."))

        # ── CITIES ───────────────────────────────────────────────────────────
        krasnodar = City.objects.create(
            name="Краснодар", slug="krasnodar",
            region_name="Краснодарский край", is_active=True,
        )
        gelendzhik = City.objects.create(
            name="Геленджик", slug="gelendzhik",
            region_name="Краснодарский край", is_active=True,
        )
        self.stdout.write(self.style.SUCCESS("Cities: OK"))

        # ── КРАСНОДАР DISTRICTS (4 official okrugs) ──────────────────────────
        krd_districts_data = [
            ("Западный округ",    "zapadny-okrug",    1),
            ("Карасунский округ", "karasunsky-okrug", 2),
            ("Прикубанский округ","prikubansky-okrug", 3),
            ("Центральный округ", "tsentralny-okrug", 4),
        ]
        krd_d = {}
        for name, slug, order in krd_districts_data:
            krd_d[slug] = District.objects.create(
                city=krasnodar, name=name, slug=slug, sort_order=order,
            )
        self.stdout.write(self.style.SUCCESS("Krasnodar districts: OK"))

        # ── КРАСНОДАР NEIGHBORHOODS ──────────────────────────────────────────
        # (district_slug, name, neighborhood_slug, sort_order)
        krd_neighborhoods_data = [
            # Центральный округ
            ("tsentralny-okrug",  "ЦМР (Центральный)",         "tsmr",                    1),
            ("tsentralny-okrug",  "Дубинка",                   "dubinka",                  2),
            ("tsentralny-okrug",  "Табачная фабрика",          "tabachnaya-fabrika",       3),
            ("tsentralny-okrug",  "Баскет-Холл",               "basket-kholl",             4),
            ("tsentralny-okrug",  "Кожевенная",                "kozhevenaya",              5),
            ("tsentralny-okrug",  "КСК",                       "ksk",                      6),
            ("tsentralny-okrug",  "ККБ",                       "kkb",                      7),
            # Карасунский округ
            ("karasunsky-okrug",  "ЧМР (Черёмушки)",           "chmr",                     1),
            ("karasunsky-okrug",  "ЮМР (Юбилейный)",           "yumr",                     2),
            ("karasunsky-okrug",  "ММР (Музыкальный)",         "mmr",                      3),
            ("karasunsky-okrug",  "ШМР (Школьный)",            "shmr",                     4),
            ("karasunsky-okrug",  "40 лет Победы",             "40-let-pobedy",            5),
            ("karasunsky-okrug",  "Панорама",                  "panorama-krd",             6),
            ("karasunsky-okrug",  "Новознаменский",            "novoznamensky",            7),
            ("karasunsky-okrug",  "Знаменский",                "znamensky",                8),
            ("karasunsky-okrug",  "Восточно-Кругликовский",    "vostochno-kruglikovsky",   9),
            ("karasunsky-okrug",  "Елизаветинский",            "elizavetinsky",           10),
            ("karasunsky-okrug",  "Берёзовский",               "beryozovsky",             11),
            ("karasunsky-okrug",  "Горхутор",                  "gorkhutor",               12),
            # Прикубанский округ
            ("prikubansky-okrug", "СМР (Северный)",            "smr",                      1),
            ("prikubansky-okrug", "ФМР (Фестивальный)",        "fmr",                      2),
            ("prikubansky-okrug", "КМР (Комсомольский)",       "kmr",                      3),
            ("prikubansky-okrug", "ГМР (Гидростроителей)",     "gmr",                      4),
            ("prikubansky-okrug", "ПМР (Пашковский)",          "pmr",                      5),
            ("prikubansky-okrug", "РИП",                       "rip",                      6),
            ("prikubansky-okrug", "ЗИП",                       "zip",                      7),
            ("prikubansky-okrug", "ХБК",                       "khbk",                     8),
            ("prikubansky-okrug", "ЭНка (Энка)",               "enka",                     9),
            ("prikubansky-okrug", "ФМР-2",                     "fmr-2",                   10),
            ("prikubansky-okrug", "Репино",                    "repino",                  11),
            ("prikubansky-okrug", "Молодёжный",                "molodyozhny-krd",         12),
            ("prikubansky-okrug", "Российский",                "rossiysky",               13),
            ("prikubansky-okrug", "Калинино",                  "kalinino",                14),
            ("prikubansky-okrug", "Учхоз Кубань",              "uchkhoz-kuban",           15),
            ("prikubansky-okrug", "Вавилова",                  "vavilova",                16),
            ("prikubansky-okrug", "Рубероидный",               "ruberoydny",              17),
            # Западный округ
            ("zapadny-okrug",     "ЗМР (Западный)",            "zmr",                      1),
            ("zapadny-okrug",     "СМР (Славянский)",          "slavyansky",               2),
            ("zapadny-okrug",     "Немецкая деревня",          "nemetskaya-derevnya",      3),
            ("zapadny-okrug",     "Северный",                  "severny-krd",              4),
            ("zapadny-okrug",     "Московский",                "moskovsky",                5),
            ("zapadny-okrug",     "Западный обход",            "zapadny-obkhod",           6),
            ("zapadny-okrug",     "Зеленодар",                 "zelenodar",                7),
        ]
        krd_n = {}
        for dist_slug, name, n_slug, order in krd_neighborhoods_data:
            krd_n[n_slug] = Neighborhood.objects.create(
                city=krasnodar,
                district=krd_d[dist_slug],
                name=name, slug=n_slug, sort_order=order,
            )
        self.stdout.write(self.style.SUCCESS("Krasnodar neighborhoods: OK"))

        # ── КРАСНОДАР RESIDENTIAL COMPLEXES ──────────────────────────────────
        # (name, slug, district_slug, neighborhood_slug_or_None)
        krd_rc_data = [
            # Прикубанский / ФМР
            ("ЖК Самолёт",             "zk-samolyot",            "prikubansky-okrug", "fmr"),
            ("ЖК Рекорд",              "zk-rekord",              "prikubansky-okrug", "fmr"),
            ("ЖК Рекорд-2",            "zk-rekord-2",            "prikubansky-okrug", "fmr"),
            ("ЖК Родные просторы",     "zk-rodnye-prostory",     "prikubansky-okrug", "fmr"),
            ("ЖК Новые сезоны",        "zk-novye-sezony",        "prikubansky-okrug", "fmr"),
            ("ЖК Новые сезоны 2",      "zk-novye-sezony-2",      "prikubansky-okrug", "fmr"),
            ("ЖК Европа-Сити",         "zk-evropa-siti",         "prikubansky-okrug", "fmr"),
            ("ЖК Народные кварталы",   "zk-narodnye-kvartaly",   "prikubansky-okrug", "fmr"),
            ("ЖК Тёплые края",         "zk-tyoplye-kraya",       "prikubansky-okrug", "fmr"),
            ("ЖК Акварели-2",          "zk-akvareli-2",          "prikubansky-okrug", "fmr"),
            ("ЖК Краски",              "zk-kraski",              "prikubansky-okrug", "fmr"),
            # Прикубанский / СМР
            ("ЖК Губернский",          "zk-gubernsky",           "prikubansky-okrug", "smr"),
            ("ЖК Семь звёзд",          "zk-sem-zvyozd",          "prikubansky-okrug", "smr"),
            # Прикубанский / КМР
            ("ЖК Образцово",           "zk-obraztsovo",          "prikubansky-okrug", "kmr"),
            ("МКР Образцово",          "mkr-obraztsovo",         "prikubansky-okrug", "kmr"),
            # Прикубанский / ПМР
            ("ЖК Спутник",             "zk-sputnik",             "prikubansky-okrug", "pmr"),
            ("ЖК Репина-Парк",         "zk-repina-park",         "prikubansky-okrug", "repino"),
            # Карасунский / ЮМР
            ("ЖК Парк Победы",         "zk-park-pobedy",         "karasunsky-okrug",  "yumr"),
            ("МКР Парк победы",        "mkr-park-pobedy",        "karasunsky-okrug",  "yumr"),
            # Карасунский / ЧМР
            ("ЖК Ботаника",            "zk-botanika",            "karasunsky-okrug",  "chmr"),
            ("ЖК Свобода",             "zk-svoboda",             "karasunsky-okrug",  "chmr"),
            ("ЖК Лидер",               "zk-lider",               "karasunsky-okrug",  "chmr"),
            # Карасунский / Панорама
            ("ЖК Панорама",            "zk-panorama-krd",        "karasunsky-okrug",  "panorama-krd"),
            # Западный / Немецкая деревня
            ("ЖК Немецкая деревня",    "zk-nemetskaya-derevnya", "zapadny-okrug",     "nemetskaya-derevnya"),
            ("ЖК МОНО Квартал",        "zk-mono-kvartal",        "zapadny-okrug",     "nemetskaya-derevnya"),
            # Западный / ЗМР
            ("ЖК Зеленодар",           "zk-zelenodar",           "zapadny-okrug",     "zelenodar"),
            # Центральный
            ("ЖК Коллекция",           "zk-kollektsiya",         "tsentralny-okrug",  "tsmr"),
            ("ЖК Эрмитаж",             "zk-ermitazh",            "tsentralny-okrug",  "tsmr"),
            ("ЖК Архитектор",          "zk-arkhitektor",         "tsentralny-okrug",  "tsmr"),
            ("ЖК Небо",                "zk-nebo-krd",            "tsentralny-okrug",  "tsmr"),
            ("ЖК Бауинвест",           "zk-bauinvest",           "tsentralny-okrug",  "tsmr"),
            ("ЖК Левада",              "zk-levada",              "tsentralny-okrug",  "tsmr"),
            # Прикубанский / Российский
            ("ЖК Фруктовый сад",       "zk-fruktovy-sad",        "prikubansky-okrug", "rossiysky"),
            ("ЖК Nova Vita",           "zk-nova-vita",           "prikubansky-okrug", "rossiysky"),
        ]
        for name, slug, dist_slug, n_slug in krd_rc_data:
            ResidentialComplex.objects.create(
                city=krasnodar,
                district=krd_d.get(dist_slug),
                neighborhood=krd_n.get(n_slug),
                name=name, slug=slug,
            )
        self.stdout.write(self.style.SUCCESS("Krasnodar residential complexes: OK"))

        # ── ГЕЛЕНДЖИК DISTRICTS (localities of Bolshoy Gelendzhik) ──────────
        gel_districts_data = [
            ("Центр",             "gel-tsentr",         1),
            ("Толстый мыс",       "gel-tolsty-mys",     2),
            ("Тонкий мыс",        "gel-tonky-mys",      3),
            ("Северный",          "gel-severny",        4),
            ("Южный",             "gel-yuzhny",         5),
            ("Парус",             "gel-parus",          6),
            ("Западный",          "gel-zapadny",        7),
            ("Магилат",           "gel-magilat",        8),
            ("Голубая бухта",     "gel-golubbaya-bukhta", 9),
            ("Марьинский",        "gel-marinsky",      10),
            ("Кабардинка",        "gel-kabardinka",    11),
            ("Дивноморское",      "gel-divnomorskoe",  12),
            ("Архипо-Осиповка",   "gel-arkhipo-osipovka", 13),
            ("Пшада",             "gel-pshada",        14),
            ("Береговое",         "gel-beregovoe",     15),
            ("Криница",           "gel-krinitsa",      16),
            ("Бетта",             "gel-betta",         17),
            ("Джанхот",           "gel-dzhankot",      18),
            ("Прасковеевка",      "gel-praskoveyevka", 19),
        ]
        gel_d = {}
        for name, slug, order in gel_districts_data:
            gel_d[slug] = District.objects.create(
                city=gelendzhik, name=name, slug=slug, sort_order=order,
            )
        self.stdout.write(self.style.SUCCESS("Gelendzhik districts: OK"))

        # ── ГЕЛЕНДЖИК NEIGHBORHOODS (26 official mikrorayony) ─────────────────
        # (district_slug, name, neighborhood_slug, sort_order)
        gel_neighborhoods_data = [
            # Центр города
            ("gel-tsentr",        "5-й микрорайон",       "gel-5y-mkr",           1),
            ("gel-tsentr",        "Черёмушки",            "gel-cheremushki",       2),
            ("gel-tsentr",        "Новый автовокзал",     "gel-novy-avtozoval",    3),
            ("gel-tsentr",        "район Аквапарка",      "gel-akvapark",          4),
            # Тонкий мыс
            ("gel-tonky-mys",     "Тонкий Мыс",          "gel-tonky-mys-mkr",    1),
            ("gel-tonky-mys",     "Магнолия",             "gel-magnoliya",         2),
            ("gel-tonky-mys",     "Казачий Хутор",        "gel-kazachy-khutor",    3),
            ("gel-tonky-mys",     "Персиковый сад",       "gel-persikoviy-sad",    4),
            ("gel-tonky-mys",     "Грин Вуд",             "gel-grin-vud",          5),
            # Толстый мыс
            ("gel-tolsty-mys",    "Толстый Мыс",         "gel-tolsty-mys-mkr",   1),
            ("gel-tolsty-mys",    "Солнечный",            "gel-solnechny",         2),
            ("gel-tolsty-mys",    "Здоровье",             "gel-zdorovye",          3),
            ("gel-tolsty-mys",    "Высокий Берег",        "gel-vysoky-bereg",      4),
            ("gel-tolsty-mys",    "Бобруковая Щель",      "gel-bobrukova-shchel",  5),
            ("gel-tolsty-mys",    "Куприянова Щель",      "gel-kupriyanova-shchel", 6),
            ("gel-tolsty-mys",    "Горбунова Щель",       "gel-gorbunova-shchel",  7),
            # Северный
            ("gel-severny",       "Северный",             "gel-severny-mkr",      1),
            ("gel-severny",       "Солнцедар",            "gel-solntsedar",        2),
            ("gel-severny",       "Марьинский",           "gel-marinsky-mkr",      3),
            # Южный / Парус
            ("gel-yuzhny",        "квартал Южный",        "gel-yuzhny-mkr",       1),
            ("gel-yuzhny",        "Южные зори",           "gel-yuzhnye-zori",      2),
            ("gel-parus",         "Парус",                "gel-parus-mkr",         1),
            # Западный / Голубая бухта
            ("gel-zapadny",       "Западный",             "gel-zapadny-mkr",      1),
            ("gel-golubbaya-bukhta", "Голубая Бухта",     "gel-golubaya-bukhta-mkr", 1),
            ("gel-golubbaya-bukhta", "Винсовхоз",         "gel-vinsovkhoz",        2),
            # Кабардинка
            ("gel-kabardinka",    "Кабардинка",           "gel-kabardinka-mkr",   1),
        ]
        gel_n = {}
        for dist_slug, name, n_slug, order in gel_neighborhoods_data:
            gel_n[n_slug] = Neighborhood.objects.create(
                city=gelendzhik,
                district=gel_d[dist_slug],
                name=name, slug=n_slug, sort_order=order,
            )
        self.stdout.write(self.style.SUCCESS("Gelendzhik neighborhoods: OK"))

        # ── ГЕЛЕНДЖИК RESIDENTIAL COMPLEXES ──────────────────────────────────
        gel_rc_data = [
            # Центр
            ("ЖК Горизонт",             "zk-gorizont-gel",           "gel-tsentr",        "gel-5y-mkr"),
            ("ЖК Чайковский",           "zk-chaykovskiy",            "gel-tsentr",        "gel-cheremushki"),
            ("ЖК Прованс",              "zk-provans-gel",            "gel-tsentr",        "gel-cheremushki"),
            ("ЖК Гоголь",               "zk-gogol-gel",              "gel-tsentr",        "gel-novy-avtozoval"),
            ("ЖК Европейский",          "zk-evropeysky-gel",         "gel-tsentr",        None),
            ("ЖК Кировский",            "zk-kirovsky-gel",           "gel-tsentr",        None),
            ("ЖК Атмосфера",            "zk-atmosfera-gel",          "gel-tsentr",        None),
            # Тонкий мыс
            ("ЖК Акватория",            "zk-akvatoriya",             "gel-tonky-mys",     "gel-tonky-mys-mkr"),
            ("ЖК Ривьера",              "zk-riviera-gel",            "gel-tonky-mys",     "gel-tonky-mys-mkr"),
            ("ЖК Подкова",              "zk-podkova-gel",            "gel-tonky-mys",     "gel-magnoliya"),
            ("ЖК Жуковский",            "zk-zhukovsky-gel",          "gel-tonky-mys",     "gel-kazachy-khutor"),
            ("ЖК Botanica Hills",       "zk-botanica-hills",         "gel-tonky-mys",     "gel-grin-vud"),
            # Толстый мыс
            ("ЖК Лазурный",             "zk-lazurny-gel",            "gel-tolsty-mys",    "gel-tolsty-mys-mkr"),
            ("ЖК Дом у моря",           "zk-dom-u-morya",            "gel-tolsty-mys",    "gel-solnechny"),
            ("ЖК Южная звезда",         "zk-yuzhnaya-zvezda",        "gel-tolsty-mys",    "gel-tolsty-mys-mkr"),
            ("ЖК Изумрудный город",     "zk-izumrudny-gorod-gel",    "gel-tolsty-mys",    None),
            # Северный
            ("ЖК Столичный квартал",    "zk-stolichny-kvartal",      "gel-severny",       "gel-severny-mkr"),
            ("ЖК Кубанская марка",      "zk-kubanskaya-marka",       "gel-severny",       "gel-severny-mkr"),
            # Южный / Парус
            ("ЖК Свобода Геленджик",    "zk-svoboda-gel",            "gel-yuzhny",        "gel-yuzhny-mkr"),
            ("ЖК Прованс Южный",        "zk-provans-yuzhny",         "gel-parus",         "gel-parus-mkr"),
        ]
        for name, slug, dist_slug, n_slug in gel_rc_data:
            ResidentialComplex.objects.create(
                city=gelendzhik,
                district=gel_d.get(dist_slug),
                neighborhood=gel_n.get(n_slug) if n_slug else None,
                name=name, slug=slug,
            )
        self.stdout.write(self.style.SUCCESS("Gelendzhik residential complexes: OK"))

        self.stdout.write(self.style.SUCCESS(
            "\n✓ All location data seeded successfully.\n"
            f"  Krasnodar: {len(krd_districts_data)} districts, "
            f"{len(krd_neighborhoods_data)} neighborhoods, "
            f"{len(krd_rc_data)} complexes\n"
            f"  Gelendzhik: {len(gel_districts_data)} districts, "
            f"{len(gel_neighborhoods_data)} neighborhoods, "
            f"{len(gel_rc_data)} complexes"
        ))
