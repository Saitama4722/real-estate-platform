import re
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient

from agencies.models import Agency
from leads.choices import LeadSource, LeadStatus
from leads.models import Lead, LeadStatusHistory
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
        self.published = Property.objects.create(
            property_type=PropertyType.APARTMENT,
            price=Decimal("100.00"),
            agency=self.agency,
            assigned_realtor=self.realtor,
            status=PropertyStatus.PUBLISHED,
            is_published=True,
        )
        # Объект без ответственного в БД не создаётся через save() модели Property;
        # для проверки ветки публичного лида обнуляем FK отдельным update (редкий / legacy-случай).
        self.published_no_realtor = Property.objects.create(
            property_type=PropertyType.APARTMENT,
            price=Decimal("200.00"),
            assigned_realtor=self.realtor,
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
                "client_message": "",
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
                "client_message": "",
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

    def test_create_missing_client_name_returns_400(self):
        captcha_id, q = self._fetch_captcha()
        a, b = self._parse_sum(q)
        r = self.client.post(
            "/api/leads/",
            {
                "client_name": "   ",
                "client_phone": "+79991234567",
                "captcha_id": captcha_id,
                "captcha_answer": str(a + b),
            },
            format="json",
        )
        self.assertEqual(r.status_code, 400)
        self.assertIn("client_name", r.data)

    def test_create_short_phone_returns_400(self):
        captcha_id, q = self._fetch_captcha()
        a, b = self._parse_sum(q)
        r = self.client.post(
            "/api/leads/",
            {
                "client_name": "Иван",
                "client_phone": "123",
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
