# NEOLITH INSTITUTIONAL READINESS ROADMAP

**Version:** 1.0.0
**Date:** November 26, 2025
**Target Launch:** 16 VP Daemon Machines + Public App Stores
**Methodology:** Phased deployment with 20-agent parallel swarms per wave

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Browser Testing Strategy](#browser-testing-strategy)
3. [Phase 0: Critical Foundations](#phase-0-critical-foundations-immediate)
4. [Phase 1: Core Infrastructure](#phase-1-core-infrastructure-weeks-1-2)
5. [Phase 2: VP Autonomous Operation](#phase-2-vp-autonomous-operation-weeks-3-4)
6. [Phase 3: UI/UX Polish & Responsive Design](#phase-3-uiux-polish--responsive-design-weeks-5-6)
7. [Phase 4: Mobile & Desktop Apps](#phase-4-mobile--desktop-apps-weeks-7-9)
8. [Phase 5: Integration & Testing](#phase-5-integration--testing-weeks-10-11)
9. [Phase 6: Production Deployment](#phase-6-production-deployment-week-12)
10. [Swarm Orchestration Strategy](#swarm-orchestration-strategy)
11. [Testing & Validation Matrix](#testing--validation-matrix)

---

## Executive Summary

### Current Status
- **Web App:** 75% complete, production-ready foundation
- **Desktop App:** 70% complete, missing renderer integration
- **Mobile App:** 65% complete, native projects not initialized
- **VP Integration:** 40% complete, autonomous operation missing
- **Org-Genesis:** 0% integrated (package exists but not connected)

### Critical Blockers
1. **VP-Daemon Package:** Does not exist (only CLI stub)
2. **Org-Genesis Integration:** Completely disconnected from workspace creation
3. **Autonomous Agent Operation:** No backlog system, no self-directed work
4. **Browser Testing:** No MCP server configured for automated UI testing
5. **Mobile Native Projects:** iOS/Android projects not initialized
6. **Desktop Renderer:** Production build missing

### Success Criteria
- ✅ All 24 web pages functional and tested
- ✅ Desktop app packages for macOS/Windows/Linux
- ✅ Mobile apps submitted to App Store and Google Play
- ✅ VP agents can autonomously work through backlogs
- ✅ Workspace creation generates full org hierarchy via org-genesis
- ✅ VP agents can participate in conversations, channels, calls
- ✅ All UI components have proper empty states and skeleton loaders
- ✅ Responsive design works across mobile/tablet/desktop
- ✅ Theme toggle (Light/Dark/System) implemented
- ✅ Avatar images stored in S3, URLs in database

---

## Browser Testing Strategy

### Recommended Approach: Microsoft Playwright MCP Server

**Why Playwright MCP:**
- ✅ **Official Microsoft support** - actively maintained
- ✅ **Accessibility-tree based** - no vision models needed
- ✅ **Fast & lightweight** - structured data vs. screenshots
- ✅ **Claude Code native** - seamless integration
- ✅ **Launched March 2025** - cutting edge

**Installation:**
```bash
# Add Playwright MCP server to Claude Code
claude mcp add playwright npx @playwright/mcp-server

# Verify installation
claude mcp list
```

**Alternative: Puppeteer MCP** (if Playwright has issues)
```bash
claude mcp add puppeteer npx @modelcontextprotocol/server-puppeteer
```

### Testing Workflow with Browser MCP

**Setup Phase:**
1. Start Neolith dev server: `pnpm dev` (port 3000)
2. Playwright MCP connects to http://localhost:3000
3. Claude Code uses MCP tools to interact with UI

**Test Execution:**
```
Agent: "Test the workspace creation flow"
→ Playwright MCP navigates to /login
→ Authenticates via OAuth mock
→ Clicks "Create Workspace"
→ Fills form fields
→ Submits and verifies redirect
→ Checks org hierarchy created
→ Validates VPs auto-created
→ Reports success/failures
```

**MCP Tools Available:**
- `playwright_navigate` - Go to URL
- `playwright_click` - Click elements
- `playwright_fill` - Fill form inputs
- `playwright_screenshot` - Capture state
- `playwright_evaluate` - Run JavaScript
- `playwright_wait` - Wait for conditions

### Automated Test Scenarios

**Critical User Flows (Must Test):**
1. Authentication (OAuth Google/GitHub)
2. Workspace creation with org-genesis
3. VP creation and configuration
4. Channel creation and messaging
5. File upload to S3
6. Video call initiation (LiveKit)
7. Workflow creation and execution
8. Admin role management
9. Integration connections
10. Theme switching

**Per-Page Validation:**
- All 24 pages load without errors
- Empty states display correctly
- Skeleton loaders during data fetch
- Responsive breakpoints (mobile/tablet/desktop)
- Form validation works
- Error handling displays properly
- Navigation works correctly

**Sources:**
- [Microsoft Playwright MCP](https://github.com/microsoft/playwright-mcp)
- [Playwright MCP Guide](https://medium.com/@bluudit/playwright-mcp-comprehensive-guide-to-ai-powered-browser-automation-in-2025-712c9fd6cffa)
- [Browser Automation MCP](https://claudefa.st/blog/tools/mcp-extensions/browser-automation)

---

## Phase 0: Critical Foundations (IMMEDIATE)

**Duration:** 1-2 days
**Agents Required:** 10 specialist agents
**Execution:** Sequential (blocking dependencies)

### Task Group 0.1: Build VP-Daemon Package ⚠️ BLOCKER
**Priority:** CRITICAL
**Dependencies:** None
**Agents:** backend-engineer (lead), software-engineer (2), system-architect

**Tasks:**
- [ ] 0.1.1 Create `packages/@wundr/vp-daemon` package structure
- [ ] 0.1.2 Implement daemon core runtime (WebSocket server, session spawning)
- [ ] 0.1.3 Add memory architecture (tiered: scratchpad/episodic/semantic)
- [ ] 0.1.4 Implement integration orchestration (Slack, Neolith dual-connection)
- [ ] 0.1.5 Create CLI interface for daemon management
- [ ] 0.1.6 Add VP charter loading and enforcement
- [ ] 0.1.7 Write comprehensive tests (unit + integration)
- [ ] 0.1.8 Publish to npm as `@wundr.io/vp-daemon`
- [ ] 0.1.9 Update CLI to import real package (remove stub)
- [ ] 0.1.10 Document daemon architecture and API

**Validation:**
```bash
✓ npm install @wundr.io/vp-daemon succeeds
✓ wundr vp start launches daemon
✓ Daemon connects to Neolith WebSocket
✓ Can spawn Claude Code sessions
```

### Task Group 0.2: Install Browser Testing MCP
**Priority:** CRITICAL
**Dependencies:** None
**Agents:** qa-engineer, test-automation-engineer
**Execution:** PARALLEL with 0.1

**Tasks:**
- [ ] 0.2.1 Install Playwright MCP server: `claude mcp add playwright npx @playwright/mcp-server`
- [ ] 0.2.2 Verify MCP connection: `claude mcp list`
- [ ] 0.2.3 Start Neolith dev server on port 3000
- [ ] 0.2.4 Test MCP navigation to localhost:3000
- [ ] 0.2.5 Create test script template for reuse
- [ ] 0.2.6 Document browser testing workflow

**Validation:**
```bash
✓ Playwright MCP appears in `claude mcp list`
✓ Can navigate to localhost:3000
✓ Can click buttons and fill forms
✓ Screenshots captured successfully
```

### Task Group 0.3: Fix Critical Configuration Issues
**Priority:** CRITICAL
**Dependencies:** None
**Agents:** software-engineer (2), devops-engineer
**Execution:** PARALLEL with 0.1, 0.2

**Tasks:**
- [ ] 0.3.1 Fix mobile Capacitor config (`webDir: '../web/out'` not `dist`)
- [ ] 0.3.2 Configure Next.js static export for mobile: `output: 'export'`
- [ ] 0.3.3 Fix desktop Electron renderer path
- [ ] 0.3.4 Standardize branding (Genesis → Neolith everywhere)
- [ ] 0.3.5 Update capacitor.config appId to `com.wundr.neolith`
- [ ] 0.3.6 Align all package versions to 1.0.3

**Validation:**
```bash
✓ Mobile build sync succeeds
✓ Desktop production build completes
✓ No "genesis" references in codebase (except legacy comments)
```

---

## Phase 1: Core Infrastructure (Weeks 1-2)

**Duration:** 2 weeks
**Agents Required:** 20 agents per wave (2 waves)
**Execution:** PARALLEL where possible

### Wave 1.1: Org-Genesis Integration (Week 1)
**Priority:** CRITICAL
**Dependencies:** Phase 0 complete
**Agents:** backend-engineer (3), frontend-engineer (2), api-engineer (2)

#### Task Group 1.1.1: Backend Integration
**Tasks:**
- [ ] 1.1.1.1 Install `@wundr.io/org-genesis` in web app
- [ ] 1.1.1.2 Create `/api/workspaces/generate-org` endpoint
- [ ] 1.1.1.3 Wire up `createGenesisEngine()` in API route
- [ ] 1.1.1.4 Implement `migrateOrgGenesisResult()` from `@neolith/org-integration`
- [ ] 1.1.1.5 Add database transactions for org creation
- [ ] 1.1.1.6 Create VPs with disciplines from manifest
- [ ] 1.1.1.7 Create channels for disciplines
- [ ] 1.1.1.8 Auto-assign VPs to discipline channels
- [ ] 1.1.1.9 Generate org hierarchy relationships
- [ ] 1.1.1.10 Add error handling and rollback logic

#### Task Group 1.1.2: Frontend Workspace Creation Flow
**Agents:** frontend-engineer (3), product-designer (2)
**Dependencies:** 1.1.1 (API must exist)

**Tasks:**
- [ ] 1.1.2.1 Create conversational org-genesis UI component
- [ ] 1.1.2.2 Add multi-step wizard for org configuration
- [ ] 1.1.2.3 Display org preview before creation
- [ ] 1.1.2.4 Show loading state during generation (use Skeleton)
- [ ] 1.1.2.5 Display generated org chart visualization
- [ ] 1.1.2.6 Add "Regenerate" and "Customize" options
- [ ] 1.1.2.7 Merge "Create Workspace" with "Create Organization" concept
- [ ] 1.1.2.8 Update onboarding flow
- [ ] 1.1.2.9 Add tooltips explaining VP disciplines
- [ ] 1.1.2.10 Implement form validation with Zod

#### Task Group 1.1.3: Org Hierarchy Display
**Agents:** frontend-engineer (2), product-designer (1)
**Dependencies:** 1.1.2

**Tasks:**
- [ ] 1.1.3.1 Create org chart visualization component (tree/hierarchy view)
- [ ] 1.1.3.2 Add VP reporting lines display
- [ ] 1.1.3.3 Show authority levels and permissions
- [ ] 1.1.3.4 Add drill-down to VP details
- [ ] 1.1.3.5 Display department/team grouping
- [ ] 1.1.3.6 Add search/filter for large orgs
- [ ] 1.1.3.7 Mobile-responsive org chart (horizontal scroll on mobile)
- [ ] 1.1.3.8 Export org chart as image/PDF
- [ ] 1.1.3.9 Add to Admin dashboard
- [ ] 1.1.3.10 Add empty state for unconfigured orgs

**Validation:**
```bash
✓ Create workspace → conversational flow appears
✓ Org manifest generated with VPs and disciplines
✓ VPs auto-created in database
✓ Discipline channels auto-created
✓ VPs auto-assigned to channels
✓ Org chart displays hierarchy
✓ Browser test passes for entire flow
```

### Wave 1.2: VP Autonomous Operation Foundation (Week 2)
**Priority:** CRITICAL
**Dependencies:** VP-Daemon built (0.1)
**Agents:** backend-engineer (4), ml-engineer (2), software-engineer (2)

#### Task Group 1.2.1: Agent Backlog System
**Tasks:**
- [ ] 1.2.1.1 Add Prisma schema for Task model (see audit spec)
- [ ] 1.2.1.2 Create task priority enum (CRITICAL, HIGH, MEDIUM, LOW)
- [ ] 1.2.1.3 Create task status enum (TODO, IN_PROGRESS, BLOCKED, DONE, CANCELLED)
- [ ] 1.2.1.4 Add task dependencies (array of task IDs)
- [ ] 1.2.1.5 Add task scheduling (dueDate, estimatedHours)
- [ ] 1.2.1.6 Create `/api/tasks` CRUD endpoints
- [ ] 1.2.1.7 Create `/api/vps/[id]/backlog` endpoint (filtered tasks)
- [ ] 1.2.1.8 Add task assignment endpoint (human→VP, VP→VP)
- [ ] 1.2.1.9 Implement task polling mechanism for VPs
- [ ] 1.2.1.10 Add task completion webhook

#### Task Group 1.2.2: VP Memory Integration
**Agents:** ml-engineer (2), backend-engineer (2)
**Dependencies:** 1.2.1

**Tasks:**
- [ ] 1.2.2.1 Install `@wundr.io/agent-memory` package
- [ ] 1.2.2.2 Create memory service wrapper
- [ ] 1.2.2.3 Implement conversation history persistence per channel
- [ ] 1.2.2.4 Add task completion history tracking
- [ ] 1.2.2.5 Store learned patterns and preferences
- [ ] 1.2.2.6 Implement cross-session memory retrieval
- [ ] 1.2.2.7 Add memory search/query API
- [ ] 1.2.2.8 Create memory pruning/archival strategy
- [ ] 1.2.2.9 Add memory visualization for debugging
- [ ] 1.2.2.10 Integrate with VP context in Claude sessions

#### Task Group 1.2.3: VP Work Execution Engine
**Agents:** backend-engineer (3), software-engineer (2)
**Dependencies:** 1.2.1, 1.2.2, VP-Daemon (0.1)

**Tasks:**
- [ ] 1.2.3.1 Create VP work polling service (checks backlog every N minutes)
- [ ] 1.2.3.2 Implement task selection algorithm (priority + deadline + dependencies)
- [ ] 1.2.3.3 Spawn Claude Code session for selected task
- [ ] 1.2.3.4 Pass task context + VP charter + memory to session
- [ ] 1.2.3.5 Monitor session progress
- [ ] 1.2.3.6 Capture session output and results
- [ ] 1.2.3.7 Update task status based on completion
- [ ] 1.2.3.8 Post status updates to assigned channel
- [ ] 1.2.3.9 Handle errors and retry logic
- [ ] 1.2.3.10 Store work artifacts in S3

**Validation:**
```bash
✓ Task created in backlog
✓ VP daemon polls and selects task
✓ Claude Code session spawns
✓ Task executes autonomously
✓ Status updates posted to channel
✓ Task marked complete in database
✓ Memory updated with learnings
```

### Wave 1.3: S3 Avatar Storage (Week 2)
**Priority:** HIGH
**Dependencies:** None (parallel with 1.2)
**Agents:** backend-engineer (2), software-engineer (1)
**Execution:** PARALLEL with Wave 1.2

**Tasks:**
- [ ] 1.3.1 Create S3 bucket for user avatars (separate from general uploads)
- [ ] 1.3.2 Implement avatar upload service
- [ ] 1.3.3 Add image processing (resize to standard sizes: 32, 64, 128, 256px)
- [ ] 1.3.4 Update OAuth callback to download provider avatar
- [ ] 1.3.5 Upload to S3 on user creation/update
- [ ] 1.3.6 Store S3 URL in User.image field
- [ ] 1.3.7 Add avatar change endpoint `/api/users/[id]/avatar`
- [ ] 1.3.8 Update UserAvatar component to use S3 URLs
- [ ] 1.3.9 Add fallback for missing avatars (initials-based generated image)
- [ ] 1.3.10 Implement CDN caching headers

**Validation:**
```bash
✓ OAuth login downloads provider avatar
✓ Avatar uploaded to S3
✓ S3 URL stored in database
✓ Avatar displays in UI from S3
✓ Manual avatar upload works
✓ Fallback initials avatar works
```

---

## Phase 2: VP Autonomous Operation (Weeks 3-4)

**Duration:** 2 weeks
**Agents Required:** 20 agents per wave (2 waves)

### Wave 2.1: VP Communication Features (Week 3)
**Priority:** HIGH
**Dependencies:** Phase 1 complete
**Agents:** backend-engineer (3), frontend-engineer (3), api-engineer (2)

#### Task Group 2.1.1: VP-Initiated Conversations
**Tasks:**
- [ ] 2.1.1.1 Add `/api/vps/[id]/conversations/initiate` endpoint
- [ ] 2.1.1.2 Create conversation context retention (thread history)
- [ ] 2.1.1.3 Implement VP status update posting
- [ ] 2.1.1.4 Add VP task delegation to humans (create task + notify)
- [ ] 2.1.1.5 Implement VP escalation workflow (task blocked → notify human)
- [ ] 2.1.1.6 Create VP meeting participation API
- [ ] 2.1.1.7 Add VP presence in calls (LiveKit integration)
- [ ] 2.1.1.8 Implement VP message threading
- [ ] 2.1.1.9 Add VP @mention handling
- [ ] 2.1.1.10 Create VP notification preferences

#### Task Group 2.1.2: Channel Intelligence
**Agents:** ml-engineer (2), backend-engineer (2)
**Dependencies:** 2.1.1

**Tasks:**
- [ ] 2.1.2.1 Auto-join VPs to discipline channels on creation
- [ ] 2.1.2.2 Implement relevance detection (VP expertise match)
- [ ] 2.1.2.3 Add channel activity monitoring for VPs
- [ ] 2.1.2.4 Smart notification filtering (only relevant mentions)
- [ ] 2.1.2.5 Suggest channels to VPs based on conversations
- [ ] 2.1.2.6 Auto-leave inactive channels
- [ ] 2.1.2.7 Channel topic extraction
- [ ] 2.1.2.8 VP expertise updating based on channel activity
- [ ] 2.1.2.9 Create channel recommendation engine
- [ ] 2.1.2.10 Add channel analytics for VPs

#### Task Group 2.1.3: UI for VP Interaction
**Agents:** frontend-engineer (4), ux-researcher (1)
**Dependencies:** 2.1.1, 2.1.2

**Tasks:**
- [ ] 2.1.3.1 Create VP conversation UI (distinguish VP vs human messages)
- [ ] 2.1.3.2 Add VP status badges (working, idle, blocked, offline)
- [ ] 2.1.3.3 Show VP current task in presence tooltip
- [ ] 2.1.3.4 Create task assignment dialog (human→VP)
- [ ] 2.1.3.5 Add VP work summary dashboard
- [ ] 2.1.3.6 Display VP decision rationale (why it chose task X)
- [ ] 2.1.3.7 Add VP approval requests UI
- [ ] 2.1.3.8 Show VP learning/improvements over time
- [ ] 2.1.3.9 Create VP interaction history timeline
- [ ] 2.1.3.10 Add VP "thinking" indicator during work

**Validation:**
```bash
✓ VP auto-joins discipline channel on creation
✓ VP posts status update to channel
✓ Human assigns task to VP via UI
✓ VP accepts task and starts work
✓ VP posts progress updates
✓ VP escalates blocked task to human
✓ Human approves VP decision
✓ VP-human conversation thread works
```

### Wave 2.2: Advanced VP Features (Week 4)
**Priority:** MEDIUM
**Dependencies:** Wave 2.1
**Agents:** backend-engineer (3), ml-engineer (2), software-engineer (2)

#### Task Group 2.2.1: Cross-VP Coordination
**Tasks:**
- [ ] 2.2.1.1 Implement VP→VP task delegation API
- [ ] 2.2.1.2 Add VP collaboration requests
- [ ] 2.2.1.3 Create shared workspace for VP teams
- [ ] 2.2.1.4 Implement consensus mechanisms (multi-VP decision)
- [ ] 2.2.1.5 Add VP knowledge sharing (cross-memory)
- [ ] 2.2.1.6 Create VP handoff protocol (task transfer)
- [ ] 2.2.1.7 Implement VP sync meetings (coordinated check-ins)
- [ ] 2.2.1.8 Add VP conflict resolution
- [ ] 2.2.1.9 Create VP team formation (dynamic grouping)
- [ ] 2.2.1.10 Implement VP peer review

#### Task Group 2.2.2: Work Rhythm & Scheduling
**Agents:** backend-engineer (2), software-engineer (2)
**Dependencies:** 2.2.1

**Tasks:**
- [ ] 2.2.2.1 Implement work hours configuration (from VPCharter)
- [ ] 2.2.2.2 Add batch processing schedules
- [ ] 2.2.2.3 Create proactive vs. reactive mode toggle
- [ ] 2.2.2.4 Implement capacity management (max concurrent tasks)
- [ ] 2.2.2.5 Add energy/resource budgeting
- [ ] 2.2.2.6 Create task time estimation
- [ ] 2.2.2.7 Implement deadline-aware prioritization
- [ ] 2.2.2.8 Add recurring task scheduling
- [ ] 2.2.2.9 Create "office hours" for VP availability
- [ ] 2.2.2.10 Implement vacation/maintenance mode

#### Task Group 2.2.3: Analytics & Observability
**Agents:** data-scientist (2), ml-engineer (1), backend-engineer (2)
**Dependencies:** 2.2.1, 2.2.2

**Tasks:**
- [ ] 2.2.3.1 Install `@wundr.io/agent-observability`
- [ ] 2.2.3.2 Track VP performance metrics (tasks/hour, accuracy)
- [ ] 2.2.3.3 Measure task completion rates
- [ ] 2.2.3.4 Track VP response times
- [ ] 2.2.3.5 Implement quality scoring (human feedback)
- [ ] 2.2.3.6 Create VP analytics dashboard
- [ ] 2.2.3.7 Add VP performance trends
- [ ] 2.2.3.8 Implement anomaly detection (VP underperforming)
- [ ] 2.2.3.9 Create VP comparison/benchmarking
- [ ] 2.2.3.10 Add real-time VP health monitoring

**Validation:**
```bash
✓ VP delegates sub-task to another VP
✓ Multi-VP collaboration on complex task
✓ Work hours respected (VP doesn't work outside hours)
✓ Capacity management prevents overload
✓ Analytics dashboard shows VP metrics
✓ Performance trends visible
```

---

## Phase 3: UI/UX Polish & Responsive Design (Weeks 5-6)

**Duration:** 2 weeks
**Agents Required:** 20 agents per wave (2 waves)

### Wave 3.1: Responsive Design Improvements (Week 5)
**Priority:** HIGH
**Dependencies:** None (parallel with VP features)
**Agents:** frontend-engineer (6), product-designer (3), ux-researcher (1)

#### Task Group 3.1.1: Mobile-First Components
**Tasks:**
- [ ] 3.1.1.1 Create `hooks/use-media-query.ts` hook
- [ ] 3.1.1.2 Create `components/ui/responsive-modal.tsx` (Dialog on desktop, Drawer on mobile)
- [ ] 3.1.1.3 Update all modals to use ResponsiveModal
- [ ] 3.1.1.4 Implement mobile navigation drawer (hamburger menu)
- [ ] 3.1.1.5 Add swipe gestures for drawer
- [ ] 3.1.1.6 Create mobile-optimized sidebar
- [ ] 3.1.1.7 Update channel list for mobile (collapsible sections)
- [ ] 3.1.1.8 Add bottom tab navigation (mobile alternative)
- [ ] 3.1.1.9 Optimize touch targets (minimum 44x44px)
- [ ] 3.1.1.10 Test on iOS Safari, Android Chrome

#### Task Group 3.1.2: Tablet Optimization
**Agents:** frontend-engineer (3), product-designer (2)
**Dependencies:** 3.1.1

**Tasks:**
- [ ] 3.1.2.1 Create tablet-specific layouts (2-column where appropriate)
- [ ] 3.1.2.2 Optimize sidebar for tablet (maybe always visible)
- [ ] 3.1.2.3 Adjust breakpoints for tablet sizes (768-1024px)
- [ ] 3.1.2.4 Test landscape vs. portrait modes
- [ ] 3.1.2.5 Optimize org chart for tablet
- [ ] 3.1.2.6 Adjust workflow builder for tablet
- [ ] 3.1.2.7 Create tablet-optimized analytics dashboard
- [ ] 3.1.2.8 Test on iPad, Android tablets
- [ ] 3.1.2.9 Add split-view support (iPad)
- [ ] 3.1.2.10 Optimize form layouts for tablet

#### Task Group 3.1.3: Desktop Enhancements
**Agents:** frontend-engineer (2), product-designer (1)
**Dependencies:** 3.1.1

**Tasks:**
- [ ] 3.1.3.1 Add keyboard shortcuts documentation
- [ ] 3.1.3.2 Implement command palette (Cmd+K)
- [ ] 3.1.3.3 Add hover states consistently
- [ ] 3.1.3.4 Optimize for large screens (>1920px)
- [ ] 3.1.3.5 Add multi-panel layouts (conversation + task sidebar)
- [ ] 3.1.3.6 Create desktop-specific context menus
- [ ] 3.1.3.7 Add drag-and-drop for file uploads
- [ ] 3.1.3.8 Implement resizable panels
- [ ] 3.1.3.9 Add desktop notifications
- [ ] 3.1.3.10 Test on 4K displays

**Validation:**
```bash
✓ All modals use Drawer on mobile, Dialog on desktop
✓ Mobile navigation drawer works smoothly
✓ Touch targets meet 44px minimum
✓ Tablet layouts optimized
✓ Desktop keyboard shortcuts work
✓ Browser tests pass on all breakpoints
```

### Wave 3.2: Empty States & Loading States (Week 6)
**Priority:** HIGH
**Dependencies:** Wave 3.1
**Agents:** frontend-engineer (5), product-designer (3), ux-researcher (1)

#### Task Group 3.2.1: Empty State Components
**Tasks:**
- [ ] 3.2.1.1 Create reusable `EmptyState` component (icon, title, description, CTA)
- [ ] 3.2.1.2 Add empty state to Dashboard (new users)
- [ ] 3.2.1.3 Add empty state to Channels list
- [ ] 3.2.1.4 Add empty state to VPs page (no VPs yet)
- [ ] 3.2.1.5 Add empty state to Workflows page
- [ ] 3.2.1.6 Add empty state to Admin Members page
- [ ] 3.2.1.7 Add empty state to Admin Roles page
- [ ] 3.2.1.8 Add empty state to Admin Activity page
- [ ] 3.2.1.9 Add empty state to Analytics (no data)
- [ ] 3.2.1.10 Add empty state to Deployments page
- [ ] 3.2.1.11 Add empty state to Integrations page
- [ ] 3.2.1.12 Add contextual empty states (filtered results, search)
- [ ] 3.2.1.13 Design custom icons for each empty state (Lucide React)
- [ ] 3.2.1.14 Add helpful tooltips and getting-started guides
- [ ] 3.2.1.15 Test empty states on mobile/tablet/desktop

#### Task Group 3.2.2: Skeleton Loaders
**Agents:** frontend-engineer (4), product-designer (2)
**Dependencies:** 3.2.1

**Tasks:**
- [ ] 3.2.2.1 Standardize Skeleton usage across all pages
- [ ] 3.2.2.2 Create VPCardSkeleton (already exists, verify usage)
- [ ] 3.2.2.3 Create WorkflowCardSkeleton (already exists, verify)
- [ ] 3.2.2.4 Create ChannelListSkeleton
- [ ] 3.2.2.5 Create MessageListSkeleton
- [ ] 3.2.2.6 Create TableSkeleton (for admin pages)
- [ ] 3.2.2.7 Create DashboardSkeleton
- [ ] 3.2.2.8 Create AnalyticsSkeleton
- [ ] 3.2.2.9 Update all list views to use skeletons during loading
- [ ] 3.2.2.10 Add skeleton animation timing consistency
- [ ] 3.2.2.11 Test skeleton visibility on slow connections
- [ ] 3.2.2.12 Ensure skeletons match actual component layout
- [ ] 3.2.2.13 Add loading states to all API calls
- [ ] 3.2.2.14 Replace generic "Loading..." text with skeletons
- [ ] 3.2.2.15 Test loading states with browser MCP

**Validation:**
```bash
✓ All 24 pages have proper empty states
✓ All list/grid views show skeleton loaders
✓ Empty states have icons + CTAs
✓ Skeleton loaders match component layouts
✓ Browser tests verify loading → data → empty states
```

### Wave 3.3: Theme Toggle & Theming (Week 6)
**Priority:** MEDIUM
**Dependencies:** None (parallel with 3.2)
**Agents:** frontend-engineer (3), product-designer (2)
**Execution:** PARALLEL with Wave 3.2

**Tasks:**
- [ ] 3.3.1 Create ThemeToggle component (Light/Dark/System options)
- [ ] 3.3.2 Add theme toggle to user menu dropdown
- [ ] 3.3.3 Add theme toggle to user settings page
- [ ] 3.3.4 Persist theme preference in Preferences API (Capacitor) for mobile
- [ ] 3.3.5 Persist theme preference in localStorage for web
- [ ] 3.3.6 Test theme switching with animations
- [ ] 3.3.7 Verify all components support dark mode
- [ ] 3.3.8 Fix any dark mode contrast issues
- [ ] 3.3.9 Test on mobile (respect system theme)
- [ ] 3.3.10 Add theme preview in settings
- [ ] 3.3.11 Document theme customization for enterprises
- [ ] 3.3.12 Test with browser MCP (toggle theme, verify styles)

**Validation:**
```bash
✓ Theme toggle appears in user menu
✓ Light/Dark/System options work
✓ Theme persists across sessions
✓ All components render correctly in both themes
✓ System theme auto-detection works
```

---

## Phase 4: Mobile & Desktop Apps (Weeks 7-9)

**Duration:** 3 weeks
**Agents Required:** 20 agents per wave (3 waves)

### Wave 4.1: Desktop App Completion (Week 7)
**Priority:** HIGH
**Dependencies:** Web app stable
**Agents:** software-engineer (4), devops-engineer (3), frontend-engineer (2)

#### Task Group 4.1.1: Renderer Integration
**Tasks:**
- [ ] 4.1.1.1 Configure Next.js static export: `output: 'export'`
- [ ] 4.1.1.2 Create desktop-specific Next.js config
- [ ] 4.1.1.3 Set distDir to 'out' for Electron compatibility
- [ ] 4.1.1.4 Update main.ts production path to '../out/index.html'
- [ ] 4.1.1.5 Copy static assets to Electron build
- [ ] 4.1.1.6 Implement Electron-specific API detection in web app
- [ ] 4.1.1.7 Add `window.neolith` type definitions to web app
- [ ] 4.1.1.8 Create conditional imports for Electron features
- [ ] 4.1.1.9 Test production build locally
- [ ] 4.1.1.10 Verify all API routes work with static export

#### Task Group 4.1.2: Missing Desktop Files
**Agents:** devops-engineer (3), software-engineer (1)
**Dependencies:** 4.1.1

**Tasks:**
- [ ] 4.1.2.1 Create `scripts/notarize.js` for macOS notarization
- [ ] 4.1.2.2 Create `build/entitlements.mac.plist`
- [ ] 4.1.2.3 Create `build/entitlements.mac.inherit.plist`
- [ ] 4.1.2.4 Generate Windows .ico from existing PNG
- [ ] 4.1.2.5 Create tray icons (monochrome versions for macOS)
- [ ] 4.1.2.6 Create notification icons
- [ ] 4.1.2.7 Set up code signing certificates (macOS Developer ID)
- [ ] 4.1.2.8 Set up Windows code signing certificate
- [ ] 4.1.2.9 Configure environment variables for signing
- [ ] 4.1.2.10 Test code signing locally

#### Task Group 4.1.3: Desktop-Specific Features
**Agents:** software-engineer (3), frontend-engineer (2)
**Dependencies:** 4.1.1, 4.1.2

**Tasks:**
- [ ] 4.1.3.1 Implement native file system operations (read/write)
- [ ] 4.1.3.2 Add native notifications
- [ ] 4.1.3.3 Implement clipboard access
- [ ] 4.1.3.4 Add global keyboard shortcuts
- [ ] 4.1.3.5 Create system tray integration
- [ ] 4.1.3.6 Implement auto-update UI
- [ ] 4.1.3.7 Add crash reporting (@sentry/electron)
- [ ] 4.1.3.8 Implement logging system (electron-log)
- [ ] 4.1.3.9 Add developer tools toggle
- [ ] 4.1.3.10 Create desktop preferences window

#### Task Group 4.1.4: Platform Builds
**Agents:** devops-engineer (4)
**Dependencies:** 4.1.3

**Tasks:**
- [ ] 4.1.4.1 Build for macOS (x64 + arm64 universal binary)
- [ ] 4.1.4.2 Build for Windows (x64, ia32, arm64)
- [ ] 4.1.4.3 Build for Linux (AppImage, deb, rpm)
- [ ] 4.1.4.4 Test macOS DMG installer
- [ ] 4.1.4.5 Test Windows NSIS installer
- [ ] 4.1.4.6 Test Linux packages on Ubuntu, Fedora
- [ ] 4.1.4.7 Notarize macOS build
- [ ] 4.1.4.8 Sign Windows build
- [ ] 4.1.4.9 Upload builds to GitHub Releases
- [ ] 4.1.4.10 Test auto-update mechanism

**Validation:**
```bash
✓ npm run package:mac produces working DMG
✓ npm run package:win produces working installer
✓ npm run package:linux produces working AppImage
✓ App launches and connects to backend
✓ Desktop-specific features work (notifications, tray, etc.)
✓ Auto-update downloads and installs
```

### Wave 4.2: Mobile App Foundation (Week 8)
**Priority:** HIGH
**Dependencies:** Web app stable, mobile config fixed (0.3)
**Agents:** react-native-engineer (4), mobile-dev (3), devops-engineer (2)

#### Task Group 4.2.1: Native Project Initialization
**Tasks:**
- [ ] 4.2.1.1 Run `npm run add:ios` to create iOS project
- [ ] 4.2.1.2 Run `npm run add:android` to create Android project
- [ ] 4.2.1.3 Verify project structure created correctly
- [ ] 4.2.1.4 Update bundle IDs (com.wundr.neolith.ios, com.wundr.neolith.android)
- [ ] 4.2.1.5 Configure app names (Neolith)
- [ ] 4.2.1.6 Set deployment targets (iOS 13+, Android API 22+)
- [ ] 4.2.1.7 Initial sync: `npm run sync`
- [ ] 4.2.1.8 Test on iOS Simulator
- [ ] 4.2.1.9 Test on Android Emulator
- [ ] 4.2.1.10 Fix any sync errors

#### Task Group 4.2.2: Mobile Assets
**Agents:** product-designer (3), mobile-dev (2)
**Dependencies:** 4.2.1

**Tasks:**
- [ ] 4.2.2.1 Design app icon (1024x1024 source)
- [ ] 4.2.2.2 Install @capacitor/assets: `npm install -D @capacitor/assets`
- [ ] 4.2.2.3 Run `npx @capacitor/assets generate` for all icon sizes
- [ ] 4.2.2.4 Design splash screen (light + dark variants)
- [ ] 4.2.2.5 Generate splash screens for all devices
- [ ] 4.2.2.6 Verify icons on iOS (all sizes)
- [ ] 4.2.2.7 Verify adaptive icons on Android
- [ ] 4.2.2.8 Test splash screens on various devices
- [ ] 4.2.2.9 Create App Store screenshots (6.5", 5.5", 12.9")
- [ ] 4.2.2.10 Create Google Play screenshots (phone, 7", 10")

#### Task Group 4.2.3: Mobile-Specific Optimizations
**Agents:** frontend-engineer (3), react-native-engineer (2)
**Dependencies:** 4.2.1

**Tasks:**
- [ ] 4.2.3.1 Add viewport meta tags to layout
- [ ] 4.2.3.2 Implement safe area CSS (`env(safe-area-inset-*)`)
- [ ] 4.2.3.3 Install essential Capacitor plugins (keyboard, status-bar, network, haptics)
- [ ] 4.2.3.4 Create `hooks/use-native.ts` hooks for Capacitor APIs
- [ ] 4.2.3.5 Implement status bar styling (dark/light per theme)
- [ ] 4.2.3.6 Add keyboard handling (resize on keyboard show)
- [ ] 4.2.3.7 Implement haptic feedback on interactions
- [ ] 4.2.3.8 Add pull-to-refresh on feed pages
- [ ] 4.2.3.9 Optimize images for mobile (Next.js Image with deviceSizes)
- [ ] 4.2.3.10 Test on low-end devices (performance)

#### Task Group 4.2.4: PWA Manifest
**Agents:** frontend-engineer (2)
**Dependencies:** 4.2.2

**Tasks:**
- [ ] 4.2.4.1 Create `public/manifest.json`
- [ ] 4.2.4.2 Add app name, short_name, description
- [ ] 4.2.4.3 Configure display mode (standalone)
- [ ] 4.2.4.4 Set theme_color and background_color
- [ ] 4.2.4.5 Add all icon sizes
- [ ] 4.2.4.6 Configure start_url and scope
- [ ] 4.2.4.7 Link manifest in layout.tsx
- [ ] 4.2.4.8 Test PWA install on mobile browsers
- [ ] 4.2.4.9 Verify service worker integration
- [ ] 4.2.4.10 Test offline functionality

**Validation:**
```bash
✓ iOS project opens in Xcode
✓ Android project opens in Android Studio
✓ App icons display correctly on both platforms
✓ Splash screens show on launch
✓ Safe area CSS works on iPhone notch
✓ Keyboard handling works
✓ Haptic feedback works
✓ PWA installable on mobile browsers
```

### Wave 4.3: Mobile Platform Setup (Week 9)
**Priority:** HIGH
**Dependencies:** Wave 4.2
**Agents:** devops-engineer (5), mobile-dev (4)

#### Task Group 4.3.1: iOS Platform Setup
**Tasks:**
- [ ] 4.3.1.1 Create Apple Developer account / access existing
- [ ] 4.3.1.2 Register App ID (com.wundr.neolith)
- [ ] 4.3.1.3 Create development provisioning profile
- [ ] 4.3.1.4 Create App Store provisioning profile
- [ ] 4.3.1.5 Generate push notification certificate (APNs)
- [ ] 4.3.1.6 Configure Xcode project settings
- [ ] 4.3.1.7 Add privacy usage descriptions (Info.plist)
- [ ] 4.3.1.8 Configure background modes (if needed for notifications)
- [ ] 4.3.1.9 Set up code signing in Xcode
- [ ] 4.3.1.10 Create App Store Connect app listing
- [ ] 4.3.1.11 Upload app metadata (name, description, keywords)
- [ ] 4.3.1.12 Upload screenshots
- [ ] 4.3.1.13 Configure app pricing (free)
- [ ] 4.3.1.14 Set up TestFlight
- [ ] 4.3.1.15 Build for TestFlight
- [ ] 4.3.1.16 Internal testing with TestFlight
- [ ] 4.3.1.17 External testing (optional)
- [ ] 4.3.1.18 Address TestFlight feedback
- [ ] 4.3.1.19 Prepare for App Store submission
- [ ] 4.3.1.20 Submit for App Store review

#### Task Group 4.3.2: Android Platform Setup
**Agents:** devops-engineer (4), mobile-dev (3)
**Execution:** PARALLEL with 4.3.1

**Tasks:**
- [ ] 4.3.2.1 Create Google Play Console account / access existing
- [ ] 4.3.2.2 Create app on Google Play Console
- [ ] 4.3.2.3 Create Firebase project
- [ ] 4.3.2.4 Download google-services.json
- [ ] 4.3.2.5 Add google-services.json to android/app/
- [ ] 4.3.2.6 Configure Firebase Cloud Messaging (FCM)
- [ ] 4.3.2.7 Generate release keystore
- [ ] 4.3.2.8 Configure signing in build.gradle
- [ ] 4.3.2.9 Update AndroidManifest.xml permissions
- [ ] 4.3.2.10 Configure ProGuard rules (if needed)
- [ ] 4.3.2.11 Upload app metadata to Play Console
- [ ] 4.3.2.12 Upload screenshots
- [ ] 4.3.2.13 Create privacy policy (required for Play Store)
- [ ] 4.3.2.14 Configure app content rating
- [ ] 4.3.2.15 Build signed APK/AAB
- [ ] 4.3.2.16 Upload to internal testing track
- [ ] 4.3.2.17 Internal testing
- [ ] 4.3.2.18 Upload to closed beta track
- [ ] 4.3.2.19 Beta testing
- [ ] 4.3.2.20 Submit for Play Store review

#### Task Group 4.3.3: Push Notifications Integration
**Agents:** backend-engineer (3), mobile-dev (2)
**Dependencies:** 4.3.1, 4.3.2

**Tasks:**
- [ ] 4.3.3.1 Update service worker to handle mobile push
- [ ] 4.3.3.2 Implement APNs token registration (iOS)
- [ ] 4.3.3.3 Implement FCM token registration (Android)
- [ ] 4.3.3.4 Store device tokens in database
- [ ] 4.3.3.5 Create push notification sending service
- [ ] 4.3.3.6 Add notification preferences per device
- [ ] 4.3.3.7 Test push on iOS physical device
- [ ] 4.3.3.8 Test push on Android physical device
- [ ] 4.3.3.9 Handle notification tap (deep linking)
- [ ] 4.3.3.10 Add notification badges

**Validation:**
```bash
✓ iOS build uploaded to TestFlight
✓ Android build uploaded to Play Console beta
✓ Push notifications work on both platforms
✓ App Store metadata complete
✓ Play Store metadata complete
✓ Beta testers can install and test
```

---

## Phase 5: Integration & Testing (Weeks 10-11)

**Duration:** 2 weeks
**Agents Required:** 20 agents per wave (2 waves)

### Wave 5.1: Comprehensive Browser Testing (Week 10)
**Priority:** CRITICAL
**Dependencies:** All features complete
**Agents:** qa-engineer (6), test-automation-engineer (4)

#### Task Group 5.1.1: Automated UI Testing
**Tasks:**
- [ ] 5.1.1.1 Set up Playwright MCP test suite
- [ ] 5.1.1.2 Test authentication flows (Google, GitHub OAuth)
- [ ] 5.1.1.3 Test workspace creation with org-genesis
- [ ] 5.1.1.4 Test VP creation and configuration
- [ ] 5.1.1.5 Test channel creation and messaging
- [ ] 5.1.1.6 Test file upload to S3
- [ ] 5.1.1.7 Test video call initiation (LiveKit)
- [ ] 5.1.1.8 Test workflow creation and execution
- [ ] 5.1.1.9 Test admin role management
- [ ] 5.1.1.10 Test integration connections
- [ ] 5.1.1.11 Test theme switching (Light/Dark/System)
- [ ] 5.1.1.12 Test all 24 pages load without errors
- [ ] 5.1.1.13 Test empty states on all pages
- [ ] 5.1.1.14 Test skeleton loaders during loading
- [ ] 5.1.1.15 Test responsive breakpoints (mobile/tablet/desktop)
- [ ] 5.1.1.16 Test form validation on all forms
- [ ] 5.1.1.17 Test error handling and error messages
- [ ] 5.1.1.18 Test navigation (sidebar, breadcrumbs, back button)
- [ ] 5.1.1.19 Generate test report with screenshots
- [ ] 5.1.1.20 Fix all critical bugs found

#### Task Group 5.1.2: Cross-Browser Testing
**Agents:** qa-engineer (4)
**Dependencies:** 5.1.1

**Tasks:**
- [ ] 5.1.2.1 Test on Chrome (latest + 2 versions back)
- [ ] 5.1.2.2 Test on Firefox (latest)
- [ ] 5.1.2.3 Test on Safari (macOS)
- [ ] 5.1.2.4 Test on Safari (iOS)
- [ ] 5.1.2.5 Test on Edge (latest)
- [ ] 5.1.2.6 Test on mobile Chrome (Android)
- [ ] 5.1.2.7 Document browser-specific issues
- [ ] 5.1.2.8 Add polyfills if needed
- [ ] 5.1.2.9 Test on older iOS versions (iOS 13+)
- [ ] 5.1.2.10 Test on older Android versions (API 22+)

#### Task Group 5.1.3: Accessibility Testing
**Agents:** ux-researcher (2), qa-engineer (2)
**Dependencies:** 5.1.1

**Tasks:**
- [ ] 5.1.3.1 Run Lighthouse accessibility audit on all pages
- [ ] 5.1.3.2 Test keyboard navigation (Tab, Enter, Esc)
- [ ] 5.1.3.3 Test with screen reader (VoiceOver, NVDA)
- [ ] 5.1.3.4 Add missing aria-labels
- [ ] 5.1.3.5 Fix color contrast issues
- [ ] 5.1.3.6 Add focus indicators
- [ ] 5.1.3.7 Test form field labels
- [ ] 5.1.3.8 Add skip navigation links
- [ ] 5.1.3.9 Test with keyboard-only navigation
- [ ] 5.1.3.10 Generate accessibility report

**Validation:**
```bash
✓ All 24 pages pass browser tests
✓ All critical user flows automated
✓ Cross-browser compatibility verified
✓ Lighthouse score >90 on accessibility
✓ Keyboard navigation works everywhere
✓ Screen reader compatibility verified
```

### Wave 5.2: VP Integration Testing (Week 11)
**Priority:** CRITICAL
**Dependencies:** VP features complete (Phase 2)
**Agents:** backend-engineer (4), qa-engineer (3), ml-engineer (2)

#### Task Group 5.2.1: End-to-End VP Workflows
**Tasks:**
- [ ] 5.2.1.1 Test workspace creation → org-genesis → VPs created
- [ ] 5.2.1.2 Test VP auto-joins discipline channel
- [ ] 5.2.1.3 Test human assigns task to VP
- [ ] 5.2.1.4 Test VP polls backlog and selects task
- [ ] 5.2.1.5 Test VP spawns Claude Code session
- [ ] 5.2.1.6 Test VP executes work autonomously
- [ ] 5.2.1.7 Test VP posts status updates to channel
- [ ] 5.2.1.8 Test VP completes task
- [ ] 5.2.1.9 Test VP memory persistence across sessions
- [ ] 5.2.1.10 Test VP escalates blocked task to human
- [ ] 5.2.1.11 Test VP→VP task delegation
- [ ] 5.2.1.12 Test multi-VP collaboration
- [ ] 5.2.1.13 Test VP work hours enforcement
- [ ] 5.2.1.14 Test VP capacity management
- [ ] 5.2.1.15 Test VP analytics tracking

#### Task Group 5.2.2: VP Daemon Integration
**Agents:** backend-engineer (3), devops-engineer (2)
**Dependencies:** 5.2.1

**Tasks:**
- [ ] 5.2.2.1 Deploy VP-Daemon to 16 machines
- [ ] 5.2.2.2 Test daemon connects to Neolith backend
- [ ] 5.2.2.3 Test daemon spawns sessions correctly
- [ ] 5.2.2.4 Test daemon handles multiple VPs per machine
- [ ] 5.2.2.5 Test daemon memory management
- [ ] 5.2.2.6 Test daemon crash recovery
- [ ] 5.2.2.7 Test daemon logs and monitoring
- [ ] 5.2.2.8 Test daemon updates and restarts
- [ ] 5.2.2.9 Load test with 16 concurrent VPs
- [ ] 5.2.2.10 Test daemon health checks

#### Task Group 5.2.3: Slack Integration Testing
**Agents:** backend-engineer (2), qa-engineer (2)
**Dependencies:** 5.2.2

**Tasks:**
- [ ] 5.2.3.1 Install `@wundr.io/slack-agent` package
- [ ] 5.2.3.2 Test VP connects to Slack workspace
- [ ] 5.2.3.3 Test VP dual presence (Slack + Neolith)
- [ ] 5.2.3.4 Test VP responds to Slack mentions
- [ ] 5.2.3.5 Test VP posts updates to Slack channels
- [ ] 5.2.3.6 Test VP receives tasks from Slack
- [ ] 5.2.3.7 Test cross-platform sync (Slack ↔ Neolith)
- [ ] 5.2.3.8 Test VP memory shared across platforms
- [ ] 5.2.3.9 Test Slack slash commands
- [ ] 5.2.3.10 Test Slack interactive messages

**Validation:**
```bash
✓ Workspace creation generates full org via org-genesis
✓ VPs autonomously work through backlogs
✓ VP daemon running on all 16 machines
✓ VPs can participate in Slack + Neolith
✓ Cross-platform VP memory works
✓ VP analytics tracking functional
```

---

## Phase 6: Production Deployment (Week 12)

**Duration:** 1 week
**Agents Required:** 20 agents
**Dependencies:** All testing complete

### Wave 6.1: Production Deployment (Week 12)
**Priority:** CRITICAL
**Agents:** devops-engineer (6), backend-engineer (3), software-engineer (2)

#### Task Group 6.1.1: Infrastructure Setup
**Tasks:**
- [ ] 6.1.1.1 Set up production database (Postgres on Railway/Supabase)
- [ ] 6.1.1.2 Set up Redis for caching and sessions
- [ ] 6.1.1.3 Set up S3 buckets (uploads, avatars)
- [ ] 6.1.1.4 Set up CloudFront CDN for S3
- [ ] 6.1.1.5 Set up SQS queues for background jobs
- [ ] 6.1.1.6 Set up LiveKit production server
- [ ] 6.1.1.7 Configure DNS and domains
- [ ] 6.1.1.8 Set up SSL certificates
- [ ] 6.1.1.9 Configure CORS and security headers
- [ ] 6.1.1.10 Set up monitoring (Sentry, Datadog, etc.)

#### Task Group 6.1.2: Environment Configuration
**Agents:** devops-engineer (4)
**Dependencies:** 6.1.1

**Tasks:**
- [ ] 6.1.2.1 Create production .env files
- [ ] 6.1.2.2 Configure OAuth apps for production URLs
- [ ] 6.1.2.3 Generate production API keys
- [ ] 6.1.2.4 Configure VAPID keys for push notifications
- [ ] 6.1.2.5 Set up secret management (AWS Secrets Manager / Vault)
- [ ] 6.1.2.6 Configure environment variables in hosting platform
- [ ] 6.1.2.7 Set up backup and disaster recovery
- [ ] 6.1.2.8 Configure log aggregation
- [ ] 6.1.2.9 Set up alerting and on-call rotation
- [ ] 6.1.2.10 Document deployment procedures

#### Task Group 6.1.3: Application Deployment
**Agents:** devops-engineer (4), backend-engineer (2)
**Dependencies:** 6.1.2

**Tasks:**
- [ ] 6.1.3.1 Deploy web app to Vercel/Netlify/Railway
- [ ] 6.1.3.2 Run database migrations on production
- [ ] 6.1.3.3 Seed initial data (if needed)
- [ ] 6.1.3.4 Deploy GraphQL API
- [ ] 6.1.3.5 Configure autoscaling
- [ ] 6.1.3.6 Set up health checks
- [ ] 6.1.3.7 Configure rate limiting
- [ ] 6.1.3.8 Set up DDoS protection
- [ ] 6.1.3.9 Enable monitoring dashboards
- [ ] 6.1.3.10 Smoke test production deployment

#### Task Group 6.1.4: App Store Submissions
**Agents:** mobile-dev (3), devops-engineer (2)
**Dependencies:** 6.1.3

**Tasks:**
- [ ] 6.1.4.1 Final iOS build for App Store
- [ ] 6.1.4.2 Submit iOS app for review
- [ ] 6.1.4.3 Final Android build for Google Play
- [ ] 6.1.4.4 Submit Android app for review
- [ ] 6.1.4.5 Upload desktop builds to GitHub Releases
- [ ] 6.1.4.6 Create update server for desktop auto-updates
- [ ] 6.1.4.7 Monitor app store review status
- [ ] 6.1.4.8 Address any review feedback
- [ ] 6.1.4.9 Release apps to public
- [ ] 6.1.4.10 Announce launch

#### Task Group 6.1.5: VP Daemon Production Deployment
**Agents:** devops-engineer (4), backend-engineer (2)
**Dependencies:** 6.1.3

**Tasks:**
- [ ] 6.1.5.1 Install VP-Daemon on all 16 machines
- [ ] 6.1.5.2 Configure daemon to connect to production backend
- [ ] 6.1.5.3 Set up daemon monitoring and alerting
- [ ] 6.1.5.4 Configure daemon auto-restart on failure
- [ ] 6.1.5.5 Set up daemon log rotation
- [ ] 6.1.5.6 Test daemon connectivity from all machines
- [ ] 6.1.5.7 Create VP charters for production VPs
- [ ] 6.1.5.8 Initialize production VPs
- [ ] 6.1.5.9 Test autonomous operation in production
- [ ] 6.1.5.10 Monitor VP performance

**Validation:**
```bash
✓ Production web app live at neolith.ai
✓ Database and infrastructure stable
✓ iOS app live on App Store
✓ Android app live on Google Play
✓ Desktop apps downloadable from website
✓ All 16 VP daemons connected and operational
✓ VPs autonomously working on tasks
✓ Monitoring and alerts configured
✓ Backup and disaster recovery tested
```

---

## Swarm Orchestration Strategy

### Swarm Composition per Phase

**20-Agent Swarm Template:**
- 1x **task-orchestrator** (coordinator)
- 4-6x **Domain specialists** (based on phase: frontend, backend, mobile, etc.)
- 2-3x **QA engineers** (testing, validation)
- 2x **Code reviewers** (quality assurance)
- 1x **Product owner** (acceptance criteria validation)
- 1x **Performance monitor** (tracking metrics)
- 2-3x **Software engineers** (generalist support)
- 1x **Deployment manager** (CI/CD, releases)

### Parallel Execution Strategy

**Phase Pattern:**
- **Sequential waves** when dependencies exist (e.g., 0.1 must complete before 1.1)
- **Parallel waves** when tasks are independent (e.g., 1.3 can run while 1.2 runs)
- **Agent spawning**: Single message with multiple Task tool calls for parallel agents

**Example Parallel Spawn:**
```typescript
// In one message, spawn 20 agents:
Task({ subagent_type: "task-orchestrator", ... })
Task({ subagent_type: "backend-engineer", ... })
Task({ subagent_type: "backend-engineer", ... })
Task({ subagent_type: "frontend-engineer", ... })
// ... 16 more agents
```

### Quality Gates

**Between Phases:**
1. All tasks marked complete in TodoWrite
2. Browser tests pass with Playwright MCP
3. Code review approval from reviewer agents
4. Performance benchmarks met
5. No critical bugs in issue tracker

**Go/No-Go Criteria:**
- Phase 0: VP-Daemon published to npm, browser MCP working
- Phase 1: Org-genesis integrated, VPs can be created autonomously
- Phase 2: VP can complete at least 1 task end-to-end
- Phase 3: All 24 pages pass browser tests
- Phase 4: Mobile apps run on physical devices, desktop apps package
- Phase 5: All critical user flows tested and passing
- Phase 6: Production deployment successful, no P0 bugs

---

## Testing & Validation Matrix

### Browser Testing Checklist (Per Page)

| Page | Loads | Empty State | Skeleton | Mobile | Tablet | Desktop | Dark Mode |
|------|-------|-------------|----------|--------|--------|---------|-----------|
| Dashboard | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| VPs | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| VP Detail | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Agents | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Workflows | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Deployments | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Analytics | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Channels | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Channel Detail | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Channel Settings | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Call | [ ] | N/A | [ ] | [ ] | [ ] | [ ] | [ ] |
| User Settings | [ ] | N/A | [ ] | [ ] | [ ] | [ ] | [ ] |
| Integrations | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Notifications | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Admin Dashboard | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Admin Settings | [ ] | N/A | [ ] | [ ] | [ ] | [ ] | [ ] |
| Admin Members | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Admin Roles | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Admin Billing | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Admin Activity | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Admin VP Health | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] |
| Login | [ ] | N/A | N/A | [ ] | [ ] | [ ] | [ ] |
| Register | [ ] | N/A | N/A | [ ] | [ ] | [ ] | [ ] |
| Auth Error | [ ] | N/A | N/A | [ ] | [ ] | [ ] | [ ] |

### Critical User Flows (Automated with Playwright MCP)

1. **Authentication Flow**
   - [ ] User clicks "Sign in with Google"
   - [ ] OAuth consent screen appears
   - [ ] User authenticates
   - [ ] Redirects to dashboard
   - [ ] Avatar downloaded and stored in S3

2. **Workspace Creation with Org-Genesis**
   - [ ] User clicks "Create Workspace"
   - [ ] Conversational flow appears
   - [ ] User describes organization
   - [ ] Org manifest generated
   - [ ] Preview shows org chart
   - [ ] User confirms
   - [ ] VPs created automatically
   - [ ] Channels created automatically
   - [ ] User redirected to workspace

3. **VP Autonomous Work**
   - [ ] Human creates task
   - [ ] Assigns task to VP
   - [ ] VP receives notification
   - [ ] VP adds task to backlog
   - [ ] VP polls and selects task
   - [ ] VP spawns Claude session
   - [ ] VP executes work
   - [ ] VP posts status update
   - [ ] VP completes task
   - [ ] Human receives notification

4. **Channel Messaging**
   - [ ] User creates channel
   - [ ] User invites members
   - [ ] User sends message
   - [ ] Message appears for others
   - [ ] User uploads file
   - [ ] File stored in S3
   - [ ] File displays in channel
   - [ ] User adds reaction
   - [ ] User starts thread

5. **Video Call**
   - [ ] User clicks "Start Call"
   - [ ] Call room created
   - [ ] LiveKit connects
   - [ ] Video/audio starts
   - [ ] User invites participant
   - [ ] Participant joins
   - [ ] Screen sharing works
   - [ ] Recording works
   - [ ] Call ends gracefully

### VP Integration Tests

1. **Org-Genesis End-to-End**
   - [ ] Genesis engine invoked
   - [ ] Manifest generated
   - [ ] Database transaction starts
   - [ ] VPs created
   - [ ] Channels created
   - [ ] VP↔Channel assignments
   - [ ] Org hierarchy stored
   - [ ] Transaction commits
   - [ ] UI updates

2. **VP Work Cycle**
   - [ ] Task created in backlog
   - [ ] VP daemon polls
   - [ ] Task selected by priority
   - [ ] Context prepared (charter + memory)
   - [ ] Claude session spawned
   - [ ] Work executed
   - [ ] Results captured
   - [ ] Task status updated
   - [ ] Channel notified
   - [ ] Memory updated

3. **VP Memory Persistence**
   - [ ] Conversation stored
   - [ ] Task result stored
   - [ ] Pattern learned
   - [ ] Memory retrieved in next session
   - [ ] Context maintained
   - [ ] Cross-session continuity

---

## Timeline Summary

| Phase | Duration | Weeks | Agents | Key Deliverables |
|-------|----------|-------|--------|------------------|
| **Phase 0** | 1-2 days | - | 10 | VP-Daemon package, Browser MCP, Config fixes |
| **Phase 1** | 2 weeks | 1-2 | 40 | Org-genesis integration, VP backlog, S3 avatars |
| **Phase 2** | 2 weeks | 3-4 | 40 | VP autonomous operation, communication, analytics |
| **Phase 3** | 2 weeks | 5-6 | 40 | Responsive design, empty states, theme toggle |
| **Phase 4** | 3 weeks | 7-9 | 60 | Desktop builds, mobile apps, App Store submission |
| **Phase 5** | 2 weeks | 10-11 | 40 | Browser testing, VP integration testing |
| **Phase 6** | 1 week | 12 | 20 | Production deployment, app launches |
| **TOTAL** | **12 weeks** | | **250 agent-weeks** | **Production-ready Neolith** |

---

## Success Metrics

### Launch Readiness Criteria

**Technical:**
- ✅ All 24 web pages functional and tested
- ✅ Zero P0 bugs, <5 P1 bugs
- ✅ Lighthouse scores: Performance >85, Accessibility >90
- ✅ Browser tests 100% passing
- ✅ Mobile apps approved by Apple/Google
- ✅ Desktop apps signed and notarized
- ✅ 16 VP daemons operational

**Functional:**
- ✅ Workspace creation generates org via org-genesis
- ✅ VPs autonomously complete at least 10 tasks
- ✅ VP memory persists across sessions
- ✅ VP↔human communication works
- ✅ Cross-platform VP operation (Slack + Neolith)

**Performance:**
- ✅ Page load <2s (95th percentile)
- ✅ API response time <500ms (95th percentile)
- ✅ VP task selection <10s
- ✅ VP work execution success rate >90%

**User Experience:**
- ✅ Onboarding completion rate >80%
- ✅ Mobile responsive on all devices
- ✅ Empty states on all pages
- ✅ Theme switching works
- ✅ Zero broken images/icons

---

## Risk Mitigation

### High-Risk Items

1. **VP-Daemon Complexity**
   - Risk: Building from scratch is complex
   - Mitigation: Allocate experienced backend engineers, start Phase 0 immediately

2. **App Store Rejections**
   - Risk: Apple/Google may reject apps
   - Mitigation: Follow guidelines strictly, add native features, beta test extensively

3. **Browser Testing Scale**
   - Risk: 24 pages × multiple scenarios = hundreds of tests
   - Mitigation: Use Playwright MCP for automation, parallelize testing

4. **VP Autonomous Operation**
   - Risk: Complex AI behavior is hard to predict
   - Mitigation: Extensive testing, human oversight, gradual rollout

5. **Timeline Pressure**
   - Risk: 12 weeks is aggressive
   - Mitigation: Phase 0 blocking items first, parallel execution, 20-agent swarms

### Contingency Plans

- **If VP-Daemon delayed:** Use simplified polling mechanism temporarily
- **If mobile delayed:** Launch web + desktop first, mobile in Phase 2
- **If org-genesis integration complex:** Allow manual org creation initially
- **If App Store review fails:** Address feedback, resubmit, launch web version first

---

## Appendices

### A. Tool & Package Versions

- Next.js: 16.0.3
- React: 18.2.0
- TypeScript: 5.3.3+
- Capacitor: 6.x
- Electron: 28.x
- Playwright MCP: Latest
- @wundr packages: 1.0.3

### B. Infrastructure Requirements

- Database: PostgreSQL 14+
- Redis: 7.x
- S3-compatible storage
- LiveKit server
- 16 VP daemon machines (Linux/macOS)

### C. External Dependencies

- Apple Developer Program ($99/year)
- Google Play Developer ($25 one-time)
- Code signing certificates
- Domain names and SSL
- Hosting platforms (Vercel/Railway/etc.)

---

**Document Version:** 1.0.0
**Last Updated:** November 26, 2025
**Next Review:** After Phase 0 completion
