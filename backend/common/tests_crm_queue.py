"""
Shared lead / sale-request queue and the CRM notification bell (2026-10-18).

Covers: realtor visibility of the free queue, the take race, masked phone
before taking, notification fan-out, superadmin exclusion, the 24 h bell
window, mark-all-read, clearing other realtors' notifications on take,
returning to the queue, the sale-request queue, and the weekly purge.
"""
import re
from datetime import timedelta
from decimal import Decimal
from unittest import mock

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from common import crm_notify
from common.models import CrmNotification, CrmNotificationType
from common.tasks import purge_old_crm_notifications
from leads.choices import LeadActionType
from leads.models import Lead, LeadActionLog
from locations.models import City, District
from properties.choices import PropertyStatus, PropertyType
from properties.models import Property
from submissions.choices import SaleRequestStatus
from submissions.models import SaleRequest

User = get_user_model()


def _make_user(email, role, *, view_clients=True, active=True):
    u = User.objects.create_user(
        email=email, password="pw", first_name="F", last_name="L", role=role
    )
    User.objects.filter(pk=u.pk).update(
        perm_view_clients=view_clients, perm_change_status=True, is_active=active
    )
    u.refresh_from_db()
    return u


class QueueTestBase(TestCase):
    def setUp(self):
        cache.clear()
        self.r1 = _make_user("r1@test.local", User.Role.REALTOR)
        self.r2 = _make_user("r2@test.local", User.Role.REALTOR)
        self.r_noclients = _make_user("r3@test.local", User.Role.REALTOR, view_clients=False)
        self.r_inactive = _make_user("r4@test.local", User.Role.REALTOR, active=False)
        self.superadmin = _make_user("sa@test.local", User.Role.SUPERADMIN)
        self.c1, self.c2, self.csa = APIClient(), APIClient(), APIClient()
        self.c1.force_authenticate(self.r1)
        self.c2.force_authenticate(self.r2)
        self.csa.force_authenticate(self.superadmin)

    def _free_lead(self, **kw):
        return Lead.objects.create(
            client_name=kw.pop("client_name", "Свободный"),
            client_phone="+79991234567",
            client_message="Вопрос",
            **kw,
        )

    def _property(self, slug_suffix):
        city = City.objects.create(name="Краснодар", slug=f"krd-{slug_suffix}", region_name="КК")
        district = District.objects.create(city=city, name="Ц", slug=f"c-{slug_suffix}")
        return Property.objects.create(
            property_type=PropertyType.APARTMENT, price=Decimal("1.00"),
            assigned_realtor=self.r1, city=city, district=district,
            status=PropertyStatus.PUBLISHED, is_published=True,
        )

    @staticmethod
    def _rows(data):
        return data if isinstance(data, list) else data.get("results", [])


