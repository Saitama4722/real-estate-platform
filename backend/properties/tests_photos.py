"""
CRM property photos: upload to an EXISTING property, the photo limit, the
main-photo rules, permissions, and the sale-request conversion order
(2026-10-25).

Background: adding photos in the edit form used to do nothing (a frontend bug),
and the server had no photo limit at all. These tests pin the server side.

⚠ NOT covered here, on purpose: the race between concurrent uploads. The limit
and `sort_order` are made exact by a row lock (`select_for_update` on the
property), and SQLite ignores that lock, so the suite cannot exercise it. It is
reasoned from the code, not measured (docs/claude/media-and-images.md).
"""
import shutil
import tempfile
from decimal import Decimal
from io import BytesIO

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from PIL import Image
from rest_framework.test import APIClient

from locations.models import City, District
from properties.choices import PropertyType
from properties.models import Property, PropertyPhoto
from properties.property_photo_images import (
    MAX_PHOTOS_PER_PROPERTY,
    PHOTO_LIMIT_CODE,
    PHOTO_LIMIT_MESSAGE,
)
from submissions.models import SaleRequest, SaleRequestPhoto

User = get_user_model()

_MEDIA = tempfile.mkdtemp(prefix="centreal-photo-tests-")


def tearDownModule():  # noqa: N802 — unittest hook name
    shutil.rmtree(_MEDIA, ignore_errors=True)


def _jpeg(w=120, h=80, color=(30, 120, 200)) -> bytes:
    buf = BytesIO()
    Image.new("RGB", (w, h), color).save(buf, format="JPEG", quality=85)
    return buf.getvalue()


def _upload(name="a.jpg", data=None, content_type="image/jpeg"):
    return SimpleUploadedFile(name, data if data is not None else _jpeg(), content_type)


