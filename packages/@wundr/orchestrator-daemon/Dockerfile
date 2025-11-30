# Production Dockerfile for orchestrator-daemon
FROM node:20-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Set working directory
WORKDIR /app

# Copy workspace configuration
COPY pnpm-workspace.yaml ./
COPY package.json pnpm-lock.yaml ./

# Copy all package.json files for dependency resolution
COPY packages/@wundr/orchestrator-daemon/package.json ./packages/@wundr/orchestrator-daemon/
COPY packages/@wundr/ai-integration/package.json ./packages/@wundr/ai-integration/

# Install dependencies stage
FROM base AS dependencies
RUN pnpm install --frozen-lockfile --filter @wundr.io/orchestrator-daemon...

# Build stage
FROM dependencies AS build

# Copy source code
COPY packages/@wundr/orchestrator-daemon ./packages/@wundr/orchestrator-daemon
COPY packages/@wundr/ai-integration ./packages/@wundr/ai-integration

# Build the daemon
WORKDIR /app/packages/@wundr/orchestrator-daemon
RUN pnpm run build

# Production runtime stage
FROM node:20-alpine AS runtime

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy built artifacts and dependencies
COPY --from=build --chown=nodejs:nodejs /app/packages/@wundr/orchestrator-daemon/dist ./dist
COPY --from=build --chown=nodejs:nodejs /app/packages/@wundr/orchestrator-daemon/package.json ./
COPY --from=build --chown=nodejs:nodejs /app/node_modules ./node_modules

# Switch to non-root user
USER nodejs

# Expose daemon port
EXPOSE 8787

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8787/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) })"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the daemon
CMD ["node", "dist/index.js"]
