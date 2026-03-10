# Production-Readiness Backlog

**Generated:** 2026-03-11 **Total Issues Found:** 400+ **Packages Audited:** 40+ **Source Files
Scanned:** 6,537

---

## Executive Summary

Full codebase audit identified production-readiness issues across 5 severity tiers. This backlog
organizes all findings into actionable work items grouped by wave for parallel implementation.

### Issue Distribution

| Severity | Count  | Description                                                                   |
| -------- | ------ | ----------------------------------------------------------------------------- |
| CRITICAL | 45+    | Blocks production deployment - security vulnerabilities, broken core features |
| HIGH     | 80+    | Must fix before release - mock implementations, stub modules, fake data       |
| MEDIUM   | 150+   | Should fix - console logging, silent errors, missing validation               |
| LOW      | 100+   | Nice to have - documentation, type safety improvements                        |
| CLEAN    | 3 pkgs | Production-ready: agent-memory, agent-observability, governance               |

---

## WAVE 1: Critical Security & Broken Core (20 agents)

### W1-01: Replace XOR encryption with AES-256-GCM

- **Package:** @wundr/security
- **File:** `packages/@wundr/security/src/credential/CredentialManager.ts`
- **Lines:** 326-340, 382-420
- **Issue:** XOR cipher used for credential encryption (comment says "for demonstration"). MD5 used
  for legacy key derivation.
- **Fix:** Replace with `crypto.createCipheriv('aes-256-gcm')`, implement PBKDF2 with 100k+
  iterations and random salt. Remove MD5 entirely.
- **Priority:** CRITICAL

### W1-02: Implement real security alert notifications

- **Package:** @wundr/security
- **File:** `packages/@wundr/security/src/monitoring/SecurityMonitor.ts`
- **Lines:** 597-617
- **Issue:** Email, webhook, and Slack alert methods are ALL mocked - just log "Would send..."
- **Fix:** Implement actual notifications using nodemailer (email), fetch (webhook), and Slack
  webhook API.
- **Priority:** CRITICAL

### W1-03: Fix mock compliance assessment and evidence collection

- **Package:** @wundr/security
- **File:** `packages/@wundr/security/src/compliance/ComplianceReporter.ts`
- **Lines:** 376-400, 476-480, 519
- **Issue:** Compliance assessments are fake (based on assumed status), evidence collection returns
  empty arrays, PDF export writes "Mock PDF content".
- **Fix:** Implement real control verification, evidence gathering, proper PDF generation with
  pdfkit.
- **Priority:** CRITICAL

### W1-04: Fix Neolith daemon auth - replace base64 with bcrypt

- **Package:** @wundr/neolith
- **File:** `packages/@wundr/neolith/packages/@neolith/core/src/services/daemon-auth-service.ts`
- **Lines:** 168-175, 390
- **Issue:** API keys hashed with simple base64 (not cryptographic), direct string comparison
  without timing-attack protection.
- **Fix:** Use bcrypt/argon2 for key hashing, crypto.timingSafeEqual for comparison.
- **Priority:** CRITICAL

### W1-05: Replace random metrics with real system metrics

- **Package:** @wundr/ai-integration
- **File:** `packages/@wundr/ai-integration/src/monitoring/MetricsCollector.ts`
- **Lines:** 20-29
- **Issue:** `collectMetrics()` returns completely random data via Math.random().
- **Fix:** Use os module for CPU/memory, actual counters for requests, real latency tracking.
- **Priority:** CRITICAL

### W1-06: Fix simulated performance analyzer

- **Package:** @wundr/ai-integration
- **File:** `packages/@wundr/ai-integration/src/monitoring/PerformanceAnalyzer.ts`
- **Lines:** 664-678
- **Issue:** All metrics simulated with Math.random() ranges.
- **Fix:** Collect real performance data from system and application metrics.
- **Priority:** CRITICAL

### W1-07: Fix silent embedding fallback to mock mode

- **Package:** @wundr/mcp-server
- **File:** `packages/@wundr/mcp-server/src/services/gemini/index.ts`
- **Lines:** 484-519
- **Issue:** When API key missing, silently falls back to hash-based fake embeddings.
- **Fix:** Throw clear error when API key missing, never silently degrade to fake embeddings.
- **Priority:** CRITICAL

