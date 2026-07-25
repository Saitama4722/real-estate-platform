"""
Generate cohesive, on-brand PLACEHOLDER cover images for the published articles
and attach them to each article's `cover_image`.

These are NOT AI-generated photography (no image-generation capability is
available in this environment) — they are clean, programmatically-drawn diagonal
gradient graphics with a subtle geometric motif, one themed colour per topic, so
the blog looks intentional instead of showing an empty gray «Статья» box. The
client replaces these with real photos later by re-uploading via the CRM.

Rendered with Pillow (already a project dependency) as PNGs at the article slot's
16:10 ratio, saved through the ImageField into media/articles/covers/.

    python manage.py generate_article_covers          # generate + attach
    python manage.py generate_article_covers --clear   # remove covers (keep articles)
"""
import io
import math

from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand
from PIL import Image, ImageDraw

from articles.models import Article

# Render at 2x the display slot for crispness (listing card is aspect-16/10).
WIDTH, HEIGHT = 1200, 750

# slug -> (top-left RGB, bottom-right RGB, accent RGB) — a cohesive set: all soft
# diagonal gradients, each with a topic-appropriate mood. Colours are muted and
# sit alongside the site's blue-600 primary without clashing.
THEMES = {
    # 1. Первая покупка квартиры — welcoming warm indigo/blue.
    "kak-kupit-kvartiru-v-krasnodare-pervaya-pokupka": (
        (79, 106, 189), (37, 61, 138), (255, 255, 255),
    ),
    # 2. Районы Краснодара — city/map teal.
    "rayony-krasnodara-dlya-pokupatelya": (
        (36, 138, 141), (24, 82, 102), (235, 250, 250),
    ),
    # 3. Геленджик у моря — sea blue → aqua.
    "gelendzhik-vtoroe-zhile-u-morya": (
        (56, 150, 190), (28, 92, 148), (224, 246, 255),
    ),
    # 4. Инвестиции — growth green/emerald.
    "investicii-v-nedvizhimost-krasnodarskogo-kraya": (
        (46, 143, 96), (26, 92, 76), (232, 250, 240),
    ),
    # 5. Земельный участок — earthy olive → sand.
    "pokupka-zemelnogo-uchastka-na-chto-obratit-vnimanie": (
        (120, 138, 74), (78, 96, 52), (245, 244, 224),
    ),
    # 6. Новостройка / вторичка — slate blue → warm gray (pairing/contrast).
    "novostroyka-ili-vtorichka-kak-vybrat": (
        (98, 110, 138), (58, 66, 90), (240, 240, 244),
    ),
    # 7. Юридическая чистота — trustworthy navy → light.
    "kak-proverit-yuridicheskuyu-chistotu-kvartiry": (
        (60, 78, 120), (34, 46, 78), (238, 242, 250),
    ),
}


def _lerp(a: int, b: int, t: float) -> int:
    return int(round(a + (b - a) * t))


def _make_cover(top_left, bottom_right, accent) -> bytes:
    """Diagonal gradient + a subtle set of translucent geometric shapes."""
    img = Image.new("RGB", (WIDTH, HEIGHT))
    px = img.load()

    # Diagonal gradient: t runs 0..1 along the top-left → bottom-right diagonal.
    max_d = WIDTH + HEIGHT
    for y in range(HEIGHT):
        for x in range(0, WIDTH, 2):  # step 2 for speed; fill the pair below
            t = (x + y) / max_d
            r = _lerp(top_left[0], bottom_right[0], t)
            g = _lerp(top_left[1], bottom_right[1], t)
            b = _lerp(top_left[2], bottom_right[2], t)
            px[x, y] = (r, g, b)
            if x + 1 < WIDTH:
                px[x + 1, y] = (r, g, b)

    # Subtle motif: a few large, low-opacity circles for depth — consistent across
    # the set so the blog reads as one visual system. No text, logos, or people.
    overlay = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    ax, ay, az = accent
    circles = [
        (WIDTH * 0.82, HEIGHT * 0.28, 260, 26),
        (WIDTH * 0.68, HEIGHT * 0.72, 190, 20),
        (WIDTH * 0.20, HEIGHT * 0.30, 150, 16),
    ]
    for cx, cy, rad, alpha in circles:
        od.ellipse(
            [cx - rad, cy - rad, cx + rad, cy + rad],
            fill=(ax, ay, az, alpha),
        )
    img = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")

    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


class Command(BaseCommand):
    help = "Generate + attach themed placeholder cover images to articles."

    def add_arguments(self, parser):
        parser.add_argument(
            "--clear",
            action="store_true",
            help="Remove cover images from these articles (files + field).",
        )

    def handle(self, *args, **options):
        if options["clear"]:
            n = 0
            for slug in THEMES:
                a = Article.objects.filter(slug=slug).first()
                if a and a.cover_image:
                    a.cover_image.delete(save=True)  # deletes file + clears field
                    n += 1
            self.stdout.write(self.style.SUCCESS(f"Cleared covers on {n} article(s)."))
            return

        done = 0
        missing = []
        for slug, (tl, br, ac) in THEMES.items():
            article = Article.objects.filter(slug=slug).first()
            if article is None:
                missing.append(slug)
                continue
            png = _make_cover(tl, br, ac)
            # Save through the ImageField -> media/articles/covers/<slug>.png
            article.cover_image.save(f"{slug}.png", ContentFile(png), save=True)
            done += 1
            self.stdout.write(f"  covered: {slug}  ({len(png)} bytes)")

        self.stdout.write(
            self.style.SUCCESS(f"Generated + attached {done} cover(s).")
        )
        if missing:
            self.stdout.write(
                self.style.WARNING(f"Articles not found (skipped): {missing}")
            )
