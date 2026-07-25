"""
Seed residential complexes (жилые комплексы) for Краснодар.

NOTE ON DATA SOURCE
-------------------
This is a CURATED list of well-known Krasnodar residential complexes compiled
from general knowledge — it is NOT a live export from Cian or any other portal
(Cian blocks automated scraping behind a CAPTCHA), and it is NOT exhaustive.
Extend KRASNODAR_COMPLEXES below with more names as needed.

All complexes are linked to:
    city     = Краснодар (slug "krasnodar")
    district = None (not narrowed to a specific district)

Idempotent: each complex is matched by (city, name, district=None) via
get_or_create; the unique slug is generated only on first creation, mirroring
ResidentialComplexCreateSerializer.

Run:
    python manage.py seed_krasnodar_complexes
"""
from django.core.management.base import BaseCommand, CommandError
from django.utils.text import slugify

SLUG_MAX_LENGTH = 50

# Curated, real major Krasnodar ЖК (various developers). Not exhaustive.
KRASNODAR_COMPLEXES = [
    "Москва",
    "Самолёт",
    "Аврора",
    "Литературный",
    "Свобода",
    "Дыхание",
    "Любимово",
    "Спортивный парк",
    "Облака",
    "Грани",
    "Стрижи",
    "Сегмент",
    "Достоевский",
    "Тихий Дон",
    "Кислород",
    "Родные просторы",
    "Самолёт-Аврора",
    "Европа-Сити",
    "Цветы",
    "Парк Победы",
    "Александровский",
    "Восток",
    "Большой",
    "Айвазовский",
    "Времена года",
    "Притяжение",
    "Гулливер",
    "Новелла",
    "Квартал Европейский",
    "Прогресс",
]


def _unique_slug(model, base_slug):
    """Return base_slug, appending -2/-3/… until globally unique."""
    slug = base_slug[:SLUG_MAX_LENGTH]
    candidate = slug
    n = 2
    while model.objects.filter(slug=candidate).exists():
        candidate = f"{slug[: SLUG_MAX_LENGTH - 2]}-{n}"
        n += 1
    return candidate


class Command(BaseCommand):
    help = "Seed residential complexes for Краснодар (district=None), idempotent."

    def handle(self, *args, **options):
        from locations.models import City, ResidentialComplex

        try:
            city = City.objects.get(slug="krasnodar")
        except City.DoesNotExist:
            raise CommandError(
                "City 'Краснодар' (slug='krasnodar') not found. "
                "Run seed_locations_full first."
            )

        created_names: list[str] = []
        existing_names: list[str] = []

        for name in KRASNODAR_COMPLEXES:
            obj, created = ResidentialComplex.objects.get_or_create(
                city=city,
                district=None,
                name=name,
                defaults={
                    "slug": _unique_slug(
                        ResidentialComplex,
                        slugify(name, allow_unicode=True) or "rc",
                    ),
                },
            )
            if created:
                created_names.append(name)
            else:
                existing_names.append(name)

        self.stdout.write("")
        self.stdout.write(
            self.style.SUCCESS(f"City : {city.name} (id={city.id}), district=None")
        )
        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS(f"Created  ({len(created_names)}):"))
        for n in created_names:
            self.stdout.write(f"  + {n}")
        if existing_names:
            self.stdout.write("")
            self.stdout.write(f"Existing ({len(existing_names)}):")
            for n in existing_names:
                self.stdout.write(f"  · {n}")
        self.stdout.write("")
        self.stdout.write(
            self.style.SUCCESS(
                f"Total complexes for {city.name} (district=None): "
                f"{ResidentialComplex.objects.filter(city=city, district__isnull=True).count()}"
            )
        )
