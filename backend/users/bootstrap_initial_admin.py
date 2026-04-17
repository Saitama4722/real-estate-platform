"""
One-time deployment bootstrap: ensure a platform superadmin exists when enabled via env.

Intended only for initial access after deploy; normal realtor onboarding stays manual in CRM.
"""
import logging
import os
import sys

logger = logging.getLogger(__name__)

_BOOTSTRAP_ENV = "BOOTSTRAP_INITIAL_ADMIN"
_SKIP_MANAGEMENT_COMMANDS = frozenset(
    (
        "migrate",
        "makemigrations",
        "test",
        "flush",
        "shell",
        "dbshell",
        "collectstatic",
    )
)


def _bootstrap_env_enabled() -> bool:
    raw = os.environ.get(_BOOTSTRAP_ENV, "").strip().lower()
    return raw in ("1", "true", "yes")


def _should_skip_for_management_command() -> bool:
    if len(sys.argv) < 2:
        return False
    return sys.argv[1] in _SKIP_MANAGEMENT_COMMANDS


def bootstrap_initial_admin() -> None:
    if not _bootstrap_env_enabled():
        return
    if _should_skip_for_management_command():
        return

    from django.contrib.auth import get_user_model

    User = get_user_model()
    email = "admin@example.com"
    password = "12345678"

    user, _created = User.objects.get_or_create(
        email=email,
        defaults={
            "first_name": "Admin",
            "last_name": "Bootstrap",
            "role": User.Role.SUPERADMIN,
            "is_active": True,
            "is_staff": True,
            "is_superuser": True,
        },
    )
    user.role = User.Role.SUPERADMIN
    user.is_active = True
    user.is_staff = True
    user.is_superuser = True
    if not user.first_name:
        user.first_name = "Admin"
    if not user.last_name:
        user.last_name = "Bootstrap"
    user.set_password(password)
    user.save()
    logger.info("Initial admin bootstrap applied for %s", email)
