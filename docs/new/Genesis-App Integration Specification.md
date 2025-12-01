# Genesis-App: Comprehensive Integration Specification & Implementation Roadmap

## Document Metadata

| Field            | Value                                  |
| ---------------- | -------------------------------------- |
| **Version**      | 1.0.0                                  |
| **Created**      | 2025-11-24                             |
| **Status**       | Draft                                  |
| **Authors**      | Wundr Architecture Team                |
| **Related Docs** | Slack Clone Feature Backlog & Setup.md |

---

## 1. Executive Summary

### 1.1 Overview

The **Genesis-App** is an enterprise communication platform that extends the original Slack-clone
specification with deep integration into the Wundr ecosystem. It serves as a **dual-purpose
platform**:

1. **Human-Facing Communication Hub**: A full-featured Slack-like experience (PWA, mobile, desktop)
   for enterprise teams
2. **VP-Daemon Integration Layer**: Programmatic API enabling Virtual Principal (VP) agents to
   participate as first-class citizens

### 1.2 Key Integration Points

| Integration     | Source Package          | Purpose                                                              |
| --------------- | ----------------------- | -------------------------------------------------------------------- |
| **Org-Genesis** | `@wundr/org-genesis`    | Automated organizational structure generation during workspace setup |
| **VP-Daemon**   | `@wundr/computer-setup` | Machine-level supervisor daemon connectivity                         |
| **Slack-Agent** | `@wundr/slack-agent`    | Reference implementation for VP communication patterns               |

### 1.3 Strategic Goals

1. **Seamless Org Provisioning**: Transform the conversational org-genesis experience into workspace
   creation
2. **Agent-First Architecture**: VP agents operate as indistinguishable users within the platform
3. **Dual-Channel Support**: VP-Daemons can connect to both real Slack AND genesis-app
   simultaneously
4. **Package Reusability**: Extract common interfaces for cross-platform communication clients

---

## 2. System Architecture

### 2.1 High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              GENESIS-APP                                     │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                     CLIENT APPLICATIONS                                 │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                 │ │
│  │  │   Web PWA    │  │  iOS/Android │  │   Desktop    │                 │ │
│  │  │  (Next.js)   │  │ (Capacitor)  │  │  (Electron)  │                 │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘                 │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                    │                                         │
│                                    ▼                                         │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                         API GATEWAY                                     │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │ │
│  │  │                    GraphQL API (Apollo Server 4)                 │  │ │
│  │  │  • HTTP Transport (Queries/Mutations)                           │  │ │
│  │  │  • WebSocket Transport (Subscriptions via graphql-ws)           │  │ │
│  │  │  • Authentication: NextAuth (humans) + ServiceAccount (daemons) │  │ │
│  │  └─────────────────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                    │                                         │
│         ┌──────────────────────────┼──────────────────────────┐             │
│         ▼                          ▼                          ▼             │
│  ┌──────────────┐         ┌──────────────┐         ┌──────────────┐        │
│  │  PostgreSQL  │         │    Redis     │         │   LiveKit    │        │
│  │   (Prisma)   │         │   (PubSub)   │         │   (WebRTC)   │        │
│  │              │         │              │         │              │        │
│  │ • Users      │         │ • Presence   │         │ • Huddles    │        │
│  │ • Workspaces │         │ • Events     │         │ • Screen     │        │
│  │ • Messages   │         │ • Cache      │         │   Share      │        │
│  │ • VP Mapping │         │              │         │              │        │
│  └──────────────┘         └──────────────┘         └──────────────┘        │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                      DAEMON API GATEWAY                                 │ │
│  │  • ServiceAccount Authentication (API Key + mTLS)                      │ │
│  │  • Scoped JWT Token Issuance                                           │ │
│  │  • Rate Limiting & Quota Management                                    │ │
│  │  • Event Fan-out to Connected Daemons                                  │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTPS/WSS
                                    │ (Daemon Auth)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    VP-DAEMON (One Per Dedicated Machine)                     │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                    COMMUNICATION LAYER                                  │ │
│  │  ┌─────────────────────────┐  ┌─────────────────────────┐             │ │
│  │  │ @wundr/genesis-client   │  │ @wundr/slack-agent      │             │ │
│  │  │ (NEW - Genesis-App)     │  │ (Existing - Real Slack) │             │ │
│  │  │                         │  │                         │             │ │
│  │  │ Implements:             │  │ Implements:             │             │ │
│  │  │ CommunicationClient     │  │ CommunicationClient     │             │ │
│  │  └─────────────────────────┘  └─────────────────────────┘             │ │
│  │                    │                        │                          │ │
│  │                    └────────────┬───────────┘                          │ │
│  │                                 ▼                                      │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │ │
│  │  │              VP Daemon Core (Session Manager)                    │  │ │
│  │  │  • Session Spawning (Claude Code / Claude Flow)                 │  │ │
│  │  │  • Memory Architecture (Scratchpad → Episodic → Semantic)       │  │ │
│  │  │  • Integration Orchestration                                    │  │ │
│  │  └─────────────────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                    │                                         │
│                                    ▼                                         │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                    CLAUDE CODE / CLAUDE FLOW SESSIONS                   │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Monorepo Structure

```
genesis-app/
├── apps/
│   ├── web/                          # Next.js 14+ (App Router)
│   │   ├── app/
│   │   │   ├── (auth)/               # Authentication routes
│   │   │   ├── (workspace)/          # Workspace routes
│   │   │   ├── api/
│   │   │   │   ├── graphql/          # Apollo Server endpoint
│   │   │   │   ├── auth/             # NextAuth endpoints
│   │   │   │   └── daemon/           # Daemon-specific REST endpoints
│   │   │   └── org-genesis/          # Org-Genesis wizard routes
│   │   └── components/
│   │       ├── chat/
│   │       ├── channels/
│   │       ├── org-genesis/          # Org-Genesis UI components
│   │       └── ...
│   ├── desktop/                      # Electron wrapper
│   │   ├── electron/
│   │   │   ├── main.ts
│   │   │   └── preload.ts
│   │   └── electron-builder.yml
│   └── mobile/                       # Capacitor config (shared with web)
│
├── packages/
│   ├── @genesis/ui/                  # Shared UI components (Shadcn/Radix)
│   ├── @genesis/database/            # Prisma schema & client
│   ├── @genesis/api-types/           # Generated GraphQL types
│   ├── @genesis/daemon-sdk/          # SDK for VP-Daemon connectivity
│   └── @genesis/org-integration/     # Org-Genesis integration utilities
│
├── turbo.json
├── pnpm-workspace.yaml
└── docker-compose.yml
```

### 2.3 Technology Stack

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

## 3. Database Schema Extensions

### 3.1 Core Schema (From Original Backlog)

The original backlog defines these core models. We extend them for org-genesis and VP-daemon
integration.

### 3.2 Extended Prisma Schema

```prisma
// =============================================================================
// ENUMS
// =============================================================================

enum UserType {
  HUMAN           // Regular human user
  VP_AGENT        // Virtual Principal agent (controlled by VP-Daemon)
  SERVICE_ACCOUNT // API-only access for integrations
}

enum VPNodeStatus {
  ACTIVE
  INACTIVE
  PROVISIONING
  ERROR
  MAINTENANCE
}

enum OrgLifecycleState {
  DRAFT
  ACTIVE
  SUSPENDED
  ARCHIVED
}

enum WorkspaceRole {
  OWNER
  ADMIN
  MEMBER
  MULTI_CHANNEL_GUEST
  SINGLE_CHANNEL_GUEST
}

enum ChannelRole {
  ADMIN
  MODERATOR
  MEMBER
}

// =============================================================================
// USER & AUTHENTICATION
// =============================================================================

model User {
  id              String    @id @default(cuid())
  email           String    @unique
  name            String?
  displayName     String?
  avatarUrl       String?
  type            UserType  @default(HUMAN)

  // VP-specific fields (null for human users)
  vpCharterId     String?   @unique
  vpMetadata      Json?     // Stores VPCharter details

  // Auth.js relations
  accounts        Account[]
  sessions        Session[]

  // Application relations
  workspaces      WorkspaceMember[]
  channels        ChannelMember[]
  messages        Message[]
  vpMapping       VPMapping?
  serviceAccounts ServiceAccount[]

  // Timestamps
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([type])
  @@index([vpCharterId])
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

// =============================================================================
// SERVICE ACCOUNTS (VP-Daemon Authentication)
// =============================================================================

model ServiceAccount {
  id            String    @id @default(cuid())
  name          String
  description   String?

  // Authentication
  apiKeyHash    String    @unique  // bcrypt hash of API key
  publicKey     String?   @db.Text // For mTLS (optional)

  // Scopes & Permissions
  scopes        String[]  // e.g., ["messages:write", "presence:update"]

  // Rate limiting
  rateLimit     Int       @default(1000) // requests per minute
  quotaLimit    Int?      // monthly quota (null = unlimited)
  quotaUsed     Int       @default(0)

  // Association
  userId        String    // The VP user this service account controls
  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  workspaceId   String
  workspace     Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  // Metadata
  lastUsedAt    DateTime?
  lastUsedIp    String?
  expiresAt     DateTime?
  isActive      Boolean   @default(true)

  // Timestamps
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@index([apiKeyHash])
  @@index([userId])
  @@index([workspaceId])
}

// =============================================================================
// WORKSPACE & ORG-GENESIS INTEGRATION
// =============================================================================

model Workspace {
  id                    String              @id @default(cuid())
  name                  String
  slug                  String              @unique
  description           String?
  iconUrl               String?

  // Org-Genesis Integration
  orgGenesisEnabled     Boolean             @default(false)
  orgManifestId         String?             @unique
  orgManifest           Json?               // Stores OrganizationManifest
  orgIndustry           String?             // technology, finance, healthcare, etc.
  orgSize               String?             // small, medium, large, enterprise
  orgLifecycleState     OrgLifecycleState   @default(DRAFT)

  // Settings
  settings              WorkspaceSettings?

  // Relations
  members               WorkspaceMember[]
  channels              Channel[]
  vpMappings            VPMapping[]
  disciplineMappings    DisciplineMapping[]
  serviceAccounts       ServiceAccount[]

  // Timestamps
  createdAt             DateTime            @default(now())
  updatedAt             DateTime            @updatedAt

  @@index([slug])
  @@index([orgManifestId])
}

model WorkspaceSettings {
  id                    String    @id @default(cuid())
  workspaceId           String    @unique
  workspace             Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  // File retention
  fileRetentionDays     Int?      // null = no expiry

  // Security
  mfaRequired           Boolean   @default(false)
  allowedDomains        String[]  // Email domain restrictions

  // VP-Daemon settings
  allowDaemonAccess     Boolean   @default(true)
  daemonRateLimit       Int       @default(1000)

  // Governance (from Org-Genesis)
  requireHumanApproval  Boolean   @default(true)
  approvalThresholdUsd  Float     @default(10000)
  auditLoggingEnabled   Boolean   @default(true)

  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
}

model WorkspaceMember {
  id          String        @id @default(cuid())
  workspaceId String
  userId      String
  role        WorkspaceRole @default(MEMBER)

  workspace   Workspace     @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  user        User          @relation(fields: [userId], references: [id], onDelete: Cascade)

  joinedAt    DateTime      @default(now())

  @@unique([workspaceId, userId])
  @@index([userId])
}

// =============================================================================
// VP-NODE MAPPINGS
// =============================================================================

model VPMapping {
  id                String        @id @default(cuid())

  // VP Charter Reference
  vpCharterId       String        @unique // From VPCharter.id
  vpCharterSlug     String        // From VPCharter.identity.slug
  vpCharterData     Json          // Full VPCharter object for reference

  // Node Information
  nodeId            String        // Machine identifier
  hostname          String        // FQDN or IP
  port              Int           @default(8080)
  status            VPNodeStatus  @default(PROVISIONING)

  // Resource Allocation
  cpuCores          Int           @default(2)
  memoryMb          Int           @default(4096)
  maxConcurrentTasks Int          @default(10)
  tokenBudgetPerHour Int          @default(100000)

  // Health Metrics
  lastHealthCheck   DateTime?
  uptime            Float?        // Percentage
  avgResponseTimeMs Float?
  errorCountLast24h Int           @default(0)

  // Relations
  workspaceId       String
  workspace         Workspace     @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  userId            String        @unique // The User account for this VP
  user              User          @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Discipline assignments
  disciplineIds     String[]      // Array of DisciplinePack IDs

  // Timestamps
  provisionedAt     DateTime      @default(now())
  lastStatusChange  DateTime      @default(now())
  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt

  @@index([workspaceId])
  @@index([status])
  @@index([nodeId])
}

// =============================================================================
// DISCIPLINE MAPPINGS (Org-Genesis → Channels)
// =============================================================================

model DisciplineMapping {
  id                String    @id @default(cuid())

  // Discipline Reference
  disciplineId      String    // From DisciplinePack.id
  disciplineSlug    String    // From DisciplinePack.slug
  disciplineName    String    // From DisciplinePack.name
  disciplineData    Json      // Full DisciplinePack object

  // Channel Mapping
  channelId         String?   @unique // The auto-generated channel for this discipline
  channel           Channel?  @relation(fields: [channelId], references: [id])

  // Workspace
  workspaceId       String
  workspace         Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  // Agent IDs assigned to this discipline
  agentIds          String[]

  // Timestamps
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  @@unique([workspaceId, disciplineId])
  @@index([workspaceId])
}

// =============================================================================
// CHANNELS
// =============================================================================

model Channel {
  id                  String             @id @default(cuid())
  name                String
  slug                String
  description         String?
  topic               String?

  // Channel Type
  isPrivate           Boolean            @default(false)
  isDM                Boolean            @default(false)
  isArchived          Boolean            @default(false)

  // Auto-generated from discipline?
  isAutogenerated     Boolean            @default(false)
  disciplineMapping   DisciplineMapping?

  // Relations
  workspaceId         String
  workspace           Workspace          @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  members             ChannelMember[]
  messages            Message[]

  // Creator
  createdById         String?

  // Timestamps
  createdAt           DateTime           @default(now())
  updatedAt           DateTime           @updatedAt

  @@unique([workspaceId, slug])
  @@index([workspaceId])
  @@index([isArchived])
}

model ChannelMember {
  id          String      @id @default(cuid())
  channelId   String
  userId      String
  role        ChannelRole @default(MEMBER)

  channel     Channel     @relation(fields: [channelId], references: [id], onDelete: Cascade)
  user        User        @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Notification preferences
  notifications String    @default("ALL") // ALL, MENTIONS, NONE

  joinedAt    DateTime    @default(now())

  @@unique([channelId, userId])
  @@index([userId])
}

// =============================================================================
// MESSAGES
// =============================================================================

model Message {
  id            String    @id @default(cuid())
  content       String    @db.Text
  contentType   String    @default("TEXT") // TEXT, SYSTEM, FILE

  // Threading
  parentId      String?   // Self-relation for threads
  parent        Message?  @relation("ThreadReplies", fields: [parentId], references: [id])
  replies       Message[] @relation("ThreadReplies")
  replyCount    Int       @default(0)
  latestReplyAt DateTime?

  // Edit/Delete tracking
  isEdited      Boolean   @default(false)
  editedAt      DateTime?
  deletedAt     DateTime? // Soft delete

  // Relations
  channelId     String
  channel       Channel   @relation(fields: [channelId], references: [id], onDelete: Cascade)
  authorId      String
  author        User      @relation(fields: [authorId], references: [id], onDelete: Cascade)

  // Metadata for daemon-sent messages
  sentByDaemon  Boolean   @default(false)
  daemonMeta    Json?     // { serviceAccountId, sessionId, etc. }

  // Timestamps
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@index([channelId, createdAt])
  @@index([parentId])
  @@index([authorId])
}

// =============================================================================
// PRESENCE (Redis-backed, DB for persistence)
// =============================================================================

model UserPresence {
  id            String    @id @default(cuid())
  userId        String    @unique

  // Status
  presence      String    @default("offline") // online, away, dnd, offline
  statusText    String?
  statusEmoji   String?
  statusExpires DateTime?

  // For VP-Daemons
  isDaemonControlled Boolean @default(false)
  lastHeartbeat DateTime?

  updatedAt     DateTime  @updatedAt

  @@index([presence])
}

// =============================================================================
// AUDIT LOG (For governance)
// =============================================================================

model AuditLog {
  id            String    @id @default(cuid())

  // Event details
  eventType     String    // e.g., "message.send", "channel.create", "vp.spawn"
  actorId       String    // User or ServiceAccount ID
  actorType     String    // "user", "vp_agent", "service_account", "system"
  resourceType  String    // "message", "channel", "workspace", "vp"
  resourceId    String

  // Payload
  details       Json

  // Context
  workspaceId   String?
  ipAddress     String?
  userAgent     String?

  // Timestamps
  createdAt     DateTime  @default(now())

  @@index([workspaceId, createdAt])
  @@index([actorId])
  @@index([eventType])
}
```

---

## 4. Phased Implementation Roadmap

