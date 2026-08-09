# Backend image: install dependencies so migrate and runserver work in container.
FROM python:3.12-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1
ENV DJANGO_SETTINGS_MODULE=config.settings

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
# Admin (and other) static assets for WhiteNoise in production — requires STATIC_ROOT in settings.
# ⚠ collectstatic imports settings, and settings refuse to start in a deployed
# environment without DJANGO_SECRET_KEY. Service variables are a RUNTIME concern
# and are not guaranteed to exist during an image build, so supply a throwaway
# key for this one step. collectstatic only copies files — it signs nothing — and
# this value is scoped to this RUN layer, so it is NEVER the key the application
# runs with. Without it the build can fail on a variable it does not need.
RUN DJANGO_SECRET_KEY=build-step-only-never-used-at-runtime \
    python manage.py collectstatic --noinput

# Railway injects $PORT at runtime; bind gunicorn to that port so its proxy can reach the process.
# Fallback to 8000 for local docker run / docker-compose.
CMD ["sh", "-c", "python manage.py migrate --noinput && python manage.py create_initial_admin && exec gunicorn config.wsgi:application --bind 0.0.0.0:${PORT:-8000} --workers 2 --timeout 60"]
