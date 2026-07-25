"""
Seed locations: Краснодар + Геленджик.

Structure
---------
City
 └─ District  (district_type = "city_district" | "suburb")
      └─ Neighborhood  (only under city_district districts)

city_district  → selecting it shows a "Микрорайон" sub-field in the UI
suburb         → selecting it IS the final location (no sub-field shown)

Краснодар
---------
  city_district: 1 consolidated "Микрорайоны Краснодара" with named microdistricts
  suburb: "Пригород Краснодара" + Динской/Северский/Тахтамукайский районы
    Their Neighborhood rows are the actual settlements (ст./п./х./пгт/аул).

Геленджик
---------
  city_district: none — every area is a flat suburb district.
  suburb: "Геленджик (центр)" carries the urban microdistricts as Neighborhood
    rows; every other settlement is a flat suburb with no children (final
    selectable location).

Run:
    python manage.py seed_locations_full
"""
from django.core.management.base import BaseCommand
from django.utils.text import slugify

SLUG_MAX_LENGTH = 50


def _base_slug(name: str) -> str:
    return slugify(name, allow_unicode=True) or "item"


# ---------------------------------------------------------------------------
# Location data — Краснодар
# ---------------------------------------------------------------------------

# One consolidated city_district holding every named urban microdistrict.
KRASNODAR_CITY_DISTRICTS = [
    (
        "Микрорайоны Краснодара",
        [
            "ЦМР (Центральный микрорайон)",
            "ФМР (Фестивальный микрорайон)",
            "ЮМР (Юбилейный микрорайон)",
            "ЧМР (Черёмушки)",
            "ГМР (Гидростроителей)",
            "КМР (Комсомольский микрорайон)",
            "ПМР (Пашковский микрорайон)",
            "СМР (Славянский микрорайон)",
            "ЗИП",
            "ХБК (Хлопчато-бумажный комбинат)",
            "СХИ (Сельхозинститут)",
            "Энка",
            "Дубинка",
            "Покровка",
            "Калинино",
            "Музыкальный",
            "Витаминкомбинат",
            "Авиагородок",
            "9-й километр",
            "Новознаменский",
            "Российский",
        ],
    ),
]

# Suburb-type districts for Krasnodar.
# Each entry: (district_name, [settlement_names]).
# Each settlement is its own FLAT suburb district (no neighborhood children) —
# selecting it IS the final location, like the Gelendzhik suburbs.
KRASNODAR_SUBURB_DISTRICTS = [
    # ── Пригород Краснодара (official settlements inside the city okrug) ──
    ("ст. Елизаветинская", []),
    ("п. Белозёрный", []),
    ("ст. Старокорсунская", []),
    ("п. Дорожный", []),
    ("п. Разъезд", []),
    ("пгт Пашковский", []),
    ("п. Зеленопольский", []),
    ("п. Знаменский", []),
    ("п. Лорис", []),
    ("п. Пригородный", []),
    ("х. Ленина", []),
    ("п. Берёзовый", []),
    ("х. Восточный", []),
    ("х. Копанской", []),
    ("х. Новый", []),
    ("х. Черников", []),
    ("п. Колосистый", []),
    ("п. Краснолит", []),
    ("пгт Калинино", []),
    ("п. Лазурный", []),
    ("п. Дружелюбный", []),
    ("п. Индустриальный", []),
    ("п. Краснодарский", []),
    ("п. Плодородный", []),
    ("п. Победитель", []),
    ("п. Российский", []),
    ("х. Октябрьский", []),
    # ── Динской район ────────────────────────────────────────────────────
    ("ст. Динская", []),
    ("ст. Новотитаровская", []),
    ("ст. Васюринская", []),
    ("ст. Пластуновская", []),
    ("ст. Нововеличковская", []),
    ("ст. Старомышастовская", []),
    ("п. Южный", []),
    ("п. Агроном", []),
    ("х. Найдорф", []),
    ("х. Дальний", []),
    ("х. Первомайский", []),
    ("х. Украинский", []),
    ("х. Янтарный", []),
    ("п. Красносельское", []),
    ("п. Зарождение", []),
    # ── Северский район ──────────────────────────────────────────────────
    ("ст. Северская", []),
    ("ст. Афипская", []),
    ("ст. Ильская", []),
    ("ст. Черноморская", []),
    ("п. Афипский", []),
    ("п. Ильский", []),
    ("п. Черноморский", []),
    ("ст. Григорьевская", []),
    ("ст. Михайловская", []),
    ("ст. Азовская", []),
    ("п. Титоровка", []),
    ("х. Красный", []),
    ("х. Навагинка", []),
    # ── Тахтамукайский район (Адыгея) ────────────────────────────────────
    ("п. Яблоновский", []),
    ("п. Тлюстенхабль", []),
    ("аул Тахтамукай", []),
    ("аул Новый", []),
    ("аул Гатлукай", []),
    ("аул Псекупс", []),
    ("п. Энем", []),
    # ── Дополнительные пригороды ─────────────────────────────────────────
    # ("ст. Нововеличковская" already present in Динской район block above.)
    ("п. Северный", []),
    ("Немецкая деревня", []),
    ("п. Новая Адыгея", []),
    ("ст. Марьянская", []),
    ("п. Учхоз Кубань", []),
    ("аул Козет", []),
    ("аул Новая Адыгея", []),
    ("п. Зональный", []),
]

