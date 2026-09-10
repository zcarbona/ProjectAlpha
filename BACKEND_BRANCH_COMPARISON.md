# Backend Branch Comparison

## 1. Executive Summary

A comprehensive read-only comparison was performed between `origin/main` and `origin/zcarbona-version` restricted to the backend root `api/`. The candidate branch introduces substantial architectural changes: a new job-booking flow (`PROVIDER_SELECTION`), refresh-token authentication, real-time events (SSE), provider availability/location tracking, and tighter profile-update validation. It also removes several main features (e.g., CSV user export, `GET /auth/me/stats`, legacy lock-based truck reservation). Security posture improves in the candidate (CORS locked down, uniqueness checks on profile updates, password hashes no longer exported to disk), but new attack surfaces appear (refresh-token state, stored hashed refresh tokens, new mutable provider status endpoints). Database schema changes are significant and require an Alembic migration (none currently exists). API consumers will face breaking changes due to prefix changes from `/api/v1` to `/api`, schema removals, and new required fields.

- Changed backend files: 10 source files modified, 1 deleted, 2 added, plus 1 new test file.
- Commit range: `origin/main` = `556b33b9c84f962af94b3998b1f9892700b383a1`, `origin/zcarbona-version` = `b587a2c90767c7e7e2fda84c68a14b58ae8e0127`
- Main is a single initial-commit ancestor; candidate has 9 additional backend-specific commits.

---

## 2. Branch Information

```text
Baseline:     origin/main (556b33b9c84f962af94b3998b1f9892700b383a1)
Candidate:    origin/zcarbona-version (b587a2c90767c7e7e2fda84c68a14b58ae8e0127)
Backend root: api/
Scope:        Backend only
```

---

## 3. Backend File Changes

| File | Status | Branch delta |
|------|--------|--------------|
| `api/Dockerfile` | Modified | Candidate upgrades pip/setuptools/wheel and removes `libmariadb-dev` from apt install. |
| `api/requirements.txt` | Modified | Candidate upgrades fastapi, aiomysql, pydantic, python-jose, python-multipart, python-dotenv, cryptography, pytest, pytest-asyncio; adds `aiosmtplib`. |
| `api/app/main.py` | Modified | Candidate removes `export_users_csv` from lifespan, narrows CORS, changes router prefix from `/api/v1` to `/api`, adds `events` router, renames health endpoint. |
| `api/app/core/database.py` | Modified | Candidate removes `seed_mock_data` from `seed_company_data`. |
| `api/app/core/exporter.py` | Deleted | Exists in main only; candidate removed it. |
| `api/app/core/security.py` | Modified | Candidate adds `create_refresh_token`, `REFRESH_TOKEN_EXPIRE_DAYS`, includes `type` claim in access tokens, and changes OAuth2 bearer URL to `/api/auth/login`. |
| `api/app/models/models.py` | Modified | Candidate adds `BookingMode`, `JobDecline`, `Provider.is_available`, `User.refresh_token`, `User.refresh_token_expires`; removes `User.is_verified`, `Provider.is_verified`; restructures `Job` schema significantly. |
| `api/app/api/v1/auth.py` | Modified | Candidate adds `/refresh`, removes `export_users_csv` calls, removes `/me/stats`, adds uniqueness checks on profile updates, adds `IntegrityError` handling, returns refresh token on login. |
| `api/app/api/v1/jobs.py` | Modified | Candidate replaces the entire job flow with provider-selection mode, adds start/complete/decline/provider requests/provider status endpoints, changes schema expectations. |
| `api/app/api/v1/provider.py` | Modified | Candidate adds `/provider/location` and `/providers` endpoints, validates `vehicle_class` against `VehicleType` during truck creation. |
| `api/app/api/v1/events.py` | Added | New SSE event stream endpoint. |
| `api/app/schemas/jobs.py` | Modified | Candidate adds `JobAccept`, `ProviderStatusUpdate`, removes price fields from `JobCreate`, adds city fields, makes `Place` fields optional. |
| `api/app/schemas/user.py` | Modified | Candidate adds refresh token to `Token`, removes `is_verified` from `UserOut`, tightens phone regex, adds `extra="forbid"` to `UserUpdate`. |
| `api/tests/test_phone_update.py` | Added | Candidate adds tests for phone-update uniqueness and auth behavior. |

