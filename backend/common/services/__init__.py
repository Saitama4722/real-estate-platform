"""
Shared service layer. Business logic can live in app-level services; use this for base classes.
"""
from common.services.base import BaseService, ServiceError

__all__ = ["BaseService", "ServiceError"]
