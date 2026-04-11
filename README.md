# Centreal — платформа недвижимости и внутренняя CRM

**Репозиторий:** [github.com/Saitama4722/real-estate-platform](https://github.com/Saitama4722/real-estate-platform)

Полнофункциональная **система для агентства недвижимости**: публичный каталог объявлений о **продаже**, SEO-посадочные страницы, статьи, заявки с сайта и **внутренняя зона сотрудников** (личный кабинет `/account` и сохранённые маршруты `/crm/*`) с управлением объектами, лидами, ролями и правами. Бэкенд — **Django** и **Django REST Framework**, фронтенд публичного сайта и интерфейсов — **Next.js** (App Router) и **TypeScript**.

Ключевые темы для поиска и каталогизации: **real estate platform**, **property CRM**, **real estate management system**, **Django real estate backend**, **Next.js real estate frontend**, **property listing website**, **real estate agency CRM**, **lead management**, **property catalog**.

---

## Русский

### О проекте

Платформа предназначена для работы агентства в рамках утверждённой географии (**Краснодарский край**, города **Краснодар** и **Геленджик**) и сценария **только продажа** (аренда в текущий объём не входит). Публичная саморегистрация посетителей и встроенный чат не предусмотрены; учётные записи сотрудников создаёт администратор.

### Что уже реализовано

- **Публичный сайт:** главная с выдачей объектов и статей с API, поисковый переход в каталог, карта (клиентский режим), юридические страницы `/privacy` и `/terms`.
- **Каталог и карточка объекта:** список с фильтрами и сортировкой, пагинация, переключение список/карта (**Leaflet**, тайлы OpenStreetMap, кластеризация), детальная страница по **slug**, галерея и видео, характеристики по типу недвижимости, описание, блок контакта с риэлтором, раскрытие телефона через API с логированием и ограничением частоты, форма заявки с капчей (где применимо — общая форма «Задать вопрос»), карта расположения, блок похожих объектов.
- **SEO:** метаданные и канонические URL, `sitemap.xml`, `robots.txt` (закрыты `/account` и `/crm`), JSON-LD для объекта и статьи; посадочные маршруты `/[city]/[catalogSegment]` под тип, комнатность, район, микрорайон, ЖК; модель `SeoPage` в админке (публичный REST для выдачи SEO-текстов из БД на момент документирования **не** подключён — часть контента задаётся на фронте).
- **Статьи:** публичное API и страницы списка/материала; управление контентом через Django Admin.
- **Лиды:** модель с статусами, историей статусов и комментариями; публичное создание заявок с капчей и throttling; CRM API для просмотра, смены статуса, комментариев и удаления (с учётом ролей и флагов прав).
- **Бэкенд объектов:** CRUD в CRM, фото (оригинал + производные размеры, часть обработки через **Celery**), видео-ссылки, публикация/черновик/архив, идентификаторы **PID** и **RID** для объектов и сотрудников, мягкая проверка дублей при создании, минимальный **импорт CSV/XML** в черновики с маппингом полей и задачей в очереди.
- **Пользователи и доступ:** роли `superadmin`, `admin`, `realtor`; JWT; разграничение видимости объектов и лидов для риэлтора; дополнительные булевы права в CRM для риэлторов; управление риэлторами через API для администраторов.
- **Личный кабинет `/account`:** вход по email/паролю, защита маршрутов, панель, объекты (список и полная форма с адресом/картой), клиенты (лиды), профиль, раздел сотрудников для администраторов.
- **Инфраструктура:** **Docker Compose** (PostgreSQL, Redis, backend, опционально worker Celery, frontend Node), кэш справочников локаций на бэкенде, кэш SEO-страниц на фронте, абстракция медиахранилища (по умолчанию локально; S3/R2 зарезервированы в коде без полной интеграции).
- **Карты в CRM-форме адреса:** при наличии ключа **Yandex Maps API** — подсказки и геокодирование; точка на карте также через **Leaflet** (как на публичной карточке).

Подробные критерии и этапы зафиксированы в [`docs/project-rules.md`](docs/project-rules.md). Направление развития внутреннего продукта (кабинет, процессы) дополнительно описано в [`docs/crm_v2_spec.md`](docs/crm_v2_spec.md).

### Планы и известные ограничения

- Развитие **employee cabinet** и сценариев из **CRM v2** (активность, блоки главной, публичные страницы риэлторов и т.д.) — по спецификации; часть базового кабинета уже в репозитории.
- Расширение публичного API (например, выдача SEO из модели `SeoPage`, дополнительные фильтры списка для домов) — по мере согласования; в документации зафиксированы пробелы относительно желаемого UX.
- Полноценное облачное медиа (**S3/R2**) — заготовка в коде, без боевой настройки в репозитории.
- Редактор статей и полноценный список пользователей в REST-CRM **не** заменяют Django Admin для всех задач — см. аудит в `project-rules.md`.

Исключено из текущего MVP: аренда, публичная регистрация, чат, импорт из внешних маркетплейсов сверх описанного файлового импорта, география вне Краснодара и Геленджика.

### Технологический стек

| Слой | Технологии |
|------|------------|
| Backend | Python, **Django 5**, **Django REST Framework**, **djangorestframework-simplejwt**, django-cors-headers |
| Данные | **PostgreSQL**, ORM Django, миграции |
| Очереди | **Redis**, **Celery** (обработка производных изображений и импорт) |
| Frontend | **Next.js 15**, **React 19**, **TypeScript**, **Tailwind CSS v4** |
| Карты | **Leaflet**, **react-leaflet**; настройка провайдера карт и **Yandex Maps** для подсказок/геокода в CRM |
| Инфраструктура | **Docker**, **Docker Compose** |

### Архитектура

- **Backend** отвечает за модели, бизнес-правила, публичные и CRM API, аутентификацию JWT, права доступа, загрузку медиа, фоновые задачи и администрирование.
- **Frontend (Next.js)** отдаёт публичные страницы с SSR/SSG там, где уместно, проксирует или запрашивает API (в т.ч. через переменные `BACKEND_URL` / `NEXT_PUBLIC_API_URL`), реализует кабинет сотрудника и унаследованные страницы `/crm/*`.
- **Слой API** разделён на публичные маршруты (`/api/...`) и CRM (`/api/crm/...`, `/api/auth/...`).
- **База данных** — PostgreSQL; файлы медиа по умолчанию на диске приложения.

### Публичный сайт и CRM

- **Публичная зона** — каталог, SEO-лендинги, статьи, формы обращений; индексация настраивается через robots и sitemap.
- **Зона сотрудников** — прежде всего **`/account`** (JWT, cookie-зеркало для middleware); маршруты **`/crm`** сохранены и частично перенаправляются; повседневные операции развиваются в сторону единого кабинета согласно правилам проекта.

### Запуск

1. Скопируйте [`.env.example`](.env.example) в `.env` в корне репозитория и при необходимости заполните секреты (файл `.env` в Git не коммитится).

2. Поднимите сервисы:

   ```bash
   docker compose up --build
   ```

3. Примените миграции:

   ```bash
   docker compose exec backend python manage.py migrate
   ```

4. Бэкенд в Compose слушает **8000** внутри контейнера и проброшен на **8001** хоста. Админка: `http://localhost:8001/admin/`.

5. Фронтенд: `http://localhost:3000` (в Compose выполняется `npm ci` и `npm run dev`).

6. Для производных фото в фоне запустите воркер (или задайте `CELERY_TASK_ALWAYS_EAGER=true` для выполнения задач в процессе Django):

   ```bash
   docker compose up celery_worker -d
   ```

Локальный запуск без Docker возможен при настроенном PostgreSQL и переменных окружения: `cd backend && python manage.py migrate && python manage.py runserver`.

Вспомогательные сценарии для Windows: каталог [`scripts/`](scripts/).

### Структура репозитория

| Путь | Назначение |
|------|------------|
| `backend/` | Django-проект, приложения (`properties`, `leads`, `users`, `locations`, `articles`, `seo`, …), настройки, Celery |
| `frontend/` | Next.js App Router, компоненты публичного сайта, кабинета и CRM |
| `docs/` | Правила продукта, прогресс, спецификации (в т.ч. CRM v2) |
| `scripts/` | Скрипты запуска для локальной разработки |
| `docker-compose.yml` | Сервисы PostgreSQL, Redis, backend, Celery worker, frontend |

### Контакты

**Telegram:** [https://t.me/VadikQA](https://t.me/VadikQA)

---

## English

### About this project

**Centreal** is a **real estate platform** and **property CRM** for agencies: a **public property listing website** (sale only, within the **Krasnodar Krai** scope defined in project docs — **Krasnodar** and **Gelendzhik**), plus an **employee-facing area** under **`/account`** (and legacy **`/crm`** routes) for **property management**, **lead management**, and **role-based access**. Stack: **Django** + **Django REST Framework** backend, **Next.js** + **TypeScript** frontend, **PostgreSQL**, **Redis**, **Celery**, **JWT** authentication.

### Current implementation

- **Public site:** homepage fed by APIs (listings, articles, map block), catalog with filters, sort, pagination, list/map toggle (**Leaflet** + OSM), property detail by **slug**, gallery, video, characteristics, description, contact block with **phone reveal** API and rate limits, lead forms with **captcha** where specified, similar listings, legal **`/privacy`** and **`/terms`**.
- **SEO & discoverability:** metadata, canonical URLs, **`sitemap.xml`**, **`robots.txt`** (blocks `/account` and `/crm`), JSON-LD for property and article; SEO landing routes `/[city]/[catalogSegment]`; `SeoPage` model in admin — **no public REST** for DB-driven SEO payloads yet (some copy is frontend-driven).
- **Articles:** public list/detail APIs and pages; editorial workflow via **Django Admin**.
- **Leads:** full model (statuses, history, comments), public submission with throttling, CRM endpoints aligned with permissions.
- **Properties:** CRM CRUD, photos with derivatives (async via **Celery**), videos, publication workflow, **PID** IDs, duplicate warning endpoint, **CSV/XML import** to drafts.
- **Auth & roles:** `superadmin` / `admin` / `realtor`, JWT, scoped queries for realtors, optional CRM capability flags, realtor management API for admins.
- **Employee cabinet `/account`:** login, dashboard, properties (full form with address/map), clients (leads), profile, staff UI for admins.
- **Infrastructure:** **Docker Compose** (Postgres, Redis, backend, optional Celery worker, frontend), caching for locations and landing pages, storage abstraction (local default; cloud backends stubbed).

Authoritative detail: [`docs/project-rules.md`](docs/project-rules.md). CRM product direction: [`docs/crm_v2_spec.md`](docs/crm_v2_spec.md).

### Roadmap and known gaps

- Continue **CRM v2** / **employee cabinet** features per spec (activity, homepage blocks, public realtor pages, etc.); baseline cabinet already exists.
- Close documented API gaps (**SeoPage**-backed public SEO, extra list filters for houses) when approved.
- Optional **cloud media** (S3/R2) — hooks exist, full setup is not committed.
- **Django Admin** remains part of the operational toolkit (e.g. articles, some CRM lists without dedicated REST).

Out of current MVP: **rentals**, public sign-up, in-app **chat**, nationwide geography, full external feed import beyond the file-based import path.

### Technology stack

| Layer | Technologies |
|-------|----------------|
| Backend | Python, **Django 5**, **Django REST Framework**, **simplejwt**, django-cors-headers |
| Database | **PostgreSQL** |
| Queues | **Redis**, **Celery** |
| Frontend | **Next.js 15**, **React 19**, **TypeScript**, **Tailwind CSS v4** |
| Maps | **Leaflet** / **react-leaflet**; **Yandex Maps** for CRM address suggest/geocode when API key is set |
| DevOps | **Docker**, **Docker Compose** |

### Architecture

- **Backend:** domain models, validation, public and CRM **API**, JWT, DRF permissions, media, Celery tasks, admin.
- **Frontend:** public SSR/ISR patterns where used, server `fetch` to API (`BACKEND_URL` in Docker, `NEXT_PUBLIC_API_URL` in browser), employee UI and `/crm` surfaces.
- **API:** split between anonymous/public endpoints and authenticated CRM routes.
- **Data:** PostgreSQL; media on local filesystem by default.

### Public site vs CRM

- **Public** — catalog, SEO landings, articles, lead capture; SEO via sitemap/robots/metadata.
- **Staff** — primarily **`/account`** with JWT; **`/crm`** kept for compatibility and redirects as documented.

### Getting started

1. Copy [`.env.example`](.env.example) to `.env`. Never commit secrets.

2. Start stack:

   ```bash
   docker compose up --build
   ```

3. Migrations:

   ```bash
   docker compose exec backend python manage.py migrate
   ```

4. Backend: host port **8001** → container **8000**. Admin: `http://localhost:8001/admin/`.

5. Frontend: `http://localhost:3000`.

6. Run **`celery_worker`** for async image derivatives (or set `CELERY_TASK_ALWAYS_EAGER=true` for in-process execution).

See [`scripts/`](scripts/) for optional Windows helpers.

### Repository layout

| Path | Role |
|------|------|
| `backend/` | Django project and apps |
| `frontend/` | Next.js application |
| `docs/` | Product rules, specs, progress notes |
| `scripts/` | Local dev scripts |
| `docker-compose.yml` | Service definitions |

### Contact

**Telegram:** [https://t.me/VadikQA](https://t.me/VadikQA)

---

**Repository:** [github.com/Saitama4722/real-estate-platform](https://github.com/Saitama4722/real-estate-platform)
