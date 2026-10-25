"""
CRM property photos: the SIZE policy's server-side safety net (2026-10-26).

The browser compresses big photos before upload (frontend/src/lib/photoCompression.ts).
These tests pin what the server does with a client that did not: API use, or an
old cached bundle. Deliberately SEPARATE from the photo COUNT limit
(`tests_photos.py`): count and size are independent constants.
"""
import random
import shutil
import tempfile
from decimal import Decimal
from io import BytesIO
from unittest import mock

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from PIL import Image, ImageDraw
from rest_framework.test import APIClient

from common.image_compression import (
    MAX_PROPERTY_PHOTO_UPLOAD_BYTES,
    PROPERTY_ORIGINAL_MAX_EDGE,
    PROPERTY_ORIGINAL_MIN_EDGE,
    PROPERTY_ORIGINAL_SKIP_BYTES,
)
from locations.models import City, District
from properties.choices import PropertyType
from properties.models import Property, PropertyPhoto
from properties.property_photo_images import MAX_PHOTOS_PER_PROPERTY

User = get_user_model()

_MEDIA = tempfile.mkdtemp(prefix="centreal-size-tests-")


def tearDownModule():  # noqa: N802 - unittest hook name
    shutil.rmtree(_MEDIA, ignore_errors=True)


def _photo_like(w, h, *, exif_orientation=None, quality=92, marker=True, seed=1) -> bytes:
    """A smooth, photo-like JPEG (a small random field blown up), optionally with
    a red block in the STORED top-left corner and an EXIF orientation tag."""
    rnd = random.Random(seed)
    small = Image.new("RGB", (300, 200))
    small.putdata(
        [(rnd.randrange(256), rnd.randrange(256), rnd.randrange(256)) for _ in range(300 * 200)]
    )
    img = small.resize((w, h), Image.Resampling.BICUBIC)
    if marker:
        ImageDraw.Draw(img).rectangle((0, 0, w // 8, h // 8), fill=(255, 0, 0))
    buf = BytesIO()
    kwargs = {}
    if exif_orientation:
        exif = Image.Exif()
        exif[0x0112] = exif_orientation
        kwargs["exif"] = exif
    img.save(buf, format="JPEG", quality=quality, **kwargs)
    return buf.getvalue()


def _is_red(px) -> bool:
    return px[0] > 200 and px[1] < 70 and px[2] < 70


@override_settings(MEDIA_ROOT=_MEDIA)
class PropertyPhotoSizePolicyTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        city = City.objects.create(name="Краснодар", slug="krd-sz", region_name="КК")
        district = District.objects.create(city=city, name="Центр", slug="c-sz")
        self.user = User.objects.create_user(
            email="own-sz@test.local", password="pw", first_name="F", last_name="L",
            role=User.Role.REALTOR, perm_edit_property=True, perm_create_property=True,
        )
        self.prop = Property.objects.create(
            property_type=PropertyType.APARTMENT, price=Decimal("1.00"),
            assigned_realtor=self.user, city=city, district=district,
        )
        self.client.force_authenticate(user=self.user)

    def _post(self, data, name="p.jpg", content_type="image/jpeg"):
        return self.client.post(
            f"/api/crm/properties/{self.prop.pk}/photos/",
            {"original_file": SimpleUploadedFile(name, data, content_type)},
            format="multipart",
        )

    def _stored(self):
        photo = PropertyPhoto.objects.get(property=self.prop)
        with photo.original_file.open("rb") as fh:
            return fh.read()

    def test_constants_and_independence_from_the_count_limit(self):
        self.assertEqual(MAX_PROPERTY_PHOTO_UPLOAD_BYTES, 40 * 1024 * 1024)
        self.assertEqual(MAX_PHOTOS_PER_PROPERTY, 10)
        self.assertEqual((PROPERTY_ORIGINAL_MAX_EDGE, PROPERTY_ORIGINAL_MIN_EDGE), (2560, 1920))
        self.assertEqual(PROPERTY_ORIGINAL_SKIP_BYTES, 1536 * 1024)

    def test_large_photo_is_resized_to_2560_under_the_byte_target(self):
        data = _photo_like(6000, 4000)
        r = self._post(data)
        self.assertEqual(r.status_code, 201, r.data)
        stored = self._stored()
        self.assertLessEqual(len(stored), PROPERTY_ORIGINAL_SKIP_BYTES)
        with Image.open(BytesIO(stored)) as out:
            self.assertEqual(out.format, "JPEG")
            self.assertEqual(out.size, (2560, 1707))

    def test_exif_orientation_is_baked_in_and_metadata_dropped(self):
        # Stored landscape 6000x4000 + EXIF orientation 6 (rotate 90 CW to display):
        # shown as portrait, and the red block (stored top-left) shows TOP-RIGHT.
        r = self._post(_photo_like(6000, 4000, exif_orientation=6))
        self.assertEqual(r.status_code, 201, r.data)
        with Image.open(BytesIO(self._stored())) as out:
            self.assertEqual(out.size, (1707, 2560))
            self.assertEqual(len(out.getexif()), 0)  # no orientation tag, no GPS/camera
            rgb = out.convert("RGB")
            self.assertTrue(_is_red(rgb.getpixel((out.width - 15, 15))))
            self.assertFalse(_is_red(rgb.getpixel((15, 15))))

    def test_small_upload_is_stored_byte_identical(self):
        data = _photo_like(1200, 800, quality=85)
        self.assertLessEqual(len(data), PROPERTY_ORIGINAL_SKIP_BYTES)
        r = self._post(data)
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(self._stored(), data)

    def test_small_upload_keeps_its_bytes_even_with_an_exif_tag(self):
        data = _photo_like(1200, 800, exif_orientation=6)
        self.assertEqual(self._post(data).status_code, 201)
        self.assertEqual(self._stored(), data)

    def test_heavy_file_within_the_edge_is_reencoded_smaller_but_not_upscaled(self):
        noise = Image.effect_noise((2400, 1600), 60).convert("RGB")
        buf = BytesIO()
        noise.save(buf, format="JPEG", quality=95)
        data = buf.getvalue()
        self.assertGreater(len(data), PROPERTY_ORIGINAL_SKIP_BYTES)
        self.assertEqual(self._post(data).status_code, 201)
        stored = self._stored()
        self.assertLess(len(stored), len(data))
        with Image.open(BytesIO(stored)) as out:
            self.assertGreaterEqual(max(out.size), PROPERTY_ORIGINAL_MIN_EDGE)  # never below 1920
            self.assertLessEqual(max(out.size), 2400)  # never upscaled

    def test_png_larger_than_2560_becomes_a_bounded_jpeg(self):
        buf = BytesIO()
        Image.new("RGB", (3000, 2000), (20, 90, 160)).save(buf, format="PNG")
        r = self._post(buf.getvalue(), "big.png", "image/png")
        self.assertEqual(r.status_code, 201, r.data)
        with Image.open(BytesIO(self._stored())) as out:
            self.assertEqual(out.format, "JPEG")
            self.assertEqual(max(out.size), 2560)

    def test_original_over_40_mib_is_rejected_in_russian(self):
        data = _photo_like(1200, 800) + b"\0" * (MAX_PROPERTY_PHOTO_UPLOAD_BYTES + 1024)
        r = self._post(data)
        self.assertEqual(r.status_code, 400)
        self.assertIn("40 МБ", str(r.data))
        self.assertEqual(PropertyPhoto.objects.filter(property=self.prop).count(), 0)

    def test_a_photo_over_the_old_12_mib_cap_is_accepted(self):
        data = _photo_like(1200, 800) + b"\0" * (13 * 1024 * 1024)
        r = self._post(data)
        self.assertEqual(r.status_code, 201, r.data)

    def test_non_image_is_rejected(self):
        r = self._post(b"just some text, not an image")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(PropertyPhoto.objects.filter(property=self.prop).count(), 0)

    def test_absurd_pixel_count_is_rejected_before_decoding(self):
        with mock.patch("common.image_compression.MAX_PHOTO_PIXELS", 1_000_000):
            r = self._post(_photo_like(1500, 1000))
        self.assertEqual(r.status_code, 400)
        self.assertIn("мегапикселей", str(r.data))
        self.assertEqual(PropertyPhoto.objects.filter(property=self.prop).count(), 0)

    def test_derivatives_still_come_out_at_1920_1024_400(self):
        from properties.property_photo_images import build_property_photo_derivatives

        self.assertEqual(self._post(_photo_like(6000, 4000)).status_code, 201)
        photo = PropertyPhoto.objects.get(property=self.prop)
        large, medium, thumb = build_property_photo_derivatives(photo.original_file)
        sizes = [max(Image.open(BytesIO(b)).size) for b in (large, medium, thumb)]
        self.assertEqual(sizes, [1920, 1024, 400])
