# Naql — Logistics Marketplace

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A full-stack logistics platform with a Next.js web frontend, a Flutter mobile/desktop app, and a FastAPI backend.

## Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Web (Next.js) │────│  API (FastAPI) │────│  MySQL 8.0    │
│  :3000        │     │  :8000        │     │  :3306        │
└──────────────┘     └──────────────┘     └──────────────┘
                            │
                    ┌───────┴───────┐
                    │  Flutter App  │
                    │  (emulator)   │
                    └───────────────┘
```

## Tech Stack

| Layer         | Technology                          |
|---------------|-------------------------------------|
| Frontend web  | Next.js 16, TypeScript, Tailwind CSS, Naql design system |
| Mobile app    | Flutter 3.12 (Dart)                 |
| API           | FastAPI + SQLAlchemy + aiomysql     |
| Database      | MySQL 8.0                           |
| Container     | Docker + docker-compose             |
| Maps          | OpenStreetMap / Leaflet (no API key) |

## Features

- **Naql Design System** — custom CSS design system (sidebar, header, cards, buttons) applied to all customer pages
- **User authentication** — JWT login/register with argon2id password hashing
- **Truck booking** — 4 vehicle sizes (Small/Medium/Large/X-Large) with live map tracking
- **Cargo category selection** — auto-suggests truck size based on what you're moving
- **Job lifecycle** — draft → published → awaiting provider price → confirmed → in transit → delivered
- **Chat** — driver messaging with FAQ quick-replies and AI-style suggestions
- **Profile** — phone number management, stats, sign out
- **Admin dashboard** — stats, requests, drivers
- **Provider fleet management** — trucks, fleet items, price approvals
- **Auto CSV export** — `exports/users.csv` updates automatically on every profile change
- **Bilingual (EN/AR)** — language toggle in Flutter app and web header
- **Red branding** — all user-facing screens use red theme
- **Uber-like pricing** — estimated price based on vehicle size + Haversine distance between pickup and dropoff cities
- **Live truck map** — OpenStreetMap / Leaflet with real-time truck markers and user location

## Roles

| Role      | Who it is                              | Allowed access                                                                 |
|-----------|----------------------------------------|--------------------------------------------------------------------------------|
| `admin`   | Platform stakeholder/administrator     | Private administrative dashboard only: review platform data, users, jobs.     |
| `customer`| A normal user who needs a truck        | Register/sign in, manage profile, select truck, create/cancel own requests.   |
| `provider`| A person or company with one or more trucks | Register/sign in, manage truck records, view requests, approve/reject prices. |

The API assigns and checks roles on the server for every request. The app must not choose a role or unlock dashboard screens based only on a client-side value.

## Job & Truck-Lock Flow

```text
Customer chooses truck + pickup/drop-off + price range
                     |
                     v
Server validates availability and creates a temporary truck lock
                     |
                     v
Job status: awaiting_provider_price_approval
                     |
           Provider approves price range?
              | no                 | yes
              v                    v
          rejected           Job status: awaiting_payment
          lock released             |
                            Payment confirmed by server?
                               | no         | yes
                               v            v
                          remains pending  accepted
                                           lock becomes job assignment
```

### Lock rules

- Only the server can create, extend, release, or convert a truck lock.
- A lock belongs to one job request and expires automatically after a short configured period (e.g. 15 minutes) unless the request is rejected or accepted sooner.
- An expired, rejected, cancelled, or failed-payment job releases its lock immediately.
- The database must prevent a truck from having more than one active lock or accepted assignment for the same time window.
- The app displays the server-returned lock expiry; it must never decide a truck is locked or unlocked on its own.
- If the customer needs more time, the server may issue a single limited extension only while the truck is still eligible.

## Run

```sh
cp .env.example .env
docker compose up --build
```

### Access URLs

| Service     | URL                          |
|-------------|------------------------------|
| Web         | http://localhost:3000        |
| API         | http://localhost:8000        |
| API docs    | http://localhost:8000/docs   |
| MySQL       | localhost:3306 (private)     |

### From your phone

To access from your phone, find your computer's IP address (e.g., `192.168.1.100`) and open:
- Web: `http://YOUR_IP:3000`
- API: `http://YOUR_IP:8000`

