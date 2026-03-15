"""
Base service and exception for the service layer.
"""


class ServiceError(Exception):
    """Raise in services for business rule violations or expected failures."""

    def __init__(self, message, code=None):
        self.message = message
        self.code = code
        super().__init__(message)


class BaseService:
    """
    Optional base for service classes. Use @transaction.atomic on methods when needed.
    """
    pass