class LeadQueueVisibilityTests(QueueTestBase):
    def test_realtor_sees_free_and_own_but_not_others(self):
        free = self._free_lead()
        mine = self._free_lead(client_name="Мой", assigned_realtor=self.r1)
        theirs = self._free_lead(client_name="Чужой", assigned_realtor=self.r2)
        r = self.c1.get("/api/crm/leads/")
        self.assertEqual(r.status_code, 200, r.data)
        ids = {row["id"] for row in self._rows(r.data)}
        self.assertEqual(ids, {free.pk, mine.pk})
        self.assertEqual(self.c1.get(f"/api/crm/leads/{theirs.pk}/").status_code, 404)

    def test_scope_filter_and_is_free(self):
        free = self._free_lead()
        mine = self._free_lead(client_name="Мой", assigned_realtor=self.r1)
        free_ids = {x["id"] for x in self._rows(self.c1.get("/api/crm/leads/?scope=free").data)}
        mine_ids = {x["id"] for x in self._rows(self.c1.get("/api/crm/leads/?scope=mine").data)}
        self.assertEqual(free_ids, {free.pk})
        self.assertEqual(mine_ids, {mine.pk})
        row = next(x for x in self._rows(self.c1.get("/api/crm/leads/").data) if x["id"] == free.pk)
        self.assertTrue(row["is_free"])

    def test_phone_masked_and_actions_blocked_before_taking(self):
        lead = self._free_lead()
        detail = self.c1.get(f"/api/crm/leads/{lead.pk}/").data
        self.assertNotIn("79991234567", detail["client_phone"])
        self.assertEqual(self.c1.post(f"/api/crm/leads/{lead.pk}/reveal_phone/").status_code, 403)
        self.assertEqual(
            self.c1.post(
                f"/api/crm/leads/{lead.pk}/set-status/", {"status": "in_progress"}, format="json"
            ).status_code,
            403,
        )
        self.assertEqual(
            self.c1.post(f"/api/crm/leads/{lead.pk}/notes/", {"text": "x"}, format="json").status_code,
            403,
        )
        self.assertEqual(self.c1.post(f"/api/crm/leads/{lead.pk}/take/").status_code, 200)
        r = self.c1.post(f"/api/crm/leads/{lead.pk}/reveal_phone/")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data["phone"], "+79991234567")

    def test_phone_search_does_not_reach_the_free_queue(self):
        self._free_lead()
        self.assertEqual(self._rows(self.c1.get("/api/crm/leads/?search=1234567").data), [])

    def test_superadmin_still_sees_everything(self):
        a = self._free_lead()
        b = self._free_lead(assigned_realtor=self.r2)
        ids = {x["id"] for x in self._rows(self.csa.get("/api/crm/leads/").data)}
        self.assertTrue({a.pk, b.pk} <= ids)


class TakeAndReturnTests(QueueTestBase):
    def test_take_race_second_realtor_gets_409(self):
        lead = self._free_lead()
        first = self.c1.post(f"/api/crm/leads/{lead.pk}/take/")
        second = self.c2.post(f"/api/crm/leads/{lead.pk}/take/")
        self.assertEqual(first.status_code, 200, first.data)
        self.assertEqual(second.status_code, 409, second.data)
        self.assertEqual(second.data["detail"], "Заявку уже взял другой риэлтор.")
        lead.refresh_from_db()
        self.assertEqual(lead.assigned_realtor_id, self.r1.pk)
        self.assertTrue(
            LeadActionLog.objects.filter(
                lead=lead, user=self.r1, action_type=LeadActionType.TAKEN
            ).exists()
        )
        ids = {x["id"] for x in self._rows(self.c2.get("/api/crm/leads/").data)}
        self.assertNotIn(lead.pk, ids)

    def test_conditional_update_is_the_arbiter(self):
        """Even if two requests both passed the pre-check, only one UPDATE wins."""
        lead = self._free_lead()
        crm_notify.take_lead(lead.pk, self.r1)
        with self.assertRaises(crm_notify.AlreadyTaken):
            crm_notify.take_lead(lead.pk, self.r2)

    def test_superadmin_cannot_take(self):
        lead = self._free_lead()
        self.assertEqual(self.csa.post(f"/api/crm/leads/{lead.pk}/take/").status_code, 403)

    def test_return_to_queue_notifies_others_and_is_logged(self):
        lead = self._free_lead()
        crm_notify.take_lead(lead.pk, self.r1)
        r = self.c1.post(f"/api/crm/leads/{lead.pk}/return/")
        self.assertEqual(r.status_code, 200, r.data)
        lead.refresh_from_db()
        self.assertIsNone(lead.assigned_realtor_id)
        self.assertTrue(
            LeadActionLog.objects.filter(lead=lead, action_type=LeadActionType.RETURNED).exists()
        )
        recipients = set(
            CrmNotification.objects.filter(lead=lead).values_list("recipient_id", flat=True)
        )
        self.assertEqual(recipients, {self.r2.pk})

    def test_other_realtor_cannot_return(self):
        lead = self._free_lead(assigned_realtor=self.r2)
        # Not in r1's queryset at all.
        self.assertEqual(self.c1.post(f"/api/crm/leads/{lead.pk}/return/").status_code, 404)

    def test_property_lead_cannot_be_returned(self):
        lead = self._free_lead(property=self._property("q1"), assigned_realtor=self.r1)
        r = self.c1.post(f"/api/crm/leads/{lead.pk}/return/")
        self.assertEqual(r.status_code, 400, r.data)
        lead.refresh_from_db()
        self.assertEqual(lead.assigned_realtor_id, self.r1.pk)