Make sure your phone and computer are on the same Wi-Fi network.

## Project Structure

```
ProjectAlpha/
├── docker-compose.yml     # Docker services
├── frontend/              # Next.js web app
│   ├── app/               # Pages (login, register, book, trip, chat, profile, admin, provider)
│   ├── src/
│   │   ├── components/    # Header, BottomNav, RoleGuard
│   │   ├── contexts/      # AuthContext, LangContext
│   │   └── lib/           # API client, types
│   └── public/            # Static assets + truck-pic/
├── api/                   # FastAPI backend
│   ├── app/
│   │   ├── api/v1/        # Auth, jobs, admin, provider endpoints
│   │   ├── core/          # Security, database, exporter
│   │   └── schemas/       # Pydantic models
│   └── requirements.txt
├── lib/                   # Flutter app source
│   ├── main.dart
│   ├── models/            # Dart models
│   ├── screens/           # Auth, user (book, trip, chat, profile), admin
│   ├── services/          # API client, auth service
│   ├── providers/         # Auth provider
│   ├── theme/             # Red theme
│   ├── l10n/              # Bilingual strings (EN/AR)
│   └── widgets/           # Reusable widgets
├── truck-pic/             # Truck images
└── exports/               # Auto-generated CSV
```

## Key Files

| File                          | Purpose                                    |
|-------------------------------|--------------------------------------------|
| `docker-compose.yml`          | Defines frontend, api, database services   |
| `frontend/app/layout.tsx`     | Root layout with AuthProvider + LangProvider |
| `frontend/app/naql.css`       | Naql design system (sidebar, header, cards, forms) |
| `frontend/src/components/NaqlLayout.tsx` | Sidebar + header layout for customer pages |
| `frontend/src/components/Shell.tsx` | Layout switcher between NaqlLayout and old Header+BottomNav |
| `frontend/src/components/TruckMap.tsx` | Leaflet map with truck markers and user location |
| `frontend/app/page.tsx`       | Home page with auth redirect and Naql design |
| `frontend/app/book/page.tsx` | Book page with progress steps, vehicle selection, pricing, map |
| `frontend/app/trip/page.tsx` | Trips page with real jobs from API, wrapped in RoleGuard |
| `frontend/app/profile/page.tsx` | Profile page using NaqlLayout |
| `frontend/src/lib/api.ts`     | API client (all endpoints)                 |
| `frontend/src/contexts/AuthContext.tsx` | Auth state management              |
| `frontend/src/contexts/LangContext.tsx`  | Language toggle (EN/AR)          |
| `api/app/main.py`             | FastAPI app entry point                    |
| `api/app/core/exporter.py`    | CSV auto-export on user changes            |
| `api/app/schemas/user.py`     | User schema (phone validation, role)       |
| `lib/main.dart`               | Flutter app entry point                    |
| `lib/l10n/app_locale.dart`    | Bilingual string bundle                    |

## Environment Variables

Create `.env` from `.env.example`:

```env
MYSQL_DATABASE=naql
MYSQL_USER=naql_user
MYSQL_PASSWORD=your_strong_password
MYSQL_ROOT_PASSWORD=your_strong_root_password
SECRET_KEY=your_secret_key
```

## CSV Export

Every login, register, and profile update triggers `export_users_csv()` which writes `exports/users.csv` with columns: `id, username, email, phone_number, hashed_password, role, is_verified, created_at, updated_at`.

## Testing

```sh
# Backend
cd api && python -m pytest tests/ -v

# Flutter
cd / && flutter test
```

## Security Notes

- Passwords stored as argon2id hashes
- JWT tokens with short expiry
- Rate limiting on login and register
- Account lockout after failed attempts
- MySQL is on private Docker network (not exposed to host)

## Known Issues

1. **User Role Misconfiguration:** New user registrations default to `CUSTOMER` regardless of selection. Caused by hardcoded defaults in the frontend JS and enforced default values in the backend SQLAlchemy models.
2. **Missing Truck-Customer Linking Logic:** The job creation flow lacks the logic to automatically identify and assign a "free" truck (one without an active, unexpired `TruckLock`) to a customer job request.

## Roadmap

See `fix.md` for the phased production-readiness roadmap and `Future.md` for the Least Viable Shippable Product definition.