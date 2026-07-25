import re
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient

from agencies.models import Agency
from leads.choices import LeadActionType, LeadSource, LeadStatus
from leads.models import Lead, LeadActionLog, LeadPhoneRevealLog, LeadStatusHistory
from locations.models import City, District
from properties.choices import PropertyStatus, PropertyType
from properties.models import Property

User = get_user_model()


class PublicLeadCaptchaAndCreateTests(TestCase):
    """Публичное создание лида с капчей (этап: обращения с сайта)."""

    def setUp(self):
        self.client = APIClient()
        cache.clear()
        self.realtor = User.objects.create_user(
            email="rel-lead-pub@test.local",
            password="pw",
            first_name="R",
            last_name="Ealtor",
            role=User.Role.REALTOR,
        )
        self.agency = Agency.objects.create(name="Lead Test Agency")
        # city/district обязательны на модели Property (миграция 0023), поэтому
        # создаём минимальную географию для фикстур объектов.
        self.city = City.objects.create(
            name="Краснодар",
            slug="krasnodar",
            region_name="Краснодарский край",
        )
        self.district = District.objects.create(
            city=self.city,
            name="Центральный",
            slug="centralnyy",
        )
        self.published = Property.objects.create(
            property_type=PropertyType.APARTMENT,
            price=Decimal("100.00"),
            agency=self.agency,
            assigned_realtor=self.realtor,
            city=self.city,
            district=self.district,
            status=PropertyStatus.PUBLISHED,
            is_published=True,
        )
        # Объект без ответственного в БД не создаётся через save() модели Property;
        # для проверки ветки публичного лида обнуляем FK отдельным update (редкий / legacy-случай).
        self.published_no_realtor = Property.objects.create(
            property_type=PropertyType.APARTMENT,
            price=Decimal("200.00"),
            assigned_realtor=self.realtor,
            city=self.city,
            district=self.district,
            status=PropertyStatus.PUBLISHED,
            is_published=True,
        )
        Property.objects.filter(pk=self.published_no_realtor.pk).update(
            assigned_realtor_id=None
        )

    def _fetch_captcha(self):
        r = self.client.get("/api/leads/captcha/")
        self.assertEqual(r.status_code, 200, r.data)
        return r.data["captcha_id"], r.data["question"]

    def test_captcha_endpoint_returns_question_and_id(self):
        cid, question = self._fetch_captcha()
        self.assertTrue(cid)
        self.assertIn("+", question)

    def test_create_without_captcha_fields_returns_400(self):
        r = self.client.post(
            "/api/leads/",
            {
                "client_name": "Иван",
                "client_phone": "+79991234567",
                "client_message": "",
            },
            format="json",
        )
        self.assertEqual(r.status_code, 400)

    def test_create_with_wrong_captcha_answer_returns_400(self):
        captcha_id, _ = self._fetch_captcha()
        r = self.client.post(
            "/api/leads/",
            {
                "client_name": "Иван",
                "client_phone": "+79991234567",
                "client_message": "Вопрос",
                "captcha_id": captcha_id,
                "captcha_answer": "99999",
            },
            format="json",
        )
        self.assertEqual(r.status_code, 400)
        self.assertIn("captcha_answer", r.data)

    def test_create_general_inquiry_succeeds(self):
        captcha_id, q = self._fetch_captcha()
        a, b = self._parse_sum(q)
        r = self.client.post(
            "/api/leads/",
            {
                "client_name": "Иван",
                "client_phone": "+79991234567",
                "client_message": "Общий вопрос",
                "captcha_id": captcha_id,
                "captcha_answer": str(a + b),
            },
            format="json",
        )
        self.assertEqual(r.status_code, 201, r.data)
        lead = Lead.objects.order_by("-pk").first()
        self.assertIsNotNone(lead)
        assert lead is not None
        self.assertIsNone(lead.property_id)
        self.assertIsNone(lead.agency_id)
        self.assertIsNone(lead.assigned_realtor_id)
        self.assertEqual(lead.source, LeadSource.WEBSITE)
        self.assertEqual(lead.status, LeadStatus.NEW)
        self.assertEqual(lead.client_name, "Иван")
        self.assertEqual(lead.client_message, "Общий вопрос")
        self.assertEqual(LeadStatusHistory.objects.filter(lead=lead).count(), 1)

    def test_create_property_linked_inquiry_succeeds(self):
        captcha_id, q = self._fetch_captcha()
        a, b = self._parse_sum(q)
        r = self.client.post(
            "/api/leads/",
            {
                "property": self.published.pk,
                "client_name": "Пётр",
                "client_phone": "+79997654321",
                "client_message": "Интересует этот объект",
                "captcha_id": captcha_id,
                "captcha_answer": str(a + b),
            },
            format="json",
        )
        self.assertEqual(r.status_code, 201, r.data)
        lead = Lead.objects.order_by("-pk").first()
        self.assertIsNotNone(lead)
        assert lead is not None
        self.assertEqual(lead.property_id, self.published.pk)
        self.assertEqual(lead.agency_id, self.agency.pk)
        self.assertEqual(lead.assigned_realtor_id, self.realtor.pk)

    def test_create_property_linked_without_assigned_realtor(self):
        captcha_id, q = self._fetch_captcha()
        a, b = self._parse_sum(q)
        r = self.client.post(
            "/api/leads/",
            {
                "property": self.published_no_realtor.pk,
                "client_name": "Мария",
                "client_phone": "+79995551122",
                "client_message": "Хочу узнать подробности",
                "captcha_id": captcha_id,
                "captcha_answer": str(a + b),
            },
            format="json",
        )
        self.assertEqual(r.status_code, 201, r.data)
        lead = Lead.objects.order_by("-pk").first()
        self.assertIsNotNone(lead)
        assert lead is not None
        self.assertEqual(lead.property_id, self.published_no_realtor.pk)
        self.assertIsNone(lead.assigned_realtor_id)

    def test_create_without_message_returns_400(self):
        captcha_id, q = self._fetch_captcha()
        a, b = self._parse_sum(q)
        r = self.client.post(
            "/api/leads/",
            {
                "client_name": "Иван",
                "client_phone": "+79991234567",
                "client_message": "",
                "captcha_id": captcha_id,
                "captcha_answer": str(a + b),
            },
            format="json",
        )
        self.assertEqual(r.status_code, 400)
        self.assertIn("client_message", r.data)

    def test_create_with_message_over_300_chars_returns_400(self):
        captcha_id, q = self._fetch_captcha()
        a, b = self._parse_sum(q)
        r = self.client.post(
            "/api/leads/",
            {
                "client_name": "Иван",
                "client_phone": "+79991234567",
                "client_message": "я" * 301,
                "captcha_id": captcha_id,
                "captcha_answer": str(a + b),
            },
            format="json",
        )
        self.assertEqual(r.status_code, 400)
        self.assertIn("client_message", r.data)

    def test_create_with_message_exactly_300_chars_succeeds(self):
        captcha_id, q = self._fetch_captcha()
        a, b = self._parse_sum(q)
        message = "я" * 300
        r = self.client.post(
            "/api/leads/",
            {
                "client_name": "Иван",
                "client_phone": "+79991234567",
                "client_message": message,
                "captcha_id": captcha_id,
                "captcha_answer": str(a + b),
            },
            format="json",
        )
        self.assertEqual(r.status_code, 201, r.data)
        lead = Lead.objects.order_by("-pk").first()
        self.assertIsNotNone(lead)
        assert lead is not None
        self.assertEqual(lead.client_message, message)

    def test_create_missing_client_name_returns_400(self):
        captcha_id, q = self._fetch_captcha()
        a, b = self._parse_sum(q)
        r = self.client.post(
            "/api/leads/",
            {
                "client_name": "   ",
                "client_phone": "+79991234567",
                "client_message": "Вопрос",
                "captcha_id": captcha_id,
                "captcha_answer": str(a + b),
            },
            format="json",
        )
        self.assertEqual(r.status_code, 400)
        self.assertIn("client_name", r.data)

    def test_create_with_name_containing_digits_returns_400(self):
        captcha_id, q = self._fetch_captcha()
        a, b = self._parse_sum(q)
        r = self.client.post(
            "/api/leads/",
            {
                "client_name": "Иван123",
                "client_phone": "+79991234567",
                "client_message": "Вопрос",
                "captcha_id": captcha_id,
                "captcha_answer": str(a + b),
            },
            format="json",
        )
        self.assertEqual(r.status_code, 400)
        self.assertIn("client_name", r.data)

    def test_create_with_name_containing_hyphen_returns_400(self):
        captcha_id, q = self._fetch_captcha()
        a, b = self._parse_sum(q)
        r = self.client.post(
            "/api/leads/",
            {
                "client_name": "Анна-Мария",
                "client_phone": "+79991234567",
                "client_message": "Вопрос",
                "captcha_id": captcha_id,
                "captcha_answer": str(a + b),
            },
            format="json",
        )
        self.assertEqual(r.status_code, 400)
        self.assertIn("client_name", r.data)

    def test_create_with_name_with_space_succeeds(self):
        captcha_id, q = self._fetch_captcha()
        a, b = self._parse_sum(q)
        r = self.client.post(
            "/api/leads/",
            {
                "client_name": "Мария Ивановна",
                "client_phone": "+79991234567",
                "client_message": "Вопрос",
                "captcha_id": captcha_id,
                "captcha_answer": str(a + b),
            },
            format="json",
        )
        self.assertEqual(r.status_code, 201, r.data)
        lead = Lead.objects.order_by("-pk").first()
        self.assertIsNotNone(lead)
        assert lead is not None
        self.assertEqual(lead.client_name, "Мария Ивановна")

    def test_create_with_formatted_phone_succeeds(self):
        # Телефон в новом формате маски «+7 (XXX) XXX-XX-XX»: скобки/пробелы/
        # дефисы должны корректно отбрасываться существующей проверкой цифр.
        captcha_id, q = self._fetch_captcha()
        a, b = self._parse_sum(q)
        r = self.client.post(
            "/api/leads/",
            {
                "client_name": "Иван",
                "client_phone": "+7 (958) 206-88-16",
                "client_message": "Вопрос",
                "captcha_id": captcha_id,
                "captcha_answer": str(a + b),
            },
            format="json",
        )
        self.assertEqual(r.status_code, 201, r.data)
        lead = Lead.objects.order_by("-pk").first()
        self.assertIsNotNone(lead)
        assert lead is not None
        self.assertEqual(lead.client_phone, "+7 (958) 206-88-16")

    def test_create_short_phone_returns_400(self):
        captcha_id, q = self._fetch_captcha()
        a, b = self._parse_sum(q)
        r = self.client.post(
            "/api/leads/",
            {
                "client_name": "Иван",
                "client_phone": "123",
                "client_message": "Вопрос",
                "captcha_id": captcha_id,
                "captcha_answer": str(a + b),
            },
            format="json",
        )
        self.assertEqual(r.status_code, 400)
        self.assertIn("client_phone", r.data)

    def test_captcha_single_use(self):
        captcha_id, q = self._fetch_captcha()
        ans = str(sum(self._parse_sum(q)))
        r1 = self.client.post(
            "/api/leads/",
            {
                "client_name": "A",
                "client_phone": "+79991112233",
                "client_message": "Вопрос",
                "captcha_id": captcha_id,
                "captcha_answer": ans,
            },
            format="json",
        )
        self.assertEqual(r1.status_code, 201, r1.data)
        r2 = self.client.post(
            "/api/leads/",
            {
                "client_name": "B",
                "client_phone": "+79991112244",
                "client_message": "Вопрос",
                "captcha_id": captcha_id,
                "captcha_answer": ans,
            },
            format="json",
        )
        self.assertEqual(r2.status_code, 400)

    @staticmethod
    def _parse_sum(question: str) -> tuple[int, int]:
        """Парсит строку вида 'Сколько будет 3 + 7?'."""
        m = re.search(r"(\d+)\s*\+\s*(\d+)", question)
        assert m is not None
        return int(m.group(1)), int(m.group(2))


