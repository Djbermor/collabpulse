# ==============================================================================
# CollabPulse Enterprise — Production Dockerfile
# Optimized for Google Cloud Run, Cloud SQL & Container Orchestration
# ==============================================================================

# --- Stage 1: Build Application & Bundles ---
FROM node:22-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy dependency manifests
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source code and build configs
COPY tsconfig.json vite.config.ts index.html firebase-applet-config.json ./
COPY src/ ./src/
COPY server/ ./server/
COPY server.ts ./
COPY drizzle/ ./drizzle/

# Build static assets (dist/) and bundle server (dist/server.cjs)
ENV NODE_ENV=production
RUN npm run build

# --- Stage 2: Minimal Production Runtime ---
FROM node:22-alpine AS runner

WORKDIR /app

# Install curl for healthcheck
RUN apk add --no-cache curl

# Security: Set production environment
ENV NODE_ENV=production
ENV PORT=8080

# Create application directory with non-root node user ownership
RUN mkdir -p /app && chown -R node:node /app

# Copy dependency manifests
COPY package.json package-lock.json ./

# Install production dependencies only
RUN npm ci --omit=dev && npm cache clean --force

# Copy built bundles from builder
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/drizzle ./drizzle
COPY --from=builder --chown=node:node /app/firebase-applet-config.json ./firebase-applet-config.json

# Switch to non-root user for security compliance
USER node

# Google Cloud Run default port
EXPOSE 8080

# Container Health Check (verifies database & SSE hub readiness)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:${PORT}/ready || exit 1

# Start production server
CMD ["node", "dist/server.cjs"]
