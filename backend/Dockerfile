# Backend image: install dependencies so migrate and runserver work in container.
FROM python:3.12-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1
ENV DJANGO_SETTINGS_MODULE=config.settings

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
# Admin (and other) static assets for WhiteNoise in production — requires STATIC_ROOT in settings.
RUN python manage.py collectstatic --noinput

CMD ["sh", "-c", "exec gunicorn config.wsgi:application --bind 0.0.0.0:${PORT:-8000}"]
