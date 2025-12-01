# Genesis-App Autonomous Implementation Prompt

**Copy and paste everything below this line into a fresh Claude Code session:**

---

## Mission: Autonomous Genesis-App Implementation

You are tasked with implementing the **Genesis-App** - a comprehensive enterprise communication
platform with VP-Daemon integration. You must work through the implementation **fully autonomously**
using parallel swarm-based execution.

### Primary Reference Document

**READ THIS FIRST - It contains the complete specification:**

```
docs/new/Genesis-App Integration Specification.md
```

This document contains:

- Complete system architecture
- Prisma database schema
- 10 implementation phases with detailed backlogs
- API contracts (GraphQL + REST)
- TypeScript implementations for all components
- File pipeline (inbound + outbound)
- Test scenarios

### Execution Protocol

You will implement the Genesis-App in **successive waves**, with each wave completing one phase from
the specification. Each wave deploys **20 parallel agents** working simultaneously.

#### Wave Execution Pattern

```
FOR EACH PHASE in [0, 0.5, 1, 1.5, 2, 3, 3.5, 4, 4.5, 5, 6, 7, 8, 8.5, 8.6, 8.7, 8.8, 8.9, 9, 9.5]:

  1. ANNOUNCE: "🚀 WAVE {PHASE}: {PHASE_NAME} - Launching 20 parallel agents"

  2. SPAWN 20 AGENTS in parallel using Task tool with appropriate agent types:
     - Use 'software-engineer' for core implementation
     - Use 'frontend-engineer' for UI components
     - Use 'backend-engineer' for API/database work
     - Use 'api-engineer' for GraphQL/REST endpoints
     - Use 'tester' for test file creation
     - Use 'reviewer' for code quality checks

  3. WAIT for all agents to complete

  4. VERIFY wave completion:
     a. Run: pnpm lint --fix
     b. Run: pnpm typecheck
     c. Run: pnpm build

  5. IF any command fails:
     - Analyze errors
     - Spawn fix agents to resolve issues
     - Repeat step 4 until ALL PASS

  6. COMMIT changes:
     git add -A
     git commit -m "feat(genesis-app): Phase {PHASE} - {PHASE_NAME}

     - [List key deliverables]

     🤖 Generated with Claude Code"

  7. PUSH to origin:
     git push origin master

  8. ANNOUNCE: "✅ WAVE {PHASE} COMPLETE - Proceeding to next phase"

END FOR
```

### Phase Breakdown

Execute these phases in order:

| Wave | Phase | Name                | Key Deliverables                         |
| ---- | ----- | ------------------- | ---------------------------------------- |
| 1    | 0     | Infrastructure      | Monorepo setup, Turborepo, Docker, CI/CD |
| 2    | 0.5   | Schema Extensions   | Prisma schema with VP/org-genesis models |
| 3    | 1     | Authentication      | NextAuth, OAuth, org-genesis wizard UI   |
| 4    | 1.5   | VP Provisioning     | VP user creation, service accounts       |
| 5    | 2     | Messaging Core      | Real-time chat, threads, optimistic UI   |
| 6    | 3     | Organization        | Channels, RBAC, discipline mapping       |
| 7    | 3.5   | Presence            | Redis presence, daemon heartbeat         |
| 8    | 4     | Rich Media          | S3 uploads, image optimization           |
| 9    | 4.5   | File Processing     | PDF/XLSX/DOCX extraction, OCR            |
| 10   | 5     | Voice/Video         | LiveKit integration, huddles             |
| 11   | 6     | Native Polish       | Push notifications, offline queue        |
| 12   | 7     | Enterprise          | Search, audit logs, retention            |
| 13   | 8     | VP-Daemon Gateway   | Machine auth, daemon API                 |
| 14   | 8.5   | Daemon File Sync    | Inbound file pipeline                    |
| 15   | 8.6   | Session Injection   | Claude session file context              |
| 16   | 8.7   | Daemon Upload       | Outbound file pipeline                   |
| 17   | 8.8   | Session Outputs     | Auto-upload session files                |
| 18   | 8.9   | Multi-Party Sharing | Channel/DM file sharing                  |
| 19   | 9     | Wundr Refactor      | Package extraction, interfaces           |
| 20   | 9.5   | Wundr Integration   | genesis-client package                   |

