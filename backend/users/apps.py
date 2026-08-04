from django.apps import AppConfig


class UsersConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "users"
    verbose_name = "Пользователи"

    def ready(self):
        # Registers the realtor-profile creation signal for every creation
        # path (CRM panel, Django admin, shell, fixtures).
        from . import signals  # noqa: F401
