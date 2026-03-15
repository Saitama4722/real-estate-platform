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
