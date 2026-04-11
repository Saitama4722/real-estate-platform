"""
Celery application for background tasks (Stage 14.5).

Use: celery -A config.celery worker -l info

``config`` package ``__init__`` imports this module at Django startup so the
Celery app exists before ``@shared_task`` modules load.

Do not call ``autodiscover_tasks()`` here: this module is imported while Django
is still loading ``config.settings`` (via ``config_from_object``), before
``django.setup()`` populates the app registry, so discovery would see no
``tasks.py`` modules. Autodiscovery runs in ``properties.apps.PropertiesConfig.ready``
(after apps are ready; ``force=True`` so the worker and web process both register tasks).
"""

import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

app = Celery("config")
app.config_from_object("django.conf:settings", namespace="CELERY")
