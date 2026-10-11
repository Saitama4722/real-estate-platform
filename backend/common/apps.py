from django.apps import AppConfig


class CommonConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "common"
    verbose_name = "Общее"

    def ready(self) -> None:
        """
        Announce which database this process resolved, and shout if it is wrong.

        ``common`` is last in INSTALLED_APPS, so this lands at the end of app
        loading — immediately before runserver prints its banner, where it cannot
        be missed in the "Centreal Backend" window.

        Runs for runserver, EVERY management command and the test runner, because
        that is where the original failure happened: `manage.py test` quietly
        built ``test_mindmem``. It reads settings only and never opens a
        connection, so it is safe before migrations and during collectstatic.
        """
        from django.conf import settings

        from common.media_storage import emit_media_startup_report
        from config.db_env import emit_startup_report

        # Two things that are catastrophic to get wrong silently, and cheap to
        # print: WHICH DATABASE and WHICH MEDIA BUCKET this process will use.
        try:
            emit_startup_report(
                settings.DATABASES.get("default", {}),
                source_var=getattr(settings, "CENTREAL_DB_URL_SOURCE", ""),
                is_deployed=getattr(settings, "IS_DEPLOYED", False),
            )
        except Exception:  # noqa: BLE001
            # A diagnostic must never be the reason the app fails to start.
            pass

        try:
            emit_media_startup_report(
                backend_key=getattr(settings, "MEDIA_STORAGE_BACKEND", "local"),
                media_root=getattr(settings, "MEDIA_ROOT", ""),
                media_url=getattr(settings, "MEDIA_URL", ""),
                bucket=getattr(settings, "AWS_STORAGE_BUCKET_NAME", ""),
                custom_domain=getattr(settings, "AWS_S3_CUSTOM_DOMAIN", ""),
                debug=getattr(settings, "DEBUG", False),
            )
        except Exception:  # noqa: BLE001
            pass
