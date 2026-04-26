# AGENTS.md

## Cursor Cloud specific instructions

### Overview
Real estate platform with a Django/DRF backend and a planned Next.js frontend. Only the **backend** is implemented; the frontend directory does not exist yet.

### Services
| Service | Status | Port | Notes |
|---------|--------|------|-------|
| PostgreSQL 16 | Required | 5432 | Must be running before backend starts |
| Django backend | Required | 8001 (host) / 8000 (container) | REST API + admin |
| Next.js frontend | Not implemented | 3000 | Placeholder only — no code exists |

### Running the backend (without Docker)
1. Start PostgreSQL: `sudo pg_ctlcluster 16 main start`
2. Activate venv: `source /workspace/backend/.venv/bin/activate`
3. Run migrations: `python manage.py migrate` (from `/workspace/backend`)
4. Start dev server: `python manage.py runserver 0.0.0.0:8001`

### Database
- Default credentials: `postgres`/`postgres`, database `real_estate_db` on localhost:5432.
- The Django settings file (`backend/config/settings.py`) reads DB config from env vars with sane defaults for local dev.

### Key endpoints
See `README.md` and `backend/README.md` for the full API table. Quick reference:
- Admin: `http://localhost:8001/admin/`
- JWT login: `POST /api/auth/login/` with `{"email", "password"}`
- JWT refresh: `POST /api/auth/refresh/` with `{"refresh"}`
- Current user: `GET /api/auth/me/` (requires `Authorization: Bearer <token>`)

### Testing
- `python manage.py test` — runs Django test suite (no tests written yet).
- `python manage.py check` — Django system checks (acts as a lint step).
- No linter config (flake8/ruff/pylint) is set up in the repo.

### Gotchas
- The custom User model requires `--first_name` and `--last_name` with `createsuperuser --noinput`. Example: `DJANGO_SUPERUSER_EMAIL=admin@example.com DJANGO_SUPERUSER_PASSWORD=admin123456 python manage.py createsuperuser --noinput --first_name=Admin --last_name=User`
- `STATICFILES_DIRS` references `backend/static/` which exists but is empty; this is fine.
- The `.env.example` file is for documentation; Django settings use `os.environ.get()` with defaults, so no `.env` loading library is needed for local dev.
