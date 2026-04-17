"""
Auth views: login (JWT pair), refresh, current user.
"""
from rest_framework import generics, status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .activity import record_employee_activity
from .models import EmployeeActivityLog
from .permissions import IsCrmStaffManager, IsCrmUser
from .serializers import (
    CurrentUserSerializer,
    CurrentUserUpdateSerializer,
    EmailTokenObtainPairSerializer,
    EmployeeActivityLogSerializer,
)


class LoginView(TokenObtainPairView):
    """
    POST /api/auth/login/
    Body: {"email": "...", "password": "..."}
    Returns: {"access": "...", "refresh": "..."}
    Only active users can log in.
    """
    serializer_class = EmailTokenObtainPairSerializer
    permission_classes = [AllowAny]


class RefreshView(TokenRefreshView):
    """
    POST /api/auth/refresh/
    Body: {"refresh": "..."}
    Returns: {"access": "..."}
    """
    permission_classes = [AllowAny]


class LogoutView(APIView):
    """
    POST /api/auth/logout/
    Фиксирует выход сотрудника в журнале. Токены по-прежнему сбрасываются на клиенте.
    """

    permission_classes = [IsCrmUser]
    http_method_names = ["post", "head", "options"]

    def post(self, request, *args, **kwargs):
        record_employee_activity(
            request,
            request.user,
            EmployeeActivityLog.ActionType.LOGOUT,
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class CrmEmployeeActivityLogListView(generics.ListAPIView):
    """
    GET /api/crm/activity-logs/
    Журнал входов/выходов — только superadmin / admin.
    Query: action_type=login|logout, user=<id>
    """

    permission_classes = [IsAuthenticated, IsCrmStaffManager]
    serializer_class = EmployeeActivityLogSerializer

    def get_queryset(self):
        qs = EmployeeActivityLog.objects.select_related("user").order_by("-created_at")
        action_type = self.request.query_params.get("action_type")
        valid_actions = {c.value for c in EmployeeActivityLog.ActionType}
        if action_type in valid_actions:
            qs = qs.filter(action_type=action_type)
        user_id = self.request.query_params.get("user")
        if user_id is not None and str(user_id).isdigit():
            qs = qs.filter(user_id=int(user_id))
        return qs


class CurrentUserView(generics.RetrieveUpdateAPIView):
    """
    GET/PATCH /api/auth/me/
    Возвращает или обновляет текущего пользователя CRM. Только свои поля профиля.
    """
    permission_classes = [IsCrmUser]
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    http_method_names = ["get", "patch", "head", "options"]

    def get_object(self):
        return self.request.user

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return CurrentUserUpdateSerializer
        return CurrentUserSerializer

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response(
            CurrentUserSerializer(instance, context=self.get_serializer_context()).data
        )
