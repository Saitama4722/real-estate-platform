"""
Public property page: the detail endpoint returns EVERY characteristic the CRM form
lets a realtor fill in, with server-side labels (2026-10-26).

Before, `HouseDetailsPublicSerializer` sent only area/plot/floors, so heating,
house type and the utilities the realtor ticked were stored but never reached the
page. The LIST endpoint keeps its small payload on purpose.
"""
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from locations.models import City, District, Neighborhood, ResidentialComplex
from properties.choices import PropertyStatus, PropertyType
from properties.models import (
    ApartmentDetails,
    CommercialDetails,
    HouseDetails,
    LandPlotDetails,
    Property,
)

User = get_user_model()

HOUSE_KEYS = {
    "house_area", "land_area", "floors_total", "heating_type", "heating_type_label",
    "building_type", "building_type_label", "has_gas", "has_water", "has_sewerage",
    "has_electricity",
}
APARTMENT_KEYS = {
    "rooms", "area_total", "floor", "floors_total", "area_living", "area_kitchen",
    "has_balcony", "has_loggia", "renovation_type", "renovation_type_label",
    "bathroom_type", "bathroom_type_label",
}
LAND_KEYS = {
    "land_area", "land_category", "land_category_label", "permitted_use",
    "permitted_use_label", "has_gas", "has_water", "has_electricity",
}
COMMERCIAL_KEYS = {
    "commercial_type", "commercial_type_label", "area_total", "floor", "floors_total",
    "entrance_type", "parking_spaces",
}


class PublicCharacteristicsTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.city = City.objects.create(name="Геленджик", slug="gel-pc", region_name="КК")
        self.district = District.objects.create(city=self.city, name="Геленджик", slug="gel-d-pc")
        self.neighborhood = Neighborhood.objects.create(
            city=self.city, district=self.district, name="Магилат", slug="magilat-pc"
        )
        self.realtor = User.objects.create_user(
            email="r-pc@test.local", password="pw", first_name="F", last_name="L",
            role=User.Role.REALTOR,
        )

    def _prop(self, ptype, **kw):
        return Property.objects.create(
            assigned_realtor=self.realtor, property_type=ptype, price=Decimal("1"),
            city=self.city, district=self.district, status=PropertyStatus.PUBLISHED,
            is_published=True, public_address_text="улица Айвазовского, 41", **kw,
        )

    def _detail(self, prop):
        r = self.client.get(f"/api/properties/{prop.pk}/")
        self.assertEqual(r.status_code, 200, r.data)
        return r.data

    def _house(self):
        prop = self._prop(PropertyType.HOUSE, neighborhood=self.neighborhood)
        HouseDetails.objects.create(
            property=prop, house_area=Decimal("225.00"), land_area=Decimal("1.30"),
            floors_total=3, heating_type="autonomous", building_type="other",
            has_gas=True, has_water=True, has_sewerage=True, has_electricity=True,
        )
        return prop

    def test_house_returns_every_characteristic_with_labels(self):
        d = self._detail(self._house())
        hd = d["house_details"]
        self.assertEqual(set(hd), HOUSE_KEYS)
        self.assertEqual(hd["heating_type"], "autonomous")
        self.assertEqual(hd["heating_type_label"], "Автономное")
        self.assertEqual(hd["building_type_label"], "Иное")
        for k in ("has_gas", "has_water", "has_sewerage", "has_electricity"):
            self.assertIs(hd[k], True)
        self.assertEqual(hd["floors_total"], 3)
        # the other types are absent, not empty objects
        self.assertIsNone(d["apartment_details"])
        self.assertIsNone(d["land_plot_details"])
        self.assertIsNone(d["commercial_details"])

    def test_house_location_parts_are_returned(self):
        d = self._detail(self._house())
        self.assertEqual(d["neighborhood"]["name"], "Магилат")
        self.assertEqual(d["district"]["name"], "Геленджик")
        self.assertEqual(d["city"]["name"], "Геленджик")
        self.assertEqual(d["public_address_text"], "улица Айвазовского, 41")
        self.assertIsNone(d["residential_complex"])

    def test_unticked_utilities_and_empty_choices_come_back_empty(self):
        prop = self._prop(PropertyType.HOUSE)
        HouseDetails.objects.create(
            property=prop, house_area=Decimal("100"), land_area=Decimal("5"), floors_total=1,
        )
        hd = self._detail(prop)["house_details"]
        self.assertIsNone(hd["heating_type"])
        self.assertIsNone(hd["heating_type_label"])
        self.assertIsNone(hd["building_type_label"])
        self.assertFalse(any(hd[k] for k in ("has_gas", "has_water", "has_sewerage", "has_electricity")))

    def test_apartment_returns_its_set_and_labels(self):
        prop = self._prop(PropertyType.APARTMENT)
        ApartmentDetails.objects.create(
            property=prop, rooms=2, area_total=Decimal("54.5"), area_living=Decimal("30"),
            area_kitchen=Decimal("10.5"), floor=3, floors_total=9, has_balcony=True,
            renovation_type="euro", bathroom_type="separate",
        )
        d = self._detail(prop)
        ad = d["apartment_details"]
        self.assertEqual(set(ad), APARTMENT_KEYS)
        self.assertEqual(ad["renovation_type_label"], "Евроремонт")
        self.assertEqual(ad["bathroom_type_label"], "Раздельный")
        self.assertTrue(ad["has_balcony"])
        self.assertFalse(ad["has_loggia"])
        self.assertIsNone(d["house_details"])

    def test_land_returns_its_set_and_utilities(self):
        prop = self._prop(PropertyType.LAND)
        LandPlotDetails.objects.create(
            property=prop, land_area=Decimal("8"), land_category="izhs",
            permitted_use="residential", has_gas=True, has_electricity=True,
        )
        ld = self._detail(prop)["land_plot_details"]
        self.assertEqual(set(ld), LAND_KEYS)
        self.assertEqual(ld["land_category_label"], "ИЖС")
        self.assertEqual(ld["permitted_use_label"], "Жилое строительство")
        self.assertTrue(ld["has_gas"])
        self.assertFalse(ld["has_water"])
        self.assertNotIn("has_sewerage", ld)  # land has no sewerage field

    def test_commercial_returns_its_set(self):
        prop = self._prop(PropertyType.COMMERCIAL)
        CommercialDetails.objects.create(
            property=prop, commercial_type="office", area_total=Decimal("80"),
            floor=1, floors_total=5, entrance_type="отдельный", parking_spaces=4,
        )
        cd = self._detail(prop)["commercial_details"]
        self.assertEqual(set(cd), COMMERCIAL_KEYS)
        self.assertEqual(cd["commercial_type_label"], "Офис")
        self.assertEqual(cd["parking_spaces"], 4)

    def test_residential_complex_is_returned_when_set(self):
        rc = ResidentialComplex.objects.create(
            city=self.city, district=self.district, name="ЖК Тест", slug="zhk-test-pc"
        )
        prop = self._prop(PropertyType.APARTMENT, residential_complex=rc)
        ApartmentDetails.objects.create(
            property=prop, rooms=1, area_total=Decimal("30"), floor=2, floors_total=None
        )
        d = self._detail(prop)
        self.assertEqual(d["residential_complex"]["name"], "ЖК Тест")
        self.assertIsNone(d["apartment_details"]["floors_total"])

    def test_list_payload_is_unchanged_and_small(self):
        self._house()
        r = self.client.get("/api/properties/")
        self.assertEqual(r.status_code, 200)
        rows = r.data["results"] if isinstance(r.data, dict) and "results" in r.data else r.data
        hd = rows[0]["house_details"]
        self.assertEqual(set(hd), {"house_area", "land_area", "floors_total"})
        self.assertEqual(rows[0]["neighborhood"]["name"], "Магилат")
