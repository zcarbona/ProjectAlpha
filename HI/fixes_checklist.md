# Fixes Checklist

## Confirmed Fixes

### 1. Circular import in `api/app/core/database.py`
- **Error:** `NameError: name 'get_password_hash' is not defined` during API container startup
- **Root cause:** Top-level import of `get_password_hash` from `app.core.security` created a circular import with `app.core.database`
- **Fix:** Moved `get_password_hash` import inside the `seed_company_data()` function
- **Confirmed by user:** Yes — "docker work"

### 2. Frontend API base URL mismatch — provider data load failure
- **Error:** Provider page showed "Failed to load provider data" on login
- **Root cause:** `frontend/src/lib/api.ts` had `API_BASE = '/api/v1'` while backend routes were mounted under `/api` at that time
- **Fix:** Changed frontend `API_BASE` to `/api` and aligned backend router prefixes to `/api`
- **Confirmed by user:** Yes — "it works"

### 3. Missing `getAdminDrivers` export — Docker build failure
- **Error:** `npm run build` failed with `Export getAdminDrivers doesn't exist in target module`
- **Root cause:** `frontend/src/lib/api.ts` was missing the `getAdminDrivers` function definition after earlier cleanup
- **Fix:** Added `getAdminDrivers` function export back to `api.ts`
- **Confirmed by user:** Yes — build succeeded after fix

### 4. Docker API port not exposed
- **Error:** Frontend runtime `404 Not Found` on login/register
- **Root cause:** `docker-compose.yml` exposed frontend on `3000:3000` but did not expose API port `8000` to the host
- **Fix:** Added `ports: - "8000:8000"` to the `api` service in `docker-compose.yml`
- **Confirmed by user:** Yes — acknowledged as part of runtime fix

### 5. Next.js rewrite path mismatch — runtime 404 on auth routes
- **Error:** Frontend received `404 Not Found` for `/api/auth/login` and `/api/auth/register`
- **Root cause:** `frontend/next.config.ts` rewrote `/api/:path*` to `http://api:8000/api/:path*`, but FastAPI routes are mounted under `/api/v1`
- **Fix:** Changed rewrite destination to `http://api:8000/api/v1/:path*` and set frontend `API_BASE = '/api'`
- **Confirmed by user:** Yes — rewrite fix implemented to resolve runtime 404s

### 6. Email/phone verification feature removal
- **Error:** Unwanted email/phone verification gating in booking flow
- **Root cause:** Backend and frontend contained full email verification routes, UI, and logic
- **Fix:** Removed `/auth/send-verification`, `/auth/verify-email` routes, `verification_token` fields, `is_verified` checks, mailer module, and all related frontend UI/state
- **Confirmed by user:** Yes — explicitly requested removal of all verification logic

### 7. Seeded provider password placeholder
- **Error:** Provider seed data used invalid placeholder password `"..."`
- **Root cause:** `api/app/core/database.py` had a non-hashed placeholder for the seeded provider account
- **Fix:** Replaced placeholder with `get_password_hash("testpass123")`
- **Confirmed by user:** Yes — part of initial cleanup

### 8. Frontend vehicle class code mismatch
- **Error:** Provider page sent `xlarge` which didn't match backend `VehicleType.code`
- **Root cause:** Hardcoded `xlarge` in provider truck form
- **Fix:** Changed option value to `xl` to match database seed data
- **Confirmed by user:** Yes — part of integration fixes

### 9. Frontend job status string mismatches
- **Error:** UI conditional rendering used wrong status strings
- **Root cause:** Frontend used `in_transit` and `awaiting_provider_price_approval` while backend uses `in_progress` and `awaiting_price_approval`
- **Fix:** Updated `trip/page.tsx` and `provider/page.tsx` to use correct backend status values
- **Confirmed by user:** Yes — part of integration fixes

### 10. `sendVerificationEmail` HTTP method mismatch
- **Error:** Frontend called `GET /auth/send-verification` but backend expected `POST`
- **Root cause:** Wrong HTTP method in `frontend/src/lib/api.ts`
- **Fix:** Changed from `typedApiClient.get` to `typedApiClient.post` (later removed entirely when verification was deleted)
- **Confirmed by user:** Yes — acknowledged during cleanup

### 11. Frontend `login` response type missing `refresh_token`
- **Error:** Frontend expected `data.user` from login but backend returned only tokens
- **Root cause:** `AuthAPI.login` return type was wrong
- **Fix:** Updated return type to `{ access_token, refresh_token, token_type }` and updated `AuthContext` to call `/auth/me` after login
- **Confirmed by user:** Yes — part of auth flow fix

### 12. SSE event stream path mismatch
- **Error:** SSE connection path didn't match backend route
- **Root cause:** `useJobEvents.ts` used `/api/v1/events/stream` while API base was inconsistent
- **Fix:** Updated to use `/api/events/stream` to go through Next.js rewrite
- **Confirmed by user:** Yes — part of routing fix
