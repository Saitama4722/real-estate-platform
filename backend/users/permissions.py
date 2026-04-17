"""
Role-based permission foundation for DRF.

Use these permission classes on views when you need to restrict access by role.
Safe for anonymous: unauthenticated users get has_permission == False.
"""
from rest_framework import permissions
from rest_framework.exceptions import PermissionDenied

from .models import User

# Коды доп. прав риэлтора в CRM → атрибут User (BooleanField).
CRM_CAPABILITY_FIELD = {
    "create_property": "perm_create_property",
    "edit_property": "perm_edit_property",
    "delete_property": "perm_delete_property",
    "view_clients": "perm_view_clients",
    "delete_clients": "perm_delete_clients",
    "change_status": "perm_change_status",
}

_CRM_CAPABILITY_DENIED_DETAIL = {
    "create_property": "Недостаточно права: создание объектов в CRM.",
    "edit_property": "Недостаточно права: редактирование объектов в CRM.",
    "delete_property": "Недостаточно права: архивирование объектов в CRM.",
    "view_clients": "Недостаточно права: просмотр клиентов (лидов) в CRM.",
    "delete_clients": "Недостаточно права: удаление клиентов (лидов) в CRM.",
    "change_status": "Недостаточно права: смена статуса лидов в CRM.",
}


def crm_user_has_capability(user, capability: str) -> bool:
    """
    Доп. слой прав для риэлтора: флаги на User.
    Суперадмин и админ всегда проходят; остальные роли — False.
    """
    if not user or not user.is_authenticated or not isinstance(user, User):
        return False
    if user.has_staff_level_access:
        return True
    if not user.is_realtor_role:
        return False
    field = CRM_CAPABILITY_FIELD.get(capability)
    if not field:
        return False
    return bool(getattr(user, field, False))


def require_crm_capability(request, capability: str) -> None:
    """Выброс PermissionDenied, если у пользователя нет возможности capability."""
    if crm_user_has_capability(request.user, capability):
        return
    raise PermissionDenied(
        detail=_CRM_CAPABILITY_DENIED_DETAIL.get(
            capability,
            "Недостаточно прав для этого действия.",
        )
    )


def crm_property_queryset_for_user(user):
    """
    Base Property queryset for CRM: staff (superadmin/admin) see all;
    realtors only objects where they are the assigned realtor (этап 8).
    """
    from properties.models import Property

    qs = Property.objects.all()
    if not user or not user.is_authenticated or not isinstance(user, User):
        return qs.none()
    if user.has_staff_level_access:
        return qs
    if user.is_realtor_role:
        return qs.filter(assigned_realtor=user)
    return qs.none()


def user_can_access_crm_property(user, property_obj) -> bool:
    """True if the user may load or mutate this property in CRM."""
    if not user or not user.is_authenticated or not isinstance(user, User):
        return False
    if user.has_staff_level_access:
        return True
    if not user.is_realtor_role:
        return False
    return property_obj.assigned_realtor_id == user.pk


def crm_lead_queryset_for_user(user):
    """
    Base Lead queryset for CRM: staff see all; realtors see only leads assigned
    to them (assigned_realtor).
    """
    from leads.models import Lead

    qs = Lead.objects.all()
    if not user or not user.is_authenticated or not isinstance(user, User):
        return qs.none()
    if user.has_staff_level_access:
        return qs
    if user.is_realtor_role:
        return qs.filter(assigned_realtor=user)
    return qs.none()


def user_can_access_crm_lead(user, lead) -> bool:
    """True if the user may load or mutate this lead in CRM."""
    if not user or not user.is_authenticated or not isinstance(user, User):
        return False
    return crm_lead_queryset_for_user(user).filter(pk=lead.pk).exists()


def crm_import_job_queryset_for_user(user):
    """
    ImportJob queryset for CRM: staff see all; realtors only jobs they started.
    """
    from properties.import_models import ImportJob

    qs = ImportJob.objects.all()
    if not user or not user.is_authenticated or not isinstance(user, User):
        return qs.none()
    if user.has_staff_level_access:
        return qs
    if user.is_realtor_role:
        return qs.filter(created_by=user)
    return qs.none()


def user_can_access_crm_import_job(user, job) -> bool:
    if not user or not user.is_authenticated or not isinstance(user, User):
        return False
    return crm_import_job_queryset_for_user(user).filter(pk=job.pk).exists()


def _crm_property_from_related_object(obj):
    from properties.models import Property, PropertyPhoto, PropertyVideo

    if isinstance(obj, Property):
        return obj
    if isinstance(obj, (PropertyPhoto, PropertyVideo)):
        return obj.property
    return None