class NotificationFanOutTests(QueueTestBase):
    def _post_public_lead(self):
        client = APIClient()
        r = client.get("/api/leads/captcha/")
        a, b = map(int, re.findall(r"\d+", r.data["question"]))
        body = {
            "client_name": "Иван Петров",
            "client_phone": "+79990001122",
            "client_message": "Хочу узнать подробности",
            "captcha_id": r.data["captcha_id"],
            "captcha_answer": str(a + b),
        }
        with mock.patch("leads.tasks.send_lead_telegram_notification.delay") as tg:
            with self.captureOnCommitCallbacks(execute=True):
                resp = client.post("/api/leads/", body, format="json")
        self.assertEqual(resp.status_code, 201, resp.data)
        return Lead.objects.get(pk=resp.data["id"]), tg

    def test_free_lead_notifies_every_active_realtor_with_view_clients(self):
        lead, tg = self._post_public_lead()
        tg.assert_called_once_with(lead.pk)  # the Telegram path is unchanged
        recipients = set(
            CrmNotification.objects.filter(lead=lead).values_list("recipient_id", flat=True)
        )
        self.assertEqual(recipients, {self.r1.pk, self.r2.pk})

    def test_assigned_lead_notifies_only_its_realtor(self):
        lead = self._free_lead(assigned_realtor=self.r2)
        crm_notify.notify_new_lead(lead)
        self.assertEqual(
            list(CrmNotification.objects.filter(lead=lead).values_list("recipient_id", flat=True)),
            [self.r2.pk],
        )

    def test_taking_clears_other_realtors_notifications(self):
        lead = self._free_lead()
        crm_notify.notify_new_lead(lead)
        self.assertEqual(CrmNotification.objects.filter(lead=lead).count(), 2)
        self.c1.post(f"/api/crm/leads/{lead.pk}/take/")
        self.assertEqual(
            list(CrmNotification.objects.filter(lead=lead).values_list("recipient_id", flat=True)),
            [self.r1.pk],
        )

    def test_staff_reassignment_notifies_new_realtor(self):
        lead = self._free_lead()
        crm_notify.notify_new_lead(lead)
        crm_notify.on_lead_owner_changed(lead, None, self.r2, by_self=False)
        rows = list(CrmNotification.objects.filter(lead=lead).values_list("recipient_id", "type"))
        self.assertIn((self.r2.pk, CrmNotificationType.ASSIGNED), rows)
        self.assertNotIn(self.r1.pk, [r for r, _ in rows])

    def test_superadmin_gets_nothing(self):
        lead = self._free_lead()
        crm_notify.notify_new_lead(lead)
        crm_notify.notify_assigned(self.superadmin, lead=lead)
        self.assertFalse(CrmNotification.objects.filter(recipient=self.superadmin).exists())
        counts = self.csa.get("/api/crm/notifications/unread-counts/").data
        self.assertEqual(counts["notifications"], 0)
        self.assertEqual(self.csa.get("/api/crm/notifications/").data["results"], [])


