# ---------- Stage 1: install production dependencies ----------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ---------- Stage 2: minimal runtime image ----------
FROM node:22-alpine AS runtime
LABEL org.opencontainers.image.title="resourcehub-backend" \
      org.opencontainers.image.description="ResourceHub Office Resource Management API" \
      org.opencontainers.image.source="https://github.com/your-org/resourcehub"

ENV NODE_ENV=production \
    PORT=5000
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src

# Run as the unprivileged "node" user that ships with the official image
USER node
EXPOSE 5000

# wget is part of busybox in alpine, so no extra packages are needed for the healthcheck
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD wget -qO- http://127.0.0.1:5000/api/health > /dev/null || exit 1

CMD ["node", "src/server.js"]
