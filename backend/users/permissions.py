"""
Role-based permission foundation for DRF.

Use these permission classes on views when you need to restrict access by role.
Safe for anonymous: unauthenticated users get has_permission == False.
"""
from django.db.models import Q
from rest_framework import permissions

from .models import User


def crm_property_queryset_for_user(user):
    """
    Base Property queryset for CRM: staff (superadmin/admin) see all;
    realtors only objects they may manage.

    Ownership: if ``assigned_realtor`` is set, that user owns the listing;
    otherwise ``created_by`` (set on CRM create) defines ownership.
    """
    from properties.models import Property

    qs = Property.objects.all()
    if not user or not user.is_authenticated or not isinstance(user, User):
        return qs.none()
    if user.has_staff_level_access:
        return qs
    if user.is_realtor_role:
        return qs.filter(
            Q(assigned_realtor=user)
            | Q(assigned_realtor__isnull=True, created_by=user)
        )
    return qs.none()


def user_can_access_crm_property(user, property_obj) -> bool:
    """True if the user may load or mutate this property in CRM."""
    if not user or not user.is_authenticated or not isinstance(user, User):
        return False
    if user.has_staff_level_access:
        return True
    if not user.is_realtor_role:
        return False
    if property_obj.assigned_realtor_id:
        return property_obj.assigned_realtor_id == user.pk
    return property_obj.created_by_id == user.pk


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
    message = "You do not have permission to perform this action."

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


class IsCrmPropertyStaffOrOwner(permissions.BasePermission):
    """
    Object-level CRM access for properties and nested media.

    Requires ``IsCrmUser`` on the same view. Superadmin/admin: allow any property.
    Realtor: only owned listings (see ``user_can_access_crm_property``).
    """

    message = "You do not have permission to perform this action."

    def has_permission(self, request, view):
        return True

    def has_object_permission(self, request, view, obj):
        prop = _crm_property_from_related_object(obj)
        if prop is None:
            return False
        return user_can_access_crm_property(request.user, prop)


__all__ = [
    "HasAllowedRole",
    "IsSuperAdmin",
    "IsAdmin",
    "IsRealtor",
    "IsAdminOrSuperAdmin",
    "IsStaffRole",
    "IsCrmUser",
    "IsCrmPropertyStaffOrOwner",
    "crm_property_queryset_for_user",
    "user_can_access_crm_property",
]
