# Builds the frontend container. The server API and MySQL database run as
# separate containers; Compose places all project containers on naql_network.
FROM ghcr.io/cirruslabs/flutter:3.29.3 AS build

WORKDIR /app

COPY pubspec.yaml ./
RUN flutter pub get

COPY . .
RUN flutter build web --release --target=truck/main.dart

FROM nginx:1.27-alpine

LABEL org.opencontainers.image.title="Naql frontend"
LABEL org.opencontainers.image.description="Naql static web frontend"

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY web-app/ /usr/share/nginx/html/
COPY --from=build /app/build/web/ /usr/share/nginx/html/flutter/

EXPOSE 80
