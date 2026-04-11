from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from leads.choices import LeadStatus
from leads.models import Lead
from properties.choices import PropertyType
from properties.models import Property
from users.permissions import (
    crm_property_queryset_for_user,
    crm_user_has_capability,
    user_can_access_crm_property,
)

User = get_user_model()


class CrmPropertyAccessByRoleTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            email="admin@example.com",
            password="x",
            first_name="A",
            last_name="Admin",
            role=User.Role.ADMIN,
        )
        self.realtor = User.objects.create_user(
            email="realtor@example.com",
            password="x",
            first_name="R",
            last_name="Realtor",
            role=User.Role.REALTOR,
        )
        self.other = User.objects.create_user(
            email="other@example.com",
            password="x",
            first_name="O",
            last_name="Other",
            role=User.Role.REALTOR,
        )
        self.p_mine = Property.objects.create(
            property_type=PropertyType.APARTMENT,
            price=Decimal("1.00"),
            created_by=self.realtor,
            assigned_realtor=self.realtor,
        )
        self.p_assigned = Property.objects.create(
            property_type=PropertyType.APARTMENT,
            price=Decimal("2.00"),
            assigned_realtor=self.realtor,
            created_by=self.other,
        )
        self.p_foreign = Property.objects.create(
            property_type=PropertyType.APARTMENT,
            price=Decimal("3.00"),
            created_by=self.other,
            assigned_realtor=self.other,
        )

    def test_admin_sees_all_properties_in_crm_queryset(self):
        qs = crm_property_queryset_for_user(self.admin)
        ids = set(qs.values_list("pk", flat=True))
        self.assertEqual(
            ids,
            {self.p_mine.pk, self.p_assigned.pk, self.p_foreign.pk},
        )

    def test_realtor_sees_only_owned_crm_properties(self):
        qs = crm_property_queryset_for_user(self.realtor)
        ids = set(qs.values_list("pk", flat=True))
        self.assertEqual(ids, {self.p_mine.pk, self.p_assigned.pk})

    def test_user_can_access_crm_property_matches_queryset(self):
        self.assertTrue(user_can_access_crm_property(self.realtor, self.p_mine))
        self.assertTrue(user_can_access_crm_property(self.realtor, self.p_assigned))
        self.assertFalse(user_can_access_crm_property(self.realtor, self.p_foreign))
        self.assertTrue(user_can_access_crm_property(self.admin, self.p_foreign))


class CurrentUserMeRoleTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email="me@example.com",
            password="secret",
            first_name="M",
            last_name="E",
            role=User.Role.REALTOR,
        )

    def test_me_requires_authentication(self):
        res = self.client.get("/api/auth/me/")
        self.assertEqual(res.status_code, 401)

    def test_me_allowed_for_crm_role(self):
        self.client.force_authenticate(user=self.user)
        res = self.client.get("/api/auth/me/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["role"], User.Role.REALTOR)
        self.assertEqual(res.data["email"], "me@example.com")
        caps = res.data.get("crm_capabilities")
        self.assertIsInstance(caps, dict)
        self.assertIn("create_property", caps)
        self.assertFalse(caps["create_property"])

    def test_me_forbidden_when_role_not_allowed(self):
        self.client.force_authenticate(user=self.user)
        User.objects.filter(pk=self.user.pk).update(role="legacy_invalid")
        self.user.refresh_from_db()
        res = self.client.get("/api/auth/me/")
        self.assertEqual(res.status_code, 403)


class CurrentUserProfilePatchTests(TestCase):
    """Этап 7: сотрудник обновляет только свой профиль через PATCH /api/auth/me/."""

    def setUp(self):
        self.client = APIClient()
        self.realtor = User.objects.create_user(
            email="patch-me@test.local",
            password="pw",
            first_name="Старый",
            last_name="Имя",
            role=User.Role.REALTOR,
            phone="+70000000000",
        )

    def test_patch_me_updates_profile_fields(self):
        self.client.force_authenticate(user=self.realtor)
        res = self.client.patch(
            "/api/auth/me/",
            {
                "first_name": "Новый",
                "last_name": "Фамилия",
                "phone": "+79991234567",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["first_name"], "Новый")
        self.assertEqual(res.data["last_name"], "Фамилия")
        self.assertEqual(res.data["phone"], "+79991234567")
        self.realtor.refresh_from_db()
        self.assertEqual(self.realtor.first_name, "Новый")

    def test_put_me_not_allowed(self):
        self.client.force_authenticate(user=self.realtor)
        res = self.client.put(
            "/api/auth/me/",
            {"first_name": "X", "last_name": "Y", "phone": "1"},
            format="json",
        )
        self.assertEqual(res.status_code, 405)


class CrmRealtorManagementTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            email="adm-stage5@test.local",
            password="pw",
            first_name="A",
            last_name="Admin",
            role=User.Role.ADMIN,
        )
        self.realtor = User.objects.create_user(
            email="rel-stage5@test.local",
            password="pw",
            first_name="R",
            last_name="Realtor",
            role=User.Role.REALTOR,
        )

    def test_realtor_forbidden_on_realtors_api(self):
        self.client.force_authenticate(user=self.realtor)
        res = self.client.get("/api/crm/realtors/")
        self.assertEqual(res.status_code, 403)

    def test_realtor_forbidden_on_realtor_write_operations(self):
        """Backend must deny create / update / delete / disable to role=realtor."""
        self.client.force_authenticate(user=self.realtor)
        self.assertEqual(
            self.client.post(
                "/api/crm/realtors/",
                {
                    "email": "nope@test.local",
                    "password": "secret12345",
                    "first_name": "N",
                    "last_name": "O",
                    "is_active": True,
                },
                format="json",
            ).status_code,
            403,
        )
        self.assertEqual(
            self.client.patch(
                f"/api/crm/realtors/{self.realtor.pk}/",
                {"is_active": False},
                format="json",
            ).status_code,
            403,
        )
        other = User.objects.create_user(
            email="other-rel@test.local",
            password="pw",
            first_name="O",
            last_name="T",
            role=User.Role.REALTOR,
        )
        self.assertEqual(
            self.client.delete(f"/api/crm/realtors/{other.pk}/").status_code,
            403,
        )

    def test_superadmin_can_list_realtors(self):
        super_u = User.objects.create_user(
            email="super-stage5@test.local",
            password="pw",
            first_name="S",
            last_name="U",
            role=User.Role.SUPERADMIN,
        )
        self.client.force_authenticate(user=super_u)
        res = self.client.get("/api/crm/realtors/")
        self.assertEqual(res.status_code, 200)
        ids = {row["id"] for row in res.data}
        self.assertIn(self.realtor.pk, ids)

    def test_inactive_staff_cannot_manage_realtors(self):
        self.admin.is_active = False
        self.admin.save(update_fields=["is_active"])
        self.client.force_authenticate(user=self.admin)
        self.assertEqual(self.client.get("/api/crm/realtors/").status_code, 403)

    def test_admin_lists_realtors_only(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.get("/api/crm/realtors/")
        self.assertEqual(res.status_code, 200)
        rows = res.data
        self.assertIsInstance(rows, list)
        ids = {row["id"] for row in rows}
        self.assertIn(self.realtor.pk, ids)
        self.assertNotIn(self.admin.pk, ids)

    def test_admin_creates_realtor_auto_crm_id(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.post(
            "/api/crm/realtors/",
            {
                "email": "newrel-stage5@test.local",
                "password": "secret12345",
                "first_name": "Новый",
                "last_name": "Риэлтор",
                "phone": "+79990001122",
                "is_active": True,
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.data)
        u = User.objects.get(email="newrel-stage5@test.local")
        self.assertEqual(u.role, User.Role.REALTOR)
        self.assertRegex(u.crm_id, r"^RID\d{6}$")
        self.assertEqual(res.data["crm_id"], u.crm_id)

    def test_crm_id_unique_on_create(self):
        self.client.force_authenticate(user=self.admin)
        body = {
            "email": "dup-stage5@test.local",
            "password": "secret12345",
            "first_name": "D",
            "last_name": "U",
            "is_active": True,
        }
        r1 = self.client.post("/api/crm/realtors/", body, format="json")
        self.assertEqual(r1.status_code, 201)
        u = User.objects.get(email="dup-stage5@test.local")
        forced = u.crm_id
        User.objects.filter(pk=u.pk).update(crm_id="RID009999")
        u.refresh_from_db()
        body["email"] = "dup2-stage5@test.local"
        r2 = self.client.post("/api/crm/realtors/", body, format="json")
        self.assertEqual(r2.status_code, 201)
        u2 = User.objects.get(email="dup2-stage5@test.local")
        self.assertNotEqual(u2.crm_id, forced)
        self.assertRegex(u2.crm_id, r"^RID\d{6}$")

    def test_disable_realtor(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.patch(
            f"/api/crm/realtors/{self.realtor.pk}/",
            {"is_active": False},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.realtor.refresh_from_db()
        self.assertFalse(self.realtor.is_active)

    def test_crm_id_unchanged_on_update(self):
        self.client.force_authenticate(user=self.admin)
        before = self.realtor.crm_id
        res = self.client.patch(
            f"/api/crm/realtors/{self.realtor.pk}/",
            {"first_name": "Renamed", "last_name": "StillRealtor"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.realtor.refresh_from_db()
        self.assertEqual(self.realtor.crm_id, before)
        self.assertEqual(res.data["crm_id"], before)

    def test_admin_can_delete_realtor(self):
        victim = User.objects.create_user(
            email="del-stage5@test.local",
            password="pw",
            first_name="X",
            last_name="Y",
            role=User.Role.REALTOR,
        )
        vid = victim.pk
        self.client.force_authenticate(user=self.admin)
        res = self.client.delete(f"/api/crm/realtors/{vid}/")
        self.assertEqual(res.status_code, 204)
        self.assertFalse(User.objects.filter(pk=vid).exists())


class CrmRealtorCapabilityFlagsTests(TestCase):
    """Stage 6: boolean CRM capabilities for realtors; staff bypass."""

    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            email="adm-perm@test.local",
            password="pw",
            first_name="A",
            last_name="Admin",
            role=User.Role.ADMIN,
        )
        self.realtor = User.objects.create_user(
            email="rel-perm@test.local",
            password="pw",
            first_name="R",
            last_name="Realtor",
            role=User.Role.REALTOR,
        )
        self.prop = Property.objects.create(
            property_type=PropertyType.APARTMENT,
            price=Decimal("100.00"),
            created_by=self.realtor,
            assigned_realtor=self.realtor,
        )
        self.lead = Lead.objects.create(
            client_name="Клиент",
            client_phone="+79990001122",
            property=self.prop,
        )

    def test_crm_user_has_capability_staff_unrestricted(self):
        self.assertTrue(crm_user_has_capability(self.admin, "create_property"))
        self.assertTrue(crm_user_has_capability(self.admin, "delete_clients"))

    def test_realtor_capability_false_by_default(self):
        self.assertFalse(crm_user_has_capability(self.realtor, "create_property"))

    def test_admin_can_patch_realtor_permissions(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.patch(
            f"/api/crm/realtors/{self.realtor.pk}/",
            {
                "perm_create_property": True,
                "perm_view_clients": True,
                "perm_change_status": True,
            },
            format="json",
        )
        self.assertEqual(res.status_code, 200, res.data)
        self.realtor.refresh_from_db()
        self.assertTrue(self.realtor.perm_create_property)
        self.assertTrue(self.realtor.perm_view_clients)
        self.assertTrue(self.realtor.perm_change_status)
        self.assertTrue(res.data.get("perm_create_property"))

    def test_realtor_cannot_patch_permissions_even_own_row(self):
        self.client.force_authenticate(user=self.realtor)
        res = self.client.patch(
            f"/api/crm/realtors/{self.realtor.pk}/",
            {"perm_create_property": True},
            format="json",
        )
        self.assertEqual(res.status_code, 403)
        self.realtor.refresh_from_db()
        self.assertFalse(self.realtor.perm_create_property)

    def test_realtor_create_property_forbidden_without_flag(self):
        self.client.force_authenticate(user=self.realtor)
        res = self.client.post(
            "/api/crm/properties/",
            {"property_type": PropertyType.APARTMENT, "price": "50.00"},
            format="json",
        )
        self.assertEqual(res.status_code, 403)

    def test_realtor_create_property_allowed_with_flag(self):
        User.objects.filter(pk=self.realtor.pk).update(perm_create_property=True)
        self.realtor.refresh_from_db()
        self.client.force_authenticate(user=self.realtor)
        res = self.client.post(
            "/api/crm/properties/",
            {"property_type": PropertyType.APARTMENT, "price": "50.00"},
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.data)

    def test_admin_create_property_without_realtor_flags(self):
        staff = User.objects.create_user(
            email="adm2-perm@test.local",
            password="pw",
            first_name="A",
            last_name="Two",
            role=User.Role.ADMIN,
        )
        self.client.force_authenticate(user=staff)
        res = self.client.post(
            "/api/crm/properties/",
            {
                "property_type": PropertyType.APARTMENT,
                "price": "77.00",
                "assigned_realtor": self.realtor.pk,
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.data)

    def test_realtor_leads_list_requires_view_clients(self):
        self.client.force_authenticate(user=self.realtor)
        self.assertEqual(self.client.get("/api/crm/leads/").status_code, 403)
        User.objects.filter(pk=self.realtor.pk).update(perm_view_clients=True)
        self.realtor.refresh_from_db()
        res = self.client.get("/api/crm/leads/")
        self.assertEqual(res.status_code, 200)

    def test_realtor_set_status_requires_change_status(self):
        User.objects.filter(pk=self.realtor.pk).update(
            perm_view_clients=True,
            perm_change_status=False,
        )
        self.realtor.refresh_from_db()
        self.client.force_authenticate(user=self.realtor)
        url = f"/api/crm/leads/{self.lead.pk}/set-status/"
        res = self.client.post(url, {"status": LeadStatus.IN_PROGRESS}, format="json")
        self.assertEqual(res.status_code, 403)
        User.objects.filter(pk=self.realtor.pk).update(perm_change_status=True)
        self.realtor.refresh_from_db()
        res = self.client.post(url, {"status": LeadStatus.IN_PROGRESS}, format="json")
        self.assertEqual(res.status_code, 200)

    def test_realtor_patch_property_requires_edit_flag(self):
        User.objects.filter(pk=self.realtor.pk).update(perm_edit_property=False)
        self.realtor.refresh_from_db()
        self.client.force_authenticate(user=self.realtor)
        res = self.client.patch(
            f"/api/crm/properties/{self.prop.pk}/",
            {"price": "200.00"},
            format="json",
        )
        self.assertEqual(res.status_code, 403)
        User.objects.filter(pk=self.realtor.pk).update(perm_edit_property=True)
        self.realtor.refresh_from_db()
        res = self.client.patch(
            f"/api/crm/properties/{self.prop.pk}/",
            {"price": "200.00"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)

    def test_realtor_archive_requires_delete_property_flag(self):
        User.objects.filter(pk=self.realtor.pk).update(
            perm_edit_property=True,
            perm_delete_property=False,
        )
        self.realtor.refresh_from_db()
        self.client.force_authenticate(user=self.realtor)
        res = self.client.post(f"/api/crm/properties/{self.prop.pk}/archive/")
        self.assertEqual(res.status_code, 403)
        User.objects.filter(pk=self.realtor.pk).update(perm_delete_property=True)
        self.realtor.refresh_from_db()
        res = self.client.post(f"/api/crm/properties/{self.prop.pk}/archive/")
        self.assertEqual(res.status_code, 200)


class CrmLeadDeletePermissionTests(TestCase):
    """DELETE /api/crm/leads/<id>/ — perm_delete_clients + object scope."""

    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            email="adm-lead-del@test.local",
            password="pw",
            first_name="A",
            last_name="Admin",
            role=User.Role.ADMIN,
        )
        self.realtor = User.objects.create_user(
            email="rel-lead-del@test.local",
            password="pw",
            first_name="R",
            last_name="Realtor",
            role=User.Role.REALTOR,
        )
        self.other = User.objects.create_user(
            email="oth-lead-del@test.local",
            password="pw",
            first_name="O",
            last_name="Other",
            role=User.Role.REALTOR,
        )
        self.prop_mine = Property.objects.create(
            property_type=PropertyType.APARTMENT,
            price=Decimal("10.00"),
            created_by=self.realtor,
            assigned_realtor=self.realtor,
        )
        self.prop_foreign = Property.objects.create(
            property_type=PropertyType.APARTMENT,
            price=Decimal("20.00"),
            created_by=self.other,
            assigned_realtor=self.other,
        )
        self.lead_mine = Lead.objects.create(
            client_name="Мой",
            client_phone="+79991111111",
            property=self.prop_mine,
        )
        self.lead_foreign = Lead.objects.create(
            client_name="Чужой",
            client_phone="+79992222222",
            property=self.prop_foreign,
        )

    def test_admin_deletes_lead_success(self):
        lid = self.lead_mine.pk
        self.client.force_authenticate(user=self.admin)
        res = self.client.delete(f"/api/crm/leads/{lid}/")
        self.assertEqual(res.status_code, 204)
        self.assertFalse(Lead.objects.filter(pk=lid).exists())

    def test_realtor_with_delete_flag_deletes_own_lead_success(self):
        User.objects.filter(pk=self.realtor.pk).update(perm_delete_clients=True)
        self.realtor.refresh_from_db()
        lid = self.lead_mine.pk
        self.client.force_authenticate(user=self.realtor)
        res = self.client.delete(f"/api/crm/leads/{lid}/")
        self.assertEqual(res.status_code, 204)
        self.assertFalse(Lead.objects.filter(pk=lid).exists())

    def test_realtor_without_delete_flag_forbidden(self):
        User.objects.filter(pk=self.realtor.pk).update(perm_delete_clients=False)
        self.realtor.refresh_from_db()
        self.client.force_authenticate(user=self.realtor)
        res = self.client.delete(f"/api/crm/leads/{self.lead_mine.pk}/")
        self.assertEqual(res.status_code, 403)
        detail = res.data.get("detail", "")
        self.assertIn("удаление клиентов", str(detail).lower())

    def test_unauthenticated_delete_rejected(self):
        res = self.client.delete(f"/api/crm/leads/{self.lead_mine.pk}/")
        self.assertIn(res.status_code, (401, 403))

    def test_realtor_cannot_delete_foreign_lead_even_with_flag(self):
        User.objects.filter(pk=self.realtor.pk).update(perm_delete_clients=True)
        self.realtor.refresh_from_db()
        self.client.force_authenticate(user=self.realtor)
        res = self.client.delete(f"/api/crm/leads/{self.lead_foreign.pk}/")
        self.assertEqual(res.status_code, 403)
        self.assertTrue(Lead.objects.filter(pk=self.lead_foreign.pk).exists())

