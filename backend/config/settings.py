"""
Django settings for the real estate platform backend.
"""

import os
from datetime import timedelta
from pathlib import Path

import dj_database_url
from dotenv import load_dotenv

from common.media_storage import default_storages_entry

# Load .env for local development. In production (Railway) env vars are injected
# by the platform and load_dotenv() is a no-op (existing vars are not overridden).
load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get(
    "DJANGO_SECRET_KEY",
    "django-insecure-dev-key-change-in-production",
)

DEBUG = os.environ.get("DJANGO_DEBUG", "True").lower() in ("true", "1", "yes")


def _csv_env_list(value):
    return [item.strip() for item in value.split(",") if item.strip()]


_default_allowed_hosts = "localhost,127.0.0.1"
_raw_allowed = os.environ.get("DJANGO_ALLOWED_HOSTS", "").strip()
if not _raw_allowed:
    if DEBUG:
        _raw_allowed = _default_allowed_hosts

_hosts_list = _csv_env_list(_raw_allowed)
if not _hosts_list and DEBUG:
    _hosts_list = _csv_env_list(_default_allowed_hosts)

# Railway sets RAILWAY_ENVIRONMENT and often RAILWAY_PUBLIC_DOMAIN. If the public
# Host header is missing from DJANGO_ALLOWED_HOSTS, Django returns 400 DisallowedHost
# for every API route (not a serializer/query issue).
_railway_public = os.environ.get("RAILWAY_PUBLIC_DOMAIN", "").strip()
if _railway_public:
    _hosts_list.append(_railway_public)
if os.environ.get("RAILWAY_ENVIRONMENT", "").strip():
    # Leading dot: match any subdomain of up.railway.app (Django ALLOWED_HOSTS rule).
    if ".up.railway.app" not in _hosts_list:
        _hosts_list.append(".up.railway.app")

_seen_hosts = set()
ALLOWED_HOSTS = []
for _host_entry in _hosts_list:
    _h = _host_entry.strip()
    if not _h:
        continue
    _key = _h.lower()
    if _key not in _seen_hosts:
        _seen_hosts.add(_key)
        ALLOWED_HOSTS.append(_h)


def _csrf_origin_with_scheme(entry):
    """Django requires each CSRF_TRUSTED_ORIGINS entry to include http:// or https://."""
    origin = entry.strip().rstrip("/")
    if not origin:
        return ""
    lower = origin.lower()
    if lower.startswith("http://") or lower.startswith("https://"):
        return origin
    if origin.startswith("127.0.0.1") or origin.startswith("localhost"):
        return f"http://{origin}"
    return f"https://{origin}"


_csrf_seen = set()
CSRF_TRUSTED_ORIGINS = []
for _part in _csv_env_list(os.environ.get("CSRF_TRUSTED_ORIGINS", "")):
    _o = _csrf_origin_with_scheme(_part)
    if _o and _o not in _csrf_seen:
        _csrf_seen.add(_o)
        CSRF_TRUSTED_ORIGINS.append(_o)

INSTALLED_APPS = [
    # Django
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third-party
    "storages",
    "rest_framework",
    "rest_framework_simplejwt",
    # Required for BLACKLIST_AFTER_ROTATION. ⚠ OutstandingToken gains a row per
    # refresh issued (~100/user/day at a 15-min access lifetime), so
    # `manage.py flushexpiredtokens` needs to run periodically or the table
    # grows without bound. See CLAUDE.md.
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    # Local apps
    "users",
    "agencies",
    "locations",
    "owners",
    "properties",
    "leads",
    "articles",
    "submissions",
    "seo",
    "common",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
]
# Production: Gunicorn does not serve static files; WhiteNoise serves STATIC_ROOT after collectstatic.
if not DEBUG:
    MIDDLEWARE.append("whitenoise.middleware.WhiteNoiseMiddleware")
