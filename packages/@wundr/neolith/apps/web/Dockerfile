# Neolith Web App - Next.js Dockerfile for Railway
# Simple approach: copy entire repo and build

ARG NODE_VERSION=20
ARG ALPINE_VERSION=3.19

# =============================================================================
# Stage 1: Builder
# =============================================================================
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS builder

# Install build dependencies (including bash for scripts)
RUN apk add --no-cache libc6-compat python3 make g++ git bash

# Install pnpm directly (bypassing corepack signature issues)
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm install -g pnpm@9

WORKDIR /app

# Copy entire repo (Railway uploads from root)
COPY . .

# Install dependencies
RUN pnpm install --frozen-lockfile

# Generate Prisma client
RUN cd packages/@wundr/neolith/packages/@neolith/database && npx prisma generate

# Build shared packages that the web app depends on
# These packages need to be compiled to dist/ before Next.js can import them

# Build @neolith/database (needs TypeScript compilation, exports from dist/)
RUN cd packages/@wundr/neolith/packages/@neolith/database && npx tsc

# Build @neolith/core (needs TypeScript compilation, exports from dist/)
RUN cd packages/@wundr/neolith/packages/@neolith/core && npx tsc

# Build @wundr.io/org-genesis (needed by generate-org route, exports from dist/)
RUN cd packages/@wundr/org-genesis && npx tsc

# Build @neolith/org-integration (needed by generate-org route, exports from dist/)
RUN cd packages/@wundr/neolith/packages/@neolith/org-integration && npx tsc

# Build @neolith/ui (using tsup, skip dts to avoid TypeScript errors)
RUN cd packages/@wundr/neolith/packages/@neolith/ui && npx tsup src/index.ts --format cjs,esm --clean --no-dts

# Build the web app (using webpack mode to avoid Turbopack path alias issues in monorepos)
WORKDIR /app/packages/@wundr/neolith/apps/web
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV CI=true
RUN npx next build --webpack

# =============================================================================
# Stage 2: Runner
# =============================================================================
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder --chown=nextjs:nodejs /app/packages/@wundr/neolith/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/packages/@wundr/neolith/apps/web/.next/static ./packages/@wundr/neolith/apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/packages/@wundr/neolith/apps/web/public ./packages/@wundr/neolith/apps/web/public

USER nextjs

EXPOSE 3000

# Start the server
CMD ["node", "packages/@wundr/neolith/apps/web/server.js"]