---

## 4. Architecture Differences

- **API versioning**: Main uses `/api/v1`; candidate uses `/api`. This is a global routing change.
- **Job lifecycle**: Main uses an AWAITING_PRICE_APPROVAL flow where the system auto-matches a truck and the provider approves/rejects a price. Candidate shifts to a `PROVIDER_SELECTION` booking mode where the customer picks a provider and the provider accepts the job and assigns a truck.
- **Provider state**: Candidate introduces `is_available` on `Provider` plus status endpoints; main does not.
- **Real-time updates**: Candidate adds an SSE-based `events/stream` using `ConnectionManager`; main has no real-time layer.
- **Authentication state**: Candidate adds refresh tokens with server-side hashed storage; main is stateless access-token only.
- **Data export**: Main writes `users.csv` (including hashed passwords) on every auth event; candidate removes this entirely.
- **Database initialization**: Main seeds mock demo data automatically; candidate removes mock data to avoid accidental demo exposure.

---

## 5. API Differences

| Endpoint | main | zcarbona-version | Difference |
|----------|------|------------------|------------|
| `POST /api/v1/auth/login` | Returns `access_token` | Returns `access_token` + `refresh_token` | Refresh token added |
| `POST /api/v1/auth/refresh` | Missing | Exists | New refresh flow |
| `GET /api/v1/auth/me/stats` | Exists | Missing | Removed |
| `PATCH /api/v1/auth/me` | Simple update; sets `is_verified=True` on phone update; no uniqueness checks | Validates uniqueness of phone/email/username; returns 409 on conflict; no longer sets `is_verified` | Safer updates |
| `POST /api/v1/jobs` | Auto-matches available truck; creates lock; requires price range | Requires `provider_id`; no truck auto-match; status `PENDING` | Completely different booking flow |
| `POST /api/v1/jobs/{id}/accept` | Missing | Exists | New provider action |
| `POST /api/v1/jobs/{id}/start` | Missing | Exists | New provider action |
| `POST /api/v1/jobs/{id}/complete` | Missing | Exists | New provider action |
| `POST /api/v1/jobs/{id}/cancel` | Cancels awaiting-price/payment only | Also cancels `PENDING` and `ACCEPTED`; restores provider availability | Wider cancellation |
| `POST /api/v1/provider/status` | Missing | Exists | Toggle availability |
| `GET /api/v1/provider/requests` | Missing | Exists | Available work queue |
| `POST /api/v1/jobs/{id}/decline` | Missing | Exists | Decline work |
| `POST /api/v1/provider/location` | Missing | Exists | Broadcast location |
| `GET /api/v1/providers` | Missing | Exists | Public provider lookup |
| `GET /api/v1/events/stream` | Missing | Exists | SSE stream |
| `GET /health` | `/health` and `/api/v1/health` | `/api/health` only | Path changed |

---

## 6. Authentication Differences

**Main (`api/app/core/security.py`):**
- Stateless access tokens only.
- `OAuth2PasswordBearer` URL: `/api/v1/auth/login`.

