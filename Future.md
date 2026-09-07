# Naql — Least Viable Shippable Product

This document defines the smallest safe product that can be shipped after the current frontend prototype. It is deliberately server-first: the mobile apps render data and submit requests, while the server owns all important decisions and records.

## Goal

Let a customer securely sign in, choose a truck, enter pickup and drop-off points, submit a requested price range, temporarily reserve the chosen truck, and receive an accepted job only after:

1. The truck provider (an individual owner or transport company) approves the requested price range.
2. The customer has paid the approved amount.

Payment collection is **not included in the first release**. The server and database will have the states and references needed for a future Stripe integration.

## Included in the first release

- Customer authentication using either phone number, email address, or username plus password.
- Google and Apple sign-in (OAuth), with each identity linked to the same server-side customer account.
- Customer profile, including verified phone/email status.
- Truck-provider accounts for people or companies that own trucks.
- Truck records owned by a truck provider.
- A list/map of available trucks.
- Google Maps place search and a map picker for pickup and drop-off locations.
- Job request creation with pickup, drop-off, requested price range, and selected truck.
- A temporary server-side truck lock while a job request is being reviewed.
- Company approval or rejection of the requested price range.
- A payment-pending step after approval.
- Job acceptance only after server-confirmed payment in the future.
- Basic customer job history and truck-provider job queue.
- Audit trail for job, lock, price-review, payment, and login-sensitive events.

## Roles and access

There are exactly three product roles in the first release:

| Role | Who it is | Allowed access |
| --- | --- | --- |
| `admin` | Platform stakeholder/administrator | The private administrative dashboard only: review platform data, users, providers, trucks, jobs, and audit events. Admins do not use the customer request flow or provider work queue. |
| `customer` | A normal user who needs a truck | Register/sign in, manage their profile, select a truck, create/cancel their own requests, pay when payments are introduced, and view only their own jobs. |
| `provider` | A person or company with one or more trucks | Register/sign in, manage their truck records, view requests for their trucks, approve/reject price ranges, and view only their own jobs and trucks. |

The API assigns and checks roles on the server for every request. The app must not choose a role or unlock dashboard screens based only on a client-side value.

## Explicitly not included yet

- Live driver tracking, driver chat, push notifications, reviews, bidding between drivers, invoices, payouts, refunds, promos, or a full admin analytics portal.
- Real payment collection. The interface may show `Payment coming soon`; it must not claim that a job is paid.
- Offline mode or long-lived client caching of customer, company, truck, job, or authentication data.

## Job and truck-lock flow

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
- A lock belongs to one job request and expires automatically after a short configured period (for example, 15 minutes) unless the request is rejected or accepted sooner.
- An expired, rejected, cancelled, or failed-payment job releases its lock immediately.
- The database must prevent a truck from having more than one active lock or accepted assignment for the same time window.
- The app displays the server-returned lock expiry; it must never decide a truck is locked or unlocked on its own.
- If the customer needs more time, the server may issue a single limited extension only while the truck is still eligible.

## Server-side business rules

- The server calculates availability, validates locations, price ranges, lock expiry, job state changes, and permissions.
- A provider cannot approve a request for a truck it does not own.
- A customer can view or change only their own jobs.
- A provider can view and act only on their own trucks and jobs. An admin dashboard is accessible only to `admin` users.
- A job cannot become `accepted` until both `price_approval = approved` and `payment_status = paid` are true in one server-side transaction.
- Every state change uses an idempotency key so a repeated network request cannot create duplicate jobs, locks, approvals, or payments.

## Container deployment rules

All runtime components must run in containers on one private project network (for example, the Compose network `naql_network`). The first deploy contains the frontend and MySQL 8.0 containers. When the server implementation begins, the API must be added as a separate container on that same network.

```text
Browser / Android app / iOS app
             |
             | HTTPS
             v
     frontend container       API container (future)
             |                       |
             +---- private network ---+
                                     |
                                     v
                            MySQL 8.0 container
                          persistent named volume
```

- Only the frontend publishes a host port (currently `8080`). MySQL must not publish a host port in the standard application deployment.
- The frontend is a static UI container and must never receive database credentials or connect to MySQL directly.
- The API is the only component permitted to hold database credentials and query the database. It must be the only path through which mobile and web clients access project data.
- MySQL data—including user account records, password hashes, OAuth identity links, session/refresh-token hashes, providers, trucks, jobs, and audit records—lives in the named Docker volume `naql_mysql_data`, mounted at `/var/lib/mysql`. Recreating containers must not erase it.
- A normal stop/removal uses `docker compose down` and preserves the volume. Removing it requires the explicit destructive command `docker compose down --volumes`.
- Database passwords belong in an uncommitted `.env` file or deployment secret store, never in source code, the app image, or a mobile client.
- The API container must wait for the database health check and use migrations during deployment; it must not depend on the frontend container.

## Core data model

Use MySQL 8.0 as the relational database. Store sensitive data encrypted at rest through the managed database/provider and expose it only through authenticated server APIs.

