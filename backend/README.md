# Backend (Django)

Real estate platform API backend.

## Requirements

- Python 3.10+
- PostgreSQL (e.g. via `docker-compose up -d db` from project root)

## Setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate   # Windows
# source .venv/bin/activate  # Linux/macOS
pip install -r requirements.txt
```

Copy `.env.example` to `.env` in the project root if you use environment variables for DB credentials.

## Run

Ensure PostgreSQL is running (default: `localhost:5432`, database `real_estate_db`, user/password `postgres`).

```bash
python manage.py migrate
python manage.py runserver
```

Server: http://127.0.0.1:8000/

## Run in Docker

From the project root, with `docker compose up -d` running:

```bash
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py runserver 0.0.0.0:8000
```

Backend is then available at http://localhost:8001/ (port 8001 on host maps to 8000 in container).

## Models (overview)

- **User** — custom user (email login, roles: superadmin, admin, realtor).
- **RealtorProfile** — staff profile for realtors (public name, phone, photo, short bio, is_public, optional agency). One-to-one with User; manageable in Django admin.
- **Agency** — entity for realtor profiles and future property assignment (name, slug, logo, phone, email, description, is_active, timestamps).

## Authentication (JWT)

CRM and protected API endpoints require JWT. No public registration; users are created by admin.

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/auth/login/` | POST | — | Body: `{"email","password"}`. Returns `access` and `refresh` tokens. Only active users. |
| `/api/auth/refresh/` | POST | — | Body: `{"refresh":"..."}`. Returns new `access` token. |
| `/api/auth/me/` | GET | JWT | Returns current user (id, email, first_name, last_name, role, is_active, is_staff). |

**Logout:** Handled client-side by discarding stored access and refresh tokens. No backend logout endpoint in this scope.

---

For project-related questions: bvv1@yahoo.com