class BellApiTests(QueueTestBase):
    def test_24h_window_and_counts(self):
        lead = self._free_lead()
        crm_notify.notify_new_lead(lead)
        old_lead = self._free_lead(client_name="Старый")
        crm_notify.notify_new_lead(old_lead)
        CrmNotification.objects.filter(lead=old_lead).update(
            created_at=timezone.now() - timedelta(hours=25)
        )
        r = self.c1.get("/api/crm/notifications/")
        self.assertEqual([x["title"] for x in r.data["results"]], ["Свободный"])
        self.assertEqual(r.data["results"][0]["target"], {"kind": "lead", "id": lead.pk})
        counts = self.c1.get("/api/crm/notifications/unread-counts/").data
        self.assertEqual(counts["notifications"], 1)
        mine = CrmNotification.objects.get(lead=lead, recipient=self.r1)
        self.assertEqual(counts["latest_notification_id"], mine.pk)

    def test_mark_read_and_mark_all_read(self):
        a, b = self._free_lead(), self._free_lead(client_name="Второй")
        crm_notify.notify_new_lead(a)
        crm_notify.notify_new_lead(b)
        n = CrmNotification.objects.get(lead=a, recipient=self.r1)
        other = CrmNotification.objects.get(lead=a, recipient=self.r2)
        self.assertEqual(self.c1.post(f"/api/crm/notifications/{other.pk}/mark-read/").status_code, 404)
        self.assertEqual(self.c1.post(f"/api/crm/notifications/{n.pk}/mark-read/").status_code, 200)
        self.assertEqual(self.c1.get("/api/crm/notifications/unread-counts/").data["notifications"], 1)
        self.assertEqual(self.c1.post("/api/crm/notifications/mark-all-read/").data["marked"], 1)
        self.assertEqual(self.c1.get("/api/crm/notifications/unread-counts/").data["notifications"], 0)
        self.assertEqual(
            CrmNotification.objects.filter(recipient=self.r2, read_at__isnull=True).count(), 2
        )

    def test_opening_a_lead_marks_its_notifications_read(self):
        lead = self._free_lead()
        crm_notify.notify_new_lead(lead)
        self.c1.post(f"/api/crm/leads/{lead.pk}/mark-read/")
        self.assertIsNotNone(CrmNotification.objects.get(lead=lead, recipient=self.r1).read_at)
        self.assertIsNone(CrmNotification.objects.get(lead=lead, recipient=self.r2).read_at)

    def test_purge_deletes_only_older_than_seven_days(self):
        lead = self._free_lead()
        crm_notify.notify_new_lead(lead)
        CrmNotification.objects.filter(recipient=self.r1).update(
            created_at=timezone.now() - timedelta(days=8)
        )
        self.assertEqual(purge_old_crm_notifications(), 1)
        self.assertEqual(CrmNotification.objects.filter(lead=lead).count(), 1)
        self.assertTrue(Lead.objects.filter(pk=lead.pk).exists())


class SaleRequestQueueTests(QueueTestBase):
    def setUp(self):
        super().setUp()
        self.city = City.objects.create(name="Геленджик", slug="gel-q", region_name="КК")

    def _sr(self):
        return SaleRequest.objects.create(
            owner_name="Собственник",
            owner_phone="+79995554433",
            city=self.city,
            description="Продаю",
        )

    def test_free_visible_masked_then_taken_and_hidden_from_others(self):
        sr = self._sr()
        crm_notify.notify_new_sale_request(sr)
        row = self._rows(self.c1.get("/api/crm/sale-requests/").data)[0]
        self.assertTrue(row["is_free"])
        self.assertNotIn("5554433", row["owner_phone"])
        self.assertEqual(
            self.c1.patch(
                f"/api/crm/sale-requests/{sr.pk}/", {"description": "x"}, format="json"
            ).status_code,
            403,
        )
        self.assertEqual(self.c1.post(f"/api/crm/sale-requests/{sr.pk}/take/").status_code, 200)
        self.assertEqual(self.c2.post(f"/api/crm/sale-requests/{sr.pk}/take/").status_code, 409)
        self.assertEqual(
            self.c1.get(f"/api/crm/sale-requests/{sr.pk}/").data["owner_phone"], "+79995554433"
        )
        self.assertEqual(self._rows(self.c2.get("/api/crm/sale-requests/").data), [])
        self.assertEqual(
            list(
                CrmNotification.objects.filter(sale_request=sr).values_list("recipient_id", flat=True)
            ),
            [self.r1.pk],
        )

    def test_new_sale_request_notifies_all_active_realtors(self):
        sr = self._sr()
        crm_notify.notify_new_sale_request(sr)
        recipients = set(
            CrmNotification.objects.filter(sale_request=sr).values_list("recipient_id", flat=True)
        )
        # Sale requests need no view_clients capability; superadmin/inactive excluded.
        self.assertEqual(recipients, {self.r1.pk, self.r2.pk, self.r_noclients.pk})

    def test_converted_request_cannot_be_returned(self):
        sr = self._sr()
        crm_notify.take_sale_request(sr.pk, self.r1)
        SaleRequest.objects.filter(pk=sr.pk).update(
            converted_property=self._property("q2"), status=SaleRequestStatus.CONVERTED
        )
        self.assertEqual(self.c1.post(f"/api/crm/sale-requests/{sr.pk}/return/").status_code, 400)

    def test_staff_see_full_phone_and_cannot_take(self):
        sr = self._sr()
        row = self._rows(self.csa.get("/api/crm/sale-requests/").data)[0]
        self.assertEqual(row["owner_phone"], "+79995554433")
        self.assertEqual(self.csa.post(f"/api/crm/sale-requests/{sr.pk}/take/").status_code, 403)


