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
from .permissions import IsCrmStaffManager, IsCrmUser, IsSuperAdmin
from .throttles import LoginThrottle, ThrottledRu
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db.models import F
from django.utils import timezone

User = get_user_model()

from .serializers import (
    ChangeOwnEmailSerializer,
    ChangeOwnPasswordSerializer,
    CurrentUserSerializer,
    CurrentUserUpdateSerializer,
    EmailTokenObtainPairSerializer,
    EmployeeActivityLogSerializer,
    VersionedTokenRefreshSerializer,
)


class LoginView(TokenObtainPairView):
    """
    POST /api/auth/login/
    Body: {"email": "...", "password": "..."}
    Returns: {"access": "...", "refresh": "..."}
    Only active users can log in.

    Rate limited by LoginThrottle. Nothing else about the flow changes: the
    credential check, the token pair and the 401 body are simplejwt's.

    ⚠ The 401 for a wrong password and for a disabled account is deliberately
    IDENTICAL (simplejwt's "no active account"). Do not split them — the login
    form would become an account-enumeration oracle. The frontend maps the
    single 401 to one message and reserves a distinct one for this 429.
    """
    serializer_class = EmailTokenObtainPairSerializer
    permission_classes = [AllowAny]
    throttle_classes = [LoginThrottle]

    def throttled(self, request, wait):
        # DRF sets Retry-After from `wait`; the frontend reads it to render the
        # countdown in the «Слишком много попыток» banner.
        raise ThrottledRu(
            wait=wait,
            detail="Слишком много попыток входа. Попробуйте позже.",
        )


class RefreshView(TokenRefreshView):
    """
    POST /api/auth/refresh/
    Body: {"refresh": "..."}
    Returns: {"access": "..."}

    Uses VersionedTokenRefreshSerializer so a refresh token from before a
    password reset fails here instead of minting an access token that the
    authentication layer would reject a moment later.
    """
    permission_classes = [AllowAny]
    serializer_class = VersionedTokenRefreshSerializer


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


class SecuritySummaryView(APIView):
    """
    GET /api/auth/security-summary/ — суперадмину.

    Три числа за последние 24 часа плюс список заблокированных. Это НЕ система
    мониторинга: ни порогов, ни истории, ни графиков, ни писем. Смысл в том,
    что при 50 риэлторах листать журнал по дате бессмысленно, а агрегат не
    растёт вместе со штатом: обычное состояние — нули, и любое ненулевое число
    само по себе является сигналом.
    """

    permission_classes = [IsCrmUser, IsSuperAdmin]
    http_method_names = ["get", "head", "options"]

    def get(self, request, *args, **kwargs):
        since = timezone.now() - timedelta(hours=24)
        failures = EmployeeActivityLog.objects.filter(
            action_type=EmployeeActivityLog.ActionType.LOGIN_FAILED,
            created_at__gte=since,
        )
        # Distinct targets counts identified accounts and unknown addresses
        # alike — a spray across invented emails must not read as "0 accounts".
        distinct_accounts = (
            failures.values("user_id", "attempted_email").distinct().count()
        )
        locked = User.objects.filter(locked_until__gt=timezone.now()).order_by(
            "crm_id", "id"
        )
        return Response(
            {
                "window_hours": 24,
                "failed_attempts": failures.count(),
                "accounts_targeted": distinct_accounts,
                "locked": [
                    {
                        "id": u.pk,
                        "crm_id": u.crm_id,
                        "email": u.email,
                        "locked_until": u.locked_until,
                        "failed_login_count": u.failed_login_count,
                    }
                    for u in locked
                ],
            }
        )


class ChangeOwnPasswordView(APIView):
    """
    POST /api/auth/password/change/  {"current_password": "...", "new_password": "..."}

    Смена собственного пароля, в том числе принудительная после сброса
    суперадмином. Успех снимает `must_change_password` и поднимает
    token_version: сессия, созданная выданным админом паролем, умирает, и с
    этого момента журнал однозначно относит действия к сотруднику, а не к
    админу под его именем. Клиент получает новую пару токенов, чтобы человека
    не выбрасывало на форму входа сразу после смены.
    """

    permission_classes = [IsCrmUser]
    http_method_names = ["post", "head", "options"]

    def post(self, request, *args, **kwargs):
        serializer = ChangeOwnPasswordSerializer(
            data=request.data, context={"user": request.user}
        )
        serializer.is_valid(raise_exception=True)

        user = request.user
        user.set_password(serializer.validated_data["new_password"])
        user.must_change_password = False
        user.token_version = F("token_version") + 1
        user.failed_login_count = 0
        user.locked_until = None
        user.save(
            update_fields=[
                "password",
                "must_change_password",
                "token_version",
                "failed_login_count",
                "locked_until",
            ]
        )
        user.refresh_from_db(fields=["token_version"])

        record_employee_activity(
            request, user, EmployeeActivityLog.ActionType.PASSWORD_RESET
        )

        # Fresh pair carrying the new token_version — without this the client's
        # tokens are already stale and the very next request would 401.
        refresh = EmailTokenObtainPairSerializer.get_token(user)
        return Response(
            {
                "detail": "Пароль изменён.",
                "access": str(refresh.access_token),
                "refresh": str(refresh),
            }
        )


class ChangeOwnEmailView(APIView):
    """
    POST /api/auth/me/email/  {"email": "...", "current_password": "..."}

    Смена собственного логина. Email — это учётные данные, поэтому подтверждаем
    текущим паролем: иначе любой, кто подошёл к незаблокированному компьютеру,
    забирает аккаунт в один клик, и владелец об этом не узнает.

    Токены НЕ отзываются: пользователь меняет адрес сам и остаётся собой — в
    отличие от сброса пароля суперадмином, где смысл как раз в разрыве сессий.
    """

    permission_classes = [IsCrmUser]
    http_method_names = ["post", "head", "options"]

    def post(self, request, *args, **kwargs):
        serializer = ChangeOwnEmailSerializer(
            data=request.data, context={"user": request.user}
        )
        serializer.is_valid(raise_exception=True)

        user = request.user
        new_email = serializer.validated_data["email"]
        if new_email != user.email:
            user.email = new_email
            user.save(update_fields=["email"])
            record_employee_activity(
                request,
                user,
                EmployeeActivityLog.ActionType.EMAIL_CHANGE,
            )
        return Response(
            CurrentUserSerializer(user, context={"request": request}).data
        )