@override_settings(MEDIA_ROOT=_MEDIA)
class PropertyPhotoUploadTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.city = City.objects.create(name="Краснодар", slug="krd-ph", region_name="КК")
        self.district = District.objects.create(city=self.city, name="Центр", slug="c-ph")

        def user(email, role=User.Role.REALTOR, edit=True):
            return User.objects.create_user(
                email=email, password="pw", first_name="F", last_name="L", role=role,
                perm_edit_property=edit, perm_create_property=edit,
            )

        self.admin = user("adm-ph@test.local", User.Role.ADMIN)
        self.owner = user("own-ph@test.local")
        self.other = user("oth-ph@test.local")
        self.no_edit = user("noedit-ph@test.local", edit=False)
        self.prop = self._property(self.owner)

    def _property(self, realtor):
        return Property.objects.create(
            property_type=PropertyType.APARTMENT,
            price=Decimal("1.00"),
            assigned_realtor=realtor,
            city=self.city,
            district=self.district,
        )

    def _url(self, prop=None):
        return f"/api/crm/properties/{(prop or self.prop).pk}/photos/"

    def _post(self, who, *, data=None, extra=None, prop=None):
        self.client.force_authenticate(user=who)
        body = {"original_file": _upload(data=data)}
        body.update(extra or {})
        return self.client.post(self._url(prop), body, format="multipart")

    def _fill(self, n, *, main_index=0, prop=None):
        """n photos without touching storage/compression (bulk_create skips save())."""
        prop = prop or self.prop
        PropertyPhoto.objects.bulk_create(
            [
                PropertyPhoto(
                    property=prop,
                    original_file=f"properties/photos/test-{prop.pk}-{i}.jpg",
                    sort_order=i,
                    is_main=(i == main_index),
                )
                for i in range(n)
            ]
        )

    # --- adding to a property that already has photos ---------------------

    def test_first_upload_returns_id_urls_and_becomes_main(self):
        r = self._post(self.owner)
        self.assertEqual(r.status_code, 201, r.data)
        for key in ("id", "original_file", "image_thumb", "is_main", "sort_order"):
            self.assertIn(key, r.data)
        self.assertTrue(r.data["is_main"])  # no is_main sent: the server decides
        self.assertEqual(r.data["sort_order"], 0)

    def test_upload_to_property_that_already_has_photos(self):
        self._fill(3)
        r = self._post(self.owner)
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(PropertyPhoto.objects.filter(property=self.prop).count(), 4)
        self.assertEqual(r.data["sort_order"], 3)
        self.assertFalse(r.data["is_main"])

    def test_new_upload_does_not_steal_main(self):
        self._fill(2, main_index=1)
        self._post(self.owner)
        self._post(self.owner)
        mains = list(PropertyPhoto.objects.filter(property=self.prop, is_main=True))
        self.assertEqual(len(mains), 1)
        self.assertEqual(mains[0].sort_order, 1)

    def test_explicit_is_main_moves_the_flag(self):
        self._fill(2, main_index=0)
        r = self._post(self.owner, extra={"is_main": "true"})
        self.assertEqual(r.status_code, 201, r.data)
        self.assertTrue(r.data["is_main"])
        mains = PropertyPhoto.objects.filter(property=self.prop, is_main=True)
        self.assertEqual(list(mains.values_list("pk", flat=True)), [r.data["id"]])

    def test_sort_order_increases(self):
        orders = [self._post(self.owner).data["sort_order"] for _ in range(3)]
        self.assertEqual(orders, [0, 1, 2])

    def test_gaps_in_sort_order_still_append_at_the_end(self):
        self._fill(2)
        PropertyPhoto.objects.filter(property=self.prop, sort_order=1).update(sort_order=9)
        self.assertEqual(self._post(self.owner).data["sort_order"], 10)

    # --- the photo limit (10) ---------------------------------------------

    def test_limit_constant_is_ten(self):
        self.assertEqual(MAX_PHOTOS_PER_PROPERTY, 10)
        self.assertEqual(
            PHOTO_LIMIT_MESSAGE, "Можно загрузить не более 10 фотографий для одного объекта"
        )

    def test_exactly_the_limit_is_allowed_and_the_next_is_rejected(self):
        limit = MAX_PHOTOS_PER_PROPERTY
        self._fill(limit - 1)
        ok = self._post(self.owner)
        self.assertEqual(ok.status_code, 201, ok.data)
        self.assertEqual(PropertyPhoto.objects.filter(property=self.prop).count(), limit)
        bad = self._post(self.owner)
        self.assertEqual(bad.status_code, 400, bad.data)
        self.assertEqual(bad.data["detail"], PHOTO_LIMIT_MESSAGE)
        self.assertEqual(bad.data["code"], PHOTO_LIMIT_CODE)
        self.assertEqual(PropertyPhoto.objects.filter(property=self.prop).count(), limit)

    def test_full_property_rejects_and_keeps_the_count(self):
        self._fill(MAX_PHOTOS_PER_PROPERTY)
        r = self._post(self.owner)
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.data["detail"], "Можно загрузить не более 10 фотографий для одного объекта")
        self.assertEqual(
            PropertyPhoto.objects.filter(property=self.prop).count(), MAX_PHOTOS_PER_PROPERTY
        )

    def test_limit_is_per_property(self):
        self._fill(MAX_PHOTOS_PER_PROPERTY)
        other_prop = self._property(self.owner)
        self.assertEqual(self._post(self.owner, prop=other_prop).status_code, 201)

    def test_admin_is_limited_too(self):
        self._fill(MAX_PHOTOS_PER_PROPERTY)
        self.assertEqual(self._post(self.admin).status_code, 400)

    # --- main photo on delete --------------------------------------------

    def _delete(self, who, photo):
        self.client.force_authenticate(user=who)
        return self.client.delete(f"{self._url()}{photo.pk}/")

    def test_deleting_the_main_photo_promotes_the_next(self):
        self._fill(3, main_index=0)
        first, second, _ = PropertyPhoto.objects.filter(property=self.prop).order_by("sort_order")
        self.assertEqual(self._delete(self.owner, first).status_code, 204)
        second.refresh_from_db()
        self.assertTrue(second.is_main)
        self.assertEqual(PropertyPhoto.objects.filter(property=self.prop, is_main=True).count(), 1)

    def test_deleting_a_non_main_photo_leaves_main_alone(self):
        self._fill(3, main_index=0)
        first, second, _ = PropertyPhoto.objects.filter(property=self.prop).order_by("sort_order")
        self.assertEqual(self._delete(self.owner, second).status_code, 204)
        first.refresh_from_db()
        self.assertTrue(first.is_main)

    def test_deleting_the_last_photo_is_fine(self):
        self._fill(1)
        only = PropertyPhoto.objects.get(property=self.prop)
        self.assertEqual(self._delete(self.owner, only).status_code, 204)
        self.assertFalse(PropertyPhoto.objects.filter(property=self.prop).exists())

    # --- permissions -------------------------------------------------------

    def test_admin_and_assigned_realtor_may_upload(self):
        self.assertEqual(self._post(self.admin).status_code, 201)
        self.assertEqual(self._post(self.owner).status_code, 201)

    def test_realtor_without_edit_permission_gets_403(self):
        prop = self._property(self.no_edit)
        r = self._post(self.no_edit, prop=prop)
        self.assertEqual(r.status_code, 403, r.data)
        self.assertFalse(PropertyPhoto.objects.filter(property=prop).exists())

    def test_realtor_not_assigned_to_the_property_gets_404(self):
        r = self._post(self.other)
        self.assertEqual(r.status_code, 404, r.data)
        self.assertFalse(PropertyPhoto.objects.filter(property=self.prop).exists())

    def test_foreign_property_is_404_even_for_a_bad_file(self):
        r = self._post(self.other, data=b"not an image")
        self.assertEqual(r.status_code, 404)

    def test_anonymous_is_rejected(self):
        self.client.force_authenticate(user=None)
        r = self.client.post(self._url(), {"original_file": _upload()}, format="multipart")
        self.assertIn(r.status_code, (401, 403))

    # --- file validation ---------------------------------------------------

    def test_file_over_12_mib_is_rejected(self):
        big = _jpeg() + b"\0" * (12 * 1024 * 1024)  # valid image + trailing bytes
        r = self._post(self.owner, data=big)
        self.assertEqual(r.status_code, 400, r.data)
        self.assertIn("12", str(r.data))
        self.assertFalse(PropertyPhoto.objects.filter(property=self.prop).exists())

    def test_non_image_is_rejected(self):
        self.client.force_authenticate(user=self.owner)
        r = self.client.post(
            self._url(),
            {"original_file": SimpleUploadedFile("a.txt", b"hello", "text/plain")},
            format="multipart",
        )
        self.assertEqual(r.status_code, 400, r.data)
        self.assertFalse(PropertyPhoto.objects.filter(property=self.prop).exists())