# ---------------------------------------------------------------------------
# Location data — Геленджик
# ---------------------------------------------------------------------------

# Gelendzhik has NO city_district. Every area is a flat suburb district.
GELENDZHIK_CITY_DISTRICTS = []

# Flat suburb districts. Each entry: (district_name, [neighborhood_names]).
# Only the city centre ("Геленджик (центр)") carries neighborhoods — its urban
# microdistricts. Every other district is a final selectable location with no
# neighborhood children.
GELENDZHIK_SUBURB_DISTRICTS = [
    (
        "Геленджик",
        [
            "Центр",
            "Толстый мыс",
            "Тонкий мыс",
            "Северный",
            "Южный",
            "Парус",
            "Магилат",
            "Нахаловка",
            "Западный",
            "Черёмушки",
            "Сосновая роща",
            "Пятый микрорайон",
        ],
    ),
    ("Кабардинка", []),
    ("Дивноморское", []),
    ("Архипо-Осиповка", []),
    ("Криница", []),
    ("Бетта", []),
    ("Джанхот", []),
    ("Прасковеевка", []),
    ("Береговое", []),
    ("Пшада", []),
    ("Текос", []),
    ("Тешебс", []),
    ("Возрождение", []),
    ("Адербиевка", []),
    ("Марьина Роща", []),
    ("Михайловский перевал", []),
    ("Голубая бухта", []),
    ("СНТ Сосновое", []),
]


# ---------------------------------------------------------------------------
# Management command
# ---------------------------------------------------------------------------