### Quality Standards (MANDATORY)

Every file produced must meet these standards:

#### 1. TypeScript Strict Mode

```typescript
// tsconfig.json must include:
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

#### 2. JSDoc Documentation

Every exported function, class, type, and interface MUST have JSDoc:

````typescript
/**
 * Creates a new Genesis-App client for VP-Daemon communication.
 *
 * @param config - Client configuration options
 * @param config.apiEndpoint - The Genesis-App API endpoint URL
 * @param config.apiKey - Service account API key for authentication
 * @returns Configured GenesisClient instance
 *
 * @example
 * ```typescript
 * const client = createGenesisClient({
 *   apiEndpoint: 'https://genesis.example.com/api/daemon',
 *   apiKey: 'gsk_xxx',
 * });
 * await client.start();
 * ```
 *
 * @throws {AuthenticationError} If API key is invalid
 * @see {@link GenesisClient}
 */
export function createGenesisClient(config: GenesisClientConfig): GenesisClient {
  // ...
}
````

#### 3. README Documentation

Each package/app MUST have a README.md with:

- Overview and purpose
- Installation instructions
- Configuration options
- Usage examples
- API reference summary
- Contributing guidelines

#### 4. Lint Rules

Must pass ESLint with zero errors:

```bash
pnpm lint
# Exit code: 0
```

#### 5. Type Safety

Must pass TypeScript with zero errors:

```bash
pnpm typecheck
# Exit code: 0
```

#### 6. Build Success

Must build successfully:

```bash
pnpm build
# Exit code: 0
```

### Project Structure to Create

```
genesis-app/                          # New monorepo (create in packages/@wundr/)
├── apps/
│   ├── web/                          # Next.js 14 app
│   │   ├── app/
│   │   │   ├── (auth)/
│   │   │   ├── (workspace)/
│   │   │   ├── api/
│   │   │   │   ├── graphql/
│   │   │   │   ├── auth/
│   │   │   │   └── daemon/
│   │   │   └── org-genesis/
│   │   ├── components/
│   │   ├── lib/
│   │   └── README.md
│   ├── desktop/                      # Electron
│   │   ├── electron/
│   │   └── README.md
│   └── mobile/                       # Capacitor config
│       └── README.md
├── packages/
│   ├── @genesis/ui/                  # Shared UI (Shadcn)
│   │   ├── src/
│   │   └── README.md
│   ├── @genesis/database/            # Prisma
│   │   ├── prisma/
│   │   ├── src/
│   │   └── README.md
│   ├── @genesis/api-types/           # GraphQL types
│   │   ├── src/
│   │   └── README.md
│   ├── @genesis/daemon-sdk/          # VP-Daemon SDK
│   │   ├── src/
│   │   └── README.md
│   ├── @genesis/file-processor/      # File processing
│   │   ├── src/
│   │   └── README.md
│   └── @genesis/org-integration/     # Org-genesis utils
│       ├── src/
│       └── README.md
├── docker-compose.yml
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
├── tsconfig.json
├── .eslintrc.js
└── README.md                         # Root README with full docs
```

### Agent Task Templates

When spawning agents, use these task templates:

#### Infrastructure Agent (Phase 0)

```
You are implementing Phase 0 of the Genesis-App.

Reference: docs/new/Genesis-App Integration Specification.md - Section 4.2

Your task: [SPECIFIC TASK]

Requirements:
1. Create all files in packages/@wundr/genesis-app/
2. Use TypeScript strict mode
3. Add comprehensive JSDoc to all exports
4. Ensure lint/typecheck/build pass
5. Create README.md for your component

Output the files you created and any issues encountered.
```

#### API Engineer Agent (Phases 8.x)

```
You are implementing the VP-Daemon Gateway API for Genesis-App.

Reference: docs/new/Genesis-App Integration Specification.md - Section 10.10

Your task: [SPECIFIC ENDPOINT]

Requirements:
1. Follow the API contract exactly as specified
2. Implement proper authentication via authenticateDaemon()
3. Add input validation with Zod
4. Include comprehensive error handling
5. Add JSDoc with @example blocks
6. Create corresponding test file

Output the implementation and test files.
```

#### Frontend Engineer Agent (Phases 1, 2, 3)

```
You are implementing UI components for Genesis-App.

