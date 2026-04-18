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

# Always :8000 so private DNS (e.g. http://<service>:8000) matches; Railway sets PORT to another
# value by default — binding only $PORT made Gunicorn unreachable on :8000 (ECONNREFUSED).
# Set backend service variable PORT=8000 in Railway so health checks / routing match this bind.
CMD ["sh", "-c", "python manage.py migrate --noinput && python manage.py create_initial_admin && exec gunicorn config.wsgi:application --bind 0.0.0.0:8000"]