### W1-08: Fix simulated MCP tool execution

- **Package:** @wundr/ai-integration
- **File:** `packages/@wundr/ai-integration/src/core/MCPToolsRegistry.ts`
- **Lines:** 724-735
- **Issue:** Returns `result: 'simulated-execution'` instead of actually executing tools.
- **Fix:** Implement real tool execution via MCP protocol.
- **Priority:** CRITICAL

### W1-09: Replace mock org-genesis with real engine

- **Package:** @wundr/org-genesis
- **File:** `packages/@wundr/org-genesis/src/cli/commands/create-org.ts`
- **Lines:** 570-800
- **Issue:** Real GenesisEngine commented out, replaced with generateMockOrganization() returning
  hardcoded data.
- **Fix:** Uncomment and wire up real GenesisEngine, remove mock functions and artificial delays.
- **Priority:** CRITICAL

### W1-10: Fix mock AI calls in CLI

- **Package:** @wundr/cli
- **File:** `packages/@wundr/cli/src/commands/ai.ts`
- **Lines:** 817-880
- **Issue:** callAI() returns mock responses, readFile() returns placeholder strings,
  getChangedFiles() returns hardcoded array.
- **Fix:** Implement real AI service integration, real file reading, real git queries.
- **Priority:** CRITICAL

### W1-11: Fix mock AI in chat command

- **Package:** @wundr/cli
- **File:** `packages/@wundr/cli/src/commands/chat.ts`
- **Lines:** 627-630
- **Issue:** callAI() returns "This is a mock response to: ..."
- **Fix:** Integrate with actual AI service.
- **Priority:** CRITICAL

### W1-12: Implement CLI safety-mechanisms module

- **Package:** @wundr/cli
- **File:** `packages/@wundr/cli/src/lib/safety-mechanisms.ts`
- **Lines:** 1-48
- **Issue:** ALL methods throw "Safety mechanisms not yet implemented".
- **Fix:** Implement backup, transaction, and rollback system.
- **Priority:** CRITICAL

### W1-13: Implement CLI conflict-resolution module

- **Package:** @wundr/cli
- **File:** `packages/@wundr/cli/src/lib/conflict-resolution.ts`
- **Lines:** 22-30
- **Issue:** resolve() throws "not yet implemented".
- **Fix:** Implement three-way merge and conflict resolution logic.
- **Priority:** CRITICAL

### W1-14: Implement CLI merge-strategy module

- **Package:** @wundr/cli
- **File:** `packages/@wundr/cli/src/lib/merge-strategy.ts`
- **Lines:** 13-28
- **Issue:** merge() and threeWayMerge() both throw "not yet implemented".
- **Fix:** Implement merge strategies with conflict detection.
- **Priority:** CRITICAL

### W1-15: Implement CLI state-detection module

- **Package:** @wundr/cli
- **File:** `packages/@wundr/cli/src/lib/state-detection.ts`
- **Lines:** 22-28
- **Issue:** Both methods throw/return "not yet implemented".
- **Fix:** Implement project state analysis using file system scanning.
- **Priority:** CRITICAL

### W1-16: Fix fake LLM grading in agent-eval

- **Package:** @wundr/agent-eval
- **File:** `packages/@wundr/agent-eval/src/evaluator.ts`
- **Lines:** 435, 544-552, 716-777
- **Issue:** simulateGradingResponse() returns hardcoded scores (7,8,9). Semantic similarity always
  passes with score 7. Default passing score of 7 assigned without evaluation.
- **Fix:** Require LLM config or custom grading function. Remove auto-passing. Implement semantic
  similarity or remove from supported types.
- **Priority:** CRITICAL

### W1-17: Fix mock task executor in agent-delegation

- **Package:** @wundr/agent-delegation
- **File:** `packages/@wundr/agent-delegation/src/coordinator.ts`
- **Lines:** 891-919
- **Issue:** Default executor sleeps 100ms and returns fake success without calling agents.
- **Fix:** Require real TaskExecutor or throw error. Remove placeholder.
- **Priority:** CRITICAL

