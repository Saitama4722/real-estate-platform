<!--
SEO / discovery keywords (README is indexed by search engines and GitHub):
Real estate platform, property listing, CRM for realtors, Django real estate, real estate marketplace, property management system, real estate SaaS, CRM system, housing platform, real estate web app
-->

**Keywords:** Real estate platform · property listing · CRM for realtors · Django real estate · real estate marketplace · property management system · real estate SaaS · CRM system · housing platform · real estate web app

---

# 🏠 Платформа недвижимости + CRM

**Репозиторий:** [github.com/Saitama4722/real-estate-platform](https://github.com/Saitama4722/real-estate-platform)

Современный **веб-сервис для продажи недвижимости** с внутренней **CRM для риэлторов** и агентств: бэкенд на Django, публичный каталог и управление объектами в единой архитектуре.

## 🚀 Что уже реализовано

- **Backend** на **Django** и **Django REST Framework** (REST API)
- **PostgreSQL** как основная СУБД
- **Docker** и **Docker Compose** для локальной инфраструктуры
- **Архитектура проекта:** приложения Django + общий слой (`common`: модели, валидаторы, сервисы, permissions)
- **Пользователи и роли:** superadmin, admin, realtor; JWT-аутентификация
- **CRM-каркас** по префиксу `/crm` (скелет разделов и маршрутов)
- **CRUD объектов недвижимости** (типы объектов, детали, контакты)
- **Фото:** загрузка, порядок, главное фото
- **Видео:** ссылки на ролики
- **Публикация:** статусы **draft** / **published** / **archived** и логика переходов
- **CRM permissions:** доступ риэлтора к **своим** объектам
- **API для CRM** (структура эндпоинтов под внутреннюю работу)
- **Стабильность backend:** миграции, админка, согласованность моделей и API

## 🧩 В разработке (Roadmap)

- **Frontend** на **Next.js** (развитие UI)
- Каталог объектов на сайте
- Карточка объекта
- Поиск и фильтры
- SEO-страницы листингов
- Карта (**Yandex Maps**)
- Лиды (заявки с сайта)
- Полноценный **CRM-интерфейс**
- Статьи / блог
- Дополнительная **оптимизация изображений**
- **Redis** + **Celery** (фоновые задачи)

## 🛠️ Технологии

| Область        | Стек                          |
|----------------|-------------------------------|
| Backend        | Django, Django REST Framework |
| База данных    | PostgreSQL                    |
| Frontend       | Next.js (в развитии)          |
| Стили          | Tailwind CSS (планируется)    |
| Разработка     | Docker, Docker Compose        |

## 📦 Запуск проекта

1. Скопируйте переменные окружения (при необходимости) из `.env.example` в `.env` в корне проекта.

2. Поднимите сервисы:

   ```bash
   docker compose up --build
   ```

3. Примените миграции (в контейнере backend):

   ```bash
   docker compose exec backend python manage.py migrate
   ```

4. Запустите Django dev-сервер внутри контейнера backend (порт **8001** с хоста → **8000** в контейнере):

   ```bash
   docker compose exec backend python manage.py runserver 0.0.0.0:8000
   ```

5. **Админка и API:** [http://localhost:8001/admin/](http://localhost:8001/admin/) и API по настройкам проекта.

6. Слот под **frontend:** [http://localhost:3000](http://localhost:3000) (инфраструктура в Compose; полноценное Next.js-приложение развивается в репозитории).

**Без Docker** (если БД и окружение уже настроены локально):

```bash
cd backend
python manage.py migrate
python manage.py runserver
```

## 📬 Контакты

**Telegram:** [https://t.me/VadikQA](https://t.me/VadikQA)

---

# 🏠 Real Estate Platform + CRM

**Repository:** [github.com/Saitama4722/real-estate-platform](https://github.com/Saitama4722/real-estate-platform)

A modern **real estate web app** and **property listing platform** with an internal **CRM for realtors** and agencies: Django-powered backend, public catalog direction, and unified property management.

## 🚀 Features implemented

- **Backend** with **Django** and **Django REST Framework** (REST API)
- **PostgreSQL** as the primary database
- **Docker** and **Docker Compose** for local infrastructure
- **Project architecture:** Django apps + shared **common** layer (models, validators, services, permissions)
- **Users and roles:** superadmin, admin, realtor; JWT authentication
- **CRM skeleton** under the `/crm` prefix (sections and route scaffold)
- **Property CRUD** (property types, details, contacts)
- **Photos:** upload, reorder, main image
- **Videos:** external video links
- **Publication workflow:** **draft** / **published** / **archived** states and transition rules
- **CRM permissions:** realtors access **their own** listings only
- **CRM-oriented API** structure for internal operations
- **Backend reliability:** migrations, admin, aligned models and API surface

## 🧩 Roadmap

- **Next.js** frontend (full UI rollout)
- Public **property catalog**
- **Property detail** pages
- **Search** and **filters**
- **SEO**-oriented listing pages
- **Map** integration (**Yandex Maps**)
- **Leads** (inbound inquiries)
- Full **CRM interface**
- **Articles / blog**
- Further **image optimization**
- **Redis** + **Celery** for background jobs

## 🛠️ Tech stack

| Layer        | Stack                         |
|--------------|-------------------------------|
| Backend      | Django, Django REST Framework |
| Database     | PostgreSQL                    |
| Frontend     | Next.js (in development)      |
| Styling      | Tailwind CSS (planned)        |
| Dev tooling  | Docker, Docker Compose        |

## 📦 Getting started

1. Copy environment variables from `.env.example` to `.env` at the project root if needed.

2. Start all services:

   ```bash
   docker compose up --build
   ```

3. Run migrations inside the backend container:

   ```bash
   docker compose exec backend python manage.py migrate
   ```

4. Start the Django development server in the backend container (host port **8001** maps to **8000** in the container):

   ```bash
   docker compose exec backend python manage.py runserver 0.0.0.0:8000
   ```

5. **Admin & API:** [http://localhost:8001/admin/](http://localhost:8001/admin/) and API routes as configured in the project.

6. **Frontend slot:** [http://localhost:3000](http://localhost:3000) (Compose service; the Next.js app evolves in this repo).

**Without Docker** (if PostgreSQL and env are set up locally):

```bash
cd backend
python manage.py migrate
python manage.py runserver
```

## 📬 Contact

**Telegram:** [https://t.me/VadikQA](https://t.me/VadikQA)
