# Real Estate Platform

**Repository:** [Saitama4722/real-estate-platform](https://github.com/Saitama4722/real-estate-platform)

A modern **real estate platform** and **property management system** combining a public **property catalog** with an internal **real estate CRM** for agencies. Built with **Django backend** and **Next.js frontend** as a scalable **proptech platform**.

---

## English Overview

**Real Estate Platform** is a PropTech solution for real estate agencies. It provides:

- A **public property catalog** with SEO-optimized listing structure and location filtering
- A future **internal CRM** for real estate agencies and staff
- Scalable backend architecture and mobile-first responsive UI

The platform uses **Django** and **Django REST Framework** on the backend, **PostgreSQL** as the database, and **Next.js** with **TypeScript** and **TailwindCSS** on the frontend. Development runs via **Docker** and **docker-compose**. The UI is **mobile-first** and **responsive**; Bootstrap is **not** used.

The MVP is limited to **Krasnodar Krai** — cities **Krasnodar** and **Gelendzhik**. The system is not designed for all of Russia in the first version.

---

## Russian Overview / Русская версия

**Real Estate Platform** — платформа недвижимости для агентств: публичный каталог объектов с SEO-оптимизированной структурой листингов и фильтрацией по локациям, а также будущая внутренняя **CRM для риелторов** и сотрудников агентств.

- **Backend:** Django, Django REST Framework, PostgreSQL  
- **Frontend:** Next.js, TypeScript, TailwindCSS (mobile-first, без Bootstrap)  
- **Инфраструктура:** Docker, docker-compose  

MVP ограничен **Краснодарским краем** — города **Краснодар** и **Геленджик**. В первой версии система не рассчитана на всю Россию.

---

## Key Features

- **Property catalog** — public real estate listings with location filtering  
- **SEO-optimized** listing structure for better discoverability  
- **Internal CRM** (planned) — for agency staff and realtors  
- **Scalable architecture** — clear separation of backend apps and services  
- **Mobile-first** responsive design  
- **Docker-based** local development

---

## Technology Stack

| Layer          | Stack |
|----------------|--------|
| **Backend**    | Django, Django REST Framework, Python |
| **Database**   | PostgreSQL |
| **Frontend**   | Next.js, TypeScript, TailwindCSS |
| **Infrastructure** | Docker, docker-compose |

---

## Project Architecture

- **Backend:** Django project with multiple apps (`users`, `agencies`, `locations`, `properties`, `leads`, `articles`, `seo`, `common`). Shared utilities: abstract timestamp model, validators, serializers, services layer, permissions.
- **Frontend:** Next.js app (in repo; UI planned as mobile-first, no Bootstrap).
- **Database:** PostgreSQL; backend connects via Docker `db` service.
- **Docs:** Project rules, MVP scope, architecture, and git workflow live in `docs/`.

---

## Project Structure

```
real-estate-platform
│
├── backend/
├── frontend/
├── docs/
├── docker-compose.yml
├── README.md
├── .env.example
└── .gitignore
```

| Directory   | Description |
|------------|-------------|
| `backend/` | Django backend (DRF, PostgreSQL, apps: users, agencies, locations, properties, leads, articles, seo, common) |
| `frontend/`| Next.js frontend application |
| `docs/`    | Project documentation (rules, MVP scope, architecture, git workflow) |

---

## Current Progress

Development is **stage-based**. Stages 1 and 2 are **completed**. Stage 3 is **not** started.

---

## Completed Stages

### Stage 1 — Project Foundation

- Repository structure (backend, frontend, docs)
- Root README and project rules
- MVP scope documentation
- Architecture documentation
- Git workflow documentation
- Docker development infrastructure (PostgreSQL + backend/frontend containers)

### Stage 2 — Backend Foundation

- Django project initialized
- PostgreSQL configured and connected
- DRF configured
- CORS configured
- Backend running in Docker

**Backend apps created:**

- `users`, `agencies`, `locations`, `properties`, `leads`, `articles`, `seo`, `common`

**Common backend utilities:**

- Abstract timestamp model
- Shared validators
- Shared serializers
- Services layer structure
- Permissions structure

---

## MVP Scope

- **Property sales** only (no rental in current scope)
- **Public catalog** and property card pages
- **Future internal CRM** for staff
- **No public self-registration** — users created by admin
- **No import** from external systems in current scope
- **Geography:** Krasnodar Krai — Krasnodar, Gelendzhik (not nationwide)

---

## Development Notes

- Backend and database run in Docker. Stage 2 backend foundation is complete.
- Frontend (Next.js) is in the repo; UI is planned as mobile-first, no Bootstrap.
- See `docs/project-rules.md`, `docs/mvp-scope.md`, `docs/architecture.md`, `docs/git-workflow.md` for details.

---

## How to Run Locally

1. From the project root, start all services:

   ```bash
   docker compose up --build
   ```

2. **Backend:** [http://localhost:8001](http://localhost:8001)  
   (e.g. [http://localhost:8001/admin/](http://localhost:8001/admin/) for Django admin)

3. **Frontend:** [http://localhost:3000](http://localhost:3000)

Run migrations inside the backend container if needed:

```bash
docker compose exec backend python manage.py migrate
```

---

## Next Planned Stage

**Stage 3 — Users and Roles**

- Custom user model  
- Authentication  
- User roles  
- Agency users  

*(Not yet started.)*

---

## Documentation

- [docs/project-rules.md](docs/project-rules.md) — project rules  
- [docs/mvp-scope.md](docs/mvp-scope.md) — MVP scope  
- [docs/architecture.md](docs/architecture.md) — system architecture  
- [docs/git-workflow.md](docs/git-workflow.md) — Git workflow  

---

## License

*Placeholder — to be defined.*
