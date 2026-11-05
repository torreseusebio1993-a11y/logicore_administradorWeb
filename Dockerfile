# Panel web: se compila con Node y se sirve con Caddy (que además envía
# /api/* al backend; ver deploy/Caddyfile en el repo del backend).
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Misma dirección que el panel: el navegador llama a /api (sin CORS)
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM caddy:2-alpine
COPY --from=build /app/dist /srv
