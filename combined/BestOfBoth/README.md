# BestOfBoth

Combined logistics marketplace frontend/backend using the strongest implementations from both source projects.

## Architecture

- **Backend**: FastAPI + SQLAlchemy + MySQL
- **Frontend**: Next.js + TypeScript + Tailwind CSS
- **API prefix**: `/api`
- **Auth**: JWT access + refresh tokens

## Backend

Run from `api/`:

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## Frontend

Run from `frontend/`:

```bash
npm install
npm run dev
```

## Docker

```bash
docker compose build
docker compose up
```

Frontend: http://localhost:3000
Backend: http://localhost:8000/api

## API

- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `GET /api/auth/me`
- `PATCH /api/auth/me`
- `POST /api/jobs`
- `POST /api/jobs/{id}/accept`
- `POST /api/jobs/{id}/start`
- `POST /api/jobs/{id}/complete`
- `POST /api/jobs/{id}/decline`
- `GET /api/jobs`
- `GET /api/providers`
- `GET /api/provider/requests`
- `PATCH /api/provider/status`
- `GET /api/provider/trucks`
- `GET /api/events/stream`

## Tests

```bash
cd api
pytest
```
