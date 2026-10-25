"""
Public catalog: ONE cover photo per card, a constant number of queries, and the
detail endpoint returning every photo with the main one first (2026-10-26).

Before: the list prefetched EVERY photo row of every card to read `[:1]`, and the
cover ignored `is_main`. These tests pin the new contract.
"""
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import connection
from django.db.models.signals import post_init
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

from locations.models import City, District
from properties.choices import PropertyStatus, PropertyType
from properties.models import Property, PropertyPhoto

User = get_user_model()


class CatalogCoverPhotoTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.city = City.objects.create(name="Краснодар", slug="krd-cv", region_name="КК")
        self.district = District.objects.create(city=self.city, name="Центр", slug="c-cv")
        self.realtor = User.objects.create_user(
            email="r-cv@test.local", password="pw", first_name="F", last_name="L",
            role=User.Role.REALTOR,
        )

    def _prop(self):
        return Property.objects.create(
            assigned_realtor=self.realtor, property_type=PropertyType.APARTMENT,
            price=Decimal("1.00"), city=self.city, district=self.district,
            status=PropertyStatus.PUBLISHED, is_published=True,
        )

    def _photos(self, prop, n, main_index=0, tag="p"):
        PropertyPhoto.objects.bulk_create(
            [
                PropertyPhoto(
                    property=prop, sort_order=i, is_main=(i == main_index),
                    original_file=f"properties/photos/{tag}-{prop.pk}-{i}.jpg",
                    image_medium=f"properties/photos/medium/{tag}-{prop.pk}-{i}.jpg",
                    image_thumb=f"properties/photos/thumb/{tag}-{prop.pk}-{i}.jpg",
                    image_large=f"properties/photos/large/{tag}-{prop.pk}-{i}.jpg",
                )
                for i in range(n)
            ]
        )

    def _list(self):
        return self.client.get("/api/properties/")

    def _rows(self, response):
        data = response.data
        return data["results"] if isinstance(data, dict) and "results" in data else data

    # --- query count and rows loaded -------------------------------------

    def _measure(self):
        loaded = [0]

        def hook(sender, **kwargs):
            loaded[0] += 1

        post_init.connect(hook, sender=PropertyPhoto)
        try:
            with CaptureQueriesContext(connection) as ctx:
                r = self._list()
        finally:
            post_init.disconnect(hook, sender=PropertyPhoto)
        self.assertEqual(r.status_code, 200)
        return len(ctx), loaded[0], r

    def test_query_count_does_not_depend_on_photos_per_property(self):
        for _ in range(20):
            self._photos(self._prop(), 1)
        q_one, _, _ = self._measure()
        PropertyPhoto.objects.all().delete()
        Property.objects.all().delete()
        for _ in range(20):
            self._photos(self._prop(), 10)
        q_ten, _, r = self._measure()
        self.assertEqual(len(self._rows(r)), 20)
        self.assertEqual(q_one, q_ten)

    def test_list_loads_no_photo_rows(self):
        for _ in range(20):
            self._photos(self._prop(), 10)
        _, photo_rows_loaded, _ = self._measure()
        self.assertEqual(photo_rows_loaded, 0)

    # --- cover rule -------------------------------------------------------

    def test_cover_is_the_main_photo_even_with_a_later_sort_order(self):
        prop = self._prop()
        self._photos(prop, 5, main_index=3)
        row = self._rows(self._list())[0]
        self.assertIn("medium/p-%d-3.jpg" % prop.pk, row["preview_image"])

    def test_cover_falls_back_to_first_by_sort_order_without_a_main(self):
        prop = self._prop()
        self._photos(prop, 3, main_index=99)
        row = self._rows(self._list())[0]
        self.assertIn("medium/p-%d-0.jpg" % prop.pk, row["preview_image"])

    def test_cover_falls_back_down_the_ladder(self):
        prop = self._prop()
        PropertyPhoto.objects.create(
            property=prop, is_main=True, sort_order=0,
            original_file="properties/photos/only-original.jpg",
        )
        row = self._rows(self._list())[0]
        self.assertIn("only-original.jpg", row["preview_image"])

    # --- photos_count -----------------------------------------------------

    def test_photos_count_and_empty_property(self):
        empty, one, ten = self._prop(), self._prop(), self._prop()
        self._photos(one, 1, tag="one")
        self._photos(ten, 10, tag="ten")
        rows = {r["id"]: r for r in self._rows(self._list())}
        self.assertEqual(rows[empty.pk]["photos_count"], 0)
        self.assertIsNone(rows[empty.pk]["preview_image"])
        self.assertEqual(rows[one.pk]["photos_count"], 1)
        self.assertEqual(rows[ten.pk]["photos_count"], 10)

    def test_price_reduced_flag_still_works_with_the_annotations(self):
        prop = self._prop()
        self._photos(prop, 4)
        prop.price = Decimal("2.00")
        prop.save()
        prop.price = Decimal("1.00")
        prop.save()
        row = self._rows(self._list())[0]
        self.assertTrue(row["is_price_reduced"])
        self.assertEqual(row["photos_count"], 4)  # not multiplied by price_history

    # --- detail -----------------------------------------------------------

    def test_detail_returns_all_photos_main_first_with_three_sizes(self):
        prop = self._prop()
        self._photos(prop, 5, main_index=3)
        r = self.client.get(f"/api/properties/{prop.pk}/")
        self.assertEqual(r.status_code, 200)
        photos = r.data["photos"]
        self.assertEqual(len(photos), 5)
        self.assertTrue(photos[0]["is_main"])
        self.assertEqual([p["sort_order"] for p in photos], [3, 0, 1, 2, 4])
        for key in ("url", "thumb", "large"):
            self.assertTrue(photos[0][key])
        self.assertIn("medium/", photos[0]["url"])
        self.assertIn("thumb/", photos[0]["thumb"])
        self.assertIn("large/", photos[0]["large"])
