# Real Estate Platform

**Repository:** [Saitama4722/real-estate-platform](https://github.com/Saitama4722/real-estate-platform)

---

## English Overview

**Real Estate Platform** is a PropTech platform for real estate agencies. It combines a **public property catalog** with a future **internal CRM** for realtors and agency staff.

- **Backend:** Django + Django REST Framework, PostgreSQL  
- **Frontend:** Next.js, TypeScript, TailwindCSS (mobile-first; Bootstrap is not used)  
- **Infrastructure:** Docker / docker-compose for local development  

The current MVP is scoped to **Krasnodar Krai** — cities **Krasnodar** and **Gelendzhik**. Geography and project rules are documented in the `docs/` folder.

---

## Русская версия

**Real Estate Platform** — платформа недвижимости для агентств: публичный каталог объектов и будущая внутренняя CRM для риелторов и сотрудников.

- **Backend:** Django + Django REST Framework, PostgreSQL  
- **Frontend:** Next.js, TypeScript, TailwindCSS (mobile-first; Bootstrap не используется)  
- **Инфраструктура:** Docker / docker-compose для локальной разработки  

Текущий MVP ограничен **Краснодарским краем** — города **Краснодар** и **Геленджик**. География и правила проекта описаны в каталоге `docs/`.

---

## Technology Stack

| Layer | Stack |
|-------|--------|
| **Backend** | Django, Django REST Framework, Python |
| **Database** | PostgreSQL |
| **Frontend** | Next.js, TypeScript, TailwindCSS |
| **Infrastructure** | Docker, Docker Compose |
| **Maps** | Yandex Maps (planned) |

---

## Project Structure

```
real-estate-platform/
├── backend/
├── frontend/
├── docs/
├── .env.example
├── .gitignore
├── docker-compose.yml
└── README.md
```

| Directory | Description |
|-----------|--------------|
| `backend/` | Django backend service |
| `frontend/` | Next.js frontend application |
| `docs/` | Project documentation (rules, MVP scope, architecture, git workflow) |

---

## Current Progress

Development is stage-based. The following stages are **completed**. Stage 3 is **not** completed.

---

## Completed Stages

### Stage 1 — Project Foundation

- Repository structure (backend, frontend, docs)
- Root README
- Docker development infrastructure (PostgreSQL + placeholder backend/frontend containers)
- Project rules documentation
- Architecture documentation
- MVP scope documentation
- Git workflow documentation

### Stage 2 — Backend Foundation

**2.1 — Django project**

- Django project created
- Development settings configured
- PostgreSQL connected
- Timezone, static, media configured
- Basic CORS configured
- DRF configured
- Migrations verified inside Docker
- Backend successfully starts

**2.2 — Backend apps**

- `users`, `agencies`, `locations`, `properties`, `leads`, `articles`, `seo`, `common`

**2.3 — Common backend utilities**

- Abstract timestamp base model
- Shared choices structure
- Shared validators structure
- Shared serializers structure
- Shared services structure
- Shared permissions structure

---

## Current MVP Scope

The MVP focuses on:

- **Property sales** (no rental in current scope)
- **Public catalog** and property card pages
- **Future internal CRM** for staff
- **No public self-registration** — users are created by admin
- **Import** from external systems is not implemented
- **Large nationwide scaling** is not part of the current MVP

Geography: Krasnodar Krai — Krasnodar, Gelendzhik.

---

## Development Notes

- Backend and database run in Docker. Stage 2 backend foundation is complete.
- Frontend (Next.js) is in the repo; UI is planned as mobile-first, no Bootstrap.
- See `docs/project-rules.md`, `docs/mvp-scope.md`, `docs/architecture.md`, `docs/git-workflow.md` for details.

---

## Local Run Instructions

1. **Start services (Docker):**

   ```bash
   docker compose up -d
   ```

2. **Check containers:**

   ```bash
   docker compose ps
   ```

3. **Backend (migrations and run):**  
   From the project root, run migrations and start the Django dev server inside the backend container or locally with `POSTGRES_*` pointing to the `db` service. See `backend/README.md` for backend-specific commands.

Backend and database are configured in Docker; the backend app is in `backend/` and connects to the `db` service.

---

## Next Planned Stage

**Stage 3 — Users and Roles**

(Not yet started.)

---

## Documentation

- [docs/project-rules.md](docs/project-rules.md) — project rules  
- [docs/mvp-scope.md](docs/mvp-scope.md) — MVP scope  
- [docs/architecture.md](docs/architecture.md) — system architecture  
- [docs/git-workflow.md](docs/git-workflow.md) — Git workflow  
