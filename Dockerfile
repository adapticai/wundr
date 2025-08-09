# Multi-stage build for Wundr - Monorepo Refactoring Toolkit
ARG NODE_VERSION=20
ARG ALPINE_VERSION=3.19

# Build stage
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS builder

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    curl

# Enable pnpm
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY config/*/package.json ./config/*/
COPY tools/*/package.json ./tools/*/
COPY mcp-tools/package.json ./mcp-tools/

# Install dependencies
RUN pnpm install --frozen-lockfile --prod=false

# Copy source code
COPY . .

# Build the application
RUN pnpm build

# Remove development dependencies
RUN pnpm prune --prod

# Production stage
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS production

# Install runtime dependencies
RUN apk add --no-cache \
    git \
    curl \
    bash \
    jq \
    ca-certificates \
    tini

# Enable pnpm
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

# Create app user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S wundr -u 1001 -G nodejs

# Set working directory
WORKDIR /app

# Copy built application from builder stage
COPY --from=builder --chown=wundr:nodejs /app/dist ./dist
COPY --from=builder --chown=wundr:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=wundr:nodejs /app/package.json ./
COPY --from=builder --chown=wundr:nodejs /app/scripts ./scripts
COPY --from=builder --chown=wundr:nodejs /app/config ./config
COPY --from=builder --chown=wundr:nodejs /app/templates ./templates
COPY --from=builder --chown=wundr:nodejs /app/docs ./docs
COPY --from=builder --chown=wundr:nodejs /app/bin ./bin

# Make scripts executable
RUN find scripts -name "*.sh" -exec chmod +x {} \; && \
    chmod +x bin/wundr.js

# Create directories for data and logs
RUN mkdir -p /app/data /app/logs && \
    chown -R wundr:nodejs /app/data /app/logs

# Build arguments for metadata
ARG VERSION
ARG BUILD_DATE
ARG VCS_REF

# Add metadata labels
LABEL maintainer="Wundr, by Adaptic.ai" \
    org.opencontainers.image.title="Wundr" \
    org.opencontainers.image.description="Intelligent CLI-Based Coding Agents Orchestrator" \
    org.opencontainers.image.version="${VERSION}" \
    org.opencontainers.image.created="${BUILD_DATE}" \
    org.opencontainers.image.revision="${VCS_REF}" \
    org.opencontainers.image.vendor="Wundr, by Adaptic.ai" \
    org.opencontainers.image.url="https://wundr.io" \
    org.opencontainers.image.source="https://github.com/adapticai/wundr" \
    org.opencontainers.image.documentation="https://github.com/adapticai/wundr/blob/main/README.md"

# Switch to non-root user
USER wundr

# Set environment variables
ENV NODE_ENV=production \
    PORT=3000 \
    WUNDR_DATA_DIR=/app/data \
    WUNDR_LOG_DIR=/app/logs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Use tini as init system
ENTRYPOINT ["/sbin/tini", "--"]

# Default command
CMD ["node", "bin/wundr.js", "server", "--port", "3000"]

# Web client stage (optional)
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS webclient

# Install web client dependencies if it exists
WORKDIR /app
COPY tools/web-client* ./tools/web-client*/
RUN if [ -f "tools/web-client/package.json" ]; then \
    cd tools/web-client && \
    corepack enable && \
    pnpm install --frozen-lockfile && \
    pnpm build; \
    fi

# Multi-service stage (includes web client)
FROM production AS full

# Copy web client if built
COPY --from=webclient --chown=wundr:nodejs /app/tools/web-client/dist ./tools/web-client/dist
COPY --from=webclient --chown=wundr:nodejs /app/tools/web-client/.next ./tools/web-client/.next

# Expose additional port for web client
EXPOSE 3001

# Override command to start both services
CMD ["sh", "-c", "node bin/wundr.js server --port 3000 & if [ -d tools/web-client/.next ]; then cd tools/web-client && npm start -- --port 3001; else wait; fi"]
