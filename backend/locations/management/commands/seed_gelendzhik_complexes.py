"""
Seed residential complexes (жилые комплексы) for Геленджик.

All complexes are linked to:
    city     = Геленджик (slug "gelendzhik")
    district = "Геленджик" (the centre district within that city)

Idempotent: each complex is matched by (city, district, name) via
get_or_create; the unique slug is generated only on first creation, mirroring
ResidentialComplexCreateSerializer.

Run:
    python manage.py seed_gelendzhik_complexes
"""
from django.core.management.base import BaseCommand, CommandError
from django.utils.text import slugify

SLUG_MAX_LENGTH = 50

GELENDZHIK_COMPLEXES = [
    "Горизонт",
    "Ривьера",
    "Альбатрос",
    "Гоголь",
    "Акватория",
    "Подкова",
    "Кубанская марка",
    "Столичный квартал",
    "Атмосфера",
    "Изумрудный город",
    "Прованс",
    "Южная звезда",
    "Кировский",
    "Европейский",
    "Лазурный",
    "Феллини",
    "Черноморский",
    "Панорама",
    "Лазурит",
    "Алые Паруса",
    "Дом у моря",
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
    help = "Seed residential complexes for Геленджик (centre district), idempotent."

    def handle(self, *args, **options):
        from locations.models import City, District, ResidentialComplex

        try:
            city = City.objects.get(slug="gelendzhik")
        except City.DoesNotExist:
            raise CommandError(
                "City 'Геленджик' (slug='gelendzhik') not found. "
                "Run seed_locations_full first."
            )

        district = District.objects.filter(city=city, name="Геленджик").first()
        if district is None:
            raise CommandError(
                "District 'Геленджик' (centre) not found under city Геленджик. "
                "Run seed_locations_full first."
            )

        created_names: list[str] = []
        existing_names: list[str] = []

        for name in GELENDZHIK_COMPLEXES:
            obj, created = ResidentialComplex.objects.get_or_create(
                city=city,
                district=district,
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
            self.style.SUCCESS(
                f"City     : {city.name} (id={city.id})\n"
                f"District : {district.name} (id={district.id})"
            )
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
                f"Total complexes for {district.name}: "
                f"{ResidentialComplex.objects.filter(city=city, district=district).count()}"
            )
        )
