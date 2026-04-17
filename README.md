# Centreal — Real Estate Platform & CRM

## English

### Description

Centreal is a full-stack real estate platform with a public catalog and an internal **CRM** for staff. It covers property listings, lead management, SEO-oriented pages, imports, and operational tooling (including phone reveal logging).

### Tech stack

- **Backend:** Django, Django REST Framework, PostgreSQL, Redis, Celery  
- **Frontend:** Next.js, TypeScript, Tailwind CSS  

### Features

- Property listings (catalog, detail pages, maps)  
- **CRM** for employees (`/account`, dedicated CRM flows)  
- Leads system (public inquiries + CRM pipeline)  
- Phone reveal logging  
- SEO pages and article content  
- Data import pipeline  

### Local development

1. Copy environment template and adjust values:

   ```bash
   cp .env.example .env
   ```

2. Start infrastructure (PostgreSQL, Redis, backend, frontend) with Docker Compose, or run services manually using variables from `.env.example`.

3. Backend (typical): apply migrations, create superuser as needed, run the dev server.

4. Frontend:

   ```bash
   cd frontend
   npm ci
   npm run dev
   ```

### Deployment ([Railway](https://railway.app))

The app is typically deployed as **one Railway project** with **two services**: a Next.js frontend and a Django backend. Example: public site `https://your-frontend.up.railway.app` and a separate backend hostname or private networking.

- Connect the repository; set each service **Root Directory** (`backend` / `frontend`).  
- Use `DATABASE_URL` from Railway PostgreSQL and `REDIS_URL` from Railway Redis (or your provider).  
- Run migrations on deploy (e.g. release command: `python manage.py migrate`).  

**Backend (production)** — set at least:

- `DJANGO_DEBUG=False`  
- `DJANGO_SECRET_KEY`  
- `DJANGO_ALLOWED_HOSTS` — include your backend public hostname(s) and, if needed, Railway defaults (the project appends `RAILWAY_PUBLIC_DOMAIN` when set).  
- `CORS_ALLOWED_ORIGINS` — comma-separated **frontend** origins (e.g. `https://your-frontend.up.railway.app`)  
- `CSRF_TRUSTED_ORIGINS` — same as CORS when using session/CSRF-protected flows  

**Frontend (production)** — set at build/runtime (especially `NEXT_PUBLIC_*` inlined at build):

- `NEXT_PUBLIC_SITE_URL` — public URL of the **Next.js** site  
- `NEXT_PUBLIC_API_URL` — public API base including `/api` (often the same hostname as the site plus `/api`, or the backend’s public URL — see below)  
- **`BACKEND_URL` — Django origin without `/api` reachable from the Next container. It must not be the same public hostname as `NEXT_PUBLIC_SITE_URL`**, otherwise Next.js rewrites `/api/*` to the same host and triggers **ERR_TOO_MANY_REDIRECTS**. Use the backend service **private** URL (e.g. `http://<backend>.railway.internal:<port>`) or the backend’s **own** public hostname — never only the frontend URL unless a separate edge routes `/api` elsewhere.  
- Optional: `SKIP_BACKEND_SITE_HOST_CHECK=1` only if you intentionally use a nonstandard proxy (not recommended).  

Production builds require `NEXT_PUBLIC_API_URL` or `BACKEND_URL` so API rewrites resolve correctly.  

### Environment variables

| Variable | Service | Purpose |
| -------- | ------- | ------- |
| `DJANGO_SECRET_KEY` | Backend | Django secret key (**required** in production) |
| `DJANGO_DEBUG` | Backend | `True` / `False` (use `False` in production) |
| `DATABASE_URL` | Backend | PostgreSQL URL (recommended on Railway) |
| `REDIS_URL` | Backend | Redis for Celery broker/result backend |
| `DJANGO_ALLOWED_HOSTS` | Backend | Comma-separated hosts |
| `CSRF_TRUSTED_ORIGINS` | Backend | HTTPS origins for CSRF (comma-separated) |
| `CORS_ALLOWED_ORIGINS` | Backend | Allowed browser origins when `DJANGO_DEBUG=False` |
| `NEXT_PUBLIC_API_URL` | Frontend | Public API base URL including `/api` |
| `NEXT_PUBLIC_SITE_URL` | Frontend | Canonical public site URL (SEO) |
| `BACKEND_URL` | Frontend | Django origin for SSR/rewrites (**must not** equal the Next.js public host unless you use a dedicated internal URL for rewrites — see deployment section) |

See **`.env.example`** in the repository root for a complete template.

### Contact

Telegram: [https://t.me/VadikQA](https://t.me/VadikQA)

### SEO keywords

real estate, property listings, CRM, leads, Django, Next.js, PostgreSQL, Redis, Celery, real estate platform, недвижимость, каталог, лиды

---

## Русский

### Описание

**Centreal** — платформа недвижимости с публичным каталогом и **CRM** для сотрудников: объекты, лиды, SEO-страницы, импорт данных и журналирование показа телефонов.

### Технологии

- **Бэкенд:** Django, Django REST Framework, PostgreSQL, Redis, Celery  
- **Фронтенд:** Next.js, TypeScript, Tailwind CSS  

### Возможности

- Каталог и карточки объектов  
- **CRM** для сотрудников (`/account` и CRM-разделы)  
- Система лидов (заявки с сайта и работа в CRM)  
- Логирование раскрытия телефона  
- SEO и статьи  
- Импорт данных  

### Локальная разработка

1. Скопируйте `.env.example` в `.env` и заполните значения.  
2. Поднимите PostgreSQL/Redis через Docker Compose или вручную.  
3. Выполните миграции бэкенда, при необходимости создайте суперпользователя.  
4. Фронтенд: `cd frontend && npm ci && npm run dev`.  

### Деплой (Railway)

Обычно два сервиса (Next.js и Django) в одном проекте Railway.

- Бэкенд: переменные из таблицы выше; `DATABASE_URL`, `REDIS_URL`, `DJANGO_DEBUG=False`; `DJANGO_ALLOWED_HOSTS`; `CORS_ALLOWED_ORIGINS` и `CSRF_TRUSTED_ORIGINS` — с публичным HTTPS-источником **фронтенда**.  
- Фронтенд: корень `frontend`; `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_API_URL`; **`BACKEND_URL` должен указывать на Django (частный URL Railway или отдельный публичный хост бэкенда), а не на тот же хост, что и Next.js**, иначе реврайты `/api/*` зацикливаются (`ERR_TOO_MANY_REDIRECTS`). Подробности — в английской секции выше.  

### Контакт

Telegram: [https://t.me/VadikQA](https://t.me/VadikQA)

### Ключевые слова (SEO)

недвижимость, каталог объектов, CRM, лиды, Django, Next.js, PostgreSQL, Redis, Celery, платформа недвижимости, Краснодар, Геленджик