MIDDLEWARE += [
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

WSGI_APPLICATION = "config.wsgi.application"

# Persistent-connection lifetime (seconds). Production keeps 600 (default); local
# dev sets a smaller value via CONN_MAX_AGE in backend/.env so the threaded dev
# server doesn't hoard idle connections toward Postgres' max_connections limit.
# Keep this at or below Postgres' idle_session_timeout so Django recycles a
# connection before Postgres force-closes an abandoned one.
try:
    _conn_max_age = int(os.environ.get("CONN_MAX_AGE", "600"))
except ValueError:
    _conn_max_age = 600

_database_url = os.environ.get("DATABASE_URL", "").strip()
if _database_url:
    DATABASES = {
        "default": dj_database_url.parse(_database_url, conn_max_age=_conn_max_age),
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": os.environ.get("POSTGRES_DB", "real_estate_db"),
            "USER": os.environ.get("POSTGRES_USER", "postgres"),
            "PASSWORD": os.environ.get("POSTGRES_PASSWORD", "postgres"),
            "HOST": os.environ.get("POSTGRES_HOST", "localhost"),
            "PORT": os.environ.get("POSTGRES_PORT", "5432"),
            "CONN_MAX_AGE": _conn_max_age,
        }
    }

LANGUAGE_CODE = "ru-ru"

TIME_ZONE = "UTC"

USE_I18N = True

USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

STATICFILES_DIRS = [
    BASE_DIR / "static",
]

_staticfiles_storage = (
    "whitenoise.storage.CompressedStaticFilesStorage"
    if not DEBUG
    else "django.contrib.staticfiles.storage.StaticFilesStorage"
)

MEDIA_ROOT = BASE_DIR / "media"

MEDIA_STORAGE_BACKEND = (
    os.environ.get("MEDIA_STORAGE_BACKEND")
    or os.environ.get("MEDIA_STORAGE")
    or "local"
).strip().lower()

# R2 / S3 settings — read from env vars, never hardcoded.
# Used by common.media_storage when MEDIA_STORAGE_BACKEND is "r2" or "s3".
AWS_ACCESS_KEY_ID = os.environ.get("AWS_ACCESS_KEY_ID", "")
AWS_SECRET_ACCESS_KEY = os.environ.get("AWS_SECRET_ACCESS_KEY", "")
AWS_STORAGE_BUCKET_NAME = os.environ.get("AWS_STORAGE_BUCKET_NAME", "centreal-media")
AWS_S3_ENDPOINT_URL = os.environ.get(
    "AWS_S3_ENDPOINT_URL",
    "https://ec9bb10c90bd739a76f314f308437066.r2.cloudflarestorage.com",
)
AWS_S3_REGION_NAME = os.environ.get("AWS_S3_REGION_NAME", "auto")
AWS_S3_SIGNATURE_VERSION = "s3v4"
AWS_S3_ADDRESSING_STYLE = "path"
AWS_DEFAULT_ACL = None
AWS_QUERYSTRING_AUTH = False
# Public CDN domain for the R2 bucket (no https:// prefix).
# S3Boto3Storage uses this for file.url → https://<custom_domain>/<key>.
AWS_S3_CUSTOM_DOMAIN = os.environ.get("AWS_S3_CUSTOM_DOMAIN", "")
AWS_S3_OBJECT_PARAMETERS = {"CacheControl": "max-age=86400"}

# MEDIA_URL: use the public R2/S3 CDN domain when cloud storage is active.
# AWS_S3_CUSTOM_DOMAIN is required for r2/s3 — media_storage.py raises
# ImproperlyConfigured at startup if it is missing.
# For local storage keep /media/ (served by Django in dev or the Next.js proxy).
if MEDIA_STORAGE_BACKEND in ("r2", "s3"):
    MEDIA_URL = f"https://{AWS_S3_CUSTOM_DOMAIN}/" if AWS_S3_CUSTOM_DOMAIN else "/media/"
else:
    MEDIA_URL = "/media/"