class BulkActionsAndUnifiedReadTests(QueueTestBase):
    """Bulk mark-read / hide / unhide / delete, and one read state for bell + sidebar."""

    def _counts(self, client):
        return client.get("/api/crm/notifications/unread-counts/").data

    def test_bulk_mark_read_clears_receipts_and_bell(self):
        a, b = self._free_lead(), self._free_lead(client_name="Второй")
        crm_notify.notify_new_lead(a)
        crm_notify.notify_new_lead(b)
        before = self._counts(self.c1)
        self.assertEqual((before["inquiries"], before["notifications"]), (2, 2))
        r = self.c1.post("/api/crm/leads/bulk-mark-read/", {"ids": [a.pk, b.pk]}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        after = self._counts(self.c1)
        self.assertEqual((after["inquiries"], after["notifications"]), (0, 0))
        rows = self._rows(self.c1.get("/api/crm/leads/").data)
        self.assertFalse(any(x["is_unread"] for x in rows))
        # r2 is untouched: read state is personal.
        self.assertEqual(self._counts(self.c2)["inquiries"], 2)

    def test_bulk_is_all_or_nothing_on_a_forbidden_id(self):
        mine = self._free_lead()
        foreign = self._free_lead(client_name="Чужой", assigned_realtor=self.r2)
        r = self.c1.post("/api/crm/leads/bulk-mark-read/", {"ids": [mine.pk, foreign.pk]}, format="json")
        self.assertEqual(r.status_code, 403, r.data)
        self.assertEqual(self._counts(self.c1)["inquiries"], 1)  # nothing changed

    def test_mark_all_in_filter(self):
        self._free_lead()
        self._free_lead(client_name="Мой", assigned_realtor=self.r1)
        r = self.c1.post("/api/crm/leads/bulk-mark-read/?scope=free", {"all": True}, format="json")
        self.assertEqual(r.data["count"], 1)
        self.assertEqual(self._counts(self.c1)["inquiries"], 1)  # the own one is still unread

    def test_hide_archive_and_restore(self):
        lead = self._free_lead()
        crm_notify.notify_new_lead(lead)
        r = self.c1.post("/api/crm/leads/bulk-hide/", {"ids": [lead.pk]}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(self._rows(self.c1.get("/api/crm/leads/").data), [])
        self.assertEqual([x["id"] for x in self._rows(self.c1.get("/api/crm/leads/?scope=archive").data)], [lead.pk])
        self.assertEqual(self._counts(self.c1)["inquiries"], 0)
        # Still visible to the other realtor, and not deleted.
        self.assertEqual([x["id"] for x in self._rows(self.c2.get("/api/crm/leads/").data)], [lead.pk])
        r = self.c1.post("/api/crm/leads/bulk-unhide/", {"ids": [lead.pk]}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual([x["id"] for x in self._rows(self.c1.get("/api/crm/leads/").data)], [lead.pk])

    def test_cannot_hide_another_realtors_lead_and_staff_cannot_hide(self):
        foreign = self._free_lead(assigned_realtor=self.r2)
        self.assertEqual(
            self.c1.post("/api/crm/leads/bulk-hide/", {"ids": [foreign.pk]}, format="json").status_code, 403
        )
        self.assertEqual(
            self.csa.post("/api/crm/leads/bulk-hide/", {"ids": [foreign.pk]}, format="json").status_code, 403
        )

    def test_bulk_delete_staff_only_and_logged(self):
        from users.models import EmployeeActivityLog

        a, b = self._free_lead(), self._free_lead(client_name="Второй")
        self.assertEqual(
            self.c1.post("/api/crm/leads/bulk-delete/", {"ids": [a.pk]}, format="json").status_code, 403
        )
        r = self.csa.post("/api/crm/leads/bulk-delete/", {"ids": [a.pk, b.pk]}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertFalse(Lead.objects.filter(pk__in=[a.pk, b.pk]).exists())
        log = EmployeeActivityLog.objects.get(
            user=self.superadmin, action_type=EmployeeActivityLog.ActionType.BULK_DELETE_LEADS
        )
        self.assertIn(f"#{a.pk}", log.details)
        self.assertTrue(log.details.startswith("2 "))
        self.assertEqual(
            self.csa.post("/api/crm/leads/bulk-delete/", {"all": True}, format="json").status_code, 400
        )

    def test_bell_mark_all_read_also_clears_the_sidebar_count(self):
        lead = self._free_lead()
        crm_notify.notify_new_lead(lead)
        self.assertEqual(self._counts(self.c1)["inquiries"], 1)
        self.c1.post("/api/crm/notifications/mark-all-read/")
        c = self._counts(self.c1)
        self.assertEqual((c["inquiries"], c["notifications"]), (0, 0))

    def test_poll_endpoint_is_never_cached(self):
        r = self.c1.get("/api/crm/notifications/unread-counts/")
        self.assertIn("no-store", r["Cache-Control"])

    def test_sale_request_bulk_hide_and_mark_read(self):
        city = City.objects.create(name="Сочи", slug="sochi-q", region_name="КК")
        sr = SaleRequest.objects.create(owner_name="С", owner_phone="+79990000000", city=city, description="x")
        crm_notify.notify_new_sale_request(sr)
        self.assertEqual(self._counts(self.c1)["sale_requests"], 1)
        self.c1.post("/api/crm/sale-requests/bulk-mark-read/", {"ids": [sr.pk]}, format="json")
        c = self._counts(self.c1)
        self.assertEqual((c["sale_requests"], c["notifications"]), (0, 0))
        self.c1.post("/api/crm/sale-requests/bulk-hide/", {"ids": [sr.pk]}, format="json")
        self.assertEqual(self._rows(self.c1.get("/api/crm/sale-requests/").data), [])
        self.assertEqual(len(self._rows(self.c1.get("/api/crm/sale-requests/?scope=archive").data)), 1)


class ActivityLogSurvivesAccountDeletionTests(QueueTestBase):
    """EmployeeActivityLog.user is SET_NULL: audit rows outlive the account."""

    def test_bulk_delete_audit_survives_and_shows_deleted_user(self):
        from users.models import EmployeeActivityLog

        admin = _make_user("adm-audit@test.local", User.Role.ADMIN)
        ca = APIClient()
        ca.force_authenticate(admin)
        lead = self._free_lead()
        self.assertEqual(
            ca.post("/api/crm/leads/bulk-delete/", {"ids": [lead.pk]}, format="json").status_code, 200
        )
        log = EmployeeActivityLog.objects.get(
            action_type=EmployeeActivityLog.ActionType.BULK_DELETE_LEADS
        )
        admin.delete()
        log.refresh_from_db()  # still there
        self.assertIsNone(log.user_id)
        self.assertIn(f"#{lead.pk}", log.details)
        rows = self.csa.get("/api/crm/activity-logs/").data
        rows = rows if isinstance(rows, list) else rows.get("results", [])
        row = next(r for r in rows if r["id"] == log.pk)
        self.assertEqual(row["user_display_name"], "удалённый пользователь")
        self.assertEqual(row["user_email"], "")
        self.assertIsNone(row["user"])

    def test_failed_login_by_unknown_email_still_shows_the_typed_address(self):
        from users.models import EmployeeActivityLog

        EmployeeActivityLog.objects.create(
            user=None, action_type=EmployeeActivityLog.ActionType.LOGIN_FAILED,
            attempted_email="nobody@example.invalid", reason="bad_credentials",
        )
        rows = self.csa.get("/api/crm/activity-logs/").data
        rows = rows if isinstance(rows, list) else rows.get("results", [])
        row = next(r for r in rows if r["user_email"] == "nobody@example.invalid")
        self.assertEqual(row["user_display_name"], "nobody@example.invalid")