### 4.1 Phase Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        IMPLEMENTATION PHASES                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  FOUNDATION                    CORE FEATURES                    ADVANCED    │
│  ──────────                    ─────────────                    ────────    │
│                                                                              │
│  ┌─────────┐  ┌─────────┐    ┌─────────┐  ┌─────────┐        ┌─────────┐  │
│  │ Phase 0 │──│Phase 0.5│────│ Phase 1 │──│Phase 1.5│────────│ Phase 2 │  │
│  │ Infra   │  │ Schema  │    │  Auth   │  │VP Prov. │        │Messaging│  │
│  └─────────┘  └─────────┘    └─────────┘  └─────────┘        └─────────┘  │
│                                                                     │       │
│                                                                     ▼       │
│  ┌─────────┐  ┌─────────┐    ┌─────────┐  ┌─────────┐        ┌─────────┐  │
│  │ Phase 9 │◀─│ Phase 8 │◀───│ Phase 7 │◀─│ Phase 6 │◀───────│ Phase 3 │  │
│  │ Wundr   │  │ Daemon  │    │Enterpris│  │ Native  │        │  Org    │  │
│  └─────────┘  └─────────┘    └─────────┘  └─────────┘        └─────────┘  │
│                                                                     │       │
│                                                                     ▼       │
│                              ┌─────────┐  ┌─────────┐        ┌─────────┐  │
│                              │ Phase 5 │◀─│ Phase 4 │◀───────│Phase 3.5│  │
│                              │  A/V    │  │  Media  │        │ Presence│  │
│                              └─────────┘  └─────────┘        └─────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 4.2 Phase 0: Infrastructure & DevOps

**Objective**: Establish the foundational infrastructure for the genesis-app monorepo.

#### Task 0.1: Monorepo Initialization

| Item                | Specification                             |
| ------------------- | ----------------------------------------- |
| **Package Manager** | pnpm with workspace configuration         |
| **Build System**    | Turborepo with remote caching             |
| **TypeScript**      | Strict mode, path aliases, shared config  |
| **Linting**         | ESLint with Next.js, Prettier integration |
| **Styling**         | Tailwind CSS with shared config package   |

**Deliverables**:

- `pnpm-workspace.yaml` configuration
- `turbo.json` with pipeline definitions
- `@genesis/typescript-config` package
- `@genesis/eslint-config` package
- `@genesis/tailwind-config` package

#### Task 0.2: Database & ORM

| Item             | Specification                      |
| ---------------- | ---------------------------------- |
| **Database**     | PostgreSQL 15+                     |
| **Cache/PubSub** | Redis 7+                           |
| **ORM**          | Prisma 5+ with singleton pattern   |
| **Migrations**   | Prisma Migrate with CI integration |

**Deliverables**:

- `docker-compose.yml` with Postgres + Redis
- `@genesis/database` package with Prisma schema
- Singleton client implementation for serverless
- Seed scripts for development

#### Task 0.3: GraphQL Server

| Item                | Specification                            |
| ------------------- | ---------------------------------------- |
| **Server**          | Apollo Server 4                          |
| **HTTP Transport**  | Next.js API route (`/api/graphql`)       |
| **WS Transport**    | Separate Node.js service or `graphql-ws` |
| **PubSub**          | `graphql-redis-subscriptions`            |
| **Code Generation** | GraphQL Code Generator                   |

**Deliverables**:

- Apollo Server configuration
- Redis PubSub integration
- Type generation pipeline
- `@genesis/api-types` package

#### Task 0.4: Native Wrappers

| Item        | Specification                      |
| ----------- | ---------------------------------- |
| **Desktop** | Electron with `electron-builder`   |
| **Mobile**  | Capacitor with iOS/Android targets |
| **IPC**     | Context-isolated preload scripts   |

**Deliverables**:

- `apps/desktop` with Electron configuration
- Capacitor configuration in `apps/web`
- Build scripts for all platforms

#### Task 0.5: CI/CD Pipeline

| Item            | Specification                                          |
| --------------- | ------------------------------------------------------ |
| **CI Platform** | GitHub Actions                                         |
| **Testing**     | Vitest for unit, Playwright for E2E                    |
| **Deployment**  | Vercel (web), Railway (API), GitHub Releases (desktop) |

**Deliverables**:

- GitHub Actions workflows
- Automated testing on PR
- Release automation for desktop builds

**Acceptance Criteria**:

- [ ] `pnpm install` succeeds at root
- [ ] `pnpm build` produces cached artifacts
- [ ] `docker-compose up -d` starts all services
- [ ] Apollo Sandbox connects to GraphQL endpoint
- [ ] `pnpm electron:dev` launches desktop app

---

### 4.3 Phase 0.5: Org-Genesis Schema Extensions

**Objective**: Extend the database schema to support org-genesis integration.

#### Task 0.5.1: Schema Migration

Create the extended Prisma schema (as defined in Section 3.2) with:

- VP-related enums and models
- Org-genesis integration fields on Workspace
- ServiceAccount model for daemon auth
- VPMapping and DisciplineMapping models
- AuditLog for governance

#### Task 0.5.2: Migration Scripts

```typescript
// packages/@genesis/database/src/migrations/org-genesis.ts

import { PrismaClient } from '@prisma/client';
import type { OrganizationManifest, VPCharter, DisciplinePack } from '@wundr/org-genesis';

export async function migrateOrgGenesisResult(
  prisma: PrismaClient,
  workspaceId: string,
  manifest: OrganizationManifest,
  orchestrators: VPCharter[],
  disciplines: DisciplinePack[]
): Promise<void> {
  await prisma.$transaction(async tx => {
    // 1. Update workspace with org manifest
    await tx.workspace.update({
      where: { id: workspaceId },
      data: {
        orgGenesisEnabled: true,
        orgManifestId: manifest.id,
        orgManifest: manifest as any,
        orgIndustry: manifest.industry,
        orgSize: manifest.size,
        orgLifecycleState: 'ACTIVE',
      },
    });

    // 2. Create VP users and mappings
    for (const vp of orchestrators) {
      const vpUser = await tx.user.create({
        data: {
          email: `${vp.identity.slug}@genesis.local`,
          name: vp.identity.name,
          displayName: vp.identity.name,
          type: 'VP_AGENT',
          vpCharterId: vp.id,
          vpMetadata: vp as any,
        },
      });

      await tx.vpMapping.create({
        data: {
          vpCharterId: vp.id,
          vpCharterSlug: vp.identity.slug,
          vpCharterData: vp as any,
          nodeId: vp.nodeId || `node-${vp.identity.slug}`,
          hostname: `${vp.identity.slug}.cluster.internal`,
          status: 'PROVISIONING',
          workspaceId,
          userId: vpUser.id,
          disciplineIds: vp.disciplineIds,
        },
      });

      // Add VP to workspace
      await tx.workspaceMember.create({
        data: {
          workspaceId,
          userId: vpUser.id,
          role: 'MEMBER',
        },
      });
    }

    // 3. Create discipline mappings and channels
    for (const discipline of disciplines) {
      const channel = await tx.channel.create({
        data: {
          name: discipline.name,
          slug: discipline.slug,
          description: discipline.description,
          topic: `${discipline.category} discipline channel`,
          workspaceId,
          isAutogenerated: true,
        },
      });

      await tx.disciplineMapping.create({
        data: {
          disciplineId: discipline.id,
          disciplineSlug: discipline.slug,
          disciplineName: discipline.name,
          disciplineData: discipline as any,
          channelId: channel.id,
          workspaceId,
          agentIds: discipline.agentIds,
        },
      });
    }
  });
}
```

**Acceptance Criteria**:

- [ ] `pnpm db:migrate` applies all schema changes
- [ ] Migration script creates VP users from org-genesis output
- [ ] Discipline channels are auto-generated
- [ ] ServiceAccount model supports API key authentication

---

### 4.4 Phase 1: Authentication & Identity Management

**Objective**: Implement unified authentication for humans and VP-daemons.

#### Feature 1.1: Human Authentication (NextAuth)

As specified in original backlog:

- Google OAuth provider
- Email magic link provider
- Session persistence
- Multi-workspace support

#### Feature 1.2: Native Mobile Authentication

As specified in original backlog:

- Deep link registration (iOS/Android)
- Manual token exchange flow
- Capacitor Secure Storage integration

#### Feature 1.3: Org-Genesis Workspace Wizard

**User Story**: As a workspace creator, I want to use org-genesis to define my organizational
structure during workspace setup.

**UI Flow**:

```
┌─────────────────────────────────────────────────────────────────┐
│                    CREATE WORKSPACE                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ○ Standard Workspace                                           │
│     Create a basic workspace with manual setup                  │
│                                                                  │
│  ● Org-Genesis Workspace                                        │
│     Use AI to generate your organizational structure            │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │              ORG-GENESIS WIZARD                            │ │
│  │                                                            │ │
│  │  Step 1 of 4: Organization Details                        │ │
│  │  ──────────────────────────────────                       │ │
│  │                                                            │ │
│  │  Organization Name:                                        │ │
│  │  ┌─────────────────────────────────────────────────────┐  │ │
│  │  │ Acme AI Labs                                        │  │ │
│  │  └─────────────────────────────────────────────────────┘  │ │
│  │                                                            │ │
│  │  Mission Statement:                                        │ │
│  │  ┌─────────────────────────────────────────────────────┐  │ │
│  │  │ Democratizing AI for small businesses               │  │ │
│  │  └─────────────────────────────────────────────────────┘  │ │
│  │                                                            │ │
│  │  Industry:                                                 │ │
│  │  ┌─────────────────────────────────────────────────────┐  │ │
│  │  │ Technology                                     ▼    │  │ │
│  │  └─────────────────────────────────────────────────────┘  │ │
│  │                                                            │ │
│  │  Organization Size:                                        │ │
│  │  ○ Small (1-5 VPs)    ● Medium (5-15 VPs)                │ │
│  │  ○ Large (15-50 VPs)  ○ Enterprise (50+ VPs)             │ │
│  │                                                            │ │
│  │                              [Back]  [Next: Disciplines]   │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**GraphQL Schema**:

```graphql
input CreateWorkspaceWithGenesisInput {
  # Standard workspace fields
  name: String!
  slug: String

  # Org-genesis configuration
  orgConfig: OrgGenesisConfigInput!
}

input OrgGenesisConfigInput {
  mission: String!
  industry: OrgIndustry!
  size: OrgSize!
  description: String
  initialDisciplines: [String!]
  vpCount: Int
  generateDisciplines: Boolean
  generateAgents: Boolean
}

enum OrgIndustry {
  TECHNOLOGY
  FINANCE
  HEALTHCARE
  LEGAL
  MARKETING
  MANUFACTURING
  RETAIL
  GAMING
  MEDIA
  CUSTOM
}

enum OrgSize {
  SMALL
  MEDIUM
  LARGE
  ENTERPRISE
}

type GenesisResult {
  workspace: Workspace!
  vpCount: Int!
  disciplineCount: Int!
  agentCount: Int!
  generatedChannels: [Channel!]!
  vpUsers: [User!]!
}

type Mutation {
  createWorkspaceWithGenesis(input: CreateWorkspaceWithGenesisInput!): GenesisResult!
}
```

**Resolver Implementation**:

```typescript
// apps/web/app/api/graphql/resolvers/workspace.ts

import { createGenesisEngine } from '@wundr/org-genesis';
import { migrateOrgGenesisResult } from '@genesis/database';

export const workspaceMutations = {
  createWorkspaceWithGenesis: async (
    _: unknown,
    { input }: { input: CreateWorkspaceWithGenesisInput },
    context: GraphQLContext
  ) => {
    // 1. Verify user is authenticated
    if (!context.user) {
      throw new AuthenticationError('Must be logged in');
    }

    // 2. Create the workspace first
    const workspace = await context.prisma.workspace.create({
      data: {
        name: input.name,
        slug: input.slug || slugify(input.name),
        orgGenesisEnabled: true,
      },
    });

    // 3. Add creator as owner
    await context.prisma.workspaceMember.create({
      data: {
        workspaceId: workspace.id,
        userId: context.user.id,
        role: 'OWNER',
      },
    });

    // 4. Run org-genesis engine
    const engine = createGenesisEngine({ verbose: true });
    const genesisResult = await engine.generateFromConfig({
      name: input.name,
      mission: input.orgConfig.mission,
      industry: input.orgConfig.industry.toLowerCase() as OrgIndustry,
      size: input.orgConfig.size.toLowerCase() as OrgSize,
      description: input.orgConfig.description,
      initialDisciplines: input.orgConfig.initialDisciplines,
      vpCount: input.orgConfig.vpCount,
      generateDisciplines: input.orgConfig.generateDisciplines ?? true,
      generateAgents: input.orgConfig.generateAgents ?? true,
    });

    // 5. Migrate results to database
    await migrateOrgGenesisResult(
      context.prisma,
      workspace.id,
      genesisResult.manifest,
      genesisResult.vps,
      genesisResult.disciplines
    );

    // 6. Fetch and return results
    const updatedWorkspace = await context.prisma.workspace.findUnique({
      where: { id: workspace.id },
      include: {
        channels: true,
        vpMappings: { include: { user: true } },
      },
    });

    return {
      workspace: updatedWorkspace,
      vpCount: genesisResult.vps.length,
      disciplineCount: genesisResult.disciplines.length,
      agentCount: genesisResult.agents.length,
      generatedChannels: updatedWorkspace?.channels.filter(c => c.isAutogenerated) || [],
      vpUsers: updatedWorkspace?.vpMappings.map(m => m.user) || [],
    };
  },
};
```

**Acceptance Criteria**:

- [ ] Org-Genesis wizard collects all configuration
- [ ] GenesisEngine runs and generates structure
- [ ] VP users created with type='VP_AGENT'
- [ ] Discipline channels auto-created
- [ ] Workspace shows org-genesis metadata

---

### 4.5 Phase 1.5: VP User Provisioning

**Objective**: Complete the VP user provisioning flow with service accounts.

#### Feature 1.5.1: VP User Creation

When org-genesis generates VPs, automatically create:

1. User record with `type='VP_AGENT'`
2. VPMapping linking user to charter
3. WorkspaceMember with appropriate role
4. ServiceAccount for daemon authentication

#### Feature 1.5.2: Service Account Generation

```typescript
// packages/@genesis/database/src/services/service-account.ts

import { randomBytes, createHash } from 'crypto';
import bcrypt from 'bcrypt';

export interface GeneratedServiceAccount {
  id: string;
  apiKey: string; // Only returned once, never stored in plaintext
  publicUrl: string;
}

export async function createServiceAccountForVP(
  prisma: PrismaClient,
  vpUserId: string,
  workspaceId: string,
  vpName: string
): Promise<GeneratedServiceAccount> {
  // Generate a secure API key
  const apiKey = `gsk_${randomBytes(32).toString('base64url')}`;
  const apiKeyHash = await bcrypt.hash(apiKey, 12);

  const serviceAccount = await prisma.serviceAccount.create({
    data: {
      name: `${vpName} Daemon`,
      description: `Service account for ${vpName} VP-Daemon`,
      apiKeyHash,
      scopes: [
        'messages:read',
        'messages:write',
        'channels:read',
        'presence:read',
        'presence:write',
        'files:read',
        'files:write',
      ],
      userId: vpUserId,
      workspaceId,
    },
  });

  return {
    id: serviceAccount.id,
    apiKey, // Return only once for daemon configuration
    publicUrl: `https://genesis-app.example.com/api/daemon`,
  };
}
```

#### Feature 1.5.3: Service Account Credentials UI

After workspace creation, show credentials for each VP:

```
┌─────────────────────────────────────────────────────────────────┐
│              VP DAEMON CREDENTIALS                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ⚠️  Save these credentials now - they won't be shown again!    │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  VP: Chief Technology Officer                              │ │
│  │  ─────────────────────────────────                        │ │
│  │                                                            │ │
│  │  Service Account ID:                                       │ │
│  │  clxyz123456789                                 [Copy]    │ │
│  │                                                            │ │
│  │  API Key:                                                  │ │
│  │  gsk_a1b2c3d4e5f6...                           [Copy]    │ │
│  │                                                            │ │
│  │  API Endpoint:                                             │ │
│  │  https://genesis-app.example.com/api/daemon    [Copy]    │ │
│  │                                                            │ │
│  │  [Download .env file]                                      │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  VP: VP of Engineering                                     │ │
│  │  ...                                                       │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                  │
│                                              [Continue to App]  │
└─────────────────────────────────────────────────────────────────┘
```

**Acceptance Criteria**:

- [ ] VP users have ServiceAccounts created
- [ ] API keys shown once and downloadable as .env
- [ ] Service accounts have appropriate scopes
- [ ] Rate limits configured per workspace settings

---

### 4.6 Phase 2: Messaging Core

**Objective**: Implement the real-time messaging engine.

As specified in original backlog, with these VP-daemon extensions:

#### Feature 2.1: Granular Message Composition (Original)

- Rich text editor (Tiptap/Slate)
- Markdown support
- @ mentions
- Edit/delete with soft delete

#### Feature 2.2: Threaded Conversations (Original)

- Parent/reply model
- Reply count caching
- Separate subscriptions for threads

#### Feature 2.3: Optimistic UI & Offline Queue (Original)

- Apollo optimistic responses
- Offline queue with IndexedDB
- Retry on reconnection

#### Feature 2.4: Daemon Message Attribution (NEW)

Messages sent by VP-daemons should be properly attributed:

```graphql
type Message {
  id: ID!
  content: String!
  author: User!

  # Daemon metadata
  sentByDaemon: Boolean!
  daemonMeta: DaemonMessageMeta
}

type DaemonMessageMeta {
  serviceAccountId: ID!
  sessionId: String
  claudeModel: String
  tokensUsed: Int
}
```

**Acceptance Criteria**:

- [ ] Messages render in real-time
- [ ] Threads work correctly
- [ ] Offline queue persists and flushes
- [ ] Daemon messages show attribution

---

### 4.7 Phase 3: Channel & Workspace Management

**Objective**: Implement organizational structure management.

#### Feature 3.1: Granular RBAC (Original)

As specified in original backlog with org-genesis integration:

- Roles from `OrgGovernanceConfig` map to RBAC
- VP users default to MEMBER role
- ExecutiveVpIds get elevated permissions

#### Feature 3.2: Channel Discovery & Archiving (Original)

- Public channel browsing
- Archive/unarchive with read-only mode
- Private channel security

#### Feature 3.3: Auto-Generated Channel Management (NEW)

Channels created from org-genesis disciplines:

- Show "Auto-generated from org-genesis" badge
- Link to discipline metadata
- Prevent deletion (only archive)
- Auto-add VP users assigned to discipline

```graphql
type Channel {
  id: ID!
  name: String!
  # ...

  # Org-genesis integration
  isAutogenerated: Boolean!
  disciplineMapping: DisciplineMapping
}

