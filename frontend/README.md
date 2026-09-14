# Naql Frontend

Next.js 16 + TypeScript + Tailwind CSS web app for the Naql logistics platform.

## Design System

Customer-facing pages (Home, Book, Trips, Profile) use a custom design system defined in `app/naql.css`:

- **Sidebar** — `src/components/NaqlLayout.tsx` with nav links, language toggle, avatar, logout
- **Header** — sticky top bar with brand logo, search, notifications
- **Cards & buttons** — consistent rounded corners, red accent (#ed1c24)
- **Layout switcher** — `src/components/Shell.tsx` switches between `NaqlLayout` and the old `Header` + `BottomNav` based on route and user role

## Pages

| Route | File | Notes |
|-------|------|-------|
| `/` | `app/page.tsx` | Home page with auth redirect, live truck map, recent bookings |
| `/book` | `app/book/page.tsx` | 4-step booking flow: vehicle → locations → budget → confirm |
| `/trip` | `app/trip/page.tsx` | Real jobs from API, wrapped in RoleGuard |
| `/profile` | `app/profile/page.tsx` | Profile using NaqlLayout, phone, stats, sign out |

## Pricing

Uber-like formula in `app/book/page.tsx`:

```
price = base + km × rate
```

| Vehicle | Base (EGP) | Per km (EGP) |
|---------|-----------|-------------|
| small   | 250       | 6           |
| medium  | 350       | 8           |
| large   | 700       | 11          |
| xl      | 850       | 15          |

Distance is computed with the Haversine formula from hardcoded city coordinates (API cities may not load in browser due to Docker networking).

## Map

`src/components/TruckMap.tsx` — Leaflet + OpenStreetMap (no API key). Shows truck markers colored by vehicle class, user's current location (black marker), and a "Use My Location" retry button.

## Getting Started

```bash
cp .env.example .env
docker compose up --build
```

Open [http://localhost:3000](http://localhost:3000) to see the result.

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Leaflet](https://leafletjs.com/)