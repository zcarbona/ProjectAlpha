# Naql frontend

The current setup runs the Flutter web frontend, FastAPI service, and a private MySQL 8.0 database in Docker. The frontend does not connect to the database; API requests are proxied through the frontend container, and only the API can access MySQL.

## Run

```sh
cp .env.example .env
docker compose up --build
```

Set strong, different `MYSQL_PASSWORD`, `MYSQL_ROOT_PASSWORD`, and `SECRET_KEY` values in `.env` before any deployment. Open http://localhost:8080. Only this frontend port is exposed; MySQL and the API remain on the private `naql_network`. Stop containers with `docker compose down`; the database remains in the `naql_mysql_data` volume. To intentionally remove the stored database too, use `docker compose down --volumes`.

The frontend uses OpenStreetMap via Leaflet (web) and flutter_map (Flutter). No external map API key is required.