class CrmLeadInquiryWorkflowTests(TestCase):
    """CRM: маскирование телефона, PATCH статуса, раскрытие номера, доступ по назначению."""

    def setUp(self):
        self.client = APIClient()
        self.realtor = User.objects.create_user(
            email="rel-inq@test.local",
            password="pw",
            first_name="R",
            last_name="Ealtor",
            role=User.Role.REALTOR,
        )
        User.objects.filter(pk=self.realtor.pk).update(
            perm_view_clients=True,
            perm_change_status=True,
        )
        self.realtor.refresh_from_db()
        self.lead = Lead.objects.create(
            client_name="Иван",
            client_phone="+79991234567",
            client_message="Вопрос по квартире",
            assigned_realtor=self.realtor,
        )

    def _rows(self, data):
        if isinstance(data, list):
            return data
        return data.get("results", [])

    def test_list_masks_phone(self):
        self.client.force_authenticate(user=self.realtor)
        r = self.client.get("/api/crm/leads/")
        self.assertEqual(r.status_code, 200, r.data)
        rows = self._rows(r.data)
        self.assertEqual(len(rows), 1)
        self.assertNotIn("79991234567", rows[0]["client_phone"])

    def test_patch_status_updates_lead(self):
        self.client.force_authenticate(user=self.realtor)
        r = self.client.patch(
            f"/api/crm/leads/{self.lead.pk}/",
            {"status": LeadStatus.IN_PROGRESS},
            format="json",
        )
        self.assertEqual(r.status_code, 200, r.data)
        self.lead.refresh_from_db()
        self.assertEqual(self.lead.status, LeadStatus.IN_PROGRESS)
        logs = LeadActionLog.objects.filter(lead=self.lead)
        self.assertEqual(logs.count(), 1)
        self.assertEqual(logs[0].action_type, LeadActionType.STATUS_CHANGED)
        self.assertIn("Статус изменён", logs[0].description)

    def test_reveal_phone_returns_full_and_writes_log(self):
        self.client.force_authenticate(user=self.realtor)
        r = self.client.post(f"/api/crm/leads/{self.lead.pk}/reveal_phone/")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data.get("phone"), "+79991234567")
        self.assertEqual(
            LeadPhoneRevealLog.objects.filter(lead=self.lead).count(),
            1,
        )
        log = LeadPhoneRevealLog.objects.get(lead=self.lead)
        self.assertEqual(log.revealed_by_id, self.realtor.pk)
        al = LeadActionLog.objects.filter(lead=self.lead, action_type=LeadActionType.PHONE_REVEALED)
        self.assertEqual(al.count(), 1)
        self.assertEqual(al[0].description, "Риэлтор открыл телефон")

    def test_notes_get_post_and_history(self):
        self.client.force_authenticate(user=self.realtor)
        r0 = self.client.get(f"/api/crm/leads/{self.lead.pk}/notes/")
        self.assertEqual(r0.status_code, 200, r0.data)
        self.assertEqual(r0.data, [])
        r1 = self.client.post(
            f"/api/crm/leads/{self.lead.pk}/notes/",
            {"text": "  Первый комментарий  "},
            format="json",
        )
        self.assertEqual(r1.status_code, 201, r1.data)
        self.assertEqual(r1.data["text"], "Первый комментарий")
        self.assertEqual(r1.data["author"]["id"], self.realtor.pk)
        r2 = self.client.get(f"/api/crm/leads/{self.lead.pk}/notes/")
        self.assertEqual(r2.status_code, 200)
        self.assertEqual(len(r2.data), 1)
        rh = self.client.get(f"/api/crm/leads/{self.lead.pk}/history/")
        self.assertEqual(rh.status_code, 200)
        types = [row["action_type"] for row in rh.data]
        self.assertIn(LeadActionType.NOTE_ADDED, types)
        note_rows = [row for row in rh.data if row["action_type"] == LeadActionType.NOTE_ADDED]
        self.assertEqual(note_rows[0]["description"], "Добавлена внутренняя заметка")

    def test_realtor_sees_only_assigned_leads(self):
        unassigned = Lead.objects.create(
            client_name="Без ответственного",
            client_phone="+79990000000",
        )
        self.client.force_authenticate(user=self.realtor)
        r = self.client.get("/api/crm/leads/")
        self.assertEqual(r.status_code, 200)
        ids = {row["id"] for row in self._rows(r.data)}
        self.assertIn(self.lead.pk, ids)
        self.assertNotIn(unassigned.pk, ids)

    def test_notes_on_foreign_lead_returns_404(self):
        other = Lead.objects.create(
            client_name="Чужой",
            client_phone="+79991112233",
        )
        self.client.force_authenticate(user=self.realtor)
        r = self.client.get(f"/api/crm/leads/{other.pk}/notes/")
        self.assertEqual(r.status_code, 404)
