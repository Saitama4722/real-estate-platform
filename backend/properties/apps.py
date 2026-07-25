from django.apps import AppConfig


class PropertiesConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "properties"
    verbose_name = "Объекты недвижимости"

    def ready(self):
        # Registry is ready; import-time autodiscover in celery.py runs too early.
        from config.celery import app as celery_app

        celery_app.autodiscover_tasks(force=True)

        # Register price-history signal handlers.
        from . import signals  # noqa: F401