**Candidate:**
- Adds `create_refresh_token` (7-day expiry).
- `OAuth2PasswordBearer` URL: `/api/auth/login` (mismatched with main's prefix).
- Access token now includes `"type": "access"` claim.
- Stores hashed refresh token + expiry in `users.refresh_token` / `users.refresh_token_expires`.
- New `/refresh` endpoint rotates refresh tokens and updates stored hash.

**Impact:**
- Refresh tokens add session state and an additional attack surface (theft of a refresh token allows indefinite access until expiry or password change).
- Storing hashed refresh tokens is a sound mitigation.

---

## 7. Authorization / RBAC Differences

- **Role checks**: Both use `require_role` for `CUSTOMER`/`PROVIDER`/`ADMIN`.
- **Ownership checks**:
  - Main: `customer_jobs`, `cancel_job` filter by `customer_id = user.id`. `provider_jobs` and `price_approval` join through `Provider.user_id = user.id`.
  - Candidate: Adds truck ownership validation in `accept_job` (`Truck.provider_id == provider.id`) and `start_job` (`assigned_truck.provider_id != provider.id` rejected).
  - Candidate: `decline_job`, `update_provider_status`, `update_location` correctly resolve provider from `user.id`.
- **Admin endpoints** (`/admin/stats`, `/admin/requests`, `/admin/drivers`) are unchanged.
- **New risks in candidate**:
  - `/provider/location` broadcasts to any in-progress job for the provider without validating the provider owns that job (it queries by `provider_id`, so ownership holds).
  - `/providers` is unauthenticated but only returns `id` and `display_name`; no sensitive data leaked.

---

## 8. Database / Model Differences

### Models changed

| Model | main | zcarbona-version |
|-------|------|------------------|
| `User` | `is_verified` present; no refresh fields | `refresh_token` (String 512), `refresh_token_expires` added; `is_verified` removed |
| `Provider` | `is_verified` present; no `is_available` | `is_available` added; `is_verified` removed |
| `Job` | `provider_id`/`truck_id` non-null; `requested_min_price`/`requested_max_price`; `pickup_place_id/lat/lng`, `dropoff_place_id/lat/lng`; default `AWAITING_PRICE_APPROVAL` | `provider_id`/`truck_id` nullable; `vehicle_class` required; `booking_mode` added; `pickup_city`/`dropoff_city` added; `requested_min_price`/`requested_max_price` removed; default `PENDING`; `updated_at` added |
| `New model` | — | `JobDecline` (job_id, provider_id, timestamp) |
| `New enum` | — | `BookingMode` (`REQUEST`, `PROVIDER_SELECTION`) |
| `JobStatus` | `AWAITING_PRICE_APPROVAL`, `AWAITING_PAYMENT`, `ACCEPTED`, `REJECTED`, `CANCELLED`, `COMPLETED` | `PENDING`, `ACCEPTED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`, `AWAITING_PRICE_APPROVAL`, `AWAITING_PAYMENT`, `REJECTED` |

**Migration required:** YES. Adding non-nullable `vehicle_class`, nullable provider/truck IDs, new `booking_mode`, new `refresh_token` columns, removing `is_verified`, etc., all require migrations.

**Potential breaking change:** YES. Existing jobs in main with `AWAITING_PRICE_APPROVAL` will persist; candidate schema expects `PENDING` or later states, and auto-migration would need a data migration for `provider_id`/`truck_id` to NULL.

---

## 9. Migration Differences

No `alembic/` or `migrations/` directory exists in either branch. The candidate introduces model changes without a corresponding migration. Deploying the candidate model changes without a migration will cause runtime SQLAlchemy schema mismatches (missing columns, incompatible enum values).

---

## 10. Schema / Validation Differences

**User schemas:**
- `Token` gains `refresh_token` in candidate.
- `UserUpdate` in candidate uses `extra="forbid"` and no longer inherits `role`; main allows `role` updates through `UserUpdate` (which the endpoint rejects manually).
- Phone regex tightened from `^\+?[0-9]{9,15}$` to `^\+?[1-9]\d{1,14}$` (prevents leading zero after plus).
- `UserOut` in candidate drops `is_verified`; main exposes it.

**Job schemas:**
- `JobCreate` in main: price range + place IDs required. Candidate: requires `provider_id`; removes price range; `place_id`, `lat`, `lng`, `city` become optional.
- `JobOut` in candidate adds `pickup_city`, `dropoff_city`; removes `requested_min_price`, `requested_max_price`.
- Candidate adds `JobAccept` and `ProviderStatusUpdate`.

**Client impact:** Existing clients using `requested_min_price` / `requested_max_price` in `JobOut` will break. Mobile clients relying on `/api/v1` prefix will break. `UserOut` no longer includes `is_verified`.

---

## 11. Business Logic Differences

- **Job creation**: Main auto-matches a free truck of the requested class, locks it, creates a `Payment` record, and sets status to `AWAITING_PRICE_APPROVAL`. Candidate simply records a `PENDING` request with a chosen provider and no truck assignment; the provider later accepts and assigns a truck.
- **Provider workflow**: Main lacks provider-side job acceptance or trip status transitions. Candidate adds full lifecycle: `accept` -> `start` -> `complete`, plus `decline` and status toggle.
- **Cancellation**: Main allows cancellation only while awaiting price or payment. Candidate allows cancellation while `PENDING`, `AWAITING_PRICE_APPROVAL`, `AWAITING_PAYMENT`, or `ACCEPTED`, and restores provider availability on accepted-job cancellation.
- **User profile updates**: Main blindly assigns fields and sets `is_verified=True` on phone update. Candidate validates uniqueness before commit and catches `IntegrityError`.
- **CSV export**: Main exports full user table (including hashed passwords) on every registration, login, and profile update. Candidate removes this.

---

## 12. Dependency / Configuration Differences

| Dependency | main | zcarbona-version |
|------------|------|------------------|
| `fastapi` | 0.110.0 | 0.115.11 |
| `aiomysql` | 0.2.0 | 0.3.0 |
| `pydantic[email]` | 2.6.3 | >=2.11,<3 |
| `python-jose` | 3.3.0 | 3.4.0 |
| `python-multipart` | 0.0.9 | 0.0.20 |
| `python-dotenv` | 1.0.1 | 1.2.2 |
| `cryptography` | 42.0.5 | 44.0.1 |
| `pytest` | 8.0.2 | 9.0.3 |
| `pytest-asyncio` | 0.23.5 | 1.3.0 |
| `aiosmtplib` | missing | added |

- `requirements.txt` in candidate pins `pydantic` to a range instead of a fixed patch, which is looser.
- Candidate's `Dockerfile` upgrades build tools and removes `libmariadb-dev`; this may affect image compatibility on architectures needing MariaDB dev headers for `aiomysql` compilation.

---

## 13. Test Differences

**Main**: No test files in `api/tests/`.

**Candidate**: Adds `api/tests/test_phone_update.py` with 10 tests covering:
- Customer phone update
- Provider phone update
- Replacing an existing phone number
- Rejection of `user_id` in payload (schema-level `extra="forbid"`)
- Role escalation rejection
- Unauthenticated access returns 401
- Invalid JWT returns 401
- Duplicate phone returns 409
- Partial update preserves other fields
- Invalid phone regex rejected
- Password update hashed and independent

**Gap**: Candidate lacks tests for the new job lifecycle (`accept`, `start`, `complete`, `decline`), refresh token flow, provider status toggle, location broadcast, and new `/providers` endpoint.

---

## 14. Security Findings

| Severity | Location | Branch | Issue | Impact | Recommendation |
|----------|----------|--------|-------|--------|----------------|
| CRITICAL | `api/app/core/exporter.py` (main) | main | Exports all users, including hashed passwords, to a world-readable CSV on disk during auth flows | Password hash leakage if container/filesystem is compromised | Remove the exporter (candidate already did this). |
| HIGH | `api/app/api/v1/auth.py` (main) | main | Profile update does not validate uniqueness of `phone_number`, `email`, `username` before commit; race condition can violate unique constraints and cause 500 or inconsistent state | Integrity errors, data corruption | Use application-level uniqueness checks plus `IntegrityError` rollback (candidate pattern). |
| HIGH | `api/app/models/models.py` (main) | main | `User.is_verified` auto-set to `True` on phone update in `update_me` | Account verification bypass | Remove auto-verification; require explicit admin/verification workflow (candidate does this). |
| MEDIUM | `api/app/core/security.py` (candidate) | zcarbona-version | Refresh tokens are stored hashed but rotated on every use; if the database is read-only or replication is delayed, `/refresh` can fail after a concurrent refresh | Availability | Document eventual consistency requirement; add short-term caching or atomic DB operations. |
| MEDIUM | `api/app/main.py` (candidate) | zcarbona-version | Router prefix changed to `/api` while `OAuth2PasswordBearer` URL is `/api/auth/login`; if any client hardcodes token URL discovery, mismatch may occur | Client auth flow breakage | Ensure API docs and clients use the new prefix. |
| MEDIUM | `api/app/api/v1/provider.py` (candidate) | zcarbona-version | `update_location` accepts arbitrary `lat`/`lon` query params with no validation beyond float parsing | Spoofed locations, map pollution | Clamp/validate ranges and require active in-progress job before broadcasting. |
| MEDIUM | `api/app/models/models.py` (candidate) | zcarbona-version | `Job.provider_id` and `Job.truck_id` made nullable without a data migration; existing main data is non-null | Migration failure or constraint violation | Write a migration that backfills or alters constraints safely. |
| LOW | `api/app/api/v1/auth.py` (candidate) | zcarbona-version | `is_verified` removed from schema and model; frontends relying on this field may display wrong state | UI regression | Document schema change; provide admin verification workflow endpoint if needed. |
| LOW | `api/Dockerfile` (candidate) | zcarbona-version | `libmariadb-dev` removed; may break `aiomysql` build on some platforms | Build failure | Verify `aiomysql` wheel availability for target platform. |

---

## 15. Breaking Changes

- **API prefix**: `/api/v1/*` -> `/api/*`. All existing clients must update.
- **Job creation contract**: Removed `requested_min_price`/`requested_max_price`; added required `provider_id`. Mobile flows must change.
- **Login response**: `Token` schema now includes `refresh_token`. Clients not expecting it may ignore it, but clients with strict parsing may fail.
- **User profile update**: `UserUpdate` now forbids unknown fields (`extra="forbid"`). Clients sending `role` or `user_id` will receive 422.
- **UserOut response**: Removed `is_verified` field.
- **JobStatus values**: Enum string values changed (`awaiting_provider_price_approval` -> `awaiting_price_approval`). Any DB-stored enum string comparisons break.
- **Provider workflow**: New provider endpoints do not exist in main; old `price_approval` flow expects `JobStatus.AWAITING_PRICE_APPROVAL`, which candidate still supports, but the path to reach it changed.

---

## 16. Regressions

- **CSV export removed**: If any external process depended on the `users.csv` file, it will no longer be generated.
- **`GET /auth/me/stats` removed**: Frontend dashboards using this endpoint will break.
- **Truck auto-matching removed**: Candidate requires customers to choose a provider, removing the original marketplace-style auto-match behavior.
- **Price-range approval removed**: Candidate's `price_approval` no longer validates approved amount against requested range.
- **Mock data seeding removed**: Developers relying on `test_customer`/`test_provider` demo accounts on fresh DB will need to create them manually.
- **`User.is_verified` auto-set removed**: Main auto-verified users on phone update; candidate does not. Any workflow depending on this side effect will change.

---

## 17. Improvements in main

- **Stable job flow**: Auto-matching, price-range approval, and lock-based reservation are implemented and complete in main.
- **Complete demo data**: `seed_mock_data` provides ready-to-use test accounts.
- **Simpler auth**: No refresh token state to manage.
- **Price validation**: `price_approval` enforces approved amount within requested range.

---

## 18. Improvements in zcarbona-version

- **Refresh token support**: Enables longer-lived sessions without long-lived access tokens.
- **Real-time events**: SSE `/events/stream` allows live trip updates.
- **Provider lifecycle**: Start/complete/decline/status/location gives providers full control.
- **Data-integrity on updates**: Uniqueness checks prevent duplicate emails/phones/usernames.
- **No password export**: Hashed passwords are no longer written to disk.
- **CORS locked down**: Specific frontend origins instead of `*`.
- **Test coverage**: First backend tests added for phone-update behavior.

---

## 19. Recommended Combination

### A. Authentication
**Keep from candidate:** Refresh token infrastructure, `IntegrityError` handling, uniqueness checks, removal of CSV export.  
**Keep from main:** Shorter access-token TTL is already 15 minutes in both; keep stateless token creation without `type` claim if possible, but the `type` claim is a harmless improvement.  
**Discard from candidate:** `OAuth2PasswordBearer` URL mismatch (`/api/auth/login`); align with new router prefix.  
**Conflict risk:** LOW.  
**Migration required:** YES (add `refresh_token` columns).

### B. Job Flow
**Keep from main:** Auto-truck matching and `TruckLock`-based reservation are more user-friendly for an on-demand marketplace. Keep the `requested_min_price`/`requested_max_price` schema and range validation.  
**Keep from candidate:** Provider `accept`/`start`/`complete` lifecycle, `JobDecline`, provider availability, and SSE broadcast.  
**Discard from candidate:** `PROVIDER_SELECTION` as the sole mode; instead support both `REQUEST` (main's auto-match) and `PROVIDER_SELECTION` (candidate).  
**Conflict risk:** HIGH. These are different business models.  
**Migration required:** YES (add `booking_mode`, `updated_at`, `pickup_city`, `dropoff_city`; adjust nullable constraints).

### C. Provider Management
**Keep from candidate:** `provider/location`, `provider/requests`, `provider/status`, `/providers` lookup.  
**Keep from main:** Fleet/truck CRUD remains largely the same; keep `capacity` in `TruckCreate` payload or derive it from `VehicleType` (candidate already derives it).  
**Conflict risk:** LOW.  
**Migration required:** NO for truck CRUD; YES for `is_available` column on `Provider`.

### D. Schemas
**Keep from candidate:** `extra="forbid"` on `UserUpdate`, tighter phone regex, removal of `is_verified` from public output (if verification is removed from model).  
**Keep from main:** `is_verified` field should remain in the model unless a new verification workflow replaces it; otherwise remove the field and any code relying on it.  
**Conflict risk:** MEDIUM.

### E. Security / CORS
**Keep from candidate:** Narrowed CORS, no CSV export.  
**Keep from main:** `libmariadb-dev` if build failures appear; verify before removing.

### F. Tests
**Keep from candidate:** `test_phone_update.py`.  
**Add:** Tests for refresh token flow, job lifecycle, provider endpoints, SSE stream, and migration round-trips.

---

## 20. Combination Matrix

| Area | main | zcarbona-version | Recommendation | Reason |
|------|------|------------------|----------------|--------|
| Authentication | access-token only | access + refresh tokens | combine | Keep refresh tokens; fix OAuth2 URL mismatch |
| Authorization | role checks, owner filters | role checks, truck ownership, provider availability | combine | Candidate adds stricter ownership; keep both |
| User schema | `is_verified`, loose update | no `is_verified`, uniqueness checks, `extra="forbid"` | combine | Keep model field unless workflow removed; use candidate validation |
| Job creation | auto-match + price range | provider-selection, no price range | combine | Support both booking modes; keep price range in main flow |
| Job lifecycle | pending -> approval -> payment | accept/start/complete/decline | combine | Merge both state machines into one enum and flow |
| Provider features | fleet/truck CRUD | +status/location/requests/decline/providers lookup | zcarbona-version | Candidate strictly supersedes provider capabilities |
| Real-time | None | SSE events | zcarbona-version | New feature, no regression |
| Database | seed mock data, exporter | no mock data, no exporter | main for demo; candidate for prod | Remove exporter; make mock seeding optional via env flag |
| CORS | `*` | specific origins | zcarbona-version | Better security posture |
| Tests | None | phone update tests | combine | Extend candidate tests to cover new flows |
| Dependencies | older pins | newer pins, `aiosmtplib` | zcarbona-version | Keep up-to-date; verify `libmariadb-dev` removal |

---

## 21. Recommended Final Backend Architecture

```text
Authentication:
- OAuth2PasswordBearer tokenUrl = /api/auth/login
- Access tokens (15 min) with "type":"access"
- Refresh tokens (7 day) with "type":"refresh", stored hashed in users.refresh_token
- /refresh endpoint rotates tokens

Authorization:
- require_role(CUSTOMER, PROVIDER, ADMIN)
- Provider ownership checks on trucks and jobs
- Provider.is_available gating accept/start

Users:
- Model retains is_verified OR removes it and replaces with explicit admin verification endpoint
- UserUpdate forbids extra fields
- Uniqueness checks on email/username/phone before commit

Customers:
- Job creation supports both REQUEST (auto-match) and PROVIDER_SELECTION modes
- Cancellation allowed for PENDING, AWAITING_PRICE_APPROVAL, AWAITING_PAYMENT, ACCEPTED

Providers:
- Fleet/truck CRUD (capacity derived from VehicleType)
- /provider/status, /provider/requests, /provider/location
- /provider/jobs/{id}/accept|start|complete|decline
- /providers lookup

Admins:
- Unchanged from main

Models:
- Add BookingMode, JobDecline
- Add Job.updated_at, Job.booking_mode
- Make Job.provider_id/truck_id nullable
- Add Provider.is_available
- Remove Provider.is_verified if verification is reworked
- Add User.refresh_token, User.refresh_token_expires

Schemas:
- Token includes refresh_token
- JobCreate includes provider_id and optional price fields (for REQUEST mode)
- JobOut includes pickup_city/dropoff_city
- UserUpdate extra="forbid", tighter phone regex

Routes:
- Prefix /api
- Events SSE at /api/events/stream

Services:
- Remove CSV exporter
- Remove auto mock seeding unless env-flagged

Database:
- Alembic migration required for all model changes
- Backfill booking_mode, updated_at, make provider_id/truck_id nullable

Tests:
- Candidate phone update tests
- Add refresh token tests
- Add job lifecycle tests for both booking modes
- Add provider endpoint tests
- Add SSE stream test
```

---

## 22. Required Follow-Up Work

1. **Add Alembic migrations** for all model changes in `zcarbona-version`.
2. **Data migration** to backfill `Job.booking_mode`, `Job.updated_at`, and handle nullable `provider_id`/`truck_id`.
3. **Fix OAuth2 URL mismatch** in `api/app/core/security.py` to `/api/auth/login` and update docs.
4. **Verify `aiomysql` build** after removing `libmariadb-dev` from Dockerfile.
5. **Add tests** for refresh tokens, job lifecycle (accept/start/complete/decline), provider status/location, SSE, and provider lookup.
6. **Document breaking API changes** for mobile/web clients.
7. **Replace CSV exporter** with secure audit/logging if export is still needed.
8. **Decide on `is_verified`**: either restore it with a proper verification workflow or remove it everywhere and update frontend.
9. **Implement dual booking modes** (`REQUEST` and `PROVIDER_SELECTION`) to avoid choosing one over the other.
10. **Add request validation** for `/provider/location` lat/lon ranges.

---

## 23. Final Verdict

```text
Recommended strategy:
Combine both branches into a single unified backend that adopts candidate's security,
real-time, and provider-lifecycle improvements while preserving main's auto-match
job flow and price-range validation as an alternative booking mode.

Best parts of main:
- Auto-truck matching with TruckLock reservation
- Price-range validation in price_approval
- Complete demo data seeding
- Simpler stateless auth (baseline)

Best parts of zcarbona-version:
- Refresh tokens
- SSE events
- Provider accept/start/complete/decline lifecycle
- Profile-update uniqueness checks and IntegrityError handling
- Removal of plaintext CSV export of hashed passwords
- Tightened CORS
- First test coverage

Changes that should NOT be combined:
- Candidate's removal of price-range validation in price_approval (regression)
- Candidate's hard switch to /api prefix without a deprecation plan for /api/v1 (breaking)
- Candidate's removal of mock data seeding without an env-flagged alternative (developer experience regression)
- Candidate's dropped `is_verified` field without a replacement verification endpoint

Changes that SHOULD be combined:
- Refresh token flow (with OAuth2 URL fix)
- Provider lifecycle endpoints
- SSE event stream
- Uniqueness checks in user updates
- CORS restriction
- test_phone_update.py test suite
- Dual booking mode (REQUEST + PROVIDER_SELECTION)

Highest-risk issue:
Missing Alembic migration for significant schema changes (new enums, nullable columns,
new columns, removed columns). Deploying candidate models without migration will fail.

Highest-value improvement:
Adding provider-side job acceptance and trip lifecycle with real-time SSE updates,
combined with secure profile update validation, gives the biggest functional and
security leap.
```
