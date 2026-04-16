"""
Django settings for the real estate platform backend.
"""

import os
from datetime import timedelta
from pathlib import Path

from common.media_storage import default_storages_entry

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get(
    "DJANGO_SECRET_KEY",
    "django-insecure-dev-key-change-in-production",
)

DEBUG = os.environ.get("DJANGO_DEBUG", "True").lower() in ("true", "1", "yes")

_default_allowed_hosts = "localhost,127.0.0.1"
_raw_allowed = os.environ.get("DJANGO_ALLOWED_HOSTS", _default_allowed_hosts).strip()
if not _raw_allowed:
    _raw_allowed = _default_allowed_hosts
ALLOWED_HOSTS = ["*"]

INSTALLED_APPS = [
    # Django
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third-party
    "rest_framework",
    "rest_framework_simplejwt",
    "corsheaders",
    # Local apps
    "users",
    "agencies",
    "locations",
    "properties",
    "leads",
    "articles",
    "seo",
    "common",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

WSGI_APPLICATION = "config.wsgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ.get("POSTGRES_DB", "real_estate_db"),
        "USER": os.environ.get("POSTGRES_USER", "postgres"),
        "PASSWORD": os.environ.get("POSTGRES_PASSWORD", "postgres"),
        "HOST": os.environ.get("POSTGRES_HOST", "localhost"),
        "PORT": os.environ.get("POSTGRES_PORT", "5432"),
    }
}

LANGUAGE_CODE = "ru-ru"

TIME_ZONE = "UTC"

USE_I18N = True

USE_TZ = True

STATIC_URL = "/static/"

STATICFILES_DIRS = [
    BASE_DIR / "static",
]

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

# Stage 14.4 — media storage: default remains local. Central switch for a future
# S3 / R2 backend (not implemented yet; ``s3`` / ``r2`` raise ImproperlyConfigured).
# Accept legacy MEDIA_STORAGE for older .env files; MEDIA_STORAGE_BACKEND wins when set.
MEDIA_STORAGE_BACKEND = (
    os.environ.get("MEDIA_STORAGE_BACKEND")
    or os.environ.get("MEDIA_STORAGE")
    or "local"
).strip().lower()

STORAGES = {
    "default": default_storages_entry(
        backend_key=MEDIA_STORAGE_BACKEND,
        media_root=MEDIA_ROOT,
        media_url=MEDIA_URL,
    ),
    "staticfiles": {
        "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
    },
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# --- Celery / Redis (Stage 14.5) ---
REDIS_URL = os.environ.get("REDIS_URL", "redis://127.0.0.1:6379/0").strip()
CELERY_BROKER_URL = os.environ.get("CELERY_BROKER_URL", REDIS_URL).strip()
CELERY_RESULT_BACKEND = os.environ.get("CELERY_RESULT_BACKEND", REDIS_URL).strip()
# Eager mode only when explicitly set — not tied to DEBUG (honest queue behavior).
_celery_eager_raw = os.environ.get("CELERY_TASK_ALWAYS_EAGER", "").strip().lower()
if _celery_eager_raw in ("1", "true", "yes"):
    CELERY_TASK_ALWAYS_EAGER = True
elif _celery_eager_raw in ("0", "false", "no"):
    CELERY_TASK_ALWAYS_EAGER = False
else:
    CELERY_TASK_ALWAYS_EAGER = False
CELERY_TASK_EAGER_PROPAGATES = True
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = TIME_ZONE

# Кэш по умолчанию (локальная память процесса; для публичных справочников и cache_page)
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "real_estate_platform",
    }
}

# Custom user model (email as login)
AUTH_USER_MODEL = "users.User"

# CORS — development: allow all origins
CORS_ALLOW_ALL_ORIGINS = True

# Django REST Framework — JWT for CRM; default require auth
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
}

# JWT token lifetimes (minimal config)
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
}

# Templates (required for admin)
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# Auth password validation (Django default)
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]
