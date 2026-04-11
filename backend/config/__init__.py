# Import Celery app when Django loads the config package so @shared_task binds
# to this app and autodiscovery runs (see config/celery.py).
from .celery import app as celery_app

__all__ = ("celery_app",)
