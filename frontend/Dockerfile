# ---------- Stage 1: build the React app ----------
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_API_URL=/api
ARG VITE_GRAFANA_URL=
ARG VITE_PROMETHEUS_URL=
ENV VITE_API_URL=$VITE_API_URL \
    VITE_GRAFANA_URL=$VITE_GRAFANA_URL \
    VITE_PROMETHEUS_URL=$VITE_PROMETHEUS_URL
RUN npm run build

# ---------- Stage 2: serve with nginx (≈ 50 MB image, no Node.js inside) ----------
FROM nginx:1.27-alpine
LABEL org.opencontainers.image.title="resourcehub-frontend"
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=15s --timeout=3s --retries=5 CMD wget -qO- http://127.0.0.1/ > /dev/null || exit 1
CMD ["nginx", "-g", "daemon off;"]