@override_settings(MEDIA_ROOT=_MEDIA)
class SaleRequestPhotoCopyTests(TestCase):
    """mark-converted copies the owner's photos; the first becomes main."""

    def setUp(self):
        self.client = APIClient()
        self.city = City.objects.create(name="Геленджик", slug="gel-ph", region_name="КК")
        self.district = District.objects.create(city=self.city, name="Центр", slug="c-ph2")
        self.admin = User.objects.create_user(
            email="adm-sr-ph@test.local", password="pw", first_name="A", last_name="D",
            role=User.Role.ADMIN,
        )
        self.realtor = User.objects.create_user(
            email="rel-sr-ph@test.local", password="pw", first_name="R", last_name="E",
            role=User.Role.REALTOR, perm_edit_property=True, perm_create_property=True,
        )
        self.sr = SaleRequest.objects.create(
            owner_name="Собственник", owner_phone="+79990000000", city=self.city, description="x",
        )
        for i in range(3):
            SaleRequestPhoto.objects.create(
                sale_request=self.sr, image=_upload(f"o{i}.jpg"), sort_order=i
            )
        self.prop = Property.objects.create(
            property_type=PropertyType.APARTMENT, price=Decimal("1.00"),
            assigned_realtor=self.realtor, city=self.city, district=self.district,
        )

    def _convert(self):
        self.client.force_authenticate(user=self.admin)
        return self.client.post(
            f"/api/crm/sale-requests/{self.sr.pk}/mark-converted/",
            {"property_id": self.prop.pk}, format="json",
        )

    def test_owner_photos_are_copied_and_the_first_is_main(self):
        r = self._convert()
        self.assertEqual(r.status_code, 200, r.data)
        photos = list(PropertyPhoto.objects.filter(property=self.prop).order_by("sort_order"))
        self.assertEqual(len(photos), 3)
        self.assertEqual([p.is_main for p in photos], [True, False, False])

    def test_copy_is_skipped_when_the_property_already_has_a_photo(self):
        """Why the create form must call mark-converted BEFORE uploading its own photos."""
        PropertyPhoto.objects.bulk_create(
            [PropertyPhoto(property=self.prop, original_file="properties/photos/own.jpg", sort_order=0, is_main=True)]
        )
        self._convert()
        self.assertEqual(PropertyPhoto.objects.filter(property=self.prop).count(), 1)

    def test_realtor_photos_uploaded_after_conversion_are_added_not_main(self):
        self._convert()
        self.client.force_authenticate(user=self.realtor)
        r = self.client.post(
            f"/api/crm/properties/{self.prop.pk}/photos/",
            {"original_file": _upload("mine.jpg")}, format="multipart",
        )
        self.assertEqual(r.status_code, 201, r.data)
        self.assertFalse(r.data["is_main"])
        self.assertEqual(PropertyPhoto.objects.filter(property=self.prop).count(), 4)
        self.assertEqual(PropertyPhoto.objects.filter(property=self.prop, is_main=True).count(), 1)
