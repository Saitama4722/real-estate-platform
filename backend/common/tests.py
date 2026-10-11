"""Tests for the shared image pipeline (``common.image_compression``).

There were NO tests over this code before, which is exactly how the public
owner form ended up storing raw uploads while property photos were compressed:
nothing asserted that the two behaved the same.
"""
import json
from io import BytesIO
from pathlib import Path

from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase
from PIL import Image

from common.city_bounds import (
    RADIUS_BY_TYPE_KM,
    SERVICE_CIRCLES,
    WITHOUT_CIRCLE,
    city_for_point,
    distance_km,
)
from common.image_compression import (
    DERIVATIVE_SIZES,
    build_derivatives,
    compress_to_max_edge,
    validate_image_upload,
)


def _jpeg(w: int, h: int, *, orientation: int | None = None) -> bytes:
    img = Image.new("RGB", (w, h), (200, 60, 40))
    for x in range(0, w, 37):
        for y in range(0, h, 41):
            img.putpixel((x, y), ((x * 7) % 255, (y * 5) % 255, 90))
    buf = BytesIO()
    if orientation is None:
        img.save(buf, format="JPEG", quality=95)
    else:
        exif = Image.Exif()
        exif[274] = orientation  # 274 = Orientation
        img.save(buf, format="JPEG", quality=95, exif=exif)
    return buf.getvalue()


def _png_rgba(w: int, h: int) -> bytes:
    img = Image.new("RGBA", (w, h), (10, 120, 200, 128))
    buf = BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _upload(name: str, data: bytes, ct: str = "image/jpeg") -> SimpleUploadedFile:
    return SimpleUploadedFile(name, data, ct)