type DisciplineMapping {
  disciplineId: ID!
  disciplineName: String!
  disciplineSlug: String!
  category: String!
  agentIds: [ID!]!
}
```

**Acceptance Criteria**:

- [ ] RBAC enforced via GraphQL Shield
- [ ] Auto-generated channels identified
- [ ] Discipline metadata accessible
- [ ] VP users auto-added to discipline channels

---

### 4.8 Phase 3.5: Real-Time Presence & Status

**Objective**: Implement presence system with daemon support.

#### Feature 3.5.1: Heartbeat-Based Presence (Original)

As specified in original backlog:

- Redis keys with TTL
- Keyspace notifications
- Throttled status broadcasts

#### Feature 3.5.2: Daemon Presence Integration (NEW)

VP-daemons report presence via API:

```graphql
type Mutation {
  # Human presence (via heartbeat subscription)
  sendHeartbeat: Boolean!

  # Daemon presence (via API)
  setDaemonPresence(
    presence: PresenceStatus!
    statusText: String
    statusEmoji: String
  ): UserPresence!
}

enum PresenceStatus {
  ONLINE
  AWAY
  DND
  OFFLINE
}
```

**Implementation**:

```typescript
// apps/web/app/api/daemon/presence/route.ts

export async function POST(request: Request) {
  const { serviceAccount, vpUser } = await authenticateDaemon(request);

  const { presence, statusText, statusEmoji } = await request.json();

  // Update Redis presence key
  await redis.setex(
    `presence:${vpUser.id}`,
    45, // 45 second TTL
    JSON.stringify({ presence, statusText, statusEmoji, isDaemonControlled: true })
  );

  // Publish presence change
  await redis.publish(
    'USER_PRESENCE_CHANGE',
    JSON.stringify({
      userId: vpUser.id,
      presence,
      statusText,
      statusEmoji,
    })
  );

  return Response.json({ success: true });
}
```

**Acceptance Criteria**:

- [ ] Human presence via WebSocket heartbeat
- [ ] Daemon presence via REST API
- [ ] Presence changes broadcast to all clients
- [ ] ~45 second offline detection

---

### 4.9 Phase 4: File Management & Media

**Objective**: Implement file upload/download with S3.

As specified in original backlog:

- Direct-to-S3 uploads via pre-signed URLs
- Image optimization with Lambda
- Thumbnail generation
- File retention policies

**VP-Daemon Extension**:

- Daemons can upload files via API
- File attribution shows daemon metadata
- Quota tracking per service account

---

### 4.10 Phase 5: Voice & Video (Huddles)

**Objective**: Implement WebRTC-based huddles with LiveKit.

As specified in original backlog:

- One-click audio huddles
- LiveKit token generation
- Voice activity detection
- Desktop screen sharing via Electron

**VP-Daemon Consideration**:

- VP agents do NOT participate in audio/video (they're text-only)
- VPs can trigger huddle notifications via messages

---

### 4.11 Phase 6: Native Polish

**Objective**: Complete native platform integration.

As specified in original backlog:

- Push notifications (FCM/APNs)
- Deep links
- Electron tray/dock badges
- Offline queue enhancement

---

### 4.12 Phase 7: Enterprise Features

**Objective**: Implement enterprise-grade features.

As specified in original backlog:

- Full-text search with modifiers
- Audit logging
- File retention policies

**Org-Genesis Integration**:

- Audit log captures org-genesis events
- Search includes org metadata
- Governance config from org-genesis enforced

---

### 4.13 Phase 8: VP-Daemon Gateway Module (NEW)

**Objective**: Implement complete daemon API and SDK.

#### Feature 8.1: Machine Service Account Authentication

**Authentication Flow**:

```
┌─────────────┐                         ┌─────────────┐
│  VP-Daemon  │                         │ Genesis-App │
└──────┬──────┘                         └──────┬──────┘
       │                                       │
       │  1. POST /api/daemon/auth             │
       │  Authorization: Bearer gsk_xxx...     │
       │─────────────────────────────────────▶│
       │                                       │
       │                          2. Validate  │
       │                             API key   │
       │                                       │
       │  3. 200 OK                            │
       │  { token: "eyJhbG...", expiresIn: 3600 }
       │◀─────────────────────────────────────│
       │                                       │
       │  4. All subsequent requests:          │
       │  Authorization: Bearer eyJhbG...      │
       │─────────────────────────────────────▶│
       │                                       │
```

**API Endpoints**:

```typescript
// Authentication
POST /api/daemon/auth
  Body: { apiKey: string }
  Response: { token: string, expiresIn: number, vpUser: User }

// Messaging
POST /api/daemon/messages
  Body: { channelId: string, content: string, threadTs?: string }
  Response: { message: Message }

GET /api/daemon/messages/:channelId
  Query: { limit?: number, before?: string, after?: string }
  Response: { messages: Message[], hasMore: boolean }

// Reactions
POST /api/daemon/reactions
  Body: { channelId: string, messageTs: string, emoji: string }
  Response: { success: boolean }

DELETE /api/daemon/reactions
  Body: { channelId: string, messageTs: string, emoji: string }
  Response: { success: boolean }

// Presence
POST /api/daemon/presence
  Body: { presence: string, statusText?: string, statusEmoji?: string }
  Response: { success: boolean }

// Files
POST /api/daemon/files/upload-url
  Body: { filename: string, contentType: string }
  Response: { uploadUrl: string, fileKey: string }

// Events (WebSocket)
WS /api/daemon/events
  Subscription topics:
    - message.created.{channelId}
    - message.updated.{channelId}
    - message.deleted.{channelId}
    - mention.{userId}
    - reaction.added.{channelId}
    - presence.changed
```

#### Feature 8.2: Daemon Event Subscriptions

**WebSocket Protocol**:

```typescript
// Connection
ws://genesis-app.example.com/api/daemon/events
Headers: { Authorization: "Bearer eyJhbG..." }

// Subscribe to topics
{ type: "subscribe", topics: ["message.created.chan_123", "mention.user_456"] }

// Unsubscribe
{ type: "unsubscribe", topics: ["message.created.chan_123"] }

// Event received
{
  type: "event",
  topic: "message.created.chan_123",
  payload: {
    id: "msg_789",
    content: "Hello @vp-cto",
    author: { id: "user_abc", name: "Alice" },
    channelId: "chan_123",
    createdAt: "2024-01-15T10:30:00Z"
  }
}

// Heartbeat (every 30s)
{ type: "ping" }
{ type: "pong" }
```

#### Feature 8.3: Rate Limiting & Quotas

**Configuration**:

```typescript
interface RateLimitConfig {
  // Per-minute limits
  messagesPerMinute: number; // Default: 60
  reactionsPerMinute: number; // Default: 100
  fileUploadsPerMinute: number; // Default: 10

  // Burst limits
  burstMessages: number; // Default: 10
  burstReactions: number; // Default: 20

  // Monthly quotas
  monthlyTokenBudget?: number; // null = unlimited
  monthlyFileSizeMb?: number; // null = unlimited
}
```

**Acceptance Criteria**:

- [ ] API key authentication works
- [ ] JWT tokens issued with correct scopes
- [ ] All messaging APIs functional
- [ ] WebSocket subscriptions work
- [ ] Rate limiting enforced
- [ ] Quota tracking accurate

---

### 4.14 Phase 9: Wundr Package Refactoring (NEW)

**Objective**: Refactor wundr packages for genesis-app integration.

#### Feature 9.1: Extract CommunicationClient Interface

Create a shared interface that both `@wundr/slack-agent` and `@wundr/genesis-client` implement:

```typescript
// packages/@wundr/communication-client/src/interface.ts

/**
 * Abstract interface for VP communication clients.
 * Implemented by both SlackUserAgent and GenesisAppClient.
 */
export interface CommunicationClient {
  // Lifecycle
  start(): Promise<void>;
  stop(): Promise<void>;
  connected(): boolean;
  healthCheck(): Promise<HealthCheckResult>;

  // Messaging
  sendMessage(channel: string, text: string, options?: MessageOptions): Promise<MessageResult>;
  sendDM(userId: string, text: string): Promise<MessageResult>;
  replyToThread(
    channel: string,
    threadTs: string,
    text: string,
    broadcast?: boolean
  ): Promise<MessageResult>;
  editMessage(channel: string, ts: string, newText: string): Promise<void>;
  deleteMessage(channel: string, ts: string): Promise<void>;

  // Reactions
  addReaction(channel: string, ts: string, emoji: string): Promise<void>;
  removeReaction(channel: string, ts: string, emoji: string): Promise<void>;

  // Presence
  setPresence(presence: 'auto' | 'away'): Promise<void>;
  setStatus(text: string, emoji?: string, expiration?: Date): Promise<void>;
  clearStatus(): Promise<void>;

  // Channels
  joinChannel(channelId: string): Promise<void>;
  leaveChannel(channelId: string): Promise<void>;
  getChannelInfo(channelId: string): Promise<ChannelInfo>;
  getMyChannels(): Promise<ChannelInfo[]>;

  // Files
  uploadFile(filePath: string, channels?: string[], options?: FileOptions): Promise<FileResult>;
  downloadFile(fileUrl: string): Promise<Buffer>;

  // Search
  searchMessages(query: string, options?: SearchOptions): Promise<SearchResult>;

  // Events
  onMessage(handler: EventHandler<MessageEvent>): void;
  onMention(handler: EventHandler<MentionEvent>): void;
  onReactionAdded(handler: EventHandler<ReactionEvent>): void;
  onEvent<T>(eventType: string, handler: EventHandler<T>): void;
}

export interface MessageOptions {
  threadTs?: string;
  replyBroadcast?: boolean;
  blocks?: unknown[];
}

export interface MessageResult {
  ok: boolean;
  channelId: string;
  ts: string;
}

export interface HealthCheckResult {
  healthy: boolean;
  connected: boolean;
  errors: string[];
}

// ... additional type definitions
```

#### Feature 9.2: Create @wundr/genesis-client Package

**Package Structure**:

```
packages/@wundr/genesis-client/
├── package.json
├── src/
│   ├── index.ts
│   ├── genesis-client.ts        # Main client class
│   ├── auth/
│   │   ├── api-key-auth.ts      # API key authentication
│   │   └── token-manager.ts     # JWT token refresh
│   ├── api/
│   │   ├── messages.ts          # Messaging API calls
│   │   ├── reactions.ts         # Reactions API calls
│   │   ├── presence.ts          # Presence API calls
│   │   ├── channels.ts          # Channels API calls
│   │   └── files.ts             # Files API calls
│   ├── events/
│   │   ├── websocket-client.ts  # WebSocket connection
│   │   └── event-emitter.ts     # Event distribution
│   ├── offline/
│   │   ├── queue.ts             # Offline mutation queue
│   │   └── storage.ts           # IndexedDB/file storage
│   └── types/
│       └── index.ts
└── README.md
```

**Main Client Implementation**:

```typescript
// packages/@wundr/genesis-client/src/genesis-client.ts

import { EventEmitter } from 'events';
import type {
  CommunicationClient,
  MessageOptions,
  MessageResult,
} from '@wundr/communication-client';

export interface GenesisClientConfig {
  /** Genesis-App API endpoint */
  apiEndpoint: string;
  /** Service account API key */
  apiKey: string;
  /** WebSocket endpoint for events */
  wsEndpoint?: string;
  /** Enable debug logging */
  debug?: boolean;
  /** Enable offline queue */
  offlineSupport?: boolean;
}

export class GenesisClient extends EventEmitter implements CommunicationClient {
  private readonly config: GenesisClientConfig;
  private readonly tokenManager: TokenManager;
  private readonly wsClient: WebSocketClient;
  private readonly offlineQueue: OfflineQueue;

  private isConnected = false;
  private vpUser: User | null = null;

  constructor(config: GenesisClientConfig) {
    super();
    this.config = config;
    this.tokenManager = new TokenManager(config.apiEndpoint, config.apiKey);
    this.wsClient = new WebSocketClient(
      config.wsEndpoint || config.apiEndpoint.replace('http', 'ws')
    );
    this.offlineQueue = new OfflineQueue({ enabled: config.offlineSupport ?? true });
  }

  async start(): Promise<void> {
    // 1. Authenticate and get JWT
    const authResult = await this.tokenManager.authenticate();
    this.vpUser = authResult.vpUser;

    // 2. Connect WebSocket for events
    await this.wsClient.connect(this.tokenManager.getToken());
    this.setupEventHandlers();

    // 3. Flush offline queue if any
    await this.offlineQueue.flush(this.sendMessageInternal.bind(this));

    this.isConnected = true;
    this.emit('ready', { vpUser: this.vpUser });
  }

  async stop(): Promise<void> {
    await this.setPresence('away');
    await this.wsClient.disconnect();
    this.isConnected = false;
    this.emit('disconnected');
  }

  connected(): boolean {
    return this.isConnected;
  }

  // Messaging
  async sendMessage(
    channel: string,
    text: string,
    options?: MessageOptions
  ): Promise<MessageResult> {
    if (!this.isConnected && this.config.offlineSupport) {
      return this.offlineQueue.enqueue('sendMessage', { channel, text, options });
    }
    return this.sendMessageInternal(channel, text, options);
  }

  private async sendMessageInternal(
    channel: string,
    text: string,
    options?: MessageOptions
  ): Promise<MessageResult> {
    const response = await this.apiCall('POST', '/messages', {
      channelId: channel,
      content: text,
      threadTs: options?.threadTs,
    });
    return {
      ok: true,
      channelId: response.message.channelId,
      ts: response.message.id,
    };
  }

  // ... implement all CommunicationClient methods

