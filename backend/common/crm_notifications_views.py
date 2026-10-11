"""
Лёгкая ручка счётчиков непрочитанного для шапки и бокового меню CRM.

Её опрашивают каждые 30 секунд, поэтому она обязана оставаться ДЕШЁВОЙ:
два `COUNT(*)` с подзапросом `NOT EXISTS` и никаких данных самих заявок. Не
добавляйте сюда последние заявки, превью или что-либо ещё, что заставит
загружать строки, — для этого есть списочные ручки.
"""
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from common.crm_unread import unread_counts_for_user


class CrmUnreadCountsView(APIView):
    """
    GET /api/crm/notifications/unread-counts/
    → {"inquiries": 2, "sale_requests": 1, "total": 3}

    ⚠ Намеренно `IsAuthenticated`, а НЕ `IsCrmUser`: для суперадмина и
    администратора ручка возвращает нули (см. `common.crm_unread`), и это
    честный ответ, а не отказ. Опрос из шапки не должен получать 403 просто
    потому, что вошёл не риэлтор — фронтенд обязан молча получить нули и не
    рисовать бейдж.
    """

    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "head", "options"]

    def get(self, request):
        return Response(unread_counts_for_user(request.user))
