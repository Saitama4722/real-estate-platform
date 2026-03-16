"""
Role-based permission foundation for DRF.

Use these permission classes on views when you need to restrict access by role.
Safe for anonymous: unauthenticated users get has_permission == False.
"""
from rest_framework import permissions

from .models import User


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

__all__ = [
    "HasAllowedRole",
    "IsSuperAdmin",
    "IsAdmin",
    "IsRealtor",
    "IsAdminOrSuperAdmin",
    "IsStaffRole",
]
