# BestOfBoth (نقل - Naql)

**BestOfBoth** is a unified, production-grade freight logistics platform combining:
* **Backend:** `VeryPrivateProjectAlpha` (FastAPI, MySQL, Redis, async SQLAlchemy, OAuth2/JWT + refresh tokens, 6-digit OTP email verification, atomic provider locking, live SSE stream, 100% passing test suite).
* **Frontend:** `ProjectAlpha` (Next.js 16, React 19, Tailwind CSS, Leaflet interactive map, bilingual English/Arabic with RTL support, brand red `#e53935` styling, truck images).

---

## 🏗️ Architecture

```text
BestOfBoth/
├── api/                    # FastAPI Backend (Source of Truth: VeryPrivateProjectAlpha)
│   ├── app/
│   │   ├── core/           # Security, database connection, Redis client
│   │   ├── models/         # SQLAlchemy models (User, Job, Truck, Provider, etc.)
│   │   ├── routers/        # /auth, /jobs, /provider, /events (SSE), /company
│   │   └── schemas/        # Pydantic schemas
│   ├── tests/              # 27 Pytest unit & integration tests (100% passing)
│   ├── Dockerfile
│   └── requirements.txt    # (Strictly NO Alembic)
├── frontend/               # Next.js Frontend (Source of Truth: ProjectAlpha)
│   ├── app/                # App Router pages (/login, /register, /book, /trip, /provider, /admin)
│   ├── public/             # Static assets, SVG icons, and /truck-pic
│   ├── src/
│   │   ├── components/     # Layout, Header, BottomNav, Leaflet TruckMap, RoleGuard
│   │   ├── contexts/       # AuthContext (with automatic refresh), LangContext (EN/AR)
│   │   └── lib/            # api.ts (unified /api client, SSE subscriber), types.ts
│   ├── Dockerfile
│   └── package.json
├── nginx.conf              # Production reverse proxy with SSE buffering disabled
├── docker-compose.yml      # Orchestrates nginx, frontend, api, MySQL 8, and Redis
├── .env.example            # Clean environment template (zero committed secrets)
└── README.md
```

---

## 🚀 Key Integrations & Features

### 1. Unified Authentication
- **OAuth2 Login:** Supports username, email, or phone number identifier + password.
- **Tokens:** Issues short-lived JWT access tokens and long-lived refresh tokens.
- **Auto-Refresh Queue:** Frontend `api.ts` transparently catches 401s, calls `/api/auth/refresh`, updates tokens, and retries requests without user disruption.
- **Two-Step Registration with OTP:** Generates a 6-digit numeric OTP code sent to user email (or logged in development when SMTP is unconfigured) with countdown timer and resend support.
- **Role-Based Routing:** Customers are directed to `/book`, Providers to `/provider`, and Admins to `/admin`.

### 2. Streamlined 4-Step Booking Experience
1. **Vehicle Selection:** Select from available fleet classes (`small`, `medium`, `large`, `xl`) with real truck photos, dimensions, load capacities, and instant haversine distance pricing.
2. **Locations:** Select pickup & drop-off governorates/cities and enter precise street address details. Validates that pickup and drop-off locations are distinct.
3. **Booking Mode & Budget:**
   - **Quick Request:** Broadcasts instantly to all nearby active providers for fastest response.
   - **Selective Request:** Allows hand-picking a specific provider from our active fleet in Step 4.
   - **Target Budget:** Specify your willing target price in EGP.
4. **Provider & Confirmation:** Review all cargo details, route summary, and confirm. Real backend job dispatch creates an active job and redirects to live shipment tracking.

### 3. Provider Operations Dashboard
- **Online/Offline Availability:** Toggle provider online status.
- **Incoming Requests:** View eligible freight jobs, assign an active truck from your fleet, and accept or decline with atomic concurrency protection.
- **Active Trips:** Transition accepted jobs to `in_progress` ("Start Trip") and mark as `completed` ("Complete Trip").
- **Fleet Management:** Add trucks, enter license plate and capacity, toggle activation, and delete trucks.

### 4. Real-Time Tracking (SSE)
- Real-time updates delivered over `/api/events/stream` via Server-Sent Events.
- Trip status transitions update live on the `/trip` tracking dashboard without manual refreshes.

---

## 🛠️ Quickstart with Docker Compose

1. Copy the environment file:
```bash
cp .env.example .env
```

2. Start all services:
```bash
docker compose up --build -d
```

3. Access the platform:
- **Frontend / Main Portal:** [http://localhost](http://localhost) (or [http://localhost:3000](http://localhost:3000))
- **API Documentation (Swagger):** [http://localhost:8000/docs](http://localhost:8000/docs)
- **API Healthcheck:** [http://localhost:8000/api/health](http://localhost:8000/api/health)

---

## 💻 Local Development Setup

### Backend (FastAPI)
```bash
cd api
python -m venv .venv
# On Windows:
.venv\Scripts\activate
# On Linux/macOS:
source .venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Setup by Docker
From Project Root folder
```bash
Run
   docker compose up --build -d
NOTE: make sure you wait till all become green (running, started, created)
```

### Running Backend Tests
All 27 integration and unit tests are configured to run with in-memory SQLite:
```bash
cd api
pytest tests -v
```

### Frontend (Next.js)
```bash
cd frontend
npm install
npm run dev
```

---

## 🔒 Security & Standards Compliance
- **Strictly NO Alembic:** Database schemas and tables are managed cleanly without Alembic.
- **Single API Prefix:** All backend endpoints are exposed under `/api` (no `/api/v1` or `/api2`).
- **Zero Secrets Committed:** No hardcoded API keys, JWT secrets, or passwords in source control.
- **Concurrency Protection:** Concurrent job acceptance is guarded atomically via database row locks and state checks, preventing duplicate allocations.