### W1-18: Fix deployment MCP wrappers returning empty stubs

- **Package:** @wundr/computer-setup
- **File:** `packages/@wundr/computer-setup/src/lib/deployment-mcp-wrappers.ts`
- **Lines:** 76, 92, 105, 129, 144, 154, 234
- **Issue:** 7 functions return empty objects/arrays instead of real deployment data.
- **Fix:** Implement actual Railway/Netlify MCP integration or throw NotImplementedError.
- **Priority:** CRITICAL

### W1-19: Fix Neolith file-processor queue stubs

- **Package:** @wundr/neolith
- **File:** `packages/@wundr/neolith/packages/@neolith/file-processor/src/queue.ts`
- **Lines:** 86-100+
- **Issue:** 11+ TODO comments, all queue operations stubbed.
- **Fix:** Implement BullMQ queue integration with proper error handling.
- **Priority:** CRITICAL

### W1-20: Fix disabled web-client build scripts

- **Package:** tools/web-client
- **File:** `tools/web-client/package.json`
- **Lines:** 8, 24
- **Issue:** Build and typecheck commands echo "Skipping build for WIP package" and exit 0.
- **Fix:** Enable proper Next.js build commands.
- **Priority:** CRITICAL

---

## WAVE 2: High-Priority Mock Data & Stubs (20 agents)

### W2-01: Replace dashboard mock chart data with real API

- **File:** `packages/@wundr/dashboard/components/dashboard/overview.tsx` (lines 14-23)

### W2-02: Replace dashboard mock metrics with real API

- **File:** `packages/@wundr/dashboard/components/dashboard/metrics-grid.tsx` (lines 31-87)

### W2-03: Replace dashboard mock activities with real data

- **File:** `packages/@wundr/dashboard/components/dashboard/recent-activity.tsx` (lines 20-61)

### W2-04: Replace dashboard mock health metrics

- **File:** `packages/@wundr/dashboard/components/dashboard/project-health.tsx` (lines 43-132)

### W2-05: Implement dashboard quick actions (6 stubs)

- **File:** `packages/@wundr/dashboard/components/dashboard/quick-actions.tsx` (lines 35-85)

### W2-06: Replace dashboard hardcoded user/notifications

- **Files:** `app-sidebar.tsx` (lines 227-236), `header.tsx` (lines 78-113)

### W2-07: Fix risk-twin schema validation stub

- **File:** `packages/@wundr/risk-twin/src/pr-validator.ts` (lines 932-933)

### W2-08: Implement risk-twin policy conflict detection

- **File:** `packages/@wundr/risk-twin/src/pr-validator.ts` (lines 1082-1083)

### W2-09: Implement risk-twin custom rule execution

- **File:** `packages/@wundr/risk-twin/src/pr-validator.ts` (lines 1210-1211)

### W2-10: Fix risk-twin silent orchestrator skip

- **File:** `packages/@wundr/risk-twin/src/pr-validator.ts` (lines 1130-1144, 514-517)

### W2-11: Remove mock providers from structured-output exports

- **File:** `packages/@wundr/structured-output/src/instructor.ts` (lines 805-871)

### W2-12: Fix placeholder embedding in JIT tools

- **File:** `packages/@wundr/jit-tools/src/tool-retriever.ts` (lines 684-699)

### W2-13: Fix crew-orchestrator placeholder executor

- **File:** `packages/@wundr/crew-orchestrator/src/crew.ts` (lines 697-722)

### W2-14: Fix autogen-orchestrator placeholder responses

- **File:** `packages/@wundr/autogen-orchestrator/src/group-chat.ts` (lines 386-394)

### W2-15: Fix CLI plugin manager mock data

- **File:** `packages/@wundr/cli/src/plugins/plugin-manager.ts` (lines 319-338)

### W2-16: Fix mock RAG implementations in ai-integration

- **Files:** Multiple RAG files in `packages/@wundr/ai-integration/src/`

### W2-17: Fix drift detection placeholder data

