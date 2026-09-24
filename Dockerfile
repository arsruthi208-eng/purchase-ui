# ── Stage 1: Vite build ─────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --prefer-offline
COPY . .

# VITE_API_URL is the full backend Cloud Run URL, e.g.
# https://purchase-backend-abc123-em.a.run.app
# Passed at build time via --build-arg in CI (see deploy-frontend.yml).
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# ── Stage 2: Nginx static server ────────────────────────────────────
FROM nginx:stable-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Cloud Run expects the container to listen on PORT=8080 (nginx.conf uses 8080)
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