STORAGES = {
    "default": default_storages_entry(
        backend_key=MEDIA_STORAGE_BACKEND,
        media_root=MEDIA_ROOT,
        media_url=MEDIA_URL,
    ),
    "staticfiles": {
        "BACKEND": _staticfiles_storage,
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

# --- Public site URL (used to build absolute links in notifications, etc.) ---
# No trailing slash. Override per environment via the SITE_URL env var.
SITE_URL = os.environ.get("SITE_URL", "https://centreal.ru").rstrip("/")

# --- Lead notifications (Telegram) ---
# Master switch for outbound lead notifications. When False, no notification is
# sent regardless of the Telegram credentials below.
LEADS_NOTIFICATIONS_ENABLED = os.environ.get(
    "LEADS_NOTIFICATIONS_ENABLED", "True"
).strip().lower() in ("1", "true", "yes")
# When enabled AND both are set, a new public-form lead triggers a Telegram
# message (see leads.tasks.send_lead_telegram_notification). Leave empty to disable.
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "").strip()

# Кэш по умолчанию (локальная память процесса; для публичных справочников и cache_page)
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "real_estate_platform",
    }
}

# Custom user model (email as login)
AUTH_USER_MODEL = "users.User"

# CORS — permissive in DEBUG; in production use CORS_ALLOWED_ORIGINS (comma-separated).
_cors_allowed = _csv_env_list(os.environ.get("CORS_ALLOWED_ORIGINS", ""))
if DEBUG:
    CORS_ALLOW_ALL_ORIGINS = True
else:
    CORS_ALLOW_ALL_ORIGINS = False
    CORS_ALLOWED_ORIGINS = _cors_allowed

# Railway / reverse TLS termination: Gunicorn sees http while clients use HTTPS.
# Without this, request.build_absolute_uri() uses http://… (mixed content for avatars/media).
if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    USE_X_FORWARDED_HOST = True

# TLS terminates at the platform (Railway). Never let Django emit HTTP→HTTPS redirects:
# internal HTTP hops from Next.js → Django would loop with SECURE_SSL_REDIRECT=True.
SECURE_SSL_REDIRECT = False

# Defense in depth: even if SECURE_SSL_REDIRECT is enabled by mistake in an environment,
# API routes must never 301/302 — clients expect JSON / 401 / 403 (Next /api proxy loop).
# request.path includes a leading slash; "^api/" never matched.
SECURE_REDIRECT_EXEMPT = [r"^/api/"]

# Django REST Framework — JWT for CRM; default require auth.
# JSON-only in production so API clients never receive browsable HTML or ambiguous responses.
_rest_framework_renderers = ["rest_framework.renderers.JSONRenderer"]
if DEBUG:
    _rest_framework_renderers.append("rest_framework.renderers.BrowsableAPIRenderer")

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        # Subclass of simplejwt's JWTAuthentication that additionally checks the
        # token's `tv` claim against User.token_version, so a superadmin
        # password reset kills existing access AND refresh tokens immediately
        # instead of leaving the access token valid for up to an hour.
        "users.authentication.VersionedJWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_RENDERER_CLASSES": _rest_framework_renderers,
}

# JWT token lifetimes. Tightened 2026-08-08 with the owner's explicit approval
# of each number — see CLAUDE.md; do not change these without asking again.
SIMPLE_JWT = {
    # 60 → 15 min. This was the weak number: the window in which a stolen access
    # token works and nothing can intervene. token_version revokes on a
    # DELIBERATE act (reset / terminate), but nothing catches a silent theft, so
    # the lifetime itself has to be short. Invisible to employees — the client
    # refreshes transparently (fetchWithCrmAuthRetry).
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),
    # 7 days → 48 h. Owner's call over the 12 h I suggested: still ~70% off the
    # stolen-token window, and re-authentication every couple of days rather
    # than every morning.
    "REFRESH_TOKEN_LIFETIME": timedelta(hours=48),
    # Each refresh issues a NEW refresh token…
    "ROTATE_REFRESH_TOKENS": True,
    # …and blacklists the one just spent. ⚠ Rotation WITHOUT this is theatre:
    # the old refresh would stay valid for its full 48 h, so a stolen token
    # would be unaffected. Requires the token_blacklist app in INSTALLED_APPS.
    "BLACKLIST_AFTER_ROTATION": True,
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
