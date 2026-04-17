from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import TestCase
from rest_framework.test import APIClient

from locations.models import City

from properties.choices import PropertyStatus, PropertyType
from properties.models import ApartmentDetails, Property, PropertyContact
from users.models import RealtorProfile

User = get_user_model()


class CrmPropertyPidAndAccessApiTests(TestCase):
    """Этап 8: PID объекта, привязка риэлтора, разделение доступа в CRM API."""

    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            email="adm-pid@test.local",
            password="pw",
            first_name="A",
            last_name="Admin",
            role=User.Role.ADMIN,
        )
        self.realtor_a = User.objects.create_user(
            email="rel-a-pid@test.local",
            password="pw",
            first_name="A",
            last_name="Realtor",
            role=User.Role.REALTOR,
            perm_create_property=True,
            perm_edit_property=True,
        )
        self.realtor_b = User.objects.create_user(
            email="rel-b-pid@test.local",
            password="pw",
            first_name="B",
            last_name="Realtor",
            role=User.Role.REALTOR,
            perm_create_property=True,
            perm_edit_property=True,
        )

    def test_admin_list_includes_all_crm_properties(self):
        p1 = Property.objects.create(
            property_type=PropertyType.APARTMENT,
            price=Decimal("1.00"),
            assigned_realtor=self.realtor_a,
        )
        p2 = Property.objects.create(
            property_type=PropertyType.APARTMENT,
            price=Decimal("2.00"),
            assigned_realtor=self.realtor_b,
        )
        self.client.force_authenticate(user=self.admin)
        res = self.client.get("/api/crm/properties/")
        self.assertEqual(res.status_code, 200)
        ids = {row["id"] for row in res.data}
        self.assertEqual(ids, {p1.pk, p2.pk})

    def test_realtor_list_only_own_assigned_properties(self):
        mine = Property.objects.create(
            property_type=PropertyType.APARTMENT,
            price=Decimal("10.00"),
            assigned_realtor=self.realtor_a,
        )
        foreign = Property.objects.create(
            property_type=PropertyType.APARTMENT,
            price=Decimal("20.00"),
            assigned_realtor=self.realtor_b,
        )
        self.client.force_authenticate(user=self.realtor_a)
        res = self.client.get("/api/crm/properties/")
        self.assertEqual(res.status_code, 200)
        ids = {row["id"] for row in res.data}
        self.assertEqual(ids, {mine.pk})
        self.assertNotIn(foreign.pk, ids)

    def test_crm_property_id_generated_on_create_and_stable(self):
        self.client.force_authenticate(user=self.admin)
        r = self.client.post(
            "/api/crm/properties/",
            {
                "property_type": PropertyType.APARTMENT,
                "price": "100.00",
                "assigned_realtor": self.realtor_a.pk,
            },
            format="json",
        )
        self.assertEqual(r.status_code, 201, r.data)
        pid = r.data.get("crm_property_id")
        self.assertIsNotNone(pid)
        self.assertRegex(pid, r"^PID\d{6}$")
        pk = r.data["id"]
        r2 = self.client.patch(
            f"/api/crm/properties/{pk}/",
            {"price": "101.00"},
            format="json",
        )
        self.assertEqual(r2.status_code, 200)
        self.assertEqual(r2.data.get("crm_property_id"), pid)

    def test_admin_create_without_assigned_realtor_returns_400(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.post(
            "/api/crm/properties/",
            {"property_type": PropertyType.APARTMENT, "price": "50.00"},
            format="json",
        )
        self.assertEqual(res.status_code, 400)

    def test_realtor_create_assigns_self_as_assigned_realtor(self):
        self.client.force_authenticate(user=self.realtor_a)
        res = self.client.post(
            "/api/crm/properties/",
            {
                "property_type": PropertyType.APARTMENT,
                "price": "60.00",
                "assigned_realtor": self.realtor_b.pk,
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.data)
        prop = Property.objects.get(pk=res.data["id"])
        self.assertEqual(prop.assigned_realtor_id, self.realtor_a.pk)

    def test_realtor_cannot_patch_foreign_property(self):
        p = Property.objects.create(
            property_type=PropertyType.APARTMENT,
            price=Decimal("1.00"),
            assigned_realtor=self.realtor_b,
        )
        self.client.force_authenticate(user=self.realtor_a)
        User.objects.filter(pk=self.realtor_a.pk).update(perm_edit_property=True)
        self.realtor_a.refresh_from_db()
        res = self.client.patch(
            f"/api/crm/properties/{p.pk}/",
            {"price": "99.00"},
            format="json",
        )
        self.assertEqual(res.status_code, 404)

    def test_crm_property_id_unique_across_creates(self):
        self.client.force_authenticate(user=self.admin)
        r1 = self.client.post(
            "/api/crm/properties/",
            {
                "property_type": PropertyType.APARTMENT,
                "price": "1.00",
                "assigned_realtor": self.realtor_a.pk,
            },
            format="json",
        )
        r2 = self.client.post(
            "/api/crm/properties/",
            {
                "property_type": PropertyType.APARTMENT,
                "price": "2.00",
                "assigned_realtor": self.realtor_a.pk,
            },
            format="json",
        )
        self.assertEqual(r1.status_code, 201)
        self.assertEqual(r2.status_code, 201)
        self.assertNotEqual(
            r1.data["crm_property_id"],
            r2.data["crm_property_id"],
        )


class RevealPhoneFallbackTests(TestCase):
    """Этап 7: раскрытие телефона с тем же номером, что у ответственного риэлтора (User.phone)."""

    def setUp(self):
        self.client = APIClient()
        self.realtor = User.objects.create_user(
            email="rel-phone@test.local",
            password="pw",
            first_name="Иван",
            last_name="Риэлтор",
            role=User.Role.REALTOR,
            phone="+79991112233",
        )
        self.prop = Property.objects.create(
            property_type=PropertyType.APARTMENT,
            price=Decimal("10.00"),
            assigned_realtor=self.realtor,
            status=PropertyStatus.PUBLISHED,
            is_published=True,
        )

    def test_reveal_uses_assigned_realtor_phone_without_property_contact(self):
        res = self.client.post(f"/api/properties/{self.prop.pk}/reveal_phone/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data.get("phone"), "+79991112233")
        self.assertTrue(RealtorProfile.objects.filter(user=self.realtor).exists())

    def test_property_contact_phone_takes_precedence(self):
        prof, _ = RealtorProfile.objects.get_or_create(
            user=self.realtor,
            defaults={"public_name": "Иван"},
        )
        PropertyContact.objects.create(
            property=self.prop,
            realtor_profile=prof,
            contact_name="Иван Р.",
            phone="+79990000001",
            show_phone_enabled=True,
        )
        res = self.client.post(f"/api/properties/{self.prop.pk}/reveal_phone/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data.get("phone"), "+79990000001")


class PropertyAssignedRealtorInvariantTests(TestCase):
    """Этап 8: новый объект не сохраняется без assigned_realtor."""

    def test_create_property_without_assigned_realtor_raises(self):
        with self.assertRaises(ValidationError):
            Property.objects.create(
                property_type=PropertyType.APARTMENT,
                price=Decimal("1.00"),
            )


class CrmPropertyFormNestedDetailsApiTests(TestCase):
    """Этап 9 (форма объекта CRM): вложенные характеристики, координаты, авто-заголовок."""

    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            email="adm-form@test.local",
            password="pw",
            first_name="A",
            last_name="Admin",
            role=User.Role.ADMIN,
        )
        self.realtor = User.objects.create_user(
            email="rel-form@test.local",
            password="pw",
            first_name="R",
            last_name="Realtor",
            role=User.Role.REALTOR,
            perm_create_property=True,
            perm_edit_property=True,
        )
        self.city = City.objects.create(name="Краснодар", slug="krasnodar")

    def test_create_apartment_with_nested_details_and_geo_sets_title(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.post(
            "/api/crm/properties/",
            {
                "property_type": PropertyType.APARTMENT,
                "price": "100.00",
                "assigned_realtor": self.realtor.pk,
                "city": self.city.pk,
                "description": "Описание для теста",
                "public_address_text": "ул. Красная, 1",
                "public_latitude": "45.035470",
                "public_longitude": "38.975313",
                "real_latitude": "45.035470",
                "real_longitude": "38.975313",
                "apartment_details": {
                    "rooms": 2,
                    "area_total": "55.50",
                    "floor": 4,
                    "floors_total": 12,
                },
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.data)
        self.assertIn("комн", (res.data.get("title_generated") or "").lower())
        self.assertIn("краснодар", (res.data.get("title_generated") or "").lower())
        pid = res.data["id"]
        ad = ApartmentDetails.objects.get(property_id=pid)
        self.assertEqual(ad.rooms, 2)
        prop = Property.objects.get(pk=pid)
        self.assertEqual(prop.public_latitude, Decimal("45.035470"))

    def test_create_rejects_house_details_for_apartment_type(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.post(
            "/api/crm/properties/",
            {
                "property_type": PropertyType.APARTMENT,
                "price": "10.00",
                "assigned_realtor": self.realtor.pk,
                "house_details": {
                    "house_area": "100.00",
                    "land_area": "6.00",
                    "floors_total": 2,
                },
            },
            format="json",
        )
        self.assertEqual(res.status_code, 400)

    def test_patch_partial_apartment_details_merges(self):
        self.client.force_authenticate(user=self.admin)
        r0 = self.client.post(
            "/api/crm/properties/",
            {
                "property_type": PropertyType.APARTMENT,
                "price": "50.00",
                "assigned_realtor": self.realtor.pk,
                "apartment_details": {
                    "rooms": 1,
                    "area_total": "40.00",
                    "floor": 2,
                    "floors_total": 5,
                },
            },
            format="json",
        )
        self.assertEqual(r0.status_code, 201, r0.data)
        pk = r0.data["id"]
        r1 = self.client.patch(
            f"/api/crm/properties/{pk}/",
            {"apartment_details": {"rooms": 3}},
            format="json",
        )
        self.assertEqual(r1.status_code, 200, r1.data)
        ad = ApartmentDetails.objects.get(property_id=pk)
        self.assertEqual(ad.rooms, 3)
        self.assertEqual(ad.area_total, Decimal("40.00"))

    def test_title_generated_is_read_only_on_write_response(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.post(
            "/api/crm/properties/",
            {
                "property_type": PropertyType.LAND,
                "price": "1.00",
                "assigned_realtor": self.realtor.pk,
                "title_generated": "Ручной заголовок",
                "land_plot_details": {"land_area": "10.00"},
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.data)
        self.assertNotIn("ручной", (res.data.get("title_generated") or "").lower())


class ImportAssignedRealtorResolutionTests(TestCase):
    """Этап 8 / импорт: без риэлтора в БД назначение не подставляется."""

    def test_assigned_realtor_for_import_none_when_no_realtor_exists(self):
        from properties.import_pipeline import _assigned_realtor_for_import_row

        u = User.objects.create_user(
            email="admin-only-import@test.local",
            password="pw",
            first_name="A",
            last_name="Admin",
            role=User.Role.ADMIN,
        )
        self.assertIsNone(_assigned_realtor_for_import_row(u, None))


class PublicPropertyListRealtorFilterTests(TestCase):
    """Публичный каталог: фильтр по ответственному риэлтору (только опубликованные)."""

    def setUp(self):
        self.client = APIClient()
        self.realtor = User.objects.create_user(
            email="rel-pub-filter@test.local",
            password="pw",
            first_name="Пётр",
            last_name="Публичный",
            role=User.Role.REALTOR,
            phone="+79991112233",
        )
        self.pub = Property.objects.create(
            property_type=PropertyType.APARTMENT,
            price=Decimal("5.00"),
            assigned_realtor=self.realtor,
            status=PropertyStatus.PUBLISHED,
            is_published=True,
        )
        Property.objects.create(
            property_type=PropertyType.APARTMENT,
            price=Decimal("6.00"),
            assigned_realtor=self.realtor,
            status=PropertyStatus.DRAFT,
            is_published=False,
        )

    def test_list_filters_by_assigned_realtor_crm_id_case_insensitive(self):
        cid = self.realtor.crm_id
        self.assertRegex(cid, r"^RID\d{6}$")
        low = cid.lower()
        res = self.client.get(
            "/api/properties/",
            {"assigned_realtor_crm_id": low},
        )
        self.assertEqual(res.status_code, 200)
        rows = res.data if isinstance(res.data, list) else res.data.get("results", [])
        ids = {row["id"] for row in rows}
        self.assertEqual(ids, {self.pub.pk})
