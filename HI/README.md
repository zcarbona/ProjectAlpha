# Naql Logistics Platform

Naql is a logistics and shipping marketplace platform running a Next.js web application frontend, FastAPI backend service, and a private MySQL 8.0 database in Docker.

## Architecture

- **Frontend:** Next.js (React 19 / TypeScript / Tailwind CSS) with Leaflet maps.
- **Backend:** FastAPI (Python 3.11+, SQLAlchemy 2.0 async, aiomysql, Pydantic v2).
- **Database:** MySQL 8.0 container attached to the private `naql_network`.

## Getting Started

1. Copy the environment variables:
   ```sh
   cp .env.example .env
   ```
2. Set strong values for `MYSQL_PASSWORD`, `MYSQL_ROOT_PASSWORD`, and `SECRET_KEY` in `.env`.
3. Start the services with Docker Compose:
   ```sh
   docker compose up --build
   ```
4. Access the frontend at [http://localhost:3000](http://localhost:3000).

To stop the containers:
```sh
docker compose down
```
To also remove the database volume:
```sh
docker compose down --volumes
```