  private async apiCall(method: string, path: string, body?: unknown): Promise<any> {
    const token = await this.tokenManager.getValidToken();

    const response = await fetch(`${this.config.apiEndpoint}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new GenesisApiError(response.status, await response.text());
    }

    return response.json();
  }

  private setupEventHandlers(): void {
    this.wsClient.on('message', event => this.emit('message', event));
    this.wsClient.on('mention', event => this.emit('mention', event));
    this.wsClient.on('reaction_added', event => this.emit('reaction_added', event));
    // ... other events
  }
}

// Factory functions
export function createGenesisClient(config: GenesisClientConfig): GenesisClient {
  return new GenesisClient(config);
}

export function createGenesisClientFromEnv(): GenesisClient {
  return new GenesisClient({
    apiEndpoint: process.env.GENESIS_API_ENDPOINT!,
    apiKey: process.env.GENESIS_API_KEY!,
    debug: process.env.GENESIS_DEBUG === 'true',
  });
}
```

#### Feature 9.3: Update VP-Daemon Installer

Add genesis-app integration template alongside Slack:

```typescript
// packages/@wundr/computer-setup/src/installers/vp-daemon-installer.ts

private async setupIntegrationConfigs(): Promise<void> {
  const integrationsDir = path.join(this.vpDaemonDir, 'integrations');

  // Existing Slack integration template
  await fs.writeFile(
    path.join(integrationsDir, 'slack.config.json'),
    JSON.stringify({
      enabled: false,
      botToken: '${SLACK_BOT_TOKEN}',
      // ...
    }, null, 2),
  );

  // NEW: Genesis-App integration template
  await fs.writeFile(
    path.join(integrationsDir, 'genesis-app.config.json'),
    JSON.stringify({
      enabled: false,
      apiEndpoint: '${GENESIS_API_ENDPOINT}',
      apiKey: '${GENESIS_API_KEY}',
      wsEndpoint: '${GENESIS_WS_ENDPOINT}',
      offlineSupport: true,
      debug: false,
    }, null, 2),
  );
}
```

#### Feature 9.4: Unified VP Communication Manager

Create a manager that can use both Slack and Genesis-App:

```typescript
// packages/@wundr/vp-communication/src/manager.ts

import { SlackUserAgent } from '@wundr/slack-agent';
import { GenesisClient } from '@wundr/genesis-client';
import type { CommunicationClient } from '@wundr/communication-client';

export interface VPCommunicationConfig {
  slack?: SlackUserAgentConfig;
  genesis?: GenesisClientConfig;
  primaryChannel: 'slack' | 'genesis';
}

export class VPCommunicationManager {
  private clients: Map<string, CommunicationClient> = new Map();
  private primaryChannel: string;

  constructor(config: VPCommunicationConfig) {
    if (config.slack) {
      this.clients.set('slack', new SlackUserAgent(config.slack));
    }
    if (config.genesis) {
      this.clients.set('genesis', new GenesisClient(config.genesis));
    }
    this.primaryChannel = config.primaryChannel;
  }

  async startAll(): Promise<void> {
    await Promise.all(Array.from(this.clients.values()).map(client => client.start()));
  }

  async stopAll(): Promise<void> {
    await Promise.all(Array.from(this.clients.values()).map(client => client.stop()));
  }

  // Get primary client
  get primary(): CommunicationClient {
    const client = this.clients.get(this.primaryChannel);
    if (!client) throw new Error(`Primary channel ${this.primaryChannel} not configured`);
    return client;
  }

  // Get specific client
  getClient(channel: 'slack' | 'genesis'): CommunicationClient | undefined {
    return this.clients.get(channel);
  }

  // Broadcast to all channels
  async broadcastMessage(text: string, channels: Record<string, string>): Promise<void> {
    const promises: Promise<any>[] = [];

    for (const [clientName, channelId] of Object.entries(channels)) {
      const client = this.clients.get(clientName);
      if (client) {
        promises.push(client.sendMessage(channelId, text));
      }
    }

    await Promise.all(promises);
  }
}
```

**Acceptance Criteria**:

- [ ] CommunicationClient interface extracted
- [ ] @wundr/genesis-client package created
- [ ] GenesisClient implements full interface
- [ ] VP-Daemon installer includes genesis-app template
- [ ] VPCommunicationManager supports dual channels

---

## 5. API Contract Reference

### 5.1 GraphQL Schema (Human Clients)

```graphql
# =============================================================================
# QUERIES
# =============================================================================

type Query {
  # User
  me: User!
  user(id: ID!): User

  # Workspace
  workspace(id: ID!): Workspace
  workspaces: [Workspace!]!

  # Channels
  channel(id: ID!): Channel
  channels(workspaceId: ID!, includeArchived: Boolean): [Channel!]!
  publicChannels(workspaceId: ID!, cursor: String, limit: Int): ChannelConnection!

  # Messages
  messages(channelId: ID!, limit: Int, before: String, after: String): MessageConnection!
  thread(channelId: ID!, parentId: ID!): [Message!]!

  # Search
  searchMessages(workspaceId: ID!, query: String!, options: SearchOptions): MessageSearchResult!
  searchFiles(workspaceId: ID!, query: String!, options: SearchOptions): FileSearchResult!

  # Org-Genesis
  vpMappings(workspaceId: ID!): [VPMapping!]!
  disciplineMappings(workspaceId: ID!): [DisciplineMapping!]!
}

# =============================================================================
# MUTATIONS
# =============================================================================

type Mutation {
  # Authentication
  signIn(provider: String!, credentials: JSON): AuthResult!
  signOut: Boolean!

  # Workspace
  createWorkspace(input: CreateWorkspaceInput!): Workspace!
  createWorkspaceWithGenesis(input: CreateWorkspaceWithGenesisInput!): GenesisResult!
  updateWorkspace(id: ID!, input: UpdateWorkspaceInput!): Workspace!

  # Channel
  createChannel(workspaceId: ID!, input: CreateChannelInput!): Channel!
  joinChannel(channelId: ID!): Channel!
  leaveChannel(channelId: ID!): Boolean!
  archiveChannel(channelId: ID!): Channel!

  # Message
  sendMessage(channelId: ID!, content: String!, threadTs: String): Message!
  editMessage(messageId: ID!, content: String!): Message!
  deleteMessage(messageId: ID!): Boolean!

  # Reaction
  addReaction(channelId: ID!, messageId: ID!, emoji: String!): Boolean!
  removeReaction(channelId: ID!, messageId: ID!, emoji: String!): Boolean!

  # Presence
  sendHeartbeat: Boolean!
  setStatus(text: String!, emoji: String, expiresAt: DateTime): UserPresence!
  clearStatus: Boolean!

  # File
  requestUploadUrl(filename: String!, contentType: String!): UploadUrlResult!
  completeUpload(fileKey: String!, channelId: ID!): File!
}

# =============================================================================
# SUBSCRIPTIONS
# =============================================================================

type Subscription {
  # Messages
  messageCreated(channelId: ID!): Message!
  messageUpdated(channelId: ID!): Message!
  messageDeleted(channelId: ID!): DeletedMessage!

  # Threads
  threadUpdated(channelId: ID!, parentId: ID!): Message!

  # Presence
  userPresenceChanged(workspaceId: ID!): UserPresence!

  # Typing
  userTyping(channelId: ID!): TypingIndicator!
}
```

### 5.2 REST API (VP-Daemon)

```yaml
openapi: 3.0.0
info:
  title: Genesis-App Daemon API
  version: 1.0.0
  description: REST API for VP-Daemon integration

servers:
  - url: https://genesis-app.example.com/api/daemon

security:
  - BearerAuth: []

paths:
  /auth:
    post:
      summary: Authenticate with API key
      security: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                apiKey:
                  type: string
              required:
                - apiKey
      responses:
        '200':
          description: Authentication successful
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/AuthResponse'
        '401':
          description: Invalid API key

  /messages:
    post:
      summary: Send a message
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/SendMessageRequest'
      responses:
        '200':
          description: Message sent
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/MessageResponse'

    get:
      summary: Get messages from a channel
      parameters:
        - name: channelId
          in: query
          required: true
          schema:
            type: string
        - name: limit
          in: query
          schema:
            type: integer
            default: 50
        - name: before
          in: query
          schema:
            type: string
        - name: after
          in: query
          schema:
            type: string
      responses:
        '200':
          description: Messages retrieved
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/MessagesResponse'

  /reactions:
    post:
      summary: Add a reaction
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ReactionRequest'
      responses:
        '200':
          description: Reaction added

    delete:
      summary: Remove a reaction
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ReactionRequest'
      responses:
        '200':
          description: Reaction removed

  /presence:
    post:
      summary: Update presence status
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/PresenceRequest'
      responses:
        '200':
          description: Presence updated

  /files/upload-url:
    post:
      summary: Get pre-signed upload URL
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                filename:
                  type: string
                contentType:
                  type: string
              required:
                - filename
                - contentType
      responses:
        '200':
          description: Upload URL generated
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/UploadUrlResponse'

  /health:
    get:
      summary: Health check
      security: []
      responses:
        '200':
          description: Service healthy

components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer

  schemas:
    AuthResponse:
      type: object
      properties:
        token:
          type: string
        expiresIn:
          type: integer
        vpUser:
          $ref: '#/components/schemas/User'

    SendMessageRequest:
      type: object
      properties:
        channelId:
          type: string
        content:
          type: string
        threadTs:
          type: string
      required:
        - channelId
        - content

    MessageResponse:
      type: object
      properties:
        message:
          $ref: '#/components/schemas/Message'

    MessagesResponse:
      type: object
      properties:
        messages:
          type: array
          items:
            $ref: '#/components/schemas/Message'
        hasMore:
          type: boolean

    Message:
      type: object
      properties:
        id:
          type: string
        content:
          type: string
        channelId:
          type: string
        authorId:
          type: string
        author:
          $ref: '#/components/schemas/User'
        parentId:
          type: string
        createdAt:
          type: string
          format: date-time
        updatedAt:
          type: string
          format: date-time

    User:
      type: object
      properties:
        id:
          type: string
        name:
          type: string
        displayName:
          type: string
        avatarUrl:
          type: string
        type:
          type: string
          enum: [HUMAN, VP_AGENT, SERVICE_ACCOUNT]

    ReactionRequest:
      type: object
      properties:
        channelId:
          type: string
        messageTs:
          type: string
        emoji:
          type: string
      required:
        - channelId
        - messageTs
        - emoji

    PresenceRequest:
      type: object
      properties:
        presence:
          type: string
          enum: [ONLINE, AWAY, DND, OFFLINE]
        statusText:
          type: string
        statusEmoji:
          type: string
      required:
        - presence

    UploadUrlResponse:
      type: object
      properties:
        uploadUrl:
          type: string
        fileKey:
          type: string
```

---

## 6. Migration & Compatibility

### 6.1 Existing Wundr Package Updates

| Package                            | Change Type | Description                                        |
| ---------------------------------- | ----------- | -------------------------------------------------- |
| `@wundr/org-genesis`               | Extension   | Add `toGenesisApp()` export method                 |
| `@wundr/slack-agent`               | Refactor    | Extract interface to `@wundr/communication-client` |
| `@wundr/computer-setup`            | Extension   | Add genesis-app integration template               |
| NEW: `@wundr/communication-client` | New         | Shared interface package                           |
| NEW: `@wundr/genesis-client`       | New         | Genesis-App client SDK                             |
| NEW: `@wundr/vp-communication`     | New         | Multi-channel manager                              |

### 6.2 Breaking Changes

**None** - All changes are additive:

- Existing Slack integration continues to work
- New genesis-app integration is opt-in
- Interface extraction doesn't change existing exports

### 6.3 Migration Path for Existing VP-Daemons

1. **No Action Required**: Existing Slack-only daemons continue working
2. **Opt-In Genesis**: Add genesis-app config alongside Slack
3. **Dual-Channel**: Use VPCommunicationManager for both

---

## 7. Security Considerations

### 7.1 Service Account Security

| Measure              | Implementation                                |
| -------------------- | --------------------------------------------- |
| **API Key Storage**  | bcrypt hash only stored in DB                 |
| **Key Rotation**     | Regenerate via admin API, invalidates old key |
| **Scope Limitation** | JWT contains explicit scope list              |
| **Rate Limiting**    | Per-account limits enforced                   |
| **IP Allowlisting**  | Optional per-account IP restrictions          |
| **Audit Logging**    | All daemon actions logged                     |

### 7.2 Authentication Flow Security

```
┌─────────────────────────────────────────────────────────────────┐
│                    SECURITY LAYERS                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Layer 1: API Key Validation                                    │
│  ─────────────────────────────                                  │
│  • API key validated against bcrypt hash                        │
│  • Rate limited: 10 auth attempts per minute                    │
│  • Failed attempts logged with IP                               │
│                                                                  │
│  Layer 2: JWT Token                                             │
│  ────────────────────                                           │
│  • Short-lived (1 hour default)                                 │
│  • Contains: serviceAccountId, userId, scopes, exp              │
│  • Signed with workspace-specific secret                        │
│                                                                  │
│  Layer 3: Scope Enforcement                                     │
│  ──────────────────────────                                     │
│  • Each endpoint checks required scopes                         │
│  • Scopes: messages:read, messages:write, presence:*, etc.      │
│                                                                  │
│  Layer 4: Resource Authorization                                │
│  ───────────────────────────────                                │
│  • VP can only access channels they're a member of              │
│  • Cross-workspace access blocked                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 7.3 Data Isolation

- VP users isolated to their workspace
- Service accounts bound to single workspace
- Cross-workspace queries forbidden
- Tenant isolation at database level

---

## 8. Testing Strategy

### 8.1 Test Categories

| Category          | Tool               | Coverage Target             |
| ----------------- | ------------------ | --------------------------- |
| Unit Tests        | Vitest             | 80% code coverage           |
| Integration Tests | Vitest + Supertest | All API endpoints           |
| E2E Tests         | Playwright         | Critical user journeys      |
| Load Tests        | k6                 | 1000 concurrent connections |
| Security Tests    | OWASP ZAP          | All auth endpoints          |

### 8.2 Key Test Scenarios

**Org-Genesis Integration**:

- [ ] Workspace creation with org-genesis
- [ ] VP user provisioning
- [ ] Discipline channel auto-generation
- [ ] Service account creation

**VP-Daemon Gateway**:

- [ ] API key authentication
- [ ] JWT token refresh
- [ ] Message send/receive
- [ ] WebSocket connection/reconnection
- [ ] Rate limiting enforcement
- [ ] Offline queue flush

**Multi-Channel Communication**:

- [ ] Simultaneous Slack + Genesis connection
- [ ] Message broadcast to both channels
- [ ] Graceful degradation on channel failure

---

## 9. Monitoring & Observability

### 9.1 Metrics

```typescript
// Key metrics to track
const metrics = {
  // Daemon connections
  'daemon.connections.active': Gauge,
  'daemon.connections.total': Counter,
  'daemon.auth.success': Counter,
  'daemon.auth.failure': Counter,

  // Message throughput
  'daemon.messages.sent': Counter,
  'daemon.messages.received': Counter,
  'daemon.messages.latency': Histogram,

  // Rate limiting
  'daemon.ratelimit.exceeded': Counter,
  'daemon.quota.remaining': Gauge,

  // Org-genesis
  'genesis.workspace.created': Counter,
  'genesis.vp.provisioned': Counter,
  'genesis.channel.autogenerated': Counter,
};
```

### 9.2 Logging

```typescript
// Structured log format
{
  "timestamp": "2024-01-15T10:30:00Z",
  "level": "info",
  "service": "genesis-app",
  "component": "daemon-gateway",
  "event": "message.sent",
  "serviceAccountId": "sa_123",
  "vpUserId": "user_456",
  "channelId": "chan_789",
  "messageId": "msg_abc",
  "latencyMs": 45,
  "traceId": "trace_xyz"
}
```

### 9.3 Alerting

| Alert                    | Condition      | Severity |
| ------------------------ | -------------- | -------- |
| Daemon Auth Failures     | >10/min        | Warning  |
| Rate Limit Exceeded      | >100/min       | Warning  |
| WebSocket Disconnections | >50/min        | Critical |
| Message Latency          | P99 > 500ms    | Warning  |
| Database Connection      | Pool exhausted | Critical |

---

## 10. Module 10: File Pipeline - Genesis-App → VP-Daemon → Claude Sessions

### 10.1 Overview

This module defines the complete file pipeline enabling files uploaded to Genesis-App to flow
through to VP-Daemons and ultimately be processed within Claude Code / Claude Flow sessions.

**Supported File Types**: | Category | Extensions | Processing |
|----------|------------|------------| | Documents | `.pdf`, `.docx`, `.doc`, `.odt` | Text
extraction + OCR | | Spreadsheets | `.xlsx`, `.xls`, `.csv`, `.ods` | Structured data extraction | |
Images | `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg` | Vision API / OCR | | Code | `.ts`,
`.js`, `.py`, `.go`, `.rs`, `.java`, etc. | Direct text | | Archives | `.zip`, `.tar.gz` |
Extraction + recursive processing | | Data | `.json`, `.yaml`, `.xml`, `.toml` | Direct text | |
Text | `.txt`, `.md`, `.rtf` | Direct text |

### 10.2 File Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           FILE PIPELINE ARCHITECTURE                             │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                         GENESIS-APP (Cloud)                              │   │
│  │                                                                          │   │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────────┐  │   │
│  │  │   User UI    │───▶│  Upload API  │───▶│      S3 / R2 Storage     │  │   │
│  │  │  (Web/Mobile)│    │ (Pre-signed) │    │                          │  │   │
│  │  └──────────────┘    └──────────────┘    │  • Raw files             │  │   │
│  │                                           │  • Processed versions    │  │   │
│  │                             │             │  • Extracted text        │  │   │
│  │                             ▼             └──────────────────────────┘  │   │
│  │                    ┌──────────────┐                    │                │   │
│  │                    │  File Record │                    │                │   │
│  │                    │  (Postgres)  │                    │                │   │
│  │                    └──────────────┘                    │                │   │
│  │                             │                          │                │   │
│  │                             ▼                          │                │   │
│  │  ┌──────────────────────────────────────────────────────────────────┐  │   │
│  │  │                    FILE PROCESSING QUEUE                          │  │   │
│  │  │  (BullMQ / Redis)                                                │  │   │
│  │  │                                                                   │  │   │
│  │  │  Jobs: extract_text, generate_thumbnail, ocr_image, parse_xlsx   │  │   │
│  │  └──────────────────────────────────────────────────────────────────┘  │   │
│  │                             │                                          │   │
│  │                             ▼                                          │   │
│  │  ┌──────────────────────────────────────────────────────────────────┐  │   │
│  │  │                    FILE PROCESSOR WORKERS                         │  │   │
│  │  │                                                                   │  │   │
│  │  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐│  │   │
│  │  │  │PDF Processor│ │XLSX Parser  │ │Image OCR    │ │DOCX Extract ││  │   │
│  │  │  │(pdf-parse)  │ │(exceljs)    │ │(Tesseract)  │ │(mammoth)    ││  │   │
│  │  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘│  │   │
│  │  └──────────────────────────────────────────────────────────────────┘  │   │
│  │                             │                                          │   │
│  │                             ▼                                          │   │
│  │  ┌──────────────────────────────────────────────────────────────────┐  │   │
│  │  │                    PROCESSED FILE STORAGE                         │  │   │
│  │  │                                                                   │  │   │
│  │  │  S3 Structure:                                                    │  │   │
│  │  │  /{workspaceId}/files/{fileId}/                                  │  │   │
│  │  │    ├── original.{ext}           # Original file                  │  │   │
│  │  │    ├── extracted.txt            # Plain text extraction          │  │   │
│  │  │    ├── extracted.json           # Structured extraction          │  │   │
│  │  │    ├── thumbnail.webp           # Preview thumbnail              │  │   │
│  │  │    └── metadata.json            # Processing metadata            │  │   │
│  │  └──────────────────────────────────────────────────────────────────┘  │   │
│  │                             │                                          │   │
│  │                             │  WebSocket Event: file.processed        │   │
│  │                             ▼                                          │   │
│  │  ┌──────────────────────────────────────────────────────────────────┐  │   │
│  │  │                    DAEMON FILE API                                │  │   │
│  │  │                                                                   │  │   │
│  │  │  GET  /api/daemon/files/{fileId}           # File metadata       │  │   │
│  │  │  GET  /api/daemon/files/{fileId}/download  # Download original   │  │   │
│  │  │  GET  /api/daemon/files/{fileId}/text      # Get extracted text  │  │   │
│  │  │  GET  /api/daemon/files/{fileId}/json      # Get structured data │  │   │
│  │  │  POST /api/daemon/files/{fileId}/process   # Request processing  │  │   │
│  │  └──────────────────────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                          │                                      │
│                                          │ HTTPS (Daemon Auth)                 │
│                                          ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                         VP-DAEMON (Per Machine)                          │   │
│  │                                                                          │   │
│  │  ┌──────────────────────────────────────────────────────────────────┐  │   │
│  │  │                    FILE SYNC SERVICE                              │  │   │
│  │  │                                                                   │  │   │
│  │  │  • Subscribes to file.shared events for VP's channels            │  │   │
│  │  │  • Downloads files to local staging directory                    │  │   │
│  │  │  • Manages local file cache with LRU eviction                    │  │   │
│  │  │  • Tracks file processing status                                 │  │   │
│  │  └──────────────────────────────────────────────────────────────────┘  │   │
│  │                             │                                          │   │
│  │                             ▼                                          │   │
│  │  ┌──────────────────────────────────────────────────────────────────┐  │   │
│  │  │                    LOCAL FILE STAGING                             │  │   │
│  │  │                                                                   │  │   │
│  │  │  ~/vp-daemon/files/                                              │  │   │
│  │  │    ├── cache/                    # Downloaded files (LRU)        │  │   │
│  │  │    │   └── {fileId}/                                             │  │   │
│  │  │    │       ├── original.pdf                                      │  │   │
│  │  │    │       ├── extracted.txt                                     │  │   │
│  │  │    │       └── metadata.json                                     │  │   │
│  │  │    ├── sessions/                 # Per-session file mounts       │  │   │
│  │  │    │   └── {sessionId}/                                          │  │   │
│  │  │    │       └── context/          # Files for this session        │  │   │
│  │  │    └── index.json                # File cache index              │  │   │
│  │  └──────────────────────────────────────────────────────────────────┘  │   │
│  │                             │                                          │   │
│  │                             │  Session Spawn with File Context        │   │
│  │                             ▼                                          │   │
│  │  ┌──────────────────────────────────────────────────────────────────┐  │   │
│  │  │                CLAUDE CODE / CLAUDE FLOW SESSION                  │  │   │
│  │  │                                                                   │  │   │
│  │  │  Session receives files via:                                     │  │   │
│  │  │                                                                   │  │   │
│  │  │  1. CLAUDE.md Context Injection                                  │  │   │
│  │  │     - File summaries embedded in system prompt                   │  │   │
│  │  │     - Extracted text included (token-budgeted)                   │  │   │
│  │  │                                                                   │  │   │
│  │  │  2. Working Directory Files                                      │  │   │
│  │  │     - Original files copied to session working dir               │  │   │
│  │  │     - Claude can use Read tool to access                         │  │   │
│  │  │                                                                   │  │   │
│  │  │  3. MCP File Server                                              │  │   │
│  │  │     - Files exposed via MCP filesystem tool                      │  │   │
│  │  │     - Supports large file streaming                              │  │   │
│  │  │                                                                   │  │   │
│  │  └──────────────────────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 10.3 Database Schema Extensions for File Pipeline

```prisma
// =============================================================================
// FILE MODELS (Extended)
// =============================================================================

enum FileProcessingStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
  PARTIAL       // Some extractions succeeded, others failed
}

enum FileType {
  DOCUMENT      // PDF, DOCX, DOC, ODT
  SPREADSHEET   // XLSX, XLS, CSV, ODS
  IMAGE         // PNG, JPG, GIF, WEBP, SVG
  CODE          // Source code files
  ARCHIVE       // ZIP, TAR.GZ
  DATA          // JSON, YAML, XML
  TEXT          // TXT, MD, RTF
  OTHER
}

model File {
  id                    String                @id @default(cuid())

  // Basic info
  filename              String
  originalFilename      String
  mimeType              String
  fileType              FileType
  sizeBytes             Int

  // Storage
  storageKey            String                @unique  // S3 key for original
  storageUrl            String?               // CDN URL if public

  // Processing
  processingStatus      FileProcessingStatus  @default(PENDING)
  processingStartedAt   DateTime?
  processingCompletedAt DateTime?
  processingError       String?

  // Extracted content references
  extractedTextKey      String?               // S3 key for extracted.txt
  extractedJsonKey      String?               // S3 key for extracted.json
  thumbnailKey          String?               // S3 key for thumbnail

  // Extracted content (cached for quick access, max 100KB)
  extractedTextPreview  String?               @db.Text
  extractedMetadata     Json?                 // Page count, dimensions, etc.

  // Token estimation for Claude
  estimatedTokens       Int?                  // Estimated tokens for extracted text

  // Relations
  workspaceId           String
  workspace             Workspace             @relation(fields: [workspaceId], references: [id])
  uploadedById          String
  uploadedBy            User                  @relation(fields: [uploadedById], references: [id])
  channelId             String?               // Channel where file was shared
  channel               Channel?              @relation(fields: [channelId], references: [id])
  messageId             String?               // Message the file is attached to
  message               Message?              @relation(fields: [messageId], references: [id])

  // Daemon sync tracking
  daemonSyncs           FileDaemonSync[]
  sessionFiles          SessionFile[]

  // Timestamps
  createdAt             DateTime              @default(now())
  updatedAt             DateTime              @updatedAt

  @@index([workspaceId])
  @@index([channelId])
  @@index([processingStatus])
  @@index([fileType])
}

model FileDaemonSync {
  id              String    @id @default(cuid())

  // File reference
  fileId          String
  file            File      @relation(fields: [fileId], references: [id], onDelete: Cascade)

  // VP/Daemon reference
  vpMappingId     String
  vpMapping       VPMapping @relation(fields: [vpMappingId], references: [id], onDelete: Cascade)

  // Sync status
  syncStatus      String    @default("pending") // pending, syncing, synced, failed
  syncedAt        DateTime?
  localPath       String?   // Path on daemon machine
  syncError       String?

  // Cache management
  lastAccessedAt  DateTime?
  accessCount     Int       @default(0)

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@unique([fileId, vpMappingId])
  @@index([vpMappingId])
  @@index([syncStatus])
}

model SessionFile {
  id              String    @id @default(cuid())

  // File reference
  fileId          String
  file            File      @relation(fields: [fileId], references: [id], onDelete: Cascade)

  // Session reference
  sessionId       String    // Claude Code/Flow session ID
  vpMappingId     String
  vpMapping       VPMapping @relation(fields: [vpMappingId], references: [id], onDelete: Cascade)

  // How file was injected
  injectionMethod String    // "context", "working_dir", "mcp"

  // Token usage
  tokensUsed      Int?      // Actual tokens used for this file
  truncated       Boolean   @default(false)

  createdAt       DateTime  @default(now())

  @@index([sessionId])
  @@index([fileId])
}

// Add relation to VPMapping
model VPMapping {
  // ... existing fields ...

  fileSyncs       FileDaemonSync[]
  sessionFiles    SessionFile[]
}
```

### 10.4 File Processing Pipeline

#### 10.4.1 Processor Configuration

```typescript
// packages/@genesis/file-processor/src/config.ts

export interface FileProcessorConfig {
  // Storage
  s3Bucket: string;
  s3Region: string;

  // Processing limits
  maxFileSizeMb: number; // Default: 100MB
  maxPagesPerPdf: number; // Default: 500
  maxRowsPerSpreadsheet: number; // Default: 100000

  // OCR settings
  ocrEnabled: boolean;
  ocrLanguages: string[]; // Default: ['eng']

  // Token budgeting
  maxExtractedTokens: number; // Default: 50000

  // Queue settings
  concurrency: number; // Default: 5
  jobTimeout: number; // Default: 300000 (5 min)
}

export const defaultConfig: FileProcessorConfig = {
  s3Bucket: process.env.S3_BUCKET!,
  s3Region: process.env.S3_REGION || 'us-east-1',
  maxFileSizeMb: 100,
  maxPagesPerPdf: 500,
  maxRowsPerSpreadsheet: 100000,
  ocrEnabled: true,
  ocrLanguages: ['eng'],
  maxExtractedTokens: 50000,
  concurrency: 5,
  jobTimeout: 300000,
};
```

#### 10.4.2 File Processors

```typescript
// packages/@genesis/file-processor/src/processors/index.ts

import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import ExcelJS from 'exceljs';
import Tesseract from 'tesseract.js';
import sharp from 'sharp';

export interface ProcessorResult {
  extractedText: string;
  extractedJson?: Record<string, unknown>;
  metadata: FileMetadata;
  thumbnailBuffer?: Buffer;
  estimatedTokens: number;
}

export interface FileMetadata {
  pageCount?: number;
  wordCount?: number;
  dimensions?: { width: number; height: number };
  sheetNames?: string[];
  rowCount?: number;
  columnCount?: number;
  author?: string;
  createdAt?: Date;
  modifiedAt?: Date;
}

// PDF Processor
export async function processPdf(buffer: Buffer): Promise<ProcessorResult> {
  const data = await pdfParse(buffer);

  const extractedText = data.text;
  const metadata: FileMetadata = {
    pageCount: data.numpages,
    wordCount: extractedText.split(/\s+/).length,
  };

  // Generate thumbnail from first page
  // (would use pdf2pic or similar in production)

  return {
    extractedText,
    metadata,
    estimatedTokens: estimateTokens(extractedText),
  };
}

// DOCX Processor
export async function processDocx(buffer: Buffer): Promise<ProcessorResult> {
  const result = await mammoth.extractRawText({ buffer });
  const extractedText = result.value;

  return {
    extractedText,
    metadata: {
      wordCount: extractedText.split(/\s+/).length,
    },
    estimatedTokens: estimateTokens(extractedText),
  };
}

// XLSX Processor
export async function processXlsx(buffer: Buffer): Promise<ProcessorResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const sheets: Record<string, unknown[][]> = {};
  const sheetNames: string[] = [];
  let totalRows = 0;
  let maxColumns = 0;

  workbook.eachSheet(worksheet => {
    sheetNames.push(worksheet.name);
    const rows: unknown[][] = [];

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber <= 10000) {
        // Limit rows per sheet
        rows.push(row.values as unknown[]);
        totalRows++;
        maxColumns = Math.max(maxColumns, (row.values as unknown[]).length);
      }
    });

