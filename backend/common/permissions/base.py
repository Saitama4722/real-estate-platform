"""
Base permission class for reusable permission logic.
"""
from rest_framework import permissions


class BasePermission(permissions.BasePermission):
    """
    Reusable base. Override has_permission / has_object_permission in subclasses.
    """
    message = "You do not have permission to perform this action."

    def has_permission(self, request, view):
        return True

    def has_object_permission(self, request, view, obj):
        return True