class ValidateImageUploadTests(SimpleTestCase):
    """The public owner form's guard. Every rejection must be a ValidationError."""

    def test_accepts_jpeg_and_png(self):
        validate_image_upload(_upload("a.jpg", _jpeg(200, 100)))
        validate_image_upload(_upload("a.png", _png_rgba(200, 100), "image/png"))

    def test_rejects_non_image_with_image_extension(self):
        with self.assertRaises(ValidationError):
            validate_image_upload(_upload("evil.jpg", b"MZ\x90\x00 not an image"))

    def test_rejects_truncated_image(self):
        """⚠ verify() alone passes a truncated JPEG — only a full load() catches
        it. This test exists because the first implementation accepted one."""
        data = _jpeg(1200, 900)
        with self.assertRaises(ValidationError):
            validate_image_upload(_upload("cut.jpg", data[: len(data) // 3]))

    def test_rejects_empty_file(self):
        with self.assertRaises(ValidationError):
            validate_image_upload(_upload("empty.jpg", b""))

    def test_rejects_oversized_file(self):
        big = _jpeg(200, 200) * 200_000  # comfortably over 12 MiB
        with self.assertRaises(ValidationError):
            validate_image_upload(_upload("huge.jpg", big))

    def test_rejects_decodable_but_non_whitelisted_format(self):
        buf = BytesIO()
        Image.new("RGB", (40, 30), (1, 2, 3)).save(buf, format="BMP")
        with self.assertRaises(ValidationError):
            validate_image_upload(_upload("x.bmp", buf.getvalue(), "image/bmp"))


class BuildDerivativesTests(SimpleTestCase):
    def test_produces_every_size_without_upscaling(self):
        parts = build_derivatives(_upload("a.jpg", _jpeg(3000, 2000)))
        self.assertEqual(set(parts), set(DERIVATIVE_SIZES))
        expected = {"large": 1920, "medium": 1024, "thumb": 400}
        for suffix, max_edge in expected.items():
            with Image.open(BytesIO(parts[suffix])) as im:
                self.assertLessEqual(max(im.size), max_edge)
                self.assertEqual(im.format, "JPEG")

    def test_small_source_is_not_upscaled(self):
        parts = build_derivatives(_upload("s.jpg", _jpeg(300, 200)))
        with Image.open(BytesIO(parts["large"])) as im:
            self.assertEqual(im.size, (300, 200))

    def test_honors_exif_orientation_then_strips_metadata(self):
        # Orientation=6 means "rotate 90° CW to display": a stored 1200x1600
        # portrait must come out 1600x1200 landscape.
        parts = build_derivatives(_upload("p.jpg", _jpeg(1200, 1600, orientation=6)))
        with Image.open(BytesIO(parts["large"])) as im:
            self.assertGreater(im.size[0], im.size[1], "EXIF orientation not applied")
            self.assertEqual(len(im.getexif()), 0, "EXIF not stripped from derivative")

    def test_rgba_is_flattened_not_crashed(self):
        parts = build_derivatives(_upload("a.png", _png_rgba(800, 600), "image/png"))
        with Image.open(BytesIO(parts["medium"])) as im:
            self.assertEqual(im.mode, "RGB")

    def test_corrupt_source_raises_validation_error_not_oserror(self):
        with self.assertRaises(ValidationError):
            build_derivatives(_upload("bad.jpg", b"still not an image"))


class CompressToMaxEdgeTests(SimpleTestCase):
    def test_downscales_large_image(self):
        out = compress_to_max_edge(_upload("b.jpg", _jpeg(3000, 2000)))
        self.assertIsNotNone(out)
        with Image.open(BytesIO(out.read())) as im:
            self.assertEqual(max(im.size), 1920)

    def test_skips_small_jpeg(self):
        self.assertIsNone(compress_to_max_edge(_upload("s.jpg", _jpeg(800, 600))))

    def test_never_inflates_an_already_small_png(self):
        """A small PNG that would encode LARGER as JPEG is left untouched —
        otherwise 'compression' grows the file and destroys transparency."""
        data = _png_rgba(1500, 1000)
        self.assertIsNone(compress_to_max_edge(_upload("logo.png", data, "image/png")))


class ServiceAreaSyncTests(SimpleTestCase):
    """The Python circles MUST equal the canonical JSON the frontend imports.

    They are duplicated on purpose (the deployed backend image does not contain
    the frontend directory), so this test is the only thing standing between a
    one-sided edit and a silent frontend/backend disagreement about where the
    platform operates.
    """

    JSON_PATH = (
        Path(__file__).resolve().parent.parent.parent
        / "frontend" / "src" / "shared" / "serviceArea.json"
    )
    #: The checked-in seed for the Город/Район dropdown. Used instead of the
    #: database because a SimpleTestCase has none, and a freshly-created test
    #: database would be EMPTY — making the checks below pass vacuously, which is
    #: no check at all.
    FIXTURE_PATH = (
        Path(__file__).resolve().parent.parent
        / "fixtures" / "transfer" / "01_locations.json"
    )

    def _json(self):
        return json.loads(self.JSON_PATH.read_text(encoding="utf-8"))

    def _dropdown_names(self):
        data = json.loads(self.FIXTURE_PATH.read_text(encoding="utf-8"))
        return {
            row["fields"]["name"]
            for row in data
            if row["model"] in ("locations.district", "locations.neighborhood")
        }

    def _classification_ground_truth(self):
        """(microdistrict names, standalone-settlement names, container names).

        A `locations.Neighborhood` row is ALWAYS a microdistrict of its city —
        it has no address data of its own. A `locations.District` row is a
        standalone settlement with its own address data UNLESS its
        `district_type` is `city_district`, the one grouping row («Микрорайоны
        Краснодара») that is not a place at all.
        """
        data = json.loads(self.FIXTURE_PATH.read_text(encoding="utf-8"))
        microdistricts = {
            r["fields"]["name"] for r in data if r["model"] == "locations.neighborhood"
        }
        standalone = {
            r["fields"]["name"] for r in data
            if r["model"] == "locations.district"
            and r["fields"]["district_type"] != "city_district"
        }
        containers = {
            r["fields"]["name"] for r in data
            if r["model"] == "locations.district"
            and r["fields"]["district_type"] == "city_district"
        }
        return microdistricts, standalone, containers

    def test_the_fixture_actually_has_entries(self):
        """Guard the guard: an empty fixture would make the checks vacuous."""
        if not self.FIXTURE_PATH.exists():
            self.skipTest("locations fixture not present")
        self.assertGreater(len(self._dropdown_names()), 100)

    def test_python_circles_match_the_canonical_json(self):
        """Centres AND radii, both directions — the whole radius model."""
        if not self.JSON_PATH.exists():
            self.skipTest(
                "frontend/src/shared/serviceArea.json not present "
                "(backend-only checkout) — nothing to compare against"
            )
        data = self._json()
        canonical = {}
        for name, v in data["cities"].items():
            # ⚠ «Геленджик» is both a city and a dropdown row; the city key is
            # prefixed so the row's smaller circle cannot overwrite it.
            canonical["город " + name] = {
                "lat": v["lat"], "lon": v["lon"],
                "radius_km": v["radiusKm"], "city": name,
            }
        for name, v in data["settlements"].items():
            canonical[name] = {
                "lat": v["lat"], "lon": v["lon"],
                "radius_km": v["radiusKm"], "city": v["city"],
            }
        self.assertEqual(
            canonical, SERVICE_CIRCLES,
            "backend/common/city_bounds.py has drifted from "
            "frontend/src/shared/serviceArea.json — regenerate it",
        )

    def test_radius_table_matches(self):
        if not self.JSON_PATH.exists():
            self.skipTest("serviceArea.json not present")
        self.assertEqual(self._json()["radiusByTypeKm"], RADIUS_BY_TYPE_KM)

    def test_without_circle_list_matches(self):
        if not self.JSON_PATH.exists():
            self.skipTest("serviceArea.json not present")
        canonical = {k: v["reason"]
                     for k, v in self._json()["settlementsWithoutCircle"].items()}
        self.assertEqual(canonical, WITHOUT_CIRCLE)

    def test_every_dropdown_row_has_a_circle_or_a_stated_reason(self):
        """⭐ THE DROPDOWN DEFINES THE SCOPE — nothing in it may be unknown.

        A row must either carry a circle or appear on the explicit "no circle,
        and here is why" list. Adding a settlement without doing one of those
        FAILS HERE rather than silently falling back to the city centre and
        quietly searching the wrong area — which is how Бетта shipped broken.
        """
        if not (self.JSON_PATH.exists() and self.FIXTURE_PATH.exists()):
            self.skipTest("canonical JSON or locations fixture not present")
        data = self._json()
        known = set(data["settlements"]) | set(data["settlementsWithoutCircle"])
        missing = sorted(self._dropdown_names() - known)
        self.assertEqual(
            missing, [],
            "these dropdown rows are in neither settlements nor "
            "settlementsWithoutCircle — regenerate serviceArea.json "
            "(see CLAUDE.md): %s" % missing,
        )

    def test_a_row_with_coordinates_cannot_lack_a_circle(self):
        """Coordinates without a radius is the failure mode this guards.

        Everything on the without-circle list must be there for one of three
        STATED reasons, never because someone added coordinates and forgot the
        radius. A radius is not optional data.
        """
        if not self.JSON_PATH.exists():
            self.skipTest("serviceArea.json not present")
        data = self._json()
        for name, v in data["settlementsWithoutCircle"].items():
            self.assertIn(
                v["reason"], ("microdistrict", "unmapped", "container"),
                "%s has no circle for an unrecognised reason %r" % (name, v["reason"]),
            )
            self.assertNotIn("lat", v, "%s carries coordinates but no circle" % name)
        for name, v in data["settlements"].items():
            self.assertGreater(
                v["radiusKm"], 0,
                "%s has coordinates but a non-positive radius" % name,
            )

    def test_standalone_flag_matches_the_dropdown_model(self):
        """⭐ THE Район SELECTOR MIXES TWO KINDS OF ROW, AND ONLY THE DJANGO
        MODEL TELLS THEM APART RELIABLY.

        A `Neighborhood` row (Витаминкомбинат, Дубинка, Южный in Геленджик…)
        is ALWAYS a microdistrict — its streets belong to the city, and
        scoping search to it finds nothing («Краснодар + Витаминкомбинат +
        Хлебосольная» returned zero results before this was fixed, for a
        street Krasnodar plainly has). A `District`/`suburb` row (Бетта,
        Кабардинка, ст. Динская…) ALWAYS owns its own address data.

        OSM's place-node type is NOT a safe proxy for this distinction: OSM
        resolves «Южный» (a microdistrict) to kind="town" and «Голубая бухта»
        (a standalone settlement) to kind="suburb" — backwards from what the
        English words suggest. This test is what stops a future edit to
        `serviceArea.json` from trusting OSM's kind instead of regenerating
        `standalone` from the fixture.
        """
        if not (self.JSON_PATH.exists() and self.FIXTURE_PATH.exists()):
            self.skipTest("canonical JSON or locations fixture not present")
        microdistricts, standalone_names, containers = self._classification_ground_truth()
        data = self._json()

        mismatches = []
        for name, v in data["settlements"].items():
            expect = name in standalone_names
            is_micro = name in microdistricts
            if expect == is_micro:
                mismatches.append((name, "not found in either fixture set"))
                continue
            if v.get("standalone") != expect:
                mismatches.append(
                    (name, "standalone=%r, fixture says %r" % (v.get("standalone"), expect))
                )
        self.assertEqual(
            mismatches, [],
            "standalone flag drifted from the Город/Район dropdown model — "
            "regenerate serviceArea.json's standalone field from the fixture, "
            "never from OSM's kind: %s" % mismatches,
        )

        # settlementsWithoutCircle has no `standalone` key — its `reason`
        # already encodes the same fact, so prove reason agrees too.
        wo_mismatches = []
        for name, v in data["settlementsWithoutCircle"].items():
            reason = v["reason"]
            if reason == "microdistrict" and name not in microdistricts:
                wo_mismatches.append((name, "reason=microdistrict but not a Neighborhood row"))
            if reason == "unmapped" and name not in standalone_names:
                wo_mismatches.append((name, "reason=unmapped but not a District/suburb row"))
            if reason == "container" and name not in containers:
                wo_mismatches.append((name, "reason=container but not the city_district row"))
        self.assertEqual(wo_mismatches, [], "withoutCircle reason drift: %s" % wo_mismatches)

    def test_every_circle_centre_validates(self):
        """A circle that does not contain its own centre is nonsense."""
        bad = [n for n, c in SERVICE_CIRCLES.items()
               if city_for_point(c["lat"], c["lon"]) is None]
        self.assertEqual(bad, [], "circle centres rejected by the union: %s" % bad)

    def test_excluded_towns_stay_outside_every_circle(self):
        """The towns we do not serve.

        ⚠ Динская is NOT here any more, deliberately: ст. Динская is a row of
        the dropdown, so the town is inside the service area by definition.
        Excluding it was the wrong instruction, and a rectangle was the wrong
        shape — see CLAUDE.md.
        """
        outside = {
            "Усть-Лабинск": (45.2119, 39.6839),
            "Абинск": (44.8687, 38.1590),
            "Крымск": (44.9340, 37.9860),
            "Новороссийск": (44.7239, 37.7683),
            "Сочи": (43.6028, 39.7342),
            "Москва": (55.7558, 37.6173),
            "Анапа": (44.8944, 37.3164),
            "Армавир": (44.9892, 41.1234),
            "Горячий Ключ": (44.6300, 39.1300),
            "Славянск-на-Кубани": (45.2586, 38.1264),
        }
        for label, (lat, lon) in outside.items():
            with self.subTest(town=label):
                self.assertIsNone(
                    city_for_point(lat, lon),
                    "%s must NOT be inside any service circle" % label,
                )

    def test_the_tightest_exclusion_keeps_real_clearance(self):
        """Новороссийск vs Кабардинка is the binding constraint on `town`.

        Asserting the NUMBER, not merely "outside", so widening a radius later
        cannot quietly eat the margin.
        """
        clearance = min(
            distance_km(44.7239, 37.7683, c["lat"], c["lon"]) - c["radius_km"]
            for c in SERVICE_CIRCLES.values()
        )
        self.assertGreater(
            clearance, 5.0, "Новороссийск clearance fell to %.1f km" % clearance)

    def test_served_settlements_are_inside(self):
        """Places that MUST resolve — including ones a rectangle could not hold."""
        inside = [
            ("Бетта", 44.372802, 38.395614),
            ("ст. Динская", 45.216871, 39.224976),
            ("Кабардинка", 44.651572, 37.939529),
            ("Архипо-Осиповка", 44.370318, 38.533611),
            ("Краснодар центр", 45.0355, 38.9753),
            ("Геленджик центр", 44.5622, 38.0848),
        ]
        for label, lat, lon in inside:
            with self.subTest(place=label):
                self.assertIsNotNone(
                    city_for_point(lat, lon), "%s should be served" % label)


# ===========================================================================
# Agency phone — the site-wide contact rendered in the header.
#
# Storage is a row of the existing key-value table (`common.HomepageTextBlock`,
# key `agency_phone`). These tests pin the three things that were decided
# rather than inherited: the canonical stored form, the superadmin-only gate,
# and that clearing is a legal edit rather than a validation failure.
# ===========================================================================

from django.test import TestCase  # noqa: E402
from rest_framework.test import APIClient  # noqa: E402

from common.homepage_constants import (  # noqa: E402
    AGENCY_PHONE_BLOCK_KEY,
    HOMEPAGE_TEXT_BLOCK_KEYS,
    SUPERADMIN_ONLY_TEXT_BLOCK_KEYS,
)
from common.models import HomepageTextBlock  # noqa: E402
from common.phone import normalize_ru_phone  # noqa: E402
from users.models import User  # noqa: E402

PATCH_URL = "/api/crm/homepage/text-blocks/%s/" % AGENCY_PHONE_BLOCK_KEY


class AgencyPhoneNormalisationTests(SimpleTestCase):
    """The forms a person actually types must all reach ONE stored value."""

    def test_accepted_forms_all_normalise_to_the_same_canonical_value(self):
        for raw in (
            "+79283330837",
            "8 928 333-08-37",
            "+7 (928) 333-08-37",
            "9283330837",
            "  +7 928 333 08 37  ",
            "8(928)3330837",
        ):
            with self.subTest(raw=raw):
                self.assertEqual(normalize_ru_phone(raw), "+79283330837")

    def test_blank_is_a_cleared_value_not_an_error(self):
        for raw in ("", "   ", None):
            with self.subTest(raw=raw):
                self.assertEqual(normalize_ru_phone(raw), "")

    def test_garbage_is_rejected(self):
        for raw in (
            "не телефон",
            "+7 928 333",           # too short
            "+7 928 333 08 37 99",  # too long
            "звоните 8 928 333-08-37",
            "<script>alert(1)</script>",
            "+1 202 555 0123",      # 10 digits but a US country code was typed
        ):
            with self.subTest(raw=raw):
                self.assertIsNone(normalize_ru_phone(raw))

    def test_a_landline_is_accepted(self):
        """Ten digits is the rule — an agency may publish a landline."""
        self.assertEqual(normalize_ru_phone("8 861 200-10-20"), "+78612001020")


class AgencyPhoneApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        # Disposable `.invalid` accounts, hard-deleted with the test database.
        self.superadmin = User.objects.create_user(
            email="sa-phone@test.invalid",
            password="pw",
            first_name="S",
            last_name="A",
            role=User.Role.SUPERADMIN,
        )
        self.admin = User.objects.create_user(
            email="adm-phone@test.invalid",
            password="pw",
            first_name="A",
            last_name="D",
            role=User.Role.ADMIN,
        )
        self.realtor = User.objects.create_user(
            email="rel-phone2@test.invalid",
            password="pw",
            first_name="R",
            last_name="E",
            role=User.Role.REALTOR,
        )
        HomepageTextBlock.objects.update_or_create(
            key=AGENCY_PHONE_BLOCK_KEY,
            defaults={"label": "Телефон агентства", "value": "+79283330837"},
        )

    def _patch(self, user, value):
        if user is not None:
            self.client.force_authenticate(user=user)
        else:
            self.client.force_authenticate(user=None)
        return self.client.patch(PATCH_URL, {"value": value}, format="json")

    def test_the_key_is_registered_and_superadmin_gated(self):
        self.assertIn(AGENCY_PHONE_BLOCK_KEY, HOMEPAGE_TEXT_BLOCK_KEYS)
        self.assertIn(AGENCY_PHONE_BLOCK_KEY, SUPERADMIN_ONLY_TEXT_BLOCK_KEYS)

    def test_public_endpoint_exposes_the_phone_anonymously(self):
        res = self.client.get("/api/homepage/text-blocks/")
        self.assertEqual(res.status_code, 200)
        rows = {b["key"]: b["value"] for b in res.data["blocks"]}
        self.assertEqual(rows[AGENCY_PHONE_BLOCK_KEY], "+79283330837")

    def test_superadmin_can_set_it_and_it_is_stored_canonically(self):
        res = self._patch(self.superadmin, "8 (928) 111-22-33")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["value"], "+79281112233")
        self.assertEqual(
            HomepageTextBlock.objects.get(pk=AGENCY_PHONE_BLOCK_KEY).value,
            "+79281112233",
        )

    def test_superadmin_can_clear_it(self):
        res = self._patch(self.superadmin, "")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["value"], "")
        self.assertEqual(
            HomepageTextBlock.objects.get(pk=AGENCY_PHONE_BLOCK_KEY).value, ""
        )

    def test_invalid_input_is_rejected_in_russian_and_nothing_is_saved(self):
        res = self._patch(self.superadmin, "позвоните нам")
        self.assertEqual(res.status_code, 400)
        message = str(res.data["value"][0])
        self.assertIn("корректный номер телефона", message)
        self.assertEqual(
            HomepageTextBlock.objects.get(pk=AGENCY_PHONE_BLOCK_KEY).value,
            "+79283330837",
            "a rejected value must not be written",
        )

    def test_admin_is_refused_even_though_admin_may_edit_homepage_copy(self):
        res = self._patch(self.admin, "+79281112233")
        self.assertEqual(res.status_code, 403)
        self.assertEqual(
            HomepageTextBlock.objects.get(pk=AGENCY_PHONE_BLOCK_KEY).value,
            "+79283330837",
        )

    def test_realtor_is_refused(self):
        res = self._patch(self.realtor, "+79281112233")
        self.assertEqual(res.status_code, 403)

    def test_anonymous_is_refused(self):
        res = self._patch(None, "+79281112233")
        self.assertIn(res.status_code, (401, 403))

    def test_admin_can_still_edit_a_homepage_copy_key(self):
        """The narrowing must apply ONLY to the phone key — no collateral."""
        HomepageTextBlock.objects.update_or_create(
            key="hero_title", defaults={"label": "hero", "value": "было"}
        )
        self.client.force_authenticate(user=self.admin)
        res = self.client.patch(
            "/api/crm/homepage/text-blocks/hero_title/",
            {"value": "стало"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["value"], "стало")
