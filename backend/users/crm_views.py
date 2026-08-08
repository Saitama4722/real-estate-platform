"""
CRM API: управление риэлторами (только admin / superadmin).
"""
from django.db.models import F
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .activity import record_employee_activity
from .models import EmployeeActivityLog, User
from .permissions import IsCrmStaffManager, IsSuperAdmin
from .serializers import (
    RealtorCrmReadSerializer,
    RealtorCrmWriteSerializer,
    SetEmployeePasswordSerializer,
)


class CrmRealtorViewSet(viewsets.ModelViewSet):
    """
    CRUD по пользователям с ролью «Риэлтор»: список, создание, правка, удаление.
    Отключение: PATCH/PUT с is_active=false.
    """

    permission_classes = [IsAuthenticated, IsCrmStaffManager]
    queryset = User.objects.filter(role=User.Role.REALTOR).order_by("crm_id", "id")
    http_method_names = ["get", "post", "put", "patch", "delete", "head", "options"]

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return RealtorCrmWriteSerializer
        return RealtorCrmReadSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        read = RealtorCrmReadSerializer(
            serializer.instance, context=self.get_serializer_context()
        )
        headers = self.get_success_headers(read.data)
        return Response(read.data, status=status.HTTP_201_CREATED, headers=headers)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        read = RealtorCrmReadSerializer(
            serializer.instance, context=self.get_serializer_context()
        )
        return Response(read.data)

    @action(
        detail=True,
        methods=["post"],
        url_path="set-password",
        # ⚠ IsSuperAdmin, NOT the view's IsCrmStaffManager: that one also admits
        # role=admin. Setting someone's password is a superadmin-only act, and a
        # realtor can never reach this view at all (queryset + permissions).
        permission_classes=[IsAuthenticated, IsSuperAdmin],
    )
    def set_password(self, request, pk=None):
        """
        POST /api/crm/realtors/<pk>/set-password/  {"password": "..."}

        Суперадмин задаёт сотруднику новый пароль. Пароль проверяется
        валидаторами Django, нигде не логируется и не возвращается.
        Все ранее выданные токены сотрудника становятся недействительными
        немедленно (инкремент token_version).
        """
        target = self.get_object()
        serializer = SetEmployeePasswordSerializer(
            data=request.data,
            context={**self.get_serializer_context(), "target_user": target},
        )
        serializer.is_valid(raise_exception=True)

        target.set_password(serializer.validated_data["password"])
        # F() so the bump cannot lose a concurrent increment.
        target.token_version = F("token_version") + 1
        # A password the admin knows is a temporary credential: the employee
        # must replace it at next sign-in, after which the log can attribute
        # actions to them rather than to the admin acting as them.
        target.must_change_password = True
        # A fresh password also clears any lockout — the old one is gone, so
        # counting failures against it is meaningless.
        target.failed_login_count = 0
        target.locked_until = None
        target.save(
            update_fields=[
                "password",
                "token_version",
                "must_change_password",
                "failed_login_count",
                "locked_until",
            ]
        )
        target.refresh_from_db(fields=["token_version"])

        record_employee_activity(
            request,
            request.user,
            EmployeeActivityLog.ActionType.PASSWORD_RESET,
            target_user=target,
        )
        # Body carries no password and no token — only confirmation.
        return Response(
            {
                "detail": (
                    "Пароль обновлён. Прежние сессии сотрудника завершены; "
                    "при входе он должен задать свой пароль."
                )
            },
            status=status.HTTP_200_OK,
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="terminate-sessions",
        permission_classes=[IsAuthenticated, IsSuperAdmin],
    )
    def terminate_sessions(self, request, pk=None):
        """
        POST /api/crm/realtors/<pk>/terminate-sessions/

        «Завершить все сессии» — для потерянного ноутбука или ушедшего
        сотрудника. Отдельно от сброса пароля: пароль НЕ меняется, сотрудник
        просто входит заново теми же данными.

        Механизм тот же самый token_version, второго не заводим.
        """
        target = self.get_object()
        target.token_version = F("token_version") + 1
        target.save(update_fields=["token_version"])
        target.refresh_from_db(fields=["token_version"])
        record_employee_activity(
            request,
            request.user,
            EmployeeActivityLog.ActionType.SESSIONS_TERMINATED,
            target_user=target,
        )
        return Response(
            {"detail": "Все сессии сотрудника завершены."},
            status=status.HTTP_200_OK,
        )

    @action(
        detail=True,
        methods=["post"],
        permission_classes=[IsAuthenticated, IsSuperAdmin],
    )
    def unlock(self, request, pk=None):
        """
        POST /api/crm/realtors/<pk>/unlock/

        Снять блокировку немедленно, не дожидаясь окончания остывания.
        """
        target = self.get_object()
        User.objects.filter(pk=target.pk).update(
            failed_login_count=0, locked_until=None
        )
        record_employee_activity(
            request,
            request.user,
            EmployeeActivityLog.ActionType.UNLOCK,
            target_user=target,
        )
        return Response(
            {"detail": "Блокировка снята."}, status=status.HTTP_200_OK
        )