- **File:** `packages/@wundr/mcp-server/src/tools/drift-detection.ts` (lines 243-264)

### W2-18: Fix MCP registry aggregator placeholders

- **File:** `packages/@wundr/mcp-registry/src/aggregator.ts` (lines 810-864)

### W2-19: Fix core CoreService stub

- **File:** `packages/core/src/services/index.ts` (lines 1-10)

### W2-20: Fix analysis-engine demo limitation

- **File:** `packages/analysis-engine/src/analyzers/index.ts` (line 69: `filePaths.slice(0, 5)`
  "Limit for demo")

---

## WAVE 3: Silent Error Handlers & Console Logging (20 agents)

### W3-01: Fix 20+ silent error handlers in web-client dashboard pages

- **Files:** All `app/dashboard/*/page.tsx` files with
  `catch (_error) { // Error logged - details available in network tab`

### W3-02: Replace 4 alert() calls with toast notifications in web-client

- **Files:** `load-report/page.tsx`, `script-executor.tsx`

### W3-03: Replace console logging in org-genesis CLI (559+ instances, 11 files)

- **Files:** All files under `packages/@wundr/org-genesis/src/cli/`

### W3-04: Replace console logging in orchestrator-daemon (4+ locations)

- **Files:** `token-tracker.ts`, `registry.ts`, `media-pipeline.ts`, `skill-registry.ts`

### W3-05: Fix 20+ empty catch blocks in computer-setup

- **Files:** `platform-detector.ts`, `unified-orchestrator.ts`, `operation-runner.ts`,
  `security-setup.ts`, etc.

### W3-06: Replace console logging in ai-integration (27+ locations)

- **Files:** Multiple files under `packages/@wundr/ai-integration/src/`

### W3-07: Replace console logging in project-templates

- **File:** `packages/@wundr/project-templates/src/index.ts` (lines 128-135, 493-498)

### W3-08: Replace console.error in config memory-source

- **File:** `packages/@wundr/config/src/sources/memory-source.ts` (line 75)

### W3-09: Fix silent error handling in RAG config loading

- **File:** `packages/@wundr/core/src/rag/project-rag-config.ts` (lines 207-216)

### W3-10: Fix silent catches in RAG reindex

- **File:** `packages/@wundr/core/src/rag/project-rag-reindex.ts` (lines 132-159)

### W3-11: Fix uncaught promise in event bus error handler

- **File:** `packages/@wundr/core/src/events/index.ts` (lines 64-77)

### W3-12: Fix memory leak in PerformanceAggregator

- **File:** `packages/@wundr/core/src/utils/performance.ts` (lines 850-871)

### W3-13: Replace console statements in docs components

- **Files:** `SearchAnalytics.tsx`, `Playground.tsx`

### W3-14: Fix silent error suppression in token-budget

- **Files:** `usage-tracker.ts` (lines 503-508), `budget-manager.ts` (lines 636-641)

### W3-15: Replace console logging in slack-installer

- **File:** `packages/@wundr/computer-setup/src/installers/slack-installer.ts` (line 397)

### W3-16: Fix mock Gmail auth URL and email

- **File:** `packages/@wundr/computer-setup/src/personalizers/gmail-integration.ts` (lines 140, 157)

### W3-17: Replace console.warn in prompt-security output-filter

- **File:** `packages/@wundr/prompt-security/src/output-filter.ts` (line 391)

### W3-18: Replace console.warn in prompt-templates loader

- **File:** `packages/@wundr/prompt-templates/src/loader.ts` (line 153)

### W3-19: Fix silent event handler errors in prompt-templates engine

- **File:** `packages/@wundr/prompt-templates/src/engine.ts` (lines 594-598)

### W3-20: Fix console statements in orchestrator frameworks

- **Files:** crew-orchestrator `index.ts`, autogen-orchestrator `group-chat.ts`,
  langgraph-orchestrator `state-graph.ts`

---

## WAVE 4: Input Validation, Type Safety & Cleanup (20 agents)

### W4-01: Add JSON schema validation to RAG config loading

- **File:** `packages/@wundr/core/src/rag/project-rag-config.ts` (line 213)

### W4-02: Add file permission checks before writes