    sheets[worksheet.name] = rows;
  });

  // Convert to text representation
  const extractedText = Object.entries(sheets)
    .map(([name, rows]) => {
      const header = `=== Sheet: ${name} ===\n`;
      const content = rows
        .slice(0, 100) // First 100 rows for text
        .map(row => (row as unknown[]).join('\t'))
        .join('\n');
      return header + content;
    })
    .join('\n\n');

  return {
    extractedText,
    extractedJson: { sheets },
    metadata: {
      sheetNames,
      rowCount: totalRows,
      columnCount: maxColumns,
    },
    estimatedTokens: estimateTokens(extractedText),
  };
}

// Image Processor (with OCR)
export async function processImage(
  buffer: Buffer,
  mimeType: string,
  ocrEnabled: boolean = true
): Promise<ProcessorResult> {
  // Get image metadata
  const metadata = await sharp(buffer).metadata();

  let extractedText = '';

  if (ocrEnabled) {
    const { data } = await Tesseract.recognize(buffer, 'eng');
    extractedText = data.text;
  }

  // Generate thumbnail
  const thumbnailBuffer = await sharp(buffer)
    .resize(400, 400, { fit: 'inside' })
    .webp({ quality: 80 })
    .toBuffer();

  return {
    extractedText,
    metadata: {
      dimensions: {
        width: metadata.width || 0,
        height: metadata.height || 0,
      },
    },
    thumbnailBuffer,
    estimatedTokens: estimateTokens(extractedText),
  };
}

// Token estimation (rough approximation)
function estimateTokens(text: string): number {
  // ~4 characters per token on average
  return Math.ceil(text.length / 4);
}
```

#### 10.4.3 Processing Queue

```typescript
// packages/@genesis/file-processor/src/queue.ts

import { Queue, Worker, Job } from 'bullmq';
import { prisma } from '@genesis/database';
import { s3Client, uploadToS3, downloadFromS3 } from './storage';
import * as processors from './processors';

export interface FileProcessingJob {
  fileId: string;
  workspaceId: string;
  storageKey: string;
  mimeType: string;
  fileType: string;
}

