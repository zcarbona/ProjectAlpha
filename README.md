# Naql Logistics Platform — Complete System Architecture & Deployment Guide

Naql is an on-demand freight and shipping marketplace platform built with a **Next.js 19** frontend, an asynchronous **FastAPI** backend service, and a **MySQL 8.0** relational database running in containerized Docker environments.

This guide provides a comprehensive technical walkthrough of the codebase, every API endpoint, an audit of active versus dead code paths, concrete recommendations on what to implement versus delete, and the exact steps required for production deployment.

![Naql System Architecture & Endpoints Topology](./endpoints_and_deadpoints.png)

---

## Table of Contents

1. [High-Level System Architecture](#1-high-level-system-architecture)
2. [Codebase Structure & Component Breakdown](#2-codebase-structure--component-breakdown)
3. [Complete API Endpoints Catalog](#3-complete-api-endpoints-catalog)
4. [Dead Points & Unreachable Code Audit](#4-dead-points--unreachable-code-audit)
5. [What Should Be Implemented vs. What Should Be Deleted](#5-what-should-be-implemented-vs-what-should-be-deleted)
6. [Step-by-Step Production Deployment Guide](#6-step-by-step-production-deployment-guide)
7. [Testing & Quality Assurance](#7-testing--quality-assurance)

---

## 1. High-Level System Architecture

Naql facilitates freight transportation by connecting cargo shippers (**Customers**) with fleet operators and drivers (**Providers**) through a curated provider-selection model.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CLIENT / FRONTEND TIER                          │
│   Next.js 19 (App Router) • React 19 • TypeScript • Tailwind CSS       │
│   AuthContext (State) • Leaflet (MapDashboard) • useJobEvents (SSE)    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP REST & SSE Stream (/api)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         BACKEND SERVICE TIER                           │
│   FastAPI (Async Python 3.11+) • Pydantic v2 • SQLAlchemy 2.0 Async    │
│   OAuth2 Password Flow • Structlog JSON Logging • In-Memory SSE Bus   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Async MySQL Connection (aiomysql)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         PERSISTENCE & STORAGE                          │
│   MySQL 8.0 InnoDB • Seeded Company & Vehicle Data • Audit Trail       │
└────────────────────────────────────────────────────────────────────────┘
```

### Core Business Workflow

1. **Authentication & Identity:**
   - Users register with `email`, `username`, `phone_number`, `password`, and a selected `role` (`customer`, `provider`, or `admin`).
   - Passwords are encrypted with `bcrypt`. Logins yield JWT `access_token` and `refresh_token`.
2. **Customer Booking Flow (Provider-Selection):**
   - Customer chooses vehicle type (`small`, `medium`, `large`, `xl`) and pickup/dropoff cities.
   - Customer queries `/api/providers?vehicle_class={class}` to view providers with available capacity.
   - Customer submits the booking to `/api/jobs` with an `idempotency_key`, creating a job in `pending` status.
3. **Provider Dispatch & Acceptance:**
   - Provider fetches unassigned jobs targeted to them via `/api/provider/requests`.
   - Provider selects one of their active trucks and accepts the request via `/api/jobs/{id}/accept`. Status shifts: `pending` ➔ `accepted`.
4. **Trip Lifecycle:**
   - Driver marks trip started via `/api/provider/jobs/{id}/start`: status shifts `accepted` ➔ `in_progress`.
   - Driver marks delivery complete via `/api/provider/jobs/{id}/complete`: status shifts `in_progress` ➔ `completed`.
   - Provider availability is restored (`is_available = True`) and truck lock is released.
5. **Auditing:** Every state change emits an event to the `audit_events` table recording user ID, IP address, user-agent, and timestamp.

---

## 2. Codebase Structure & Component Breakdown

### 2.1 Backend (`api/app/`)

- **`main.py`:** Application entrypoint. Configures `structlog`, registers CORS middleware (`localhost:3000`, `localhost:8080`, `frontend:80`), manages the `lifespan` context (runs `init_db()` and `seed_company_data()`), and mounts route controllers under `/api`.
- **`core/database.py`:** Sets up the SQLAlchemy asynchronous engine using `DATABASE_URL` (`mysql+aiomysql`). Handles table initialization and default database seeding (company profile, 4 vehicle categories: `small`, `medium`, `large`, `xl`, and 6 Egyptian cities: Cairo, Alexandria, Giza, Luxor, Aswan, Port Said).
- **`core/security.py`:** JWT generation and verification, `bcrypt` password hashing, password strength validation, brute-force rate-limiting, and FastAPI dependency `require_role(role)`.
- **`models/models.py`:** Declarative ORM models:
  - `User`: Accounts, credentials, lockouts, refresh tokens.
  - `Provider`: Fleet operator profiles linked 1:1 with `User`.
  - `Truck`: Vehicle registrations, license plates, capacities.
  - `Job`: Dispatch lifecycle state, pickup/dropoff locations, provider & truck assignments.
  - `VehicleType` & `City`: Lookup tables seeded on startup.
  - `AuditEvent`: Security and transaction audit trails.
  - `JobDecline`: Tracks provider declines.
  - `TruckLock`: Locks a truck to prevent double-booking.
  - `ProviderFleet`: Aggregated fleet capacity counts per vehicle type.
  - `Payment`: Stripe payment intent record *(Deferred)*.
  - `PriceApproval`: Provider negotiation record *(Unreachable legacy)*.
- **`schemas/user.py` & `schemas/jobs.py`:** Pydantic v2 schemas for request validation and response serialization.
- **`api/v1/auth.py`:** User registration, OAuth2 login, token refresh, and user profile management.
- **`api/v1/jobs.py`:** Job creation, customer cancellation, provider job acceptance, trip start, and trip completion.
- **`api/v1/provider.py`:** Fleet CRUD operations, truck registration, and provider discovery.
- **`api/v1/company.py`:** Company profile lookup, city/vehicle lookups, and administrative dashboards.
- **`api/v1/events.py`:** Real-time Server-Sent Events (SSE) broadcaster.

### 2.2 Frontend (`frontend/`)

- **`src/contexts/AuthContext.tsx`:** React context maintaining user session, JWT token in `localStorage`, login, register, and logout handlers.
- **`src/lib/api.ts`:** Typed HTTP client wrapper communicating with backend endpoints under `/api`.
- **`src/lib/types.ts`:** TypeScript interfaces matching Pydantic response models.
- **`src/components/RoleGuard.tsx`:** Route guard protecting pages based on `user.role`.
- **`src/components/Header.tsx`:** Top navigation bar displaying user initials, identity, and sign-out button.
- **`src/components/BottomNav.tsx`:** Mobile navigation footer bar.
- **`src/components/MapDashboard.tsx`:** Dynamic Leaflet map visualizing pickup and dropoff markers.
- **`src/hooks/useJobEvents.ts`:** EventSource client hook connecting to `/api/events/stream`.
- **`app/page.tsx`:** Landing page that inspects auth state and redirects users to `/admin`, `/provider`, or `/book`.
- **`app/login/page.tsx` & `app/register/page.tsx`:** Authentication forms.
- **`app/book/page.tsx`:** Customer multi-step booking wizard (vehicle class ➔ city selection ➔ provider selection ➔ confirmation).
- **`app/trip/page.tsx`:** Customer dashboard displaying active requests and trip history.
- **`app/provider/page.tsx`:** Provider command center (requests feed, active jobs, truck CRUD, fleet capacities).
- **`app/admin/page.tsx`:** Admin metrics (active users, requests today, revenue) and driver directory.
- **`app/profile/page.tsx`:** User profile viewer and password updater.

### 2.3 Mobile Mockup Code (`Swift/` & `Naql/`)

- Contains 12 SwiftUI source files representing mobile UI concepts.
- **Critical Note:** These files use 100% hardcoded mock data arrays with zero networking code (`URLSession` or HTTP). `Naql/` is an identical duplicate copy of `Swift/`.

---

## 3. Complete API Endpoints Catalog

All routes are mounted under the `/api` prefix.

### 3.1 Authentication & Profile (`/api/auth`)

| Method | Endpoint | Auth | Request Body | Response | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Public | `UserCreate` (username, email, phone, password, role) | `UserOut` (201) | Registers customer, provider, or admin |
| `POST` | `/api/auth/login` | Public | URL-encoded form (`username`, `password`) | `Token` (`access_token`, `refresh_token`) | Authenticates user; returns JWTs |
| `GET` | `/api/auth/me` | Bearer | None | `UserOut` | Fetches current user profile |
| `PATCH` | `/api/auth/me` | Bearer | `UserUpdate` (username, email, password) | `UserOut` | Updates profile fields and credentials |
| `POST` | `/api/auth/refresh` | Bearer | None | `Token` | Issues fresh token from refresh token *(Unused in UI)* |

### 3.2 Metadata & Public Lookups

| Method | Endpoint | Auth | Query / Body | Response | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/company` | Public | None | `CompanyOut` | Company name, contact email, phone, address |
| `GET` | `/api/vehicle-types` | Public | None | `list[VehicleTypeOut]` | Supported vehicle classes, capacities, price ranges |
| `GET` | `/api/cities` | Public | None | `list[CityOut]` | Operating cities with latitude & longitude |
| `GET` | `/api/providers` | Public | `?vehicle_class={class}` | `list[{"id", "display_name"}]` | Lists active providers supporting vehicle class |

### 3.3 Customer Job Operations

| Method | Endpoint | Auth | Request Body | Response | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/jobs` | Customer | `JobCreate` (pickup, dropoff, vehicle_class, provider_id, idempotency_key) | `JobOut` (201) | Creates a booking in `pending` state |
| `GET` | `/api/jobs` | Customer | None | `list[JobOut]` | Retrieves current customer's requests |
| `POST` | `/api/jobs/{id}/cancel` | Customer | None | `JobOut` | Cancels a job *(Pending or Accepted)* |

### 3.4 Provider Dispatch & Operations

| Method | Endpoint | Auth | Request Body | Response | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/provider/requests` | Provider | None | `list[JobOut]` | Pending requests targeted to this provider |
| `POST` | `/api/jobs/{id}/accept` | Provider | `JobAccept` (`truck_id`) | `JobOut` | Assigns truck, transitions `pending` ➔ `accepted` |
| `POST` | `/api/jobs/{id}/decline` | Provider | None | `{"success": true}` | Rejects a job request |
| `GET` | `/api/provider/jobs` | Provider | None | `list[JobOut]` | Retrieves provider's active and historical jobs |
| `POST` | `/api/provider/jobs/{id}/start` | Provider | None | `JobOut` | Starts trip: `accepted` ➔ `in_progress` |
| `POST` | `/api/provider/jobs/{id}/complete` | Provider | None | `JobOut` | Completes trip: `in_progress` ➔ `completed` |
| `POST` | `/api/provider/jobs/{id}/price-approval` | Provider | `PriceDecision` | `JobOut` | Price approval review *(Unreachable dead route)* |
| `POST` | `/api/provider/location` | Provider | Query: `?lat={float}&lon={float}` | `{"success": true}` | Updates driver GPS location *(Dead in UI)* |
| `POST` | `/api/provider/status` | Provider | `{"is_available": bool}` | `{"status": bool}` | Toggles provider duty availability *(Dead in UI)* |

### 3.5 Provider Fleet Management

| Method | Endpoint | Auth | Request Body | Response | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/provider/trucks` | Provider | None | `list[TruckOut]` | Lists all trucks owned by current provider |
| `POST` | `/api/provider/trucks` | Provider | `TruckCreate` (plate_number, vehicle_class, is_active) | `TruckOut` (201) | Adds a new truck to provider's fleet |
| `PATCH` | `/api/provider/trucks/{id}` | Provider | `TruckUpdate` (plate_number, vehicle_class, is_active) | `TruckOut` | Modifies truck attributes or active status |
| `DELETE` | `/api/provider/trucks/{id}` | Provider | None | 204 No Content | Deletes truck from fleet |
| `GET` | `/api/provider/fleet` | Provider | None | `list[FleetItemOut]` | Fleet summary grouped by vehicle category |
| `PATCH` | `/api/provider/fleet/{id}` | Provider | `FleetItemUpdate` (quantity, is_active) | `FleetItemOut` | Updates vehicle type inventory and availability |

### 3.6 Admin Management

| Method | Endpoint | Auth | Request Body | Response | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/admin/stats` | Admin | None | `AdminStats` | Platform metrics: users, daily requests, revenue |
| `GET` | `/api/admin/requests` | Admin | None | `list[AdminRequest]` | Audit feed of all customer requests |
| `GET` | `/api/admin/drivers` | Admin | None | `list[AdminDriver]` | List of registered drivers and trucks |

### 3.7 Real-Time Event Stream

| Method | Endpoint | Auth | Headers | Response | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/events/stream` | Bearer | `Accept: text/event-stream` | SSE Stream | Broadcasts real-time events (`job_accepted`, `trip_started`, `trip_completed`) |

---

## 4. Dead Points & Unreachable Code Audit

During the codebase scan, 8 critical dead points, unreachable routes, and UI mismatches were uncovered:

```
                                  SYSTEM DEAD POINTS MAP
  ┌──────────────────────────────────────────────────────────────────────────────────┐
  │ 1. POST /provider/jobs/{id}/price-approval    --> Unreachable (Enforces dead state)│
  │ 2. POST /provider/location & /provider/status --> Implemented in API, 0 UI calls │
  │ 3. GET /api/trucks                            --> Unauthenticated legacy route   │
  │ 4. POST /api/auth/refresh                     --> Discarded by frontend          │
  │ 5. useJobEvents.ts Hook                       --> Never imported or mounted      │
  │ 6. Customer Trip Cancellation                 --> Blocked by UI status mismatch  │
  │ 7. Swift/ & Naql/ Folders                     --> 100% Mock SwiftUI prototypes   │
  │ 8. payments DB Table                          --> Orphaned model (Stripe deferred)│
  └──────────────────────────────────────────────────────────────────────────────────┘
```

### 🛑 Dead Point 1: Unreachable Price-Approval Endpoint
- **Location:** `api/app/api/v1/jobs.py` (`price_approval`)
- **Root Cause:** Line 296 rejects calls with 404 unless `job.status == JobStatus.AWAITING_PRICE_APPROVAL`. However, in the provider-selection booking flow, jobs are created in `PENDING` and accepted directly into `ACCEPTED`. No code in the entire project ever sets `AWAITING_PRICE_APPROVAL`.
- **Frontend Symptom:** `frontend/app/provider/page.tsx` imports `approvePrice` on line 11, but never calls it anywhere.

### 🛑 Dead Point 2: Unused Driver Location & Online Status Endpoints
- **Location:** `api/app/api/v1/provider.py` (`update_location`) & `api/app/api/v1/jobs.py` (`set_status`)
- **Root Cause:** Both endpoints exist in FastAPI and pass tests in `tests/test_workflow.py`, but the Next.js frontend has **zero** UI toggles, geolocation watchers, or API client methods that call them.

### 🛑 Dead Point 3: Unauthenticated Global `/trucks` Endpoint
- **Location:** `api/app/api/v1/jobs.py:L40` (`trucks`)
- **Root Cause:** Returns a raw list of all active trucks across all providers without authentication or tenant isolation. A wrapper `getTrucks()` exists in `frontend/src/lib/api.ts`, but no UI screen ever calls it.

### 🛑 Dead Point 4: Stranded JWT Refresh Endpoint
- **Location:** `api/app/api/v1/auth.py:L148` (`refresh_token`)
- **Root Cause:** The `/api/auth/login` route returns both `access_token` and `refresh_token`. However, `frontend/src/contexts/AuthContext.tsx` discards `refresh_token` and only persists `access_token` in `localStorage`. Seamless token rotation never occurs.

### ⚠️ Dead Point 5: Dormant Real-Time Event Hook
- **Location:** `frontend/src/hooks/useJobEvents.ts`
- **Root Cause:** A complete SSE hook exists to receive dispatch updates (`job_accepted`, `trip_started`, `trip_completed`), but **no file in `frontend/app/` imports `useJobEvents`**. Both `/trip` and `/provider` update only on manual browser refreshes.

### ⚠️ Dead Point 6: Customer Trip Cancellation UI Deadlock
- **Location:** `frontend/app/trip/page.tsx:L117-L124`
- **Root Cause:** The UI renders the Cancel button only when `job.status === 'awaiting_provider_price_approval' || job.status === 'awaiting_payment'`. Because standard bookings are `pending` and `accepted`, **the Cancel button is permanently hidden from customers**, even though the backend permits cancellation for `PENDING` and `ACCEPTED` jobs.

### ⚠️ Dead Point 7: Mobile Navigation Mismatch for Admins
- **Location:** `frontend/src/components/BottomNav.tsx:L13-L23`
- **Root Cause:** `BottomNav` performs a binary role check (`isProvider ? ... : ...`). When an administrator logs into `/admin`, the bottom bar displays Customer tabs (`BOOK`, `MY TRIP`, `PROFILE`).

### 🟣 Dead Point 8: Disconnected Swift Prototype Directories
- **Location:** `Swift/` and `Naql/`
- **Root Cause:** 12 SwiftUI source files that rely entirely on hardcoded mock arrays with zero HTTP/networking logic. `Naql/` is an identical duplicate copy of `Swift/`.

### 🟣 Dead Point 9: Orphaned Database Models & Stranded Enums
- **Location:** `api/app/models/models.py`
- **Root Cause:** `Payment` model with `stripe_payment_intent_id` exists with no backend endpoints. `JobStatus.AWAITING_PRICE_APPROVAL`, `JobStatus.AWAITING_PAYMENT`, and `JobStatus.REJECTED` are unused stranded enum states.

---

## 5. What Should Be Implemented vs. What Should Be Deleted

To bring this codebase to a clean, production-ready state, follow this concrete implementation and deletion roadmap:

### 5.1 What Should Be IMPLEMENTED

| Task | File to Modify | Action Required |
| :--- | :--- | :--- |
| **1. Fix Customer Cancel Button** | `frontend/app/trip/page.tsx` | Replace lines 117–124 with: `{(job.status === 'pending' \|\| job.status === 'accepted') && (<button onClick={() => handleCancel(job.id)} ...>Cancel</button>)}` |
| **2. Activate Real-Time SSE Stream** | `frontend/app/trip/page.tsx` & `frontend/app/provider/page.tsx` | Import `useJobEvents` and invoke it to trigger `loadJobs()` on incoming `job_accepted`, `trip_started`, and `trip_completed` events. |
| **3. Fix Admin Navigation in BottomNav** | `frontend/src/components/BottomNav.tsx` | Add explicit `user.role === 'admin'` check rendering `{ href: '/admin', emoji: '📊', label: 'ADMIN' }` and `{ href: '/profile', emoji: '👤', label: 'PROFILE' }`. |
| **4. Implement JWT Refresh Token Rotation** | `frontend/src/contexts/AuthContext.tsx` | Store `refresh_token` in `localStorage` upon login and implement automatic silent refresh when requests return 401. |
| **5. (Roadmap) Live Driver GPS Tracking** | `frontend/app/provider/page.tsx` | If live tracking is desired, wire `navigator.geolocation.watchPosition` to call `POST /api/provider/location`. |

---

### 5.2 What Should Be DELETED

| Target | Location | Rationale |
| :--- | :--- | :--- |
| **Duplicate `Naql/` directory** | Root `/Naql` | Identical duplicate of `Swift/`. Wastes space and pollutes codebase search results. |
| **Disconnected `Swift/` prototype** | Root `/Swift` | Mock SwiftUI code with zero API integration. Move to a separate repository or archive folder. |
| **Unauthenticated `/trucks` endpoint** | `api/app/api/v1/jobs.py:L40-L43` | Data leak exposing all fleet vehicles without authentication. |
| **Dead `/price-approval` endpoint** | `api/app/api/v1/jobs.py:L289-L306` | Unreachable endpoint enforcing an impossible status check. |
| **Unused import `approvePrice`** | `frontend/app/provider/page.tsx:L11` | Dead import referencing an unreachable API function. |
| **Orphaned `Payment` model** | `api/app/models/models.py:L164` | Dead schema remnant from deferred Stripe integration. |
| **Stale `__pycache__` artifacts** | `api/app/core/__pycache__/mailer.cpython-314.pyc` | Residual bytecode from a previously deleted mailer module. |

---

## 6. Step-by-Step Production Deployment Guide

Follow these steps to deploy Naql to a production Ubuntu Linux VPS or cloud instance (e.g., AWS EC2, DigitalOcean, Hetzner).

### Phase 1: Server Preparation & Security Hardening

1. **Update system packages and configure firewall:**
   ```bash
   sudo apt update && sudo apt upgrade -y
   sudo apt install -y ufw curl git openssl
   sudo ufw allow OpenSSH
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw enable
   ```

2. **Install Docker Engine & Docker Compose Plugin:**
   ```bash
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   sudo usermod -aG docker $USER
   # Log out and log back in to apply group changes
   ```

---

### Phase 2: Production Environment Variables

1. Clone the repository to the server:
   ```bash
   git clone <your-repo-url> /opt/naql
   cd /opt/naql
   ```

2. Generate strong secrets and configure `/opt/naql/.env`:
   ```bash
   # Generate credentials
   MYSQL_ROOT_PW=$(openssl rand -hex 24)
   MYSQL_PW=$(openssl rand -hex 24)
   APP_SECRET=$(openssl rand -hex 32)

   cat <<EOF > .env
   # Database Configuration
   MYSQL_ROOT_PASSWORD=${MYSQL_ROOT_PW}
   MYSQL_DATABASE=naql_db
   MYSQL_USER=naql_admin
   MYSQL_PASSWORD=${MYSQL_PW}
   DATABASE_URL=mysql+aiomysql://naql_admin:${MYSQL_PW}@db:3306/naql_db

   # FastAPI Security
   SECRET_KEY=${APP_SECRET}
   ALGORITHM=HS256
   ACCESS_TOKEN_EXPIRE_MINUTES=60
   REFRESH_TOKEN_EXPIRE_DAYS=14

   # Domain & Networking
   DOMAIN_NAME=naql.example.com
   ALLOWED_ORIGINS=https://naql.example.com
   EOF
   ```

---

### Phase 3: Production Docker Compose Setup

Create a production compose file `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  db:
    image: mysql:8.0
    container_name: naql_db
    restart: always
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}
      MYSQL_DATABASE: ${MYSQL_DATABASE}
      MYSQL_USER: ${MYSQL_USER}
      MYSQL_PASSWORD: ${MYSQL_PASSWORD}
    volumes:
      - mysql_data:/var/lib/mysql
    networks:
      - naql_net
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 5

  api:
    build:
      context: ./api
      dockerfile: Dockerfile
    container_name: naql_api
    restart: always
    environment:
      DATABASE_URL: ${DATABASE_URL}
      SECRET_KEY: ${SECRET_KEY}
      ALGORITHM: ${ALGORITHM}
      ACCESS_TOKEN_EXPIRE_MINUTES: ${ACCESS_TOKEN_EXPIRE_MINUTES}
      REFRESH_TOKEN_EXPIRE_DAYS: ${REFRESH_TOKEN_EXPIRE_DAYS}
      ALLOWED_ORIGINS: ${ALLOWED_ORIGINS}
    depends_on:
      db:
        condition: service_healthy
    networks:
      - naql_net

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: naql_frontend
    restart: always
    depends_on:
      - api
    networks:
      - naql_net

  nginx:
    image: nginx:alpine
    container_name: naql_proxy
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
    depends_on:
      - frontend
      - api
    networks:
      - naql_net

volumes:
  mysql_data:

networks:
  naql_net:
    driver: bridge
```

---

### Phase 4: Nginx Reverse Proxy with SSL & SSE Support

Create `nginx.conf`:

```nginx
server {
    listen 80;
    server_name naql.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name naql.example.com;

    ssl_certificate /etc/letsencrypt/live/naql.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/naql.example.com/privkey.pem;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-XSS-Protection "1; mode=block";
    add_header X-Content-Type-Options "nosniff";

    # Next.js Frontend
    location / {
        proxy_pass http://frontend:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }

    # FastAPI Backend Routes
    location /api/ {
        proxy_pass http://api:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;

        # Server-Sent Events (SSE) Streaming Configuration
        proxy_buffering off;
        proxy_cache off;
        proxy_set_header Connection '';
        proxy_http_version 1.1;
        chunked_transfer_encoding off;
        proxy_read_timeout 86400s;
    }
}
```

---

### Phase 5: SSL Certificate & Service Launch

1. **Obtain SSL Certificate with Certbot:**
   ```bash
   sudo apt install -y certbot
   sudo certbot certonly --standalone -d naql.example.com
   ```

2. **Launch Container Stack:**
   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```

3. **Verify Deployment Health:**
   ```bash
   # Check container statuses
   docker compose -f docker-compose.prod.yml ps

   # Verify API health check
   curl https://naql.example.com/api/health
   # Expected output: {"status": "healthy"}
   ```

---

## 7. Testing & Quality Assurance

Before promoting any changes to production, execute the automated test suite:

```bash
# Run backend integration tests inside the API container
docker compose exec api pytest -v tests/test_workflow.py

# Verify frontend types and linting
cd frontend
npm run lint
```

---

## Maintenance & Support

- **Repository:** `ProjectAlpha`
- **Maintained by:** Naql Core Engineering Team
- **Support Contact:** `support@naql.com`
