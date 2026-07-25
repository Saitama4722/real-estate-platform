"""
Seed a few PLACEHOLDER blog articles so the /articles listing, detail page and
empty-state logic can be verified end-to-end before real content exists.

These are clearly-marked placeholders (titles «Пример статьи N», slugs
`primer-stati-N`). Idempotent — safe to re-run (get_or_create by slug).

    python manage.py seed_placeholder_articles          # create/update 3 published
    python manage.py seed_placeholder_articles --clear  # delete the placeholders
"""
from django.core.management.base import BaseCommand
from django.utils import timezone

from articles.choices import ArticleStatus
from articles.models import Article

# slug prefix used to identify placeholder rows (for idempotency + --clear).
PLACEHOLDER_SLUG_PREFIX = "primer-stati-"

_BODY = (
    "Это пример статьи, созданный для проверки работы раздела «Статьи».\n\n"
    "Здесь будет реальный текст материала о недвижимости: советы покупателю, "
    "обзоры районов Краснодара и Геленджика, разбор этапов сделки и другие "
    "полезные темы.\n\n"
    "Замените этот текст настоящим содержанием через раздел управления статьями "
    "в CRM."
)

PLACEHOLDERS = [
    {
        "slug": f"{PLACEHOLDER_SLUG_PREFIX}1",
        "title": "Пример статьи 1: как выбрать квартиру в Краснодаре",
        "excerpt": "Пример анонса статьи. На что обратить внимание при выборе квартиры.",
    },
    {
        "slug": f"{PLACEHOLDER_SLUG_PREFIX}2",
        "title": "Пример статьи 2: обзор районов Геленджика",
        "excerpt": "Пример анонса статьи. Краткий обзор районов и посёлков Геленджика.",
    },
    {
        "slug": f"{PLACEHOLDER_SLUG_PREFIX}3",
        "title": "Пример статьи 3: этапы сделки с недвижимостью",
        "excerpt": "Пример анонса статьи. Что нужно знать о ходе сделки купли-продажи.",
    },
]


class Command(BaseCommand):
    help = "Seed placeholder blog articles for verification (idempotent)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--clear",
            action="store_true",
            help="Delete the placeholder articles instead of creating them.",
        )

    def handle(self, *args, **options):
        if options["clear"]:
            deleted, _ = Article.objects.filter(
                slug__startswith=PLACEHOLDER_SLUG_PREFIX
            ).delete()
            self.stdout.write(
                self.style.SUCCESS(f"Deleted {deleted} placeholder article(s).")
            )
            return

        now = timezone.now()
        created_n = 0
        for i, data in enumerate(PLACEHOLDERS):
            obj, created = Article.objects.get_or_create(
                slug=data["slug"],
                defaults={
                    "title": data["title"],
                    "excerpt": data["excerpt"],
                    "body": _BODY,
                    "status": ArticleStatus.PUBLISHED,
                    # Stagger published_at so ordering (-published_at) is stable.
                    "published_at": now - timezone.timedelta(days=i),
                },
            )
            if created:
                created_n += 1
        self.stdout.write(
            self.style.SUCCESS(
                f"Placeholder articles: created {created_n}, "
                f"existing {len(PLACEHOLDERS) - created_n}."
            )
        )
