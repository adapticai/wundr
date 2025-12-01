# Genesis-App

**Enterprise Communication Platform with VP-Daemon Integration**

Genesis-App is a comprehensive enterprise communication platform that serves as both a human-facing
communication hub (similar to Slack) and a programmatic integration layer for Virtual Principal (VP)
agents. It enables seamless organizational structure generation through deep integration with the
Wundr ecosystem.

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Development](#development)
- [Packages](#packages)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

Genesis-App is a dual-purpose platform designed to:

1. **Human-Facing Communication Hub**: A full-featured Slack-like experience (PWA, mobile, desktop)
   for enterprise teams
2. **VP-Daemon Integration Layer**: Programmatic API enabling Virtual Principal (VP) agents to
   participate as first-class citizens

### Strategic Goals

- **Seamless Org Provisioning**: Transform the conversational org-genesis experience into workspace
  creation
- **Agent-First Architecture**: Orchestrator agents operate as indistinguishable users within the
  platform
- **Dual-Channel Support**: VP-Daemons can connect to both real Slack AND genesis-app simultaneously
- **Package Reusability**: Extract common interfaces for cross-platform communication clients

---

## Key Features

| Category           | Features                                                           |
| ------------------ | ------------------------------------------------------------------ |
| **Messaging**      | Real-time chat, threads, reactions, mentions, rich text (Markdown) |
| **Organization**   | Workspaces, channels (public/private), direct messages, RBAC       |
| **Media**          | File uploads, image optimization, voice/video huddles (LiveKit)    |
| **VP Integration** | Service account auth, daemon API gateway, file sync pipelines      |
| **Enterprise**     | Audit logs, search, retention policies, SSO/OAuth                  |
| **Cross-Platform** | Web (PWA), Desktop (Electron), Mobile (Capacitor)                  |

---

## Architecture

```
+-----------------------------------------------------------------------------+
|                              GENESIS-APP                                     |
|                                                                              |
|  +------------------------------------------------------------------------+  |
|  |                     CLIENT APPLICATIONS                                 |  |
|  |  +----------------+  +----------------+  +----------------+            |  |
|  |  |   Web PWA      |  |  iOS/Android   |  |   Desktop      |            |  |
|  |  |  (Next.js 14)  |  |  (Capacitor)   |  |  (Electron)    |            |  |
|  |  +----------------+  +----------------+  +----------------+            |  |
|  +------------------------------------------------------------------------+  |
|                                    |                                         |
|                                    v                                         |
|  +------------------------------------------------------------------------+  |
|  |                         API GATEWAY                                     |  |
|  |  +------------------------------------------------------------------+  |  |
|  |  |                    GraphQL API (Apollo Server 4)                 |  |  |
|  |  |  - HTTP Transport (Queries/Mutations)                            |  |  |
|  |  |  - WebSocket Transport (Subscriptions via graphql-ws)            |  |  |
|  |  |  - Auth: NextAuth (humans) + ServiceAccount (daemons)            |  |  |
|  |  +------------------------------------------------------------------+  |  |
|  +------------------------------------------------------------------------+  |
|                                    |                                         |
|         +--------------------------+-------------------------+               |
|         v                          v                         v               |
|  +----------------+       +----------------+       +----------------+        |
|  |  PostgreSQL    |       |    Redis       |       |   LiveKit      |        |
|  |   (Prisma)     |       |   (PubSub)     |       |   (WebRTC)     |        |
|  |                |       |                |       |                |        |
|  | - Users        |       | - Presence     |       | - Huddles      |        |
|  | - Workspaces   |       | - Events       |       | - Screen Share |        |
|  | - Messages     |       | - Cache        |       |                |        |
|  | - Orchestrator Mapping   |       |                |       |                |        |
|  +----------------+       +----------------+       +----------------+        |
|                                                                              |
|  +------------------------------------------------------------------------+  |
|  |                      DAEMON API GATEWAY                                 |  |
|  |  - ServiceAccount Authentication (API Key + mTLS)                      |  |
|  |  - Scoped JWT Token Issuance                                           |  |
|  |  - Rate Limiting & Quota Management                                    |  |
|  |  - Event Fan-out to Connected Daemons                                  |  |
|  +------------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------+
                                    |
                                    | HTTPS/WSS (Daemon Auth)
                                    v
+-----------------------------------------------------------------------------+
|                    VP-DAEMON (One Per Dedicated Machine)                     |
|                                                                              |
|  +------------------------------------------------------------------------+  |
|  |                    COMMUNICATION LAYER                                  |  |
|  |  +---------------------------+  +---------------------------+          |  |
|  |  | @wundr/genesis-client     |  | @wundr/slack-agent        |          |  |
|  |  | (Genesis-App)             |  | (Real Slack)              |          |  |
|  |  |                           |  |                           |          |  |
|  |  | Implements:               |  | Implements:               |          |  |
|  |  | CommunicationClient       |  | CommunicationClient       |          |  |
|  |  +---------------------------+  +---------------------------+          |  |
|  +------------------------------------------------------------------------+  |
|                                    |                                         |
|                                    v                                         |
|  +------------------------------------------------------------------------+  |
|  |              Orchestrator Daemon Core (Session Manager)                           |  |
|  |  - Session Spawning (Claude Code / Claude Flow)                        |  |
|  |  - Memory Architecture (Scratchpad -> Episodic -> Semantic)            |  |
|  |  - Integration Orchestration                                           |  |
|  +------------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------+
```

### Technology Stack

| Layer           | Technology                | Rationale                                      |
| --------------- | ------------------------- | ---------------------------------------------- |
| **Frontend**    | Next.js 14+ (App Router)  | Server components, streaming, optimal DX       |
| **UI Library**  | Shadcn/ui + Radix         | Accessible, customizable, TypeScript-first     |
| **Mobile**      | Capacitor                 | Web-to-native bridge with plugin ecosystem     |
| **Desktop**     | Electron                  | Full native API access for screen sharing      |
| **API**         | Apollo Server 4 + GraphQL | Strong typing, subscriptions, federation-ready |
| **Database**    | PostgreSQL + Prisma       | Type-safe ORM, migrations, connection pooling  |
| **Real-time**   | Redis PubSub + graphql-ws | Horizontal scaling, presence management        |
| **Voice/Video** | LiveKit                   | Open-source, scalable WebRTC infrastructure    |
| **Auth**        | Auth.js (NextAuth) v5     | Flexible providers, session management         |
| **Build**       | Turborepo + pnpm          | Monorepo caching, workspace management         |

---

## Quick Start

### Prerequisites

Ensure you have the following installed:

| Requirement        | Minimum Version | Check Command            |
| ------------------ | --------------- | ------------------------ |
| **Node.js**        | 20.0.0+         | `node --version`         |
| **pnpm**           | 9.0.0+          | `pnpm --version`         |
| **Docker**         | 24.0.0+         | `docker --version`       |
| **Docker Compose** | 2.20.0+         | `docker compose version` |

### Installation

1. **Clone the repository** (if not already in the wundr monorepo):

   ```bash
   git clone https://github.com/adaptic-ai/wundr.git
   cd wundr/packages/@wundr/genesis-app
   ```

2. **Install dependencies**:

   ```bash
   pnpm install
   ```

3. **Set up environment variables**:

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and configure the required values (see
   [Environment Configuration](#environment-configuration) below).

4. **Start infrastructure services**:

   ```bash
   docker compose up -d
   ```

   This starts:
   - PostgreSQL (port 5432)
   - Redis (port 6379)
   - MailHog (SMTP: 1025, Web UI: 8025)

5. **Initialize the database**:

   ```bash
   pnpm --filter @genesis/database db:push
   ```

6. **Start the development server**:

   ```bash
   pnpm dev
   ```

7. **Access the application**:
   - Web App: http://localhost:3000
   - MailHog UI: http://localhost:8025

### Environment Configuration

Key environment variables (see `.env.example` for full list):

```bash
# Application
NODE_ENV=development
APP_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://genesis:genesis_dev_password@localhost:5432/genesis_db

# Redis
REDIS_URL=redis://localhost:6379/0

# Authentication
JWT_SECRET=your-jwt-secret-change-in-production
SESSION_SECRET=your-session-secret-change-in-production

# AI/LLM Integration
ANTHROPIC_API_KEY=your-anthropic-api-key
OPENAI_API_KEY=your-openai-api-key
```

---

## Project Structure

```
genesis-app/
|
+-- apps/                           # Application packages
|   |
|   +-- web/                        # Next.js 14+ web application
|   |   +-- app/                    # App Router pages
|   |   |   +-- (auth)/             # Authentication routes
|   |   |   +-- (workspace)/        # Workspace routes (protected)
|   |   |   +-- api/                # API routes
|   |   |       +-- graphql/        # Apollo Server endpoint
|   |   |       +-- auth/           # NextAuth endpoints
|   |   |       +-- daemon/         # Daemon-specific REST endpoints
|   |   +-- components/             # React components
|   |   +-- lib/                    # Utilities and helpers
|   |   +-- tailwind.config.ts      # Tailwind CSS configuration
|   |   +-- next.config.js          # Next.js configuration
|   |
|   +-- mobile/                     # Capacitor mobile configuration
|   |   +-- ios/                    # iOS native project (generated)
|   |   +-- android/                # Android native project (generated)
|   |   +-- capacitor.config.ts     # Capacitor configuration
|   |
|   +-- desktop/                    # Electron desktop wrapper (planned)
|       +-- electron/               # Electron main/preload scripts
|       +-- electron-builder.yml    # Build configuration
|
+-- packages/                       # Shared library packages
|   |
|   +-- @genesis/ui/                # Shared UI components (Shadcn/Radix)
|   |   +-- src/
|   |       +-- components/         # Reusable UI components
|   |       +-- lib/                # UI utilities
|   |
|   +-- @genesis/database/          # Prisma schema and client
|   |   +-- prisma/
|   |   |   +-- schema.prisma       # Database schema
|   |   +-- src/
|   |       +-- client.ts           # Prisma client export
|   |
|   +-- @genesis/api-types/         # Generated GraphQL types (planned)
|   +-- @genesis/daemon-sdk/        # VP-Daemon SDK (planned)
|   +-- @genesis/org-integration/   # Org-Genesis integration (planned)
|   |
|   +-- @genesis/eslint-config/     # Shared ESLint configurations
|   +-- @genesis/typescript-config/ # Shared TypeScript configurations
|   +-- @genesis/tailwind-config/   # Shared Tailwind configurations
|
+-- docker/                         # Docker configuration files
|   +-- postgres/
|       +-- init/                   # PostgreSQL initialization scripts
|
+-- package.json                    # Root package.json
+-- pnpm-workspace.yaml             # pnpm workspace configuration
+-- turbo.json                      # Turborepo configuration
+-- docker-compose.yml              # Local development services
+-- .env.example                    # Environment template
```

### Key Files

| File                                              | Purpose                                                      |
| ------------------------------------------------- | ------------------------------------------------------------ |
| `turbo.json`                                      | Turborepo pipeline configuration for build, test, lint tasks |
| `pnpm-workspace.yaml`                             | Defines workspace packages for pnpm linking                  |
| `docker-compose.yml`                              | Local development infrastructure (Postgres, Redis, MailHog)  |
| `.env.example`                                    | Template for environment variables                           |
| `packages/@genesis/database/prisma/schema.prisma` | Database schema definition                                   |

---

## Development

### Available Scripts

Run these from the monorepo root (`packages/@wundr/genesis-app/`):

| Script               | Description                             |
| -------------------- | --------------------------------------- |
| `pnpm dev`           | Start all apps in development mode      |
| `pnpm build`         | Build all packages and apps             |
| `pnpm lint`          | Run ESLint across all packages          |
| `pnpm lint:fix`      | Run ESLint with auto-fix                |
| `pnpm typecheck`     | Run TypeScript type checking            |
| `pnpm test`          | Run tests across all packages           |
| `pnpm test:watch`    | Run tests in watch mode                 |
| `pnpm test:coverage` | Run tests with coverage report          |
| `pnpm format`        | Format code with Prettier               |
| `pnpm format:check`  | Check code formatting                   |
| `pnpm clean`         | Remove build artifacts and node_modules |

### Testing

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage

# Run tests for a specific package
pnpm --filter @genesis/database test
```

### Linting

```bash
# Check for lint errors
pnpm lint

# Auto-fix lint errors
pnpm lint:fix

# Lint specific package
pnpm --filter apps/web lint
```

### Building

```bash
# Build all packages (respects dependency order)
pnpm build

# Build specific package
pnpm --filter apps/web build

# Build with verbose output
pnpm build --verbose
```

### Database Operations

```bash
# Push schema changes to database
pnpm --filter @genesis/database db:push

# Generate Prisma client
pnpm --filter @genesis/database db:generate

# Open Prisma Studio (database GUI)
pnpm --filter @genesis/database db:studio

# Run database migrations
pnpm --filter @genesis/database db:migrate
```

### Docker Commands

```bash
# Start all services
docker compose up -d

# Stop all services
docker compose down

# View logs
docker compose logs -f [service_name]

# Reset data (remove volumes)
docker compose down -v

# Rebuild containers
docker compose up -d --build
```

---

## Packages

### @genesis/ui

**Shared UI component library built with Shadcn/ui and Radix primitives.**

```bash
# Install in another package
pnpm add @genesis/ui@workspace:*
```

Usage:

```tsx
import { Button, Avatar } from '@genesis/ui';

export function MyComponent() {
  return (
    <div>
      <Avatar src='/user.jpg' alt='User' />
      <Button variant='primary'>Click me</Button>
    </div>
  );
}
```

### @genesis/database

**Prisma client and database schema for Genesis-App.**

```bash
# Install in another package
pnpm add @genesis/database@workspace:*
```

Usage:

```typescript
import { prisma } from '@genesis/database';

const users = await prisma.user.findMany({
  where: { role: 'ADMIN' },
});
```

### @genesis/api-types (Planned)

**Generated GraphQL types from the schema.**

Will provide:

- TypeScript types for all GraphQL operations
- Query and mutation type definitions
- Subscription types for real-time updates

### @genesis/daemon-sdk (Planned)

**SDK for VP-Daemon connectivity to Genesis-App.**

Will provide:

- Service account authentication
- WebSocket connection management
- Message sending/receiving APIs
- File upload/download utilities
- Presence management

### @genesis/org-integration (Planned)

**Org-Genesis integration utilities.**

Will provide:

- Workspace provisioning from org-genesis manifests
- Orchestrator user creation and management
- Discipline-to-channel mapping
- Charter synchronization

---

## Deployment

### Web Application (Vercel)

The web application is designed for deployment on Vercel:

1. **Connect repository** to Vercel
2. **Configure build settings**:
   - Root Directory: `packages/@wundr/genesis-app`
   - Framework Preset: Next.js
   - Build Command: `cd apps/web && pnpm build`
   - Output Directory: `apps/web/.next`
3. **Set environment variables** in Vercel dashboard
4. **Deploy**

```bash
# Manual deployment
vercel --cwd apps/web
```

### API Server (Railway)

The API components can be deployed to Railway:

1. **Create Railway project**
2. **Add PostgreSQL and Redis services**
3. **Configure environment variables**
4. **Deploy from GitHub**

Railway configuration (`railway.toml`):

```toml
[build]
builder = "nixpacks"
buildCommand = "pnpm build"

[deploy]
startCommand = "pnpm start"
healthcheckPath = "/api/health"
healthcheckTimeout = 300
```

### Desktop Application (GitHub Releases)

The Electron desktop app is distributed via GitHub Releases:

1. **Build the application**:

   ```bash
   pnpm --filter desktop build
   ```

2. **Package for distribution**:

   ```bash
   pnpm --filter desktop package
   ```

3. **Create GitHub Release** with the built artifacts

Supported platforms:

- macOS (Intel and Apple Silicon)
- Windows (x64)
- Linux (AppImage, deb)

### Mobile Application (App Stores)

Mobile builds are created using Capacitor:

1. **Build the web application**:

   ```bash
   pnpm --filter apps/web build
   ```

2. **Sync to native projects**:

   ```bash
   pnpm --filter mobile sync
   ```

3. **Build native applications**:
   - iOS: Open `apps/mobile/ios` in Xcode
   - Android: Open `apps/mobile/android` in Android Studio

4. **Submit to app stores**

---

## Contributing

We welcome contributions to Genesis-App. Please follow these guidelines:

### Development Workflow

1. **Fork the repository** and create your branch from `master`
2. **Install dependencies**: `pnpm install`
3. **Create a feature branch**: `git checkout -b feature/my-feature`
4. **Make your changes** following the code style guidelines
5. **Write/update tests** for your changes
6. **Ensure all checks pass**:
   ```bash
   pnpm lint
   pnpm typecheck
   pnpm test
   pnpm build
   ```
7. **Commit your changes** using conventional commits:
   ```bash
   git commit -m "feat(component): add new feature"
   ```
8. **Push and create a Pull Request**

### Code Style

- **TypeScript**: Strict mode enabled, no implicit any
- **JSDoc**: All exported functions, classes, and types must have JSDoc comments
- **ESLint**: Must pass with zero errors
- **Prettier**: Code must be formatted

### Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

Types:

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### Pull Request Guidelines

- PRs should target the `master` branch
- Include a clear description of changes
- Reference any related issues
- Ensure CI checks pass
- Request review from maintainers

---

## License

This project is proprietary software owned by Adaptic.ai. All rights reserved.

**UNLICENSED** - This software is not licensed for public use, modification, or distribution without
explicit written permission from Adaptic.ai.

---

## Support

For questions or issues:

- **Internal**: Contact the Adaptic.ai Engineering Team
- **Repository**: [github.com/adaptic-ai/wundr](https://github.com/adaptic-ai/wundr)

---

## Related Documentation

- [Genesis-App Integration Specification](../../docs/new/Genesis-App%20Integration%20Specification.md)
- [Genesis-App Implementation Prompt](../../docs/new/Genesis-App%20Implementation%20Prompt.md)
- [Org-Genesis Package](../org-genesis/README.md)