| Area | Minimum records |
| --- | --- |
| Accounts | `users`, password hash, username, email, phone number, verification status, account state, created/updated dates |
| OAuth identities | `oauth_identities`: user ID, provider (`google` or `apple`), provider subject ID, provider email when supplied, linked date; unique per provider + subject |
| Sessions | `sessions` or refresh-token records: user ID, token hash, device metadata, expiry, revocation time |
| Providers | `providers`: user ID, person/business display name, contact details, verification state, active state; a provider may be an individual driver/owner or a company |
| Trucks | `trucks`: provider ID, registration/plate reference, vehicle class, capacity, availability state, active state |
| Truck locks | `truck_locks`: truck ID, job ID, starts/ends at, expiry, status; database constraint for one active conflicting lock |
| Jobs | `jobs`: customer ID, provider ID, truck ID, pickup/drop-off place IDs and coordinates, requested min/max price, approved price, state, scheduled time, timestamps |
| Price review | `price_approvals`: job ID, provider user ID, decision, approved amount, note, timestamp |
| Payments (prepared) | `payments`: job ID, amount, currency, status (`not_started`, `pending`, `paid`, `failed`, `refunded`), future Stripe payment-intent ID, timestamps; never store card numbers or CVV |
| Audit | `audit_events`: actor, action, record type/ID, timestamp, request/IP metadata appropriate to privacy policy |

Coordinates are necessary for map and routing work, but addresses should be stored alongside their Google Place IDs and normalized display text. Restrict location precision in logs and staff views to what the role needs.

## Authentication and account security

- Passwords are never stored in readable form. Use Argon2id (preferred) or bcrypt with a current secure work factor.
- Email and phone verification must occur before a customer can submit a job request.
- Phone login uses a verified phone number plus password; do not use SMS alone as a password substitute unless a later passwordless flow is intentionally designed.
- Google and Apple sign-in are verified on the server using provider-issued identity tokens. Never trust a provider identity sent by the app without server validation.
- Link OAuth identities to an existing account only after the customer proves control of that account or the verified email match is safely confirmed.
- Use short-lived access tokens, rotating refresh tokens, revocation on logout/password reset, rate limits, and login/credential-stuffing protection.
- Add account recovery with rate limits, expiring single-use links or codes, and audit records.
- Do not put secrets, OAuth client secrets, map keys with unrestricted access, or Stripe secret keys in the app.

## Mobile app security: Android and iOS

- Use HTTPS/TLS for every API and map request. Reject cleartext traffic in Android and require App Transport Security on iOS.
- Keep access tokens in the platform secure store only: Android Keystore / encrypted storage and iOS Keychain. Do not store tokens, customer records, jobs, company data, or payment data in local preferences, files, logs, or unencrypted databases.
- Keep memory-only UI state only for the active screen/session. On logout, clear it and revoke the server refresh session.
- Use device/app integrity signals for high-risk operations where practical: Play Integrity on Android and App Attest / DeviceCheck on iOS. Server policy must remain safe if a device cannot provide a signal.
- Enforce signed release builds, disable debug logging in production, minimize permissions, and do not request background location in this first release.
- Show pickup/drop-off maps only after the user grants location permission; entering an address manually remains available.
- Never rely on a mobile-side check for authorization, lock ownership, price approval, or payment status.

## Google Maps

- Use Google Maps SDK and Places Autocomplete for pickup and drop-off selection.
- Send selected Google Place IDs and coordinates to the server. The server validates and persists them with the job.
- Restrict each Maps API key by platform (Android package/signing certificate, iOS bundle ID, and server IP/service identity) and to only the required APIs.
- Keep server-side Maps credentials separate from mobile keys, and apply API quotas and billing alerts.

## Payment preparation for Stripe

The database and API should include the payment states above, but no payment form or payment confirmation button should be enabled yet. When Stripe is introduced:

1. The server creates a Stripe PaymentIntent only after the provider approves a price.
2. The app uses Stripe's mobile SDK; card data goes directly to Stripe and never to Naql servers or the database.
3. Stripe webhooks are verified by the server and are the authority that changes a payment to `paid`.
4. The server atomically converts the job to `accepted` only after that verified webhook and while the truck lock is still valid.

## Minimal API surface

- `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `POST /auth/refresh`
- `POST /auth/oauth/google`, `POST /auth/oauth/apple`
- `GET /me`, `PATCH /me`
- `GET /trucks`, `GET /trucks/:id`
- `POST /jobs` — validates selection and creates the temporary lock
- `GET /jobs`, `GET /jobs/:id`, `POST /jobs/:id/cancel`
- `POST /provider/jobs/:id/price-approval` — approve/reject; server checks truck ownership
- `GET /provider/jobs`, `GET /provider/trucks`
- `GET /admin/dashboard` — server-side `admin` role required
- Future only: `POST /jobs/:id/payment-intent` and `POST /webhooks/stripe`

Every authenticated endpoint checks the session, server-side role, ownership, input schema, rate limit, and audit requirement before acting.

## Release acceptance checklist

- A new customer can register or sign in with username/email/phone plus password, Google, or Apple.
- A customer cannot create a job without verified contact information.
- A customer can choose a truck and Google Maps pickup/drop-off locations and submit a price range.
- The selected truck is unavailable to competing requests for the server-defined lock period.
- A provider can approve or reject the requested range only for their own trucks.
- An approved request moves to `awaiting_payment`, never directly to `accepted`.
- No job becomes accepted until the future server-verified payment signal is received.
- No sensitive project data is persisted in the client; the database is the source of truth.
- Release builds pass basic authentication, authorization, duplicate-request, lock-expiry, and role-isolation tests.