- **File:** `packages/@wundr/core/src/rag/project-rag-init.ts` (lines 126-142)

### W4-03: Add input validation to async retry utility

- **File:** `packages/@wundr/core/src/utils/async.ts` (lines 15-53)

### W4-04: Add validation to branded type constructors

- **File:** `packages/@wundr/core/src/types/utility-types.ts` (lines 131-135)

### W4-05: Fix race condition in config file save

- **File:** `packages/@wundr/config/src/sources/file-source.ts` (lines 45-66)

### W4-06: Add initialization guard to config manager

- **File:** `packages/@wundr/config/src/manager/index.ts` (lines 108-110)

### W4-07: Add graceful shutdown to config manager

- **File:** `packages/@wundr/config/src/manager/index.ts`

### W4-08: Fix IP validation in RBAC

- **File:** `packages/@wundr/security/src/rbac/RoleBasedAccessControl.ts` (lines 990, 1078)

### W4-09: Fix alert condition parsing

- **File:** `packages/@wundr/security/src/monitoring/SecurityMonitor.ts` (line 498)

### W4-10: Move demo-server.js and start-demo.sh to examples

- **Files:** Root `demo-server.js`, `start-demo.sh`

### W4-11: Move test-client-services to test directory

- **File:** `tools/web-client/lib/services/client/test-client-services.ts`

### W4-12: Remove disabled route file

- **File:** `tools/web-client/app/api/docs/route.ts.disabled`

### W4-13: Fix UUID generation (replace Math.random with crypto)

- **Files:** Multiple files using `Math.random()` for IDs

### W4-14: Fix Neolith org-integration Slack stubs

- **File:** `packages/@wundr/neolith/packages/@neolith/org-integration/src/migration.ts`

### W4-15: Fix type assertions in slack-agent (24 instances of `as unknown as`)

- **Files:** Multiple files under `packages/@wundr/slack-agent/src/capabilities/`

### W4-16: Fix CLI create command stub

- **File:** `packages/@wundr/cli/src/commands/create.ts` (lines 14-25)

### W4-17: Fix placeholder schema in structured-output retry

- **File:** `packages/@wundr/structured-output/src/retry-strategies.ts` (lines 21-26)

### W4-18: Fix orchestrator-daemon TODO task queue

- **File:** `packages/@wundr/orchestrator-daemon/src/core/orchestrator-daemon.ts` (line 638)

### W4-19: Add missing HTTP status codes to shared-config

- **File:** `packages/shared-config/src/constants/index.ts`

### W4-20: Fix autogen-orchestrator uninitialized nested chat fields

- **File:** `packages/@wundr/autogen-orchestrator/src/group-chat.ts` (lines 162-167)

---

## Packages Confirmed Production-Ready (No Changes Needed)

| Package                    | Score  | Notes                                         |
| -------------------------- | ------ | --------------------------------------------- |
| @wundr/agent-memory        | 9/10   | Excellent code quality, proper error handling |
| @wundr/agent-observability | 9/10   | Strong validation, no stubs                   |
| @wundr/governance          | 10/10  | Solid policy engine, no issues                |
| @wundr/guardian-dashboard  | 95/100 | Clean, well-structured                        |
| @wundr/prompt-security     | 99/100 | Near-perfect, 1 minor console.warn            |
| @wundr/prompt-templates    | 98/100 | Near-perfect, 2 minor issues                  |

---

## Risk Assessment

### If deployed without fixes:

- **Security:** XOR encryption = credentials recoverable by any attacker
- **Monitoring:** All metrics are random numbers = zero operational visibility
- **Compliance:** Fake compliance reports = regulatory liability
- **AI Features:** Mock responses = features completely non-functional
- **CLI:** 4 modules throw "not implemented" = CLI crashes on use

### After Wave 1-2 completion:

- All critical security vulnerabilities patched
- Core features functional with real implementations
- Mock data replaced with actual API integrations
- CLI fully operational

### After Wave 3-4 completion:

- Production-grade error handling and logging
- Input validation across all packages
- Clean codebase with no demo/test artifacts
- Type-safe implementations