class HasAllowedRole(permissions.BasePermission):
    """
    Base permission: allow only authenticated users whose role is in allowed_roles.
    Override allowed_roles in subclasses or pass via view.
    """
    allowed_roles = ()
    message = "Недостаточно прав для этого действия."

    def get_allowed_roles(self, request, view):
        return self.allowed_roles

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if not isinstance(request.user, User):
            return False
        allowed = self.get_allowed_roles(request, view)
        return request.user.role in allowed


class IsSuperAdmin(HasAllowedRole):
    allowed_roles = (User.Role.SUPERADMIN.value,)


class IsAdmin(HasAllowedRole):
    allowed_roles = (User.Role.ADMIN.value,)


class IsRealtor(HasAllowedRole):
    allowed_roles = (User.Role.REALTOR.value,)


class IsAdminOrSuperAdmin(HasAllowedRole):
    """Staff-level roles: superadmin or admin."""
    allowed_roles = (User.Role.SUPERADMIN.value, User.Role.ADMIN.value)


# Alias for clarity in views
IsStaffRole = IsAdminOrSuperAdmin


class IsCrmUser(HasAllowedRole):
    """Authenticated platform roles with CRM access (superadmin, admin, realtor)."""

    allowed_roles = (
        User.Role.SUPERADMIN.value,
        User.Role.ADMIN.value,
        User.Role.REALTOR.value,
    )
    message = (
        "Доступ к CRM разрешён только активным пользователям с ролью "
        "суперадминистратора, администратора или риелтора."
    )

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if not isinstance(request.user, User):
            return False
        if not getattr(request.user, "is_active", False):
            return False
        allowed = self.get_allowed_roles(request, view)
        return request.user.role in allowed


class IsCrmStaffManager(permissions.BasePermission):
    """
    Активный суперадминистратор или администратор: управление риэлторами и др.
    staff-only действия в CRM (не риэлтор).
    """

    message = "Управление сотрудниками доступно только администратору."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if not isinstance(request.user, User):
            return False
        if not getattr(request.user, "is_active", False):
            return False
        return request.user.has_staff_level_access


class IsCrmPropertyStaffOrOwner(permissions.BasePermission):
    """
    Object-level CRM access for properties and nested media.

    Requires ``IsCrmUser`` on the same view. Superadmin/admin: allow any property.
    Realtor: only owned listings (see ``user_can_access_crm_property``).
    """

    message = "Нет доступа к этому объекту или недостаточно прав."

    def has_permission(self, request, view):
        return True

    def has_object_permission(self, request, view, obj):
        prop = _crm_property_from_related_object(obj)
        if prop is None:
            return False
        return user_can_access_crm_property(request.user, prop)


class IsCrmLeadStaffOrOwner(permissions.BasePermission):
    """
    Object-level CRM access for leads.

    Requires ``IsCrmUser`` on the same view. Staff: any lead. Realtor: only leads
    assigned to them (see ``crm_lead_queryset_for_user``).
    """

    message = "Нет доступа к этой заявке или недостаточно прав."

    def has_permission(self, request, view):
        return True

    def has_object_permission(self, request, view, obj):
        from leads.models import Lead

        if not isinstance(obj, Lead):
            return False
        return user_can_access_crm_lead(request.user, obj)


class IsCrmImportJobOwnerOrStaff(permissions.BasePermission):
    """
    Object-level access to ImportJob. Use with IsCrmUser and queryset from
    ``crm_import_job_queryset_for_user``.
    """

    message = "Нет доступа к этой задаче импорта или недостаточно прав."

    def has_permission(self, request, view):
        return True

    def has_object_permission(self, request, view, obj):
        from properties.import_models import ImportJob

        if not isinstance(obj, ImportJob):
            return False
        return user_can_access_crm_import_job(request.user, obj)


__all__ = [
    "HasAllowedRole",
    "IsSuperAdmin",
    "IsAdmin",
    "IsRealtor",
    "IsAdminOrSuperAdmin",
    "IsStaffRole",
    "IsCrmUser",
    "IsCrmStaffManager",
    "IsCrmPropertyStaffOrOwner",
    "IsCrmLeadStaffOrOwner",
    "IsCrmImportJobOwnerOrStaff",
    "CRM_CAPABILITY_FIELD",
    "crm_user_has_capability",
    "require_crm_capability",
    "crm_property_queryset_for_user",
    "crm_lead_queryset_for_user",
    "crm_import_job_queryset_for_user",
    "user_can_access_crm_property",
    "user_can_access_crm_lead",
    "user_can_access_crm_import_job",
]
