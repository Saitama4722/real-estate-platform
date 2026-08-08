"""Запись событий активности сотрудника (вход / выход)."""

from django.http import HttpRequest

from .models import EmployeeActivityLog, User


def client_ip_from_request(request: HttpRequest | None) -> str | None:
    if not request:
        return None
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    if xff:
        return xff.split(",")[0].strip() or None
    return request.META.get("REMOTE_ADDR") or None


def user_agent_from_request(request: HttpRequest | None) -> str:
    if not request:
        return ""
    return (request.META.get("HTTP_USER_AGENT") or "")[:2048]


def record_employee_activity(
    request: HttpRequest | None,
    user: User,
    action_type: EmployeeActivityLog.ActionType | str,
    target_user: User | None = None,
) -> None:
    """
    Создать запись в журнале; только для ролей CRM.

    `user` — кто выполнил действие, `target_user` — над кем (для сброса пароля).
    ⚠ Никогда не передавайте сюда пароль или его часть: в журнал попадают только
    идентификаторы, IP и User-Agent.
    """
    if not user or not user.is_authenticated:
        return
    allowed = {
        User.Role.SUPERADMIN.value,
        User.Role.ADMIN.value,
        User.Role.REALTOR.value,
    }
    if user.role not in allowed:
        return
    if isinstance(action_type, EmployeeActivityLog.ActionType):
        action_value = action_type.value
    else:
        action_value = str(action_type)
    ip = client_ip_from_request(request)
    ua = user_agent_from_request(request)
    EmployeeActivityLog.objects.create(
        user=user,
        target_user=target_user,
        action_type=action_value,
        ip_address=ip,
        user_agent=ua,
    )