Reference: docs/new/Genesis-App Integration Specification.md - Section 4.4

Your task: [SPECIFIC COMPONENT]

Requirements:
1. Use React Server Components where possible
2. Use Shadcn/ui and Radix primitives
3. Implement with TypeScript strict mode
4. Add Storybook stories if applicable
5. Ensure accessibility (WCAG 2.1 AA)
6. Add JSDoc to component props

Output the component files.
```

### Verification Commands

After each wave, run these commands in sequence:

```bash
# 1. Fix any auto-fixable lint issues
cd packages/@wundr/genesis-app && pnpm lint --fix

# 2. Verify no lint errors remain
cd packages/@wundr/genesis-app && pnpm lint

# 3. Verify type safety
cd packages/@wundr/genesis-app && pnpm typecheck

# 4. Verify build succeeds
cd packages/@wundr/genesis-app && pnpm build

# 5. Run tests (if applicable)
cd packages/@wundr/genesis-app && pnpm test
```

### Git Commit Convention

Use conventional commits:

```
feat(genesis-app): Phase X.X - Description

- Deliverable 1
- Deliverable 2
- Deliverable 3

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>
```

### Error Recovery Protocol

If any verification step fails:

1. **Lint Errors**:
   - Run `pnpm lint --fix` first
   - Spawn 'reviewer' agents to fix remaining issues

2. **Type Errors**:
   - Spawn 'software-engineer' agents targeting specific files
   - Provide the exact error messages in the prompt

3. **Build Errors**:
   - Analyze the build output
   - Fix missing dependencies, circular imports, etc.
   - Spawn targeted fix agents

4. **Test Failures**:
   - Spawn 'tester' agents to fix failing tests
   - Do not skip tests - fix them

### Session State Tracking

Maintain a todo list throughout execution:

```
Wave 1 (Phase 0): ✅ Complete
Wave 2 (Phase 0.5): ✅ Complete
Wave 3 (Phase 1): 🔄 In Progress
  - [x] NextAuth setup
  - [x] OAuth providers
  - [ ] Org-genesis wizard (in progress)
  - [ ] Service account auth
Wave 4 (Phase 1.5): ⏳ Pending
...
```

### BEGIN EXECUTION

Start now by:

1. Reading the full specification document:

   ```
   Read docs/new/Genesis-App Integration Specification.md
   ```

2. Creating the initial monorepo structure (Phase 0)

3. Launching Wave 1 with 20 parallel agents

4. Continue autonomously through all phases

**IMPORTANT**: Do not stop until ALL phases are complete and the entire Genesis-App is
production-ready.

---

## Execution Checklist (For Claude Code)

- [ ] Read specification document completely
- [ ] Create monorepo structure
- [ ] Wave 1 (Phase 0): Infrastructure ✅
- [ ] Wave 2 (Phase 0.5): Schema ✅
- [ ] Wave 3 (Phase 1): Auth ✅
- [ ] Wave 4 (Phase 1.5): VP Provisioning ✅
- [ ] Wave 5 (Phase 2): Messaging ✅
- [ ] Wave 6 (Phase 3): Organization ✅
- [ ] Wave 7 (Phase 3.5): Presence ✅
- [ ] Wave 8 (Phase 4): Media ✅
- [ ] Wave 9 (Phase 4.5): File Processing ✅
- [ ] Wave 10 (Phase 5): Voice/Video ✅
- [ ] Wave 11 (Phase 6): Native ✅
- [ ] Wave 12 (Phase 7): Enterprise ✅
- [ ] Wave 13 (Phase 8): Daemon Gateway ✅
- [ ] Wave 14 (Phase 8.5): File Sync ✅
- [ ] Wave 15 (Phase 8.6): Session Injection ✅
- [ ] Wave 16 (Phase 8.7): Daemon Upload ✅
- [ ] Wave 17 (Phase 8.8): Session Outputs ✅
- [ ] Wave 18 (Phase 8.9): Multi-Party Sharing ✅
- [ ] Wave 19 (Phase 9): Wundr Refactor ✅
- [ ] Wave 20 (Phase 9.5): Wundr Integration ✅
- [ ] Final verification: lint ✅ typecheck ✅ build ✅
- [ ] Final push to origin/master ✅
- [ ] Project complete 🎉

**GO.**
