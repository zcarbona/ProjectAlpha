# Production Readiness Roadmap & Implementation Plan

> **Note:** Payment gateway integration is deferred as requested. The Flutter mobile client and its build artifacts have been removed; focus is exclusively on the Next.js Web Frontend, FastAPI Async Backend, and MySQL infrastructure.

---

## 1. Trip & Job Execution Lifecycle (End-to-End Delivery)

### Current Gap
The job state machine currently terminates at `JobStatus.ACCEPTED`. Once a provider accepts a job:
1. `provider.is_available` is set to `False` in [jobs.py](file:///home/carbona/ProjectAlpha/api/app/api/v1/jobs.py#L130).
2. Because there are no transition endpoints for transit or completion, the provider is indefinitely unavailable.
3. Customers in [trip/page.tsx](file:///home/carbona/ProjectAlpha/frontend/app/trip/page.tsx) and providers in [provider/page.tsx](file:///home/carbona/ProjectAlpha/frontend/app/provider/page.tsx) have no way to progress shipments.

### Implementation Steps

#### Backend (`api/app/api/v1/jobs.py`)
- **Trip Progression Endpoints:**
  - `POST /api/v1/provider/jobs/{job_id}/start`: Transitions status from `ACCEPTED` to `IN_PROGRESS` (in transit). Emits an `AuditEvent`.
  - `POST /api/v1/provider/jobs/{job_id}/complete`:
    - Validates caller is the assigned provider.
    - Transitions status from `IN_PROGRESS` to `COMPLETED`.
    - Automatically resets `provider.is_available = True` so the driver can receive new orders.
    - Releases any lingering `TruckLock` (`truck_lock.is_active = False`).
    - Emits `AuditEvent`.
  - `POST /api/v1/jobs/{job_id}/cancel`:
    - Ensure cancellation properly resets `provider.is_available = True` if the job was previously accepted.
- **Provider Status Reset / Toggle:**
  - Add `PATCH /api/v1/provider/status` allowing providers to manually toggle their `is_available` status (e.g., when taking breaks or going off-duty).

#### Frontend (`frontend/src/lib/api.ts` & Dashboard Pages)
- Expose `startJob(token, jobId)` and `completeJob(token, jobId)` in `frontend/src/lib/api.ts`.
- In [frontend/app/provider/page.tsx](file:///home/carbona/ProjectAlpha/frontend/app/provider/page.tsx), add interactive action buttons on active jobs:
  - When `ACCEPTED`: Show **"Start Trip"** (`IN_PROGRESS`).
  - When `IN_PROGRESS`: Show **"Complete Delivery"** (`COMPLETED`).
- In [frontend/app/trip/page.tsx](file:///home/carbona/ProjectAlpha/frontend/app/trip/page.tsx), update customer trip tracking stepper to reflect live status transitions in real time.

---

## 2. Real-Time State Synchronization & Event Dispatching

### Current Gap
State updates require manual page reloads or periodic polling. Customers do not know when a driver accepts or arrives, and providers do not receive immediate alerts when a booking is created.

### Implementation Steps

#### Backend (`api/app`)
- **Server-Sent Events (SSE) or WebSockets:**
  - Implement a lightweight pub/sub event broadcaster using FastAPI's `EventSourceResponse` (or WebSockets).
  - Create channel rooms based on `user_id` and `job_id`:
    - `GET /api/v1/events/stream`: Authenticated stream sending events for:
      - `job_created` (notifies targeted provider).
      - `job_accepted` (notifies customer).
      - `trip_started` (notifies customer).
      - `trip_completed` (notifies customer & provider).
- **Driver Telematics (Location Ping):**
  - Add `POST /api/v1/provider/location`: Driver sends current latitude/longitude coordinates.
  - Broadcast location update via the event stream to the customer tracking the active trip.

#### Frontend (`frontend/src/components/MapDashboard.tsx` & Pages)
- Add an event hook (`useJobEvents` or EventSource listener) updating state without page refresh.
- In [frontend/src/components/MapDashboard.tsx](file:///home/carbona/ProjectAlpha/frontend/src/components/MapDashboard.tsx), render the driver's moving marker along the route between pickup and dropoff coordinates.

---

## 3. Production Authentication, Security & Notifications

### Current Gap
- In [auth.py:L147-L165](file:///home/carbona/ProjectAlpha/api/app/api/v1/auth.py#L147-L165), email verification returns the raw secret token in the JSON response.
- Access tokens expire after 15 minutes with no Refresh Token mechanism.
- No "Forgot Password" or password recovery exists.
- Rate limiting is in-memory and will not work across multiple worker processes.

### Implementation Steps

#### Transactional Email Integration
- Create an async mailer utility (`api/app/core/mailer.py`):
  - Support SMTP or an API-based provider (e.g. Resend, SendGrid, Amazon SES).
  - Add HTML email templates for:
    - Account verification.
    - Password reset requests.
    - Job status notifications.
- Update `POST /auth/send-verification` to dispatch the token via email and return only `{ "message": "Verification email sent" }`.

#### Token Refresh & Session Management
- In [security.py](file:///home/carbona/ProjectAlpha/api/app/core/security.py), implement refresh token generation (longer-lived, e.g. 7 days).
- Add `POST /api/v1/auth/refresh` endpoint to exchange a valid refresh token for a new access token without forcing users to re-login.
- Implement `POST /api/v1/auth/forgot-password` and `POST /api/v1/auth/reset-password`.

---

## 4. Database Migrations & Caching Infrastructure

### Current Gap
The project currently executes `Base.metadata.create_all` during startup in [database.py](file:///home/carbona/ProjectAlpha/api/app/core/database.py#L11-L14). This cannot safely evolve schema columns in production.

### Implementation Steps

#### Database Migrations (Alembic)
1. Initialize Alembic async environment:
   ```sh
   alembic init -t async alembic
   ```
2. Configure `alembic.ini` and `env.py` to reference `DATABASE_URL` and `Base.metadata` from `app.models.models`.
3. Generate the baseline initial migration:
   ```sh
   alembic revision --autogenerate -m "initial_schema"
   ```
4. Replace `await init_db()` in [main.py](file:///home/carbona/ProjectAlpha/api/app/main.py) lifespan with programmatic Alembic migration execution, or run `alembic upgrade head` in Docker startup scripts.

#### Distributed Rate Limiting & Cache (Redis)
- Add `redis:7-alpine` service to [docker-compose.yml](file:///home/carbona/ProjectAlpha/docker-compose.yml).
- Replace `_rate_limit_store` dictionary in [security.py](file:///home/carbona/ProjectAlpha/api/app/core/security.py) with Redis sliding-window rate limiting.

---

## 5. Automated Testing & CI/CD Pipeline

### Current Gap
- Tests in `tests/test_jobs.py` were outdated (tested removed `requested_min_price` parameters).
- No automated pipeline runs on pull requests or commits.

### Implementation Steps
- Update [tests/test_jobs.py](file:///home/carbona/ProjectAlpha/tests/test_jobs.py) and add test suites for:
  - User registration, verification, and login lockout.
  - Provider truck creation & fleet management.
  - Job creation -> Provider acceptance -> Start trip -> Delivery completion cycle.
  - Unauthorized and forbidden access restrictions across customer/provider/admin roles.
- Create GitHub Actions workflow (`.github/workflows/ci.yml`):
  - Linting (ESLint for Next.js, Ruff/Flake8 for Python).
  - Type-checking (`tsc` for Next.js, MyPy for Python).
  - Running Pytest against an ephemeral MySQL/SQLite test container.

---

## Phased Execution Plan

```
Phase 1: Trip Lifecycle Completion (Immediate)
 ├── Add /jobs/{id}/start and /jobs/{id}/complete endpoints
 ├── Re-enable provider availability on job completion/cancellation
 └── Add action buttons to Next.js Provider & Customer dashboards

Phase 2: Database Migration System (Short-term)
 ├── Set up Alembic async migrations
 └── Ensure migrations run automatically on container startup

Phase 3: Auth Robustness & Comms (Short-term)
 ├── Implement true email dispatch (Resend/SMTP)
 ├── Implement JWT refresh tokens & password reset
 └── Add live updates / SSE for job state changes

Phase 4: Production Hardening & CI/CD (Medium-term)
 ├── Redis integration for rate-limiting
 ├── Full automated test suite
 └── Production Docker Compose & HTTPS reverse proxy configuration
```