class Command(BaseCommand):
    help = "Seed Krasnodar and Gelendzhik location data (idempotent, get_or_create)"

    def handle(self, *args, **options):
        from locations.models import City, District, Neighborhood

        self.created: dict[str, int] = {"city": 0, "district": 0, "neighborhood": 0}
        self.existing: dict[str, int] = {"city": 0, "district": 0, "neighborhood": 0}
        self.updated: dict[str, int] = {"district": 0, "neighborhood": 0}

        krasnodar = self._upsert_city(City, "Краснодар", "krasnodar", "Краснодарский край")
        gelendzhik = self._upsert_city(City, "Геленджик", "gelendzhik", "Краснодарский край")

        self._seed_city_districts(
            District, Neighborhood, krasnodar, "krd", KRASNODAR_CITY_DISTRICTS, start_order=1
        )
        self._seed_suburb_districts(
            District, Neighborhood, krasnodar, "krd", KRASNODAR_SUBURB_DISTRICTS, start_order=100
        )

        self._seed_city_districts(
            District, Neighborhood, gelendzhik, "gel", GELENDZHIK_CITY_DISTRICTS, start_order=1
        )
        self._seed_suburb_districts(
            District, Neighborhood, gelendzhik, "gel", GELENDZHIK_SUBURB_DISTRICTS, start_order=100
        )

        self.stdout.write("")
        for kind in ("city", "district", "neighborhood"):
            c = self.created[kind]
            e = self.existing[kind]
            u = self.updated.get(kind, 0)
            self.stdout.write(
                self.style.SUCCESS(
                    f"{kind:15s}: created {c:3d}  existing {e:3d}  updated {u:3d}"
                )
            )

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _tally(self, kind: str, created: bool) -> None:
        if created:
            self.created[kind] += 1
        else:
            self.existing[kind] += 1

    def _upsert_city(self, City, name, slug, region):
        obj, created = City.objects.get_or_create(
            slug=slug,
            defaults={"name": name, "region_name": region, "is_active": True},
        )
        self._tally("city", created)
        return obj

    def _upsert_district(self, District, city, prefix, name, order, dtype):
        d_slug = self._fit_unique_slug(District, city, prefix, name, name)
        obj, created = District.objects.get_or_create(
            city=city,
            slug=d_slug,
            defaults={"name": name, "sort_order": order, "district_type": dtype},
        )
        self._tally("district", created)
        if not created and obj.district_type != dtype:
            obj.district_type = dtype
            obj.save(update_fields=["district_type"])
            self.updated["district"] += 1
        return obj

    def _seed_city_districts(self, District, Neighborhood, city, prefix, data, start_order):
        for d_order, (d_name, neighborhoods) in enumerate(data, start=start_order):
            district = self._upsert_district(
                District, city, prefix, d_name, d_order, District.DistrictType.CITY_DISTRICT
            )
            d_body = _base_slug(d_name)[:10]  # short district discriminator in slug
            for n_order, n_name in enumerate(neighborhoods, start=1):
                n_prefix = f"{prefix}-{d_body}"
                n_slug = self._fit_unique_slug(Neighborhood, city, n_prefix, n_name, n_name)
                _, n_created = Neighborhood.objects.get_or_create(
                    city=city,
                    slug=n_slug,
                    defaults={"district": district, "name": n_name, "sort_order": n_order},
                )
                self._tally("neighborhood", n_created)

    def _seed_suburb_districts(self, District, Neighborhood, city, prefix, data, start_order):
        for d_order, (d_name, settlements) in enumerate(data, start=start_order):
            district = self._upsert_district(
                District, city, prefix, d_name, d_order, District.DistrictType.SUBURB
            )
            d_body = _base_slug(d_name)[:10]
            for n_order, n_name in enumerate(settlements, start=1):
                n_prefix = f"{prefix}-{d_body}"
                n_slug = self._fit_unique_slug(Neighborhood, city, n_prefix, n_name, n_name)
                _, n_created = Neighborhood.objects.get_or_create(
                    city=city,
                    slug=n_slug,
                    defaults={"district": district, "name": n_name, "sort_order": n_order},
                )
                self._tally("neighborhood", n_created)

    @staticmethod
    def _fit_unique_slug(model, city, prefix, name, match_name):
        head = f"{prefix}-"
        body_budget = SLUG_MAX_LENGTH - len(head)
        base = f"{head}{_base_slug(name)[:body_budget]}".rstrip("-")
        candidate = base
        n = 1
        while True:
            row = model.objects.filter(city=city, slug=candidate).first()
            if row is None:
                return candidate
            if row.name == match_name:
                return candidate  # idempotent re-run
            n += 1
            suffix = f"-{n}"
            candidate = f"{base[:SLUG_MAX_LENGTH - len(suffix)]}{suffix}"
