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

### Deployment

#### Backend → [Railway](https://railway.app)

- Connect the repository (or deploy from `./backend`).  
- Set **Root Directory** to `backend` if the service builds from the monorepo.  
- Configure **environment variables** (see below). Use `DATABASE_URL` from Railway PostgreSQL and `REDIS_URL` from Railway Redis (or your provider).  
- Run migrations on deploy (e.g. release command: `python manage.py migrate`).  
- Ensure `DJANGO_DEBUG=False`, set `DJANGO_SECRET_KEY`, `DJANGO_ALLOWED_HOSTS` (or rely on `RAILWAY_PUBLIC_DOMAIN` where applicable), and `CSRF_TRUSTED_ORIGINS` for your HTTPS origins.  
- Set `CORS_ALLOWED_ORIGINS` to your **Vercel** frontend URL(s) (comma-separated).  

#### Frontend → [Vercel](https://vercel.com)

- Import the project; set **Root Directory** to `frontend`.  
- Set **environment variables** (at minimum `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_SITE_URL`; optional `BACKEND_URL` for rewrites if it differs).  
- Production builds require `NEXT_PUBLIC_API_URL` or `BACKEND_URL` so API rewrites resolve correctly.  

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
| `BACKEND_URL` | Frontend | Django origin for SSR/rewrites (optional if same as API host) |

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

### Деплой

- **Бэкенд — Railway:** переменные окружения из таблицы выше; `DATABASE_URL` и `REDIS_URL`; `DJANGO_DEBUG=False`; настройте CORS под домен Vercel.  
- **Фронтенд — Vercel:** корень `frontend`; задайте `NEXT_PUBLIC_API_URL` и `NEXT_PUBLIC_SITE_URL`.  

### Контакт

Telegram: [https://t.me/VadikQA](https://t.me/VadikQA)

### Ключевые слова (SEO)

недвижимость, каталог объектов, CRM, лиды, Django, Next.js, PostgreSQL, Redis, Celery, платформа недвижимости, Краснодар, Геленджик