export const fileProcessingQueue = new Queue<FileProcessingJob>('file-processing', {
  connection: { url: process.env.REDIS_URL },
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

export const fileProcessingWorker = new Worker<FileProcessingJob>(
  'file-processing',
  async (job: Job<FileProcessingJob>) => {
    const { fileId, storageKey, mimeType, fileType } = job.data;

    // Update status to processing
    await prisma.file.update({
      where: { id: fileId },
      data: {
        processingStatus: 'PROCESSING',
        processingStartedAt: new Date(),
      },
    });

    try {
      // Download file from S3
      const buffer = await downloadFromS3(storageKey);

      // Process based on type
      let result: processors.ProcessorResult;

      switch (fileType) {
        case 'DOCUMENT':
          if (mimeType === 'application/pdf') {
            result = await processors.processPdf(buffer);
          } else {
            result = await processors.processDocx(buffer);
          }
          break;
        case 'SPREADSHEET':
          result = await processors.processXlsx(buffer);
          break;
        case 'IMAGE':
          result = await processors.processImage(buffer, mimeType);
          break;
        default:
          // For text/code files, read directly
          result = {
            extractedText: buffer.toString('utf-8'),
            metadata: {},
            estimatedTokens: Math.ceil(buffer.length / 4),
          };
      }

      // Upload extracted content to S3
      const baseKey = storageKey.replace(/\/[^/]+$/, '');

      const extractedTextKey = `${baseKey}/extracted.txt`;
      await uploadToS3(extractedTextKey, Buffer.from(result.extractedText), 'text/plain');

      let extractedJsonKey: string | undefined;
      if (result.extractedJson) {
        extractedJsonKey = `${baseKey}/extracted.json`;
        await uploadToS3(
          extractedJsonKey,
          Buffer.from(JSON.stringify(result.extractedJson, null, 2)),
          'application/json'
        );
      }

      let thumbnailKey: string | undefined;
      if (result.thumbnailBuffer) {
        thumbnailKey = `${baseKey}/thumbnail.webp`;
        await uploadToS3(thumbnailKey, result.thumbnailBuffer, 'image/webp');
      }

      // Update file record
      await prisma.file.update({
        where: { id: fileId },
        data: {
          processingStatus: 'COMPLETED',
          processingCompletedAt: new Date(),
          extractedTextKey,
          extractedJsonKey,
          thumbnailKey,
          extractedTextPreview: result.extractedText.slice(0, 100000), // First 100KB
          extractedMetadata: result.metadata,
          estimatedTokens: result.estimatedTokens,
        },
      });

      // Publish event for daemons
      await publishFileProcessedEvent(fileId);
    } catch (error) {
      await prisma.file.update({
        where: { id: fileId },
        data: {
          processingStatus: 'FAILED',
          processingError: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      throw error;
    }
  },
  {
    connection: { url: process.env.REDIS_URL },
    concurrency: 5,
  }
);
```

### 10.5 Daemon File Sync Service

```typescript
// packages/@wundr/genesis-client/src/file-sync.ts

import * as fs from 'fs/promises';
import * as path from 'path';
import { EventEmitter } from 'events';

export interface FileSyncConfig {
  cacheDir: string; // Default: ~/vp-daemon/files/cache
  sessionDir: string; // Default: ~/vp-daemon/files/sessions
  maxCacheSizeMb: number; // Default: 1000 (1GB)
  autoSync: boolean; // Default: true
  syncOnFileShared: boolean; // Default: true
}

export interface SyncedFile {
  fileId: string;
  localPath: string;
  extractedTextPath: string | null;
  extractedJsonPath: string | null;
  metadata: FileMetadata;
  estimatedTokens: number;
}

export class FileSyncService extends EventEmitter {
  private readonly config: FileSyncConfig;
  private readonly client: GenesisClient;
  private readonly cache: Map<string, SyncedFile> = new Map();
  private cacheIndex: CacheIndex;

  constructor(client: GenesisClient, config: Partial<FileSyncConfig> = {}) {
    super();
    this.client = client;
    this.config = {
      cacheDir: config.cacheDir || path.join(os.homedir(), 'vp-daemon/files/cache'),
      sessionDir: config.sessionDir || path.join(os.homedir(), 'vp-daemon/files/sessions'),
      maxCacheSizeMb: config.maxCacheSizeMb || 1000,
      autoSync: config.autoSync ?? true,
      syncOnFileShared: config.syncOnFileShared ?? true,
    };
  }

  async initialize(): Promise<void> {
    // Create directories
    await fs.mkdir(this.config.cacheDir, { recursive: true });
    await fs.mkdir(this.config.sessionDir, { recursive: true });

    // Load cache index
    await this.loadCacheIndex();

    // Subscribe to file events
    if (this.config.syncOnFileShared) {
      this.client.onEvent('file.shared', async event => {
        if (this.config.autoSync) {
          await this.syncFile(event.fileId);
        }
        this.emit('file.available', event);
      });
    }
  }

  /**
   * Sync a file from Genesis-App to local cache
   */
  async syncFile(fileId: string): Promise<SyncedFile> {
    // Check if already cached
    if (this.cache.has(fileId)) {
      const cached = this.cache.get(fileId)!;
      await this.updateAccessTime(fileId);
      return cached;
    }

    // Get file metadata
    const fileMeta = await this.client.getFileMetadata(fileId);

    // Create file directory
    const fileDir = path.join(this.config.cacheDir, fileId);
    await fs.mkdir(fileDir, { recursive: true });

    // Download original file
    const originalPath = path.join(fileDir, `original${path.extname(fileMeta.filename)}`);
    const originalBuffer = await this.client.downloadFile(fileId, 'original');
    await fs.writeFile(originalPath, originalBuffer);

    // Download extracted text if available
    let extractedTextPath: string | null = null;
    if (fileMeta.extractedTextKey) {
      extractedTextPath = path.join(fileDir, 'extracted.txt');
      const textBuffer = await this.client.downloadFile(fileId, 'text');
      await fs.writeFile(extractedTextPath, textBuffer);
    }

    // Download extracted JSON if available
    let extractedJsonPath: string | null = null;
    if (fileMeta.extractedJsonKey) {
      extractedJsonPath = path.join(fileDir, 'extracted.json');
      const jsonBuffer = await this.client.downloadFile(fileId, 'json');
      await fs.writeFile(extractedJsonPath, jsonBuffer);
    }

    // Save metadata
    await fs.writeFile(path.join(fileDir, 'metadata.json'), JSON.stringify(fileMeta, null, 2));

    const syncedFile: SyncedFile = {
      fileId,
      localPath: originalPath,
      extractedTextPath,
      extractedJsonPath,
      metadata: fileMeta.extractedMetadata,
      estimatedTokens: fileMeta.estimatedTokens || 0,
    };

    // Add to cache
    this.cache.set(fileId, syncedFile);
    await this.updateCacheIndex(fileId, syncedFile);

    // Enforce cache size limit
    await this.enforceCacheLimit();

    this.emit('file.synced', syncedFile);
    return syncedFile;
  }

  /**
   * Prepare files for a Claude session
   */
  async prepareSessionFiles(
    sessionId: string,
    fileIds: string[],
    options: SessionFileOptions = {}
  ): Promise<SessionFileContext> {
    const sessionDir = path.join(this.config.sessionDir, sessionId);
    const contextDir = path.join(sessionDir, 'context');
    await fs.mkdir(contextDir, { recursive: true });

    const files: PreparedFile[] = [];
    let totalTokens = 0;
    const tokenBudget = options.tokenBudget || 50000;

    for (const fileId of fileIds) {
      // Sync file if not cached
      const syncedFile = await this.syncFile(fileId);

      // Copy to session directory
      const sessionFilePath = path.join(contextDir, path.basename(syncedFile.localPath));
      await fs.copyFile(syncedFile.localPath, sessionFilePath);

      // Prepare text content (with token budgeting)
      let textContent: string | null = null;
      let truncated = false;

      if (syncedFile.extractedTextPath) {
        const fullText = await fs.readFile(syncedFile.extractedTextPath, 'utf-8');
        const availableTokens = tokenBudget - totalTokens;

        if (syncedFile.estimatedTokens <= availableTokens) {
          textContent = fullText;
          totalTokens += syncedFile.estimatedTokens;
        } else {
          // Truncate to fit budget
          const charLimit = availableTokens * 4; // ~4 chars per token
          textContent = fullText.slice(0, charLimit) + '\n\n[... truncated ...]';
          totalTokens += availableTokens;
          truncated = true;
        }
      }

      files.push({
        fileId,
        filename: path.basename(syncedFile.localPath),
        localPath: sessionFilePath,
        textContent,
        truncated,
        tokensUsed: truncated ? tokenBudget - totalTokens : syncedFile.estimatedTokens,
      });
    }

    return {
      sessionId,
      contextDir,
      files,
      totalTokens,
      tokenBudget,
    };
  }

  /**
   * Generate CLAUDE.md context section for files
   */
  generateClaudeMdContext(context: SessionFileContext): string {
    if (context.files.length === 0) return '';

    let md = '## Attached Files\n\n';
    md += 'The following files have been provided for this session:\n\n';

    for (const file of context.files) {
      md += `### ${file.filename}\n`;
      md += `- **Path**: \`${file.localPath}\`\n`;
      md += `- **Tokens**: ${file.tokensUsed}${file.truncated ? ' (truncated)' : ''}\n`;

      if (file.textContent) {
        md += '\n<file_content>\n';
        md += file.textContent;
        md += '\n</file_content>\n\n';
      } else {
        md += "\nUse the Read tool to access this file's contents.\n\n";
      }
    }

    md += `---\n`;
    md += `*Total tokens used for files: ${context.totalTokens}/${context.tokenBudget}*\n`;

    return md;
  }

  // Cache management methods
  private async loadCacheIndex(): Promise<void> {
    /* ... */
  }
  private async updateCacheIndex(fileId: string, file: SyncedFile): Promise<void> {
    /* ... */
  }
  private async updateAccessTime(fileId: string): Promise<void> {
    /* ... */
  }
  private async enforceCacheLimit(): Promise<void> {
    /* ... */
  }
}

export interface SessionFileOptions {
  tokenBudget?: number;
  includeExtractedText?: boolean;
  injectionMethod?: 'context' | 'working_dir' | 'mcp';
}

export interface PreparedFile {
  fileId: string;
  filename: string;
  localPath: string;
  textContent: string | null;
  truncated: boolean;
  tokensUsed: number;
}

export interface SessionFileContext {
  sessionId: string;
  contextDir: string;
  files: PreparedFile[];
  totalTokens: number;
  tokenBudget: number;
}
```

### 10.6 Claude Session File Injection

#### 10.6.1 Session Spawner with File Context

```typescript
// packages/@wundr/vp-daemon/src/session-spawner.ts

import { FileSyncService, SessionFileContext } from '@wundr/genesis-client';
import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface SpawnSessionOptions {
  sessionId: string;
  archetype: string;
  prompt: string;
  fileIds?: string[];
  tokenBudget?: number;
  injectionMethod?: 'context' | 'working_dir' | 'mcp' | 'all';
}

export class SessionSpawner {
  private readonly fileSyncService: FileSyncService;

  constructor(fileSyncService: FileSyncService) {
    this.fileSyncService = fileSyncService;
  }

  async spawnClaudeCodeSession(options: SpawnSessionOptions): Promise<ClaudeSession> {
    const {
      sessionId,
      archetype,
      prompt,
      fileIds = [],
      tokenBudget = 50000,
      injectionMethod = 'all',
    } = options;

    // Prepare files if any
    let fileContext: SessionFileContext | null = null;
    if (fileIds.length > 0) {
      fileContext = await this.fileSyncService.prepareSessionFiles(sessionId, fileIds, {
        tokenBudget,
      });
    }

    // Create session working directory
    const sessionDir = path.join(os.homedir(), 'vp-daemon/sessions', sessionId);
    await fs.mkdir(sessionDir, { recursive: true });

    // Generate dynamic CLAUDE.md
    const claudeMd = await this.generateSessionClaudeMd(archetype, fileContext);
    await fs.writeFile(path.join(sessionDir, 'CLAUDE.md'), claudeMd);

    // Copy files to working directory if requested
    if (fileContext && ['working_dir', 'all'].includes(injectionMethod)) {
      const filesDir = path.join(sessionDir, 'files');
      await fs.mkdir(filesDir, { recursive: true });

      for (const file of fileContext.files) {
        await fs.copyFile(file.localPath, path.join(filesDir, file.filename));
      }
    }

    // Build the prompt with file references
    let enhancedPrompt = prompt;
    if (fileContext && fileContext.files.length > 0) {
      enhancedPrompt = this.buildPromptWithFileContext(prompt, fileContext);
    }

    // Spawn Claude Code process
    const claudeProcess = spawn(
      'claude',
      ['--print', '--dangerously-skip-permissions', '-p', enhancedPrompt],
      {
        cwd: sessionDir,
        env: {
          ...process.env,
          CLAUDE_SESSION_ID: sessionId,
        },
      }
    );

    return new ClaudeSession(sessionId, claudeProcess, fileContext);
  }

  private async generateSessionClaudeMd(
    archetype: string,
    fileContext: SessionFileContext | null
  ): Promise<string> {
    // Load archetype template
    const archetypeConfig = await this.loadArchetype(archetype);

    let claudeMd = `# Session Configuration\n\n`;
    claudeMd += `## Archetype: ${archetypeConfig.name}\n\n`;
    claudeMd += archetypeConfig.instructions + '\n\n';

    // Add file context
    if (fileContext) {
      claudeMd += this.fileSyncService.generateClaudeMdContext(fileContext);
    }

    return claudeMd;
  }

  private buildPromptWithFileContext(prompt: string, fileContext: SessionFileContext): string {
    const fileList = fileContext.files
      .map(f => `- ${f.filename} (${f.tokensUsed} tokens)`)
      .join('\n');

    return `${prompt}

## Available Files

The following files have been provided and are available in the \`./files/\` directory:

${fileList}

You can read these files using the Read tool. Extracted text content has been included in the CLAUDE.md context where token budget permitted.`;
  }
}
```

#### 10.6.2 MCP File Server for Large Files

```typescript
// packages/@wundr/vp-daemon/src/mcp/file-server.ts

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * MCP Server that exposes session files to Claude
 * Useful for large files that exceed context window
 */
export function createFileServer(sessionDir: string): Server {
  const server = new Server(
    { name: 'genesis-file-server', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  // List available files
  server.setRequestHandler('tools/list', async () => ({
    tools: [
      {
        name: 'list_session_files',
        description: 'List all files available in this session',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'read_file_chunk',
        description: 'Read a chunk of a file by offset and length',
        inputSchema: {
          type: 'object',
          properties: {
            filename: { type: 'string', description: 'Name of the file' },
            offset: { type: 'number', description: 'Byte offset to start reading' },
            length: { type: 'number', description: 'Number of bytes to read (max 100KB)' },
          },
          required: ['filename'],
        },
      },
      {
        name: 'get_file_info',
        description: 'Get metadata about a file',
        inputSchema: {
          type: 'object',
          properties: {
            filename: { type: 'string', description: 'Name of the file' },
          },
          required: ['filename'],
        },
      },
      {
        name: 'search_in_file',
        description: 'Search for text within a file',
        inputSchema: {
          type: 'object',
          properties: {
            filename: { type: 'string', description: 'Name of the file' },
            query: { type: 'string', description: 'Text to search for' },
            caseSensitive: { type: 'boolean', description: 'Case sensitive search' },
          },
          required: ['filename', 'query'],
        },
      },
    ],
  }));

  // Handle tool calls
  server.setRequestHandler('tools/call', async request => {
    const { name, arguments: args } = request.params;
    const filesDir = path.join(sessionDir, 'files');

    switch (name) {
      case 'list_session_files': {
        const files = await fs.readdir(filesDir);
        const fileInfos = await Promise.all(
          files.map(async f => {
            const stat = await fs.stat(path.join(filesDir, f));
            return { name: f, size: stat.size, modified: stat.mtime };
          })
        );
        return { content: [{ type: 'text', text: JSON.stringify(fileInfos, null, 2) }] };
      }

      case 'read_file_chunk': {
        const { filename, offset = 0, length = 102400 } = args;
        const filePath = path.join(filesDir, filename);

        // Security: prevent path traversal
        if (!filePath.startsWith(filesDir)) {
          throw new Error('Invalid file path');
        }

        const handle = await fs.open(filePath, 'r');
        const buffer = Buffer.alloc(Math.min(length, 102400));
        await handle.read(buffer, 0, buffer.length, offset);
        await handle.close();

        return { content: [{ type: 'text', text: buffer.toString('utf-8') }] };
      }

      case 'get_file_info': {
        const { filename } = args;
        const filePath = path.join(filesDir, filename);
        const stat = await fs.stat(filePath);

        // Try to load extracted metadata
        const metadataPath = path.join(
          sessionDir,
          'context',
          filename.replace(/\.[^.]+$/, ''),
          'metadata.json'
        );
        let metadata = {};
        try {
          metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
        } catch {}

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  name: filename,
                  size: stat.size,
                  modified: stat.mtime,
                  ...metadata,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'search_in_file': {
        const { filename, query, caseSensitive = false } = args;
        const filePath = path.join(filesDir, filename);
        const content = await fs.readFile(filePath, 'utf-8');

        const searchContent = caseSensitive ? content : content.toLowerCase();
        const searchQuery = caseSensitive ? query : query.toLowerCase();

        const matches: { line: number; text: string }[] = [];
        const lines = content.split('\n');

        lines.forEach((line, index) => {
          const searchLine = caseSensitive ? line : line.toLowerCase();
          if (searchLine.includes(searchQuery)) {
            matches.push({ line: index + 1, text: line.trim() });
          }
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                { totalMatches: matches.length, matches: matches.slice(0, 50) },
                null,
                2
              ),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  });

  return server;
}
```

### 10.7 Daemon File API Endpoints

```typescript
// apps/web/app/api/daemon/files/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { authenticateDaemon } from '@/lib/daemon-auth';
import { prisma } from '@genesis/database';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';

const s3 = new S3Client({ region: process.env.S3_REGION });

// GET /api/daemon/files - List files in VP's accessible channels
export async function GET(request: NextRequest) {
  const { serviceAccount, vpUser } = await authenticateDaemon(request);

  const searchParams = request.nextUrl.searchParams;
  const channelId = searchParams.get('channelId');
  const status = searchParams.get('status');
  const limit = parseInt(searchParams.get('limit') || '50');

  const files = await prisma.file.findMany({
    where: {
      channel: {
        members: {
          some: { userId: vpUser.id },
        },
      },
      ...(channelId && { channelId }),
      ...(status && { processingStatus: status as any }),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      filename: true,
      originalFilename: true,
      mimeType: true,
      fileType: true,
      sizeBytes: true,
      processingStatus: true,
      extractedMetadata: true,
      estimatedTokens: true,
      createdAt: true,
      channel: { select: { id: true, name: true } },
      uploadedBy: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ files });
}

// GET /api/daemon/files/[fileId] - Get file metadata
export async function GETFileMetadata(
  request: NextRequest,
  { params }: { params: { fileId: string } }
) {
  const { serviceAccount, vpUser } = await authenticateDaemon(request);

  const file = await prisma.file.findUnique({
    where: { id: params.fileId },
    include: {
      channel: { select: { id: true, name: true } },
      uploadedBy: { select: { id: true, name: true } },
    },
  });

  if (!file) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  // Verify VP has access to the channel
  const hasAccess = await prisma.channelMember.findFirst({
    where: { channelId: file.channelId!, userId: vpUser.id },
  });

  if (!hasAccess) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  return NextResponse.json({ file });
}

// GET /api/daemon/files/[fileId]/download - Download file
export async function GETFileDownload(
  request: NextRequest,
  { params }: { params: { fileId: string } }
) {
  const { serviceAccount, vpUser } = await authenticateDaemon(request);

  const searchParams = request.nextUrl.searchParams;
  const variant = searchParams.get('variant') || 'original'; // original, text, json, thumbnail

  const file = await prisma.file.findUnique({
    where: { id: params.fileId },
  });

  if (!file) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  // Get appropriate S3 key
  let storageKey: string;
  switch (variant) {
    case 'text':
      storageKey = file.extractedTextKey!;
      break;
    case 'json':
      storageKey = file.extractedJsonKey!;
      break;
    case 'thumbnail':
      storageKey = file.thumbnailKey!;
      break;
    default:
      storageKey = file.storageKey;
  }

  if (!storageKey) {
    return NextResponse.json({ error: `${variant} not available` }, { status: 404 });
  }

  // Generate pre-signed URL
  const command = new GetObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: storageKey,
  });

  const signedUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });

  return NextResponse.json({ downloadUrl: signedUrl, expiresIn: 3600 });
}

// POST /api/daemon/files/[fileId]/sync - Mark file as synced by daemon
export async function POSTFileSync(
  request: NextRequest,
  { params }: { params: { fileId: string } }
) {
  const { serviceAccount, vpUser } = await authenticateDaemon(request);

  const body = await request.json();
  const { localPath } = body;

  const vpMapping = await prisma.vPMapping.findUnique({
    where: { userId: vpUser.id },
  });

  if (!vpMapping) {
    return NextResponse.json({ error: 'VP mapping not found' }, { status: 404 });
  }

  const sync = await prisma.fileDaemonSync.upsert({
    where: {
      fileId_vpMappingId: {
        fileId: params.fileId,
        vpMappingId: vpMapping.id,
      },
    },
    update: {
      syncStatus: 'synced',
      syncedAt: new Date(),
      localPath,
      lastAccessedAt: new Date(),
      accessCount: { increment: 1 },
    },
    create: {
      fileId: params.fileId,
      vpMappingId: vpMapping.id,
      syncStatus: 'synced',
      syncedAt: new Date(),
      localPath,
      lastAccessedAt: new Date(),
    },
  });

  return NextResponse.json({ sync });
}
```

### 10.8 File Pipeline Backlog Summary

#### Phase 4.5: File Processing Pipeline (NEW)

| ID        | Feature               | User Story                                                                                                                            | Priority |
| --------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| **4.5.1** | File Processing Queue | As a system, I need to process uploaded files asynchronously to extract text, generate thumbnails, and prepare for Claude consumption | P0       |
| **4.5.2** | PDF Text Extraction   | As a VP, when a PDF is shared, I need the text extracted so I can analyze it in Claude                                                | P0       |
| **4.5.3** | XLSX/CSV Parsing      | As a VP, when a spreadsheet is shared, I need structured data extracted (sheets, rows, columns)                                       | P0       |
| **4.5.4** | DOCX/DOC Extraction   | As a VP, when a Word document is shared, I need the text extracted                                                                    | P0       |
| **4.5.5** | Image OCR             | As a VP, when an image with text is shared, I need OCR to extract readable text                                                       | P1       |
| **4.5.6** | Thumbnail Generation  | As a user, I want to see thumbnails of uploaded files in the UI                                                                       | P1       |
| **4.5.7** | Token Estimation      | As a VP-Daemon, I need to know estimated tokens for each file to budget context                                                       | P0       |

#### Phase 8.5: Daemon File Sync (NEW)

| ID        | Feature                 | User Story                                                                    | Priority |
| --------- | ----------------------- | ----------------------------------------------------------------------------- | -------- |
| **8.5.1** | File Sync Service       | As a VP-Daemon, I need to sync files from Genesis-App to local cache          | P0       |
| **8.5.2** | Automatic Sync on Share | As a VP-Daemon, when a file is shared in my channel, I want it auto-synced    | P1       |
| **8.5.3** | LRU Cache Management    | As a VP-Daemon, I need cache eviction to stay within disk limits              | P1       |
| **8.5.4** | File Metadata API       | As a VP-Daemon, I need API to get file metadata before downloading            | P0       |
| **8.5.5** | Download Variants API   | As a VP-Daemon, I need to download original, extracted text, or JSON variants | P0       |
| **8.5.6** | Sync Status Tracking    | As Genesis-App, I need to track which daemons have synced which files         | P2       |

#### Phase 8.6: Claude Session File Injection (NEW)

| ID        | Feature                     | User Story                                                                             | Priority |
| --------- | --------------------------- | -------------------------------------------------------------------------------------- | -------- |
| **8.6.1** | Session File Preparation    | As a VP-Daemon, I need to prepare files for a Claude session with token budgeting      | P0       |
| **8.6.2** | CLAUDE.md Context Injection | As a VP-Daemon, I need to inject file summaries/content into session CLAUDE.md         | P0       |
| **8.6.3** | Working Directory Files     | As a VP-Daemon, I need to copy files to session working directory for Read tool access | P0       |
| **8.6.4** | MCP File Server             | As a VP-Daemon, I need MCP server for streaming large files to Claude                  | P1       |
| **8.6.5** | Token Budget Enforcement    | As a VP-Daemon, I need to truncate large files to fit token budget                     | P0       |
| **8.6.6** | Session File Tracking       | As Genesis-App, I need to track which files were used in which sessions                | P2       |

#### Phase 9.5: Wundr File Integration (NEW)

| ID        | Feature                            | User Story                                                          | Priority |
| --------- | ---------------------------------- | ------------------------------------------------------------------- | -------- |
| **9.5.1** | @wundr/genesis-client File Methods | As a developer, I need file download/sync methods in genesis-client | P0       |
| **9.5.2** | @wundr/file-processor Package      | As Genesis-App, I need reusable file processing utilities           | P1       |
| **9.5.3** | VP-Daemon File Sync Integration    | As VP-Daemon installer, I need to set up file sync directories      | P1       |
| **9.5.4** | Cross-Platform File Support        | As a VP, files from Slack should also be processable                | P2       |

### 10.9 File Pipeline Test Scenarios

**File Processing**:

- [ ] PDF upload triggers text extraction
- [ ] XLSX upload extracts all sheets to JSON
- [ ] Image with text triggers OCR
- [ ] Large file (>100MB) is rejected
- [ ] Processing failure is recorded and retried

**Daemon File Sync**:

- [ ] File shared in channel triggers sync event
- [ ] Daemon downloads original + extracted text
- [ ] Cache LRU eviction works correctly
- [ ] Sync status tracked in database

**Claude Session Injection**:

- [ ] Files copied to session working directory
- [ ] CLAUDE.md includes file context
- [ ] Token budget enforced (files truncated)
- [ ] MCP file server responds to queries
- [ ] Large file chunks streamed correctly

---

## 10.10 Outbound File Pipeline: VP-Daemon → Genesis-App

### 10.10.1 Overview

VP agents need to share files back to Genesis-App conversations. This includes:

1. **Session-Generated Files**: Files created during Claude Code/Flow sessions (code, reports,
   exports)
2. **Processed Outputs**: Analysis results, transformed data, generated documents
3. **Attachments to Messages**: Files shared as part of conversation responses

**Use Cases**: | Scenario | Example | |----------|---------| | **Code Delivery** | VP Engineering
generates a PR diff and shares the patch file | | **Report Generation** | VP Legal creates a
compliance report PDF from analysis | | **Data Export** | VP Finance exports processed spreadsheet
with formulas | | **Document Creation** | VP HR generates an offer letter from template | |
**Artifact Sharing** | Any VP shares session artifacts with human collaborators |

### 10.10.2 Outbound File Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    OUTBOUND FILE PIPELINE: VP-Daemon → Genesis-App              │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                CLAUDE CODE / CLAUDE FLOW SESSION                         │   │
│  │                                                                          │   │
│  │  Session generates files via:                                           │   │
│  │  • Write tool → creates files in working directory                      │   │
│  │  • Code generation → source files, configs                              │   │
│  │  • Data processing → CSV, JSON exports                                  │   │
│  │  • Document generation → reports, summaries                             │   │
│  │                                                                          │   │
│  │  Output directory: ~/vp-daemon/sessions/{sessionId}/output/             │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                          │                                      │
│                                          │ Session completion / explicit share  │
│                                          ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                         VP-DAEMON OUTPUT HANDLER                         │   │
│  │                                                                          │   │
│  │  ┌──────────────────────────────────────────────────────────────────┐  │   │
│  │  │                    OUTPUT FILE SCANNER                            │  │   │
│  │  │                                                                   │  │   │
│  │  │  • Monitors session output directories                           │  │   │
│  │  │  • Detects new/modified files                                    │  │   │
│  │  │  • Filters by sharing rules (extension, size, path patterns)     │  │   │
│  │  │  • Queues files for upload                                       │  │   │
│  │  └──────────────────────────────────────────────────────────────────┘  │   │
│  │                             │                                          │   │
│  │                             ▼                                          │   │
│  │  ┌──────────────────────────────────────────────────────────────────┐  │   │
│  │  │                    FILE UPLOAD SERVICE                            │  │   │
│  │  │                                                                   │  │   │
│  │  │  1. Request pre-signed upload URL from Genesis-App               │  │   │
│  │  │  2. Upload file directly to S3                                   │  │   │
│  │  │  3. Notify Genesis-App of upload completion                      │  │   │
│  │  │  4. Optionally attach to message/channel                         │  │   │
│  │  └──────────────────────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                          │                                      │
│                                          │ HTTPS (Daemon Auth)                 │
│                                          ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                         GENESIS-APP (Cloud)                              │   │
│  │                                                                          │   │
│  │  ┌──────────────────────────────────────────────────────────────────┐  │   │
│  │  │                    DAEMON FILE UPLOAD API                         │  │   │
│  │  │                                                                   │  │   │
│  │  │  POST /api/daemon/files/request-upload                           │  │   │
│  │  │    → Returns pre-signed S3 URL + fileId                          │  │   │
│  │  │                                                                   │  │   │
│  │  │  POST /api/daemon/files/{fileId}/complete                        │  │   │
│  │  │    → Marks upload complete, triggers processing                  │  │   │
│  │  │                                                                   │  │   │
│  │  │  POST /api/daemon/files/{fileId}/share                           │  │   │
│  │  │    → Shares file to channel/DM with optional message             │  │   │
│  │  └──────────────────────────────────────────────────────────────────┘  │   │
│  │                             │                                          │   │
│  │                             ▼                                          │   │
│  │  ┌──────────────────────────────────────────────────────────────────┐  │   │
│  │  │                    S3 / R2 STORAGE                                │  │   │
│  │  │                                                                   │  │   │
│  │  │  /{workspaceId}/files/{fileId}/                                  │  │   │
│  │  │    ├── original.{ext}                                            │  │   │
│  │  │    └── (processing triggered same as inbound files)              │  │   │
│  │  └──────────────────────────────────────────────────────────────────┘  │   │
│  │                             │                                          │   │
│  │                             ▼                                          │   │
│  │  ┌──────────────────────────────────────────────────────────────────┐  │   │
│  │  │                    CHANNEL / CONVERSATION                         │  │   │
│  │  │                                                                   │  │   │
│  │  │  File appears in conversation as message attachment               │  │   │
│  │  │  Human users can view, download, and respond                     │  │   │
│  │  └──────────────────────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 10.10.3 Daemon File Upload API Endpoints

```typescript
// apps/web/app/api/daemon/files/request-upload/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { authenticateDaemon } from '@/lib/daemon-auth';
import { prisma } from '@genesis/database';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createId } from '@paralleldrive/cuid2';

const s3 = new S3Client({ region: process.env.S3_REGION });

/**
 * POST /api/daemon/files/request-upload
 *
 * Request a pre-signed URL for uploading a file from VP-Daemon
 */
export async function POST(request: NextRequest) {
  const { serviceAccount, vpUser } = await authenticateDaemon(request);

  const body = await request.json();
  const {
    filename,
    contentType,
    sizeBytes,
    sessionId, // Optional: associate with Claude session
    channelId, // Optional: target channel for sharing
    description, // Optional: file description
  } = body;

  // Validate file size (max 100MB)
  if (sizeBytes > 100 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large. Maximum size is 100MB.' }, { status: 400 });
  }

  // Validate channel access if specified
  if (channelId) {
    const hasAccess = await prisma.channelMember.findFirst({
      where: { channelId, userId: vpUser.id },
    });
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied to channel' }, { status: 403 });
    }
  }

  // Create file record
  const fileId = createId();
  const fileType = getFileType(contentType, filename);
  const storageKey = `${serviceAccount.workspaceId}/files/${fileId}/original${getExtension(filename)}`;

  const file = await prisma.file.create({
    data: {
      id: fileId,
      filename: sanitizeFilename(filename),
      originalFilename: filename,
      mimeType: contentType,
      fileType,
      sizeBytes,
      storageKey,
      processingStatus: 'PENDING',
      workspaceId: serviceAccount.workspaceId,
      uploadedById: vpUser.id,
      channelId: channelId || null,
    },
  });

  // Generate pre-signed upload URL
  const command = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: storageKey,
    ContentType: contentType,
    ContentLength: sizeBytes,
    Metadata: {
      'uploaded-by': vpUser.id,
      'session-id': sessionId || '',
      'file-id': fileId,
    },
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });

  return NextResponse.json({
    fileId,
    uploadUrl,
    expiresIn: 3600,
    storageKey,
  });
}

// Helper functions
function getFileType(mimeType: string, filename: string): string {
  if (mimeType.startsWith('image/')) return 'IMAGE';
  if (mimeType === 'application/pdf') return 'DOCUMENT';
  if (mimeType.includes('spreadsheet') || filename.match(/\.(xlsx?|csv|ods)$/i))
    return 'SPREADSHEET';
  if (mimeType.includes('document') || filename.match(/\.(docx?|odt|rtf)$/i)) return 'DOCUMENT';
  if (mimeType.startsWith('text/') || filename.match(/\.(ts|js|py|go|rs|java|md|txt)$/i))
    return 'TEXT';
  if (mimeType === 'application/json' || filename.match(/\.(json|yaml|yml|xml|toml)$/i))
    return 'DATA';
  if (mimeType.includes('zip') || filename.match(/\.(zip|tar|gz|rar)$/i)) return 'ARCHIVE';
  return 'OTHER';
}

function getExtension(filename: string): string {
  const match = filename.match(/\.[^.]+$/);
  return match ? match[0] : '';
}

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 255);
}
```

```typescript
// apps/web/app/api/daemon/files/[fileId]/complete/route.ts

/**
 * POST /api/daemon/files/{fileId}/complete
 *
 * Mark file upload as complete and trigger processing
 */
export async function POST(request: NextRequest, { params }: { params: { fileId: string } }) {
  const { serviceAccount, vpUser } = await authenticateDaemon(request);

  const file = await prisma.file.findUnique({
    where: { id: params.fileId },
  });

  if (!file) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  // Verify ownership
  if (file.uploadedById !== vpUser.id) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  // Verify file exists in S3
  const exists = await checkS3ObjectExists(file.storageKey);
  if (!exists) {
    return NextResponse.json({ error: 'Upload not found in storage' }, { status: 400 });
  }

  // Queue for processing
  await fileProcessingQueue.add('process-file', {
    fileId: file.id,
    workspaceId: file.workspaceId,
    storageKey: file.storageKey,
    mimeType: file.mimeType,
    fileType: file.fileType,
  });

  // Update file status
  await prisma.file.update({
    where: { id: file.id },
    data: { processingStatus: 'PENDING' },
  });

  return NextResponse.json({
    success: true,
    fileId: file.id,
    processingStatus: 'PENDING',
  });
}
```

```typescript
// apps/web/app/api/daemon/files/[fileId]/share/route.ts

/**
 * POST /api/daemon/files/{fileId}/share
 *
 * Share a file to a channel or DM, optionally with a message
 */
export async function POST(request: NextRequest, { params }: { params: { fileId: string } }) {
  const { serviceAccount, vpUser } = await authenticateDaemon(request);

  const body = await request.json();
  const {
    channelId, // Required: target channel
    messageText, // Optional: accompanying message
    threadTs, // Optional: reply to thread
    mentionUserIds, // Optional: users to mention
  } = body;

  const file = await prisma.file.findUnique({
    where: { id: params.fileId },
  });

  if (!file) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  // Verify VP has access to the channel
  const hasAccess = await prisma.channelMember.findFirst({
    where: { channelId, userId: vpUser.id },
  });

  if (!hasAccess) {
    return NextResponse.json({ error: 'Access denied to channel' }, { status: 403 });
  }

  // Create message with file attachment
  const message = await prisma.message.create({
    data: {
      content: messageText || `Shared a file: ${file.filename}`,
      contentType: 'FILE',
      channelId,
      authorId: vpUser.id,
      parentId: threadTs || null,
      sentByDaemon: true,
      daemonMeta: {
        serviceAccountId: serviceAccount.id,
        action: 'file_share',
      },
    },
  });

  // Update file with channel and message association
  await prisma.file.update({
    where: { id: file.id },
    data: {
      channelId,
      messageId: message.id,
    },
  });

  // Publish real-time event
  await redis.publish(
    `channel:${channelId}:messages`,
    JSON.stringify({
      type: 'MESSAGE_CREATED',
      message: {
        ...message,
        file: {
          id: file.id,
          filename: file.filename,
          mimeType: file.mimeType,
          sizeBytes: file.sizeBytes,
          thumbnailKey: file.thumbnailKey,
          processingStatus: file.processingStatus,
        },
      },
    })
  );

  // Handle mentions
  if (mentionUserIds?.length > 0) {
    await createMentionNotifications(message.id, mentionUserIds);
  }

  return NextResponse.json({
    success: true,
    messageId: message.id,
    fileId: file.id,
    channelId,
  });
}
```

### 10.10.4 VP-Daemon Output Handler

```typescript
// packages/@wundr/genesis-client/src/output-handler.ts

import * as fs from 'fs/promises';
import * as path from 'path';
import { watch } from 'chokidar';
import { EventEmitter } from 'events';
import { GenesisClient } from './genesis-client';

export interface OutputHandlerConfig {
  /** Base directory for session outputs */
  sessionsDir: string;
  /** File patterns to include for sharing */
  includePatterns: string[];
  /** File patterns to exclude from sharing */
  excludePatterns: string[];
  /** Maximum file size to upload (bytes) */
  maxFileSize: number;
  /** Auto-share files on session completion */
  autoShareOnComplete: boolean;
  /** Watch for file changes in real-time */
  watchMode: boolean;
}

export interface OutputFile {
  sessionId: string;
  filename: string;
  localPath: string;
  sizeBytes: number;
  mimeType: string;
  createdAt: Date;
  modifiedAt: Date;
}

export interface ShareOptions {
  channelId: string;
  messageText?: string;
  threadTs?: string;
  mentionUserIds?: string[];
}

const DEFAULT_CONFIG: OutputHandlerConfig = {
  sessionsDir: path.join(process.env.HOME || '~', 'vp-daemon/sessions'),
  includePatterns: [
    '**/*.pdf',
    '**/*.docx',
    '**/*.xlsx',
    '**/*.csv',
    '**/*.json',
    '**/*.md',
    '**/*.txt',
    '**/*.png',
    '**/*.jpg',
    '**/output/**/*',
    '**/exports/**/*',
    '**/reports/**/*',
  ],
  excludePatterns: ['**/node_modules/**', '**/.git/**', '**/.*', '**/*.log', '**/CLAUDE.md'],
  maxFileSize: 100 * 1024 * 1024, // 100MB
  autoShareOnComplete: false,
  watchMode: false,
};

export class OutputHandler extends EventEmitter {
  private readonly config: OutputHandlerConfig;
  private readonly client: GenesisClient;
  private watcher: ReturnType<typeof watch> | null = null;
  private pendingUploads: Map<string, OutputFile> = new Map();

  constructor(client: GenesisClient, config: Partial<OutputHandlerConfig> = {}) {
    super();
    this.client = client;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize the output handler
   */
  async initialize(): Promise<void> {
    await fs.mkdir(this.config.sessionsDir, { recursive: true });

    if (this.config.watchMode) {
      this.startWatching();
    }
  }

  /**
   * Start watching session directories for new files
   */
  private startWatching(): void {
    const watchPath = path.join(this.config.sessionsDir, '*/output/**/*');

    this.watcher = watch(watchPath, {
      ignored: this.config.excludePatterns,
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 100,
      },
    });

    this.watcher
      .on('add', filePath => this.onFileCreated(filePath))
      .on('change', filePath => this.onFileModified(filePath))
      .on('error', error => this.emit('error', error));
  }

  /**
   * Handle new file creation
   */
  private async onFileCreated(filePath: string): Promise<void> {
    const outputFile = await this.parseOutputFile(filePath);
    if (outputFile && this.shouldIncludeFile(outputFile)) {
      this.emit('file:created', outputFile);
      this.pendingUploads.set(filePath, outputFile);
    }
  }

  /**
   * Handle file modification
   */
  private async onFileModified(filePath: string): Promise<void> {
    const outputFile = await this.parseOutputFile(filePath);
    if (outputFile && this.shouldIncludeFile(outputFile)) {
      this.emit('file:modified', outputFile);
      this.pendingUploads.set(filePath, outputFile);
    }
  }

  /**
   * Scan a session directory for output files
   */
  async scanSessionOutputs(sessionId: string): Promise<OutputFile[]> {
    const sessionDir = path.join(this.config.sessionsDir, sessionId);
    const outputDir = path.join(sessionDir, 'output');

    try {
      await fs.access(outputDir);
    } catch {
      return [];
    }

    const files = await this.walkDirectory(outputDir);
    const outputFiles: OutputFile[] = [];

    for (const filePath of files) {
      const outputFile = await this.parseOutputFile(filePath);
      if (outputFile && this.shouldIncludeFile(outputFile)) {
        outputFiles.push(outputFile);
      }
    }

    return outputFiles;
  }

  /**
   * Upload a file to Genesis-App
   */
  async uploadFile(outputFile: OutputFile): Promise<{ fileId: string; success: boolean }> {
    try {
      // Request upload URL
      const uploadRequest = await this.client.requestFileUpload({
        filename: outputFile.filename,
        contentType: outputFile.mimeType,
        sizeBytes: outputFile.sizeBytes,
        sessionId: outputFile.sessionId,
      });

      // Read file and upload to S3
      const fileBuffer = await fs.readFile(outputFile.localPath);

      const uploadResponse = await fetch(uploadRequest.uploadUrl, {
        method: 'PUT',
        body: fileBuffer,
        headers: {
          'Content-Type': outputFile.mimeType,
          'Content-Length': outputFile.sizeBytes.toString(),
        },
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.status}`);
      }

      // Mark upload complete
      await this.client.completeFileUpload(uploadRequest.fileId);

      this.emit('file:uploaded', { outputFile, fileId: uploadRequest.fileId });
      return { fileId: uploadRequest.fileId, success: true };
    } catch (error) {
      this.emit('file:upload-failed', { outputFile, error });
      throw error;
    }
  }

  /**
   * Upload and share a file to a channel
   */
  async uploadAndShare(
    outputFile: OutputFile,
    options: ShareOptions
  ): Promise<{ fileId: string; messageId: string }> {
    // Upload the file first
    const { fileId } = await this.uploadFile(outputFile);

    // Share to channel
    const shareResult = await this.client.shareFile(fileId, {
      channelId: options.channelId,
      messageText: options.messageText,
      threadTs: options.threadTs,
      mentionUserIds: options.mentionUserIds,
    });

    this.emit('file:shared', { outputFile, fileId, messageId: shareResult.messageId });
    return { fileId, messageId: shareResult.messageId };
  }

  /**
   * Upload all pending outputs from a completed session
   */
  async uploadSessionOutputs(
    sessionId: string,
    options?: { shareToChannel?: string; autoShare?: boolean }
  ): Promise<{ uploaded: string[]; failed: string[] }> {
    const outputs = await this.scanSessionOutputs(sessionId);
    const uploaded: string[] = [];
    const failed: string[] = [];

    for (const output of outputs) {
      try {
        const { fileId } = await this.uploadFile(output);
        uploaded.push(fileId);

        // Auto-share if channel specified
        if (options?.shareToChannel && options?.autoShare) {
          await this.client.shareFile(fileId, {
            channelId: options.shareToChannel,
            messageText: `Session output: ${output.filename}`,
          });
        }
      } catch (error) {
        failed.push(output.localPath);
        this.emit('error', { file: output, error });
      }
    }

    return { uploaded, failed };
  }

  // Helper methods

  private async parseOutputFile(filePath: string): Promise<OutputFile | null> {
    try {
      const stat = await fs.stat(filePath);
      if (!stat.isFile()) return null;

      // Extract session ID from path
      const relativePath = path.relative(this.config.sessionsDir, filePath);
      const sessionId = relativePath.split(path.sep)[0];

      return {
        sessionId,
        filename: path.basename(filePath),
        localPath: filePath,
        sizeBytes: stat.size,
        mimeType: this.getMimeType(filePath),
        createdAt: stat.birthtime,
        modifiedAt: stat.mtime,
      };
    } catch {
      return null;
    }
  }

  private shouldIncludeFile(file: OutputFile): boolean {
    // Check size limit
    if (file.sizeBytes > this.config.maxFileSize) {
      return false;
    }

    // Check include patterns
    const matchesInclude = this.config.includePatterns.some(pattern =>
      this.matchGlob(file.localPath, pattern)
    );

    // Check exclude patterns
    const matchesExclude = this.config.excludePatterns.some(pattern =>
      this.matchGlob(file.localPath, pattern)
    );

    return matchesInclude && !matchesExclude;
  }

  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.csv': 'text/csv',
      '.json': 'application/json',
      '.md': 'text/markdown',
      '.txt': 'text/plain',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.ts': 'text/typescript',
      '.js': 'text/javascript',
      '.py': 'text/x-python',
      '.html': 'text/html',
      '.css': 'text/css',
      '.yaml': 'text/yaml',
      '.yml': 'text/yaml',
      '.xml': 'application/xml',
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  private matchGlob(filePath: string, pattern: string): boolean {
    // Simplified glob matching (use minimatch in production)
    const regexPattern = pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*').replace(/\?/g, '.');
    return new RegExp(regexPattern).test(filePath);
  }

  private async walkDirectory(dir: string): Promise<string[]> {
    const files: string[] = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await this.walkDirectory(fullPath)));
      } else {
        files.push(fullPath);
      }
    }

    return files;
  }

  /**
   * Stop the output handler
   */
  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
  }
}
```

### 10.10.5 Genesis Client File Methods

```typescript
// packages/@wundr/genesis-client/src/genesis-client.ts (extended)

export class GenesisClient extends EventEmitter implements CommunicationClient {
  // ... existing methods ...

  // ==========================================================================
  // OUTBOUND FILE METHODS
  // ==========================================================================

  /**
   * Request a pre-signed URL for uploading a file
   */
  async requestFileUpload(params: {
    filename: string;
    contentType: string;
    sizeBytes: number;
    sessionId?: string;
    channelId?: string;
    description?: string;
  }): Promise<{ fileId: string; uploadUrl: string; expiresIn: number }> {
    return this.apiCall('POST', '/files/request-upload', params);
  }

  /**
   * Mark a file upload as complete
   */
  async completeFileUpload(fileId: string): Promise<{ success: boolean }> {
    return this.apiCall('POST', `/files/${fileId}/complete`);
  }

  /**
   * Share a file to a channel or DM
   */
  async shareFile(
    fileId: string,
    options: {
      channelId: string;
      messageText?: string;
      threadTs?: string;
      mentionUserIds?: string[];
    }
  ): Promise<{ messageId: string; fileId: string }> {
    return this.apiCall('POST', `/files/${fileId}/share`, options);
  }

  /**
   * Upload a local file and optionally share it
   */
  async uploadFile(
    filePath: string,
    options?: {
      channelId?: string;
      messageText?: string;
      threadTs?: string;
    }
  ): Promise<{ fileId: string; messageId?: string }> {
    const stat = await fs.stat(filePath);
    const filename = path.basename(filePath);
    const contentType = this.getMimeType(filePath);

    // Request upload URL
    const { fileId, uploadUrl } = await this.requestFileUpload({
      filename,
      contentType,
      sizeBytes: stat.size,
      channelId: options?.channelId,
    });

    // Upload to S3
    const fileBuffer = await fs.readFile(filePath);
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      body: fileBuffer,
      headers: {
        'Content-Type': contentType,
        'Content-Length': stat.size.toString(),
      },
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status}`);
    }

    // Complete upload
    await this.completeFileUpload(fileId);

    // Share if channel specified
    let messageId: string | undefined;
    if (options?.channelId) {
      const shareResult = await this.shareFile(fileId, {
        channelId: options.channelId,
        messageText: options.messageText,
        threadTs: options.threadTs,
      });
      messageId = shareResult.messageId;
    }

    return { fileId, messageId };
  }

  /**
   * Send a message with file attachment
   */
  async sendMessageWithFile(
    channelId: string,
    text: string,
    filePath: string,
    options?: { threadTs?: string }
  ): Promise<{ messageId: string; fileId: string }> {
    const { fileId } = await this.uploadFile(filePath);

    const shareResult = await this.shareFile(fileId, {
      channelId,
      messageText: text,
      threadTs: options?.threadTs,
    });

    return { messageId: shareResult.messageId, fileId };
  }
}
```

### 10.10.6 Session Integration for File Outputs

```typescript
// packages/@wundr/vp-daemon/src/session-spawner.ts (extended)

export class SessionSpawner {
  private readonly outputHandler: OutputHandler;

  constructor(fileSyncService: FileSyncService, outputHandler: OutputHandler) {
    this.fileSyncService = fileSyncService;
    this.outputHandler = outputHandler;
  }

  async spawnClaudeCodeSession(options: SpawnSessionOptions): Promise<ClaudeSession> {
    // ... existing session setup ...

    // Create output directory for this session
    const outputDir = path.join(sessionDir, 'output');
    await fs.mkdir(outputDir, { recursive: true });

    // Add output instructions to CLAUDE.md
    const claudeMd = await this.generateSessionClaudeMd(archetype, fileContext);
    const claudeMdWithOutput =
      claudeMd +
      `

## Output Files

When generating files that should be shared back to the conversation:

1. Save files to the \`./output/\` directory
2. Supported formats: PDF, DOCX, XLSX, CSV, JSON, MD, TXT, images
3. Files in \`./output/\` will be automatically uploaded when the session completes
4. Use descriptive filenames (e.g., \`quarterly-report-Q4-2024.pdf\`)

Example:
\`\`\`
Write "./output/analysis-results.json" with the analysis data
Write "./output/summary-report.md" with the human-readable summary
\`\`\`
`;

    await fs.writeFile(path.join(sessionDir, 'CLAUDE.md'), claudeMdWithOutput);

    // Spawn Claude process
    const claudeProcess = spawn(
      'claude',
      [
        /* ... */
      ],
      {
        cwd: sessionDir,
        env: { ...process.env, CLAUDE_SESSION_ID: sessionId },
      }
    );

    const session = new ClaudeSession(sessionId, claudeProcess, fileContext);

    // Handle session completion
    session.on('complete', async () => {
      await this.handleSessionComplete(sessionId, options);
    });

    return session;
  }

  /**
   * Handle session completion - upload outputs
   */
  private async handleSessionComplete(
    sessionId: string,
    options: SpawnSessionOptions
  ): Promise<void> {
    if (!options.outputChannelId) return;

    try {
      const { uploaded, failed } = await this.outputHandler.uploadSessionOutputs(sessionId, {
        shareToChannel: options.outputChannelId,
        autoShare: true,
      });

      if (uploaded.length > 0) {
        console.log(`Session ${sessionId}: Uploaded ${uploaded.length} output files`);
      }

      if (failed.length > 0) {
        console.warn(`Session ${sessionId}: Failed to upload ${failed.length} files`);
      }
    } catch (error) {
      console.error(`Session ${sessionId}: Output upload failed:`, error);
    }
  }
}

// Extended options
export interface SpawnSessionOptions {
  sessionId: string;
  archetype: string;
  prompt: string;
  fileIds?: string[];
  tokenBudget?: number;
  injectionMethod?: 'context' | 'working_dir' | 'mcp' | 'all';

  // NEW: Output handling
  outputChannelId?: string; // Channel to share outputs to
  autoUploadOutputs?: boolean; // Auto-upload on session complete
}
```

### 10.10.7 Backlog: Outbound File Pipeline

#### Phase 8.7: Daemon File Upload (NEW)

| ID        | Feature                 | User Story                                                                  | Priority |
| --------- | ----------------------- | --------------------------------------------------------------------------- | -------- |
| **8.7.1** | File Upload Request API | As a VP-Daemon, I need to request pre-signed URLs for uploading files       | P0       |
| **8.7.2** | Direct S3 Upload        | As a VP-Daemon, I need to upload files directly to S3 using pre-signed URLs | P0       |
| **8.7.3** | Upload Completion API   | As a VP-Daemon, I need to notify Genesis-App when upload is complete        | P0       |
| **8.7.4** | File Share API          | As a VP-Daemon, I need to share uploaded files to channels/DMs              | P0       |
| **8.7.5** | Upload Progress Events  | As a VP-Daemon, I want to emit progress events during large uploads         | P2       |
| **8.7.6** | Chunked Upload Support  | As a VP-Daemon, I need to upload large files in chunks for reliability      | P2       |

#### Phase 8.8: Session Output Handling (NEW)

| ID        | Feature                         | User Story                                                               | Priority |
| --------- | ------------------------------- | ------------------------------------------------------------------------ | -------- |
| **8.8.1** | Output Directory Convention     | As Claude, I need a designated output directory for shareable files      | P0       |
| **8.8.2** | Output File Scanner             | As VP-Daemon, I need to scan session output directories for files        | P0       |
| **8.8.3** | Auto-Upload on Session Complete | As VP-Daemon, I want outputs auto-uploaded when sessions complete        | P1       |
| **8.8.4** | File Watch Mode                 | As VP-Daemon, I want real-time detection of new output files             | P2       |
| **8.8.5** | Output Filtering Rules          | As VP-Daemon, I need to filter which outputs to upload (by pattern/size) | P1       |
| **8.8.6** | Batch Output Sharing            | As VP-Daemon, I need to share multiple outputs in a single message       | P2       |

#### Phase 8.9: Multi-Party File Sharing (NEW)

| ID        | Feature                 | User Story                                                           | Priority |
| --------- | ----------------------- | -------------------------------------------------------------------- | -------- |
| **8.9.1** | Channel File Sharing    | As a VP, I need to share files to public/private channels            | P0       |
| **8.9.2** | DM File Sharing         | As a VP, I need to share files in direct messages                    | P0       |
| **8.9.3** | Thread File Replies     | As a VP, I need to share files as thread replies                     | P1       |
| **8.9.4** | File with Mentions      | As a VP, I need to share files with @mentions to notify users        | P1       |
| **8.9.5** | Multi-Channel Broadcast | As a VP, I need to share the same file to multiple channels          | P2       |
| **8.9.6** | File Access Permissions | As Genesis-App, I need to enforce channel membership for file access | P0       |

### 10.10.8 Test Scenarios: Outbound Files

**File Upload**:

- [ ] VP-Daemon requests upload URL successfully
- [ ] File uploads directly to S3 via pre-signed URL
- [ ] Upload completion triggers processing
- [ ] Large file (>50MB) uploads successfully
- [ ] Invalid file type is rejected
- [ ] Unauthorized upload attempt fails

**Session Outputs**:

- [ ] Files in ./output/ directory are detected
- [ ] Session completion triggers output upload
- [ ] Multiple outputs uploaded in sequence
- [ ] File watch mode detects new files in real-time
- [ ] Output filtering excludes .log and .git files

**Channel Sharing**:

- [ ] File shared to channel appears in conversation
- [ ] File shared with message text displays correctly
- [ ] Thread reply with file works
- [ ] Mentions in file share trigger notifications
- [ ] VP without channel access cannot share
- [ ] File thumbnail/preview displays in UI

---

## 11. Appendices

### Appendix A: Environment Variables

```bash
# =============================================================================
# GENESIS-APP ENVIRONMENT VARIABLES
# =============================================================================

# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/genesis_app"
DIRECT_URL="postgresql://user:pass@localhost:5432/genesis_app"

# Redis
REDIS_URL="redis://localhost:6379"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key"

# OAuth Providers
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."

# LiveKit
LIVEKIT_URL="wss://your-livekit-server"
LIVEKIT_API_KEY="..."
LIVEKIT_API_SECRET="..."

# S3/Storage
S3_BUCKET="genesis-app-files"
S3_REGION="us-east-1"
AWS_ACCESS_KEY_ID="..."
AWS_SECRET_ACCESS_KEY="..."

# Daemon API
DAEMON_JWT_SECRET="your-daemon-jwt-secret"
DAEMON_DEFAULT_RATE_LIMIT="1000"

# =============================================================================
# VP-DAEMON ENVIRONMENT VARIABLES (per machine)
# =============================================================================

# Genesis-App Integration
GENESIS_API_ENDPOINT="https://genesis-app.example.com/api/daemon"
GENESIS_API_KEY="gsk_..."
GENESIS_WS_ENDPOINT="wss://genesis-app.example.com/api/daemon/events"

# Slack Integration (optional, can run alongside genesis)
SLACK_USER_TOKEN="xoxp-..."
SLACK_BOT_TOKEN="xoxb-..."
SLACK_APP_TOKEN="xapp-..."
SLACK_SIGNING_SECRET="..."

# VP Identity
VP_NAME="Chief Technology Officer"
VP_FIRST_NAME="CTO"
VP_LAST_NAME="Agent"
VP_EMAIL="cto@acme.genesis.local"
```

### Appendix B: Glossary

| Term                       | Definition                                                        |
| -------------------------- | ----------------------------------------------------------------- |
| **Genesis-App**            | The Slack-clone enterprise communication platform                 |
| **VP (Virtual Principal)** | Tier-1 AI agent representing an executive role                    |
| **VP-Daemon**              | Machine-level supervisor process managing VP sessions             |
| **Discipline**             | Functional area within an organization (e.g., Engineering, Legal) |
| **Service Account**        | Machine credentials for VP-Daemon authentication                  |
| **Org-Genesis**            | Wundr package for generating organizational structures            |
| **CommunicationClient**    | Shared interface for Slack/Genesis-App clients                    |

### Appendix C: Related Documentation

- [Original Slack Clone Feature Backlog](./Slack%20Clone%20Feature%20Backlog%20%26%20Setup.md)
- [@wundr/org-genesis Package Documentation](../../packages/@wundr/org-genesis/README.md)
- [@wundr/slack-agent Package Documentation](../../packages/@wundr/slack-agent/README.md)
- [@wundr/computer-setup VP-Daemon Documentation](../../packages/@wundr/computer-setup/docs/VP_DAEMON.md)

---

## Document History

| Version | Date       | Author            | Changes               |
| ------- | ---------- | ----------------- | --------------------- |
| 1.0.0   | 2024-11-24 | Architecture Team | Initial specification |

---

_This document is part of the Wundr Genesis-App project. For questions or contributions, see the
project repository._
