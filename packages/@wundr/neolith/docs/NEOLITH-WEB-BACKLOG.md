# NEOLITH WEB APPLICATION BACKLOG

**Version:** 1.0.0
**Date:** November 26, 2025
**Source:** Comprehensive Code Review of `neolith/apps/web`
**Reference:** Phase 8 in INSTITUTIONAL-READINESS-ROADMAP.md

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Critical Issues (P0)](#critical-issues-p0)
3. [High Priority Issues (P1)](#high-priority-issues-p1)
4. [Medium Priority Issues (P2)](#medium-priority-issues-p2)
5. [Low Priority Issues (P3)](#low-priority-issues-p3)
6. [Missing API Endpoints](#missing-api-endpoints)
7. [Missing Pages](#missing-pages)
8. [Package Integration Status](#package-integration-status)
9. [Security Concerns](#security-concerns)
10. [Work Estimates](#work-estimates)

---

## Executive Summary

### Overall Application Readiness: 35-40%

A comprehensive code review of all `page.tsx` files, API routes, hooks, and utilities in the Neolith web application revealed **200+ issues** requiring attention before the application is production-ready.

### Quality Scores by Area

| Area | Score | Issues | Status |
|------|-------|--------|--------|
| Dashboard | 4/10 | 15 | Mock data, missing quick actions |
| VPs Pages | 7.5/10 | 12 | 75% complete, API parsing issues |
| Channels | 4/10 | 25 | Mock data everywhere, 13 missing endpoints |
| Admin Pages | 4/10 | 47 | ALL API paths wrong, mostly placeholders |
| Workflows | 4.5/10 | 18 | 100% simulated execution |
| Settings | 3.5/10 | 34 | 35-40% complete, OAuth broken |
| Agents | 5% | N/A | Complete stub |
| Deployments | 5% | N/A | Complete stub |
| Auth Pages | 6.5/10 | 12 | Registration API missing (CRITICAL) |
| Hooks | - | 51 | 51 API endpoints called, many missing |

### Technical Debt Estimate: 150-200 hours

---

## Critical Issues (P0)

### 1. Authentication System - Registration Broken

**Location:** `app/(auth)/register/page.tsx`

**Issue:** The registration form submits to an API endpoint that doesn't exist.

```typescript
// Current code in register/page.tsx:40
// "Currently a placeholder for future credential-based registration"

// Expected endpoint that doesn't exist:
// POST /api/auth/register
```

**Impact:** Users cannot create accounts with email/password.

**Fix Required:**
- Create `/api/auth/register` endpoint
- Implement password hashing (bcrypt/argon2)
- Add email verification flow
- Add to NextAuth credentials provider

---

### 2. Admin Pages - All API Paths Wrong

**Location:** All files in `app/(workspace)/[workspaceId]/admin/*`

**Issue:** Admin pages call hardcoded URLs without workspace prefix.

```typescript
// Current (BROKEN):
fetch('/api/organizations/1/members')
fetch('/api/organizations/1/roles')
fetch('/api/organizations/1/settings')

// Should be:
fetch(`/api/workspaces/${workspaceId}/members`)
fetch(`/api/workspaces/${workspaceId}/roles`)
fetch(`/api/workspaces/${workspaceId}/settings`)
```

**Affected Pages:**
- `/admin/page.tsx` - Dashboard
- `/admin/members/page.tsx` - Member management
- `/admin/roles/page.tsx` - Role management
- `/admin/settings/page.tsx` - Settings
- `/admin/billing/page.tsx` - Billing
- `/admin/activity/page.tsx` - Activity log

**Impact:** All admin functionality is broken.

---

### 3. Settings Page - 404 Error

**Location:** Navigation sidebar links to `/settings`

**Issue:** The `/settings/page.tsx` file does not exist, causing a 404.

**Evidence:** Screenshot shows "404 | This page could not be found"

**Fix Required:**
- Create `/app/(workspace)/[workspaceId]/settings/page.tsx`
- Or redirect `/settings` to appropriate settings page

---

### 4. Workflow Execution - 100% Simulated

**Location:** `app/(workspace)/[workspaceId]/workflows/[workflowId]/page.tsx`

**Issue:** Workflow execution is completely faked with `setTimeout`.

```typescript
// Current fake implementation:
const simulateExecution = async () => {
  await new Promise((resolve) => setTimeout(resolve, 1000));
  setCurrentStep(1);
  await new Promise((resolve) => setTimeout(resolve, 2000));
  setCurrentStep(2);
  // etc...
};
```

**Impact:** Workflows don't actually execute anything.

**Fix Required:**
- Integrate with workflow execution engine
- Connect to VP daemon for task execution
- Add real step progress tracking
- Implement error handling

---

### 5. Channel Messages - Mock Current User

**Location:** `app/(workspace)/[workspaceId]/channels/[channelId]/page.tsx:25`

**Issue:** Uses hardcoded mock user instead of authenticated session.

```typescript
// Current BROKEN code:
const MOCK_CURRENT_USER: User = {
  id: 'current-user-123',
  name: 'Current User',
  email: 'user@example.com',
  // ...
};
```

**Impact:** All messages sent with wrong user identity.

---

## High Priority Issues (P1)

### 6. Dashboard - Mock Data Throughout

**Location:** `app/(workspace)/[workspaceId]/dashboard/page.tsx`

**Issues:**
- Mock workspaces array
- Mock activity data
- Mock quick stats
- Mock quick actions (6 hardcoded items)
- No real API integration

**Fix Required:**
- Create `/api/workspaces/${workspaceId}/dashboard` endpoint
- Fetch real activity data
- Calculate real stats (VPs, agents, deployments, workflows)
- Dynamic quick actions based on user state

---

### 7. VPs Pages - API Response Parsing Mismatches

**Location:** Multiple files in `app/(workspace)/[workspaceId]/vps/*`

**Issue:** Inconsistent API response structure expectations.

```typescript
// Some places expect:
const data = await response.json();
const vps = data.data; // { data: VP[] }

// Other places expect:
const vps = await response.json(); // VP[] directly
```

**Affected Files:**
- `vps/page.tsx` - List view
- `vps/[vpId]/page.tsx` - Detail view
- Related hooks

---

### 8. Channels - 13 Missing API Endpoints

**Location:** `app/(workspace)/[workspaceId]/channels/*`

**Missing Endpoints:**

| Endpoint | Used In | Purpose |
|----------|---------|---------|
| `GET /api/channels` | channels/page.tsx | List channels |
| `POST /api/channels` | channels/page.tsx | Create channel |
| `GET /api/channels/[id]/messages` | channel detail | Get messages |
| `POST /api/channels/[id]/messages` | channel detail | Send message |
| `DELETE /api/channels/[id]/messages/[msgId]` | channel detail | Delete message |
| `POST /api/channels/[id]/messages/[msgId]/reactions` | channel detail | Add reaction |
| `DELETE /api/channels/[id]/messages/[msgId]/reactions` | channel detail | Remove reaction |
| `POST /api/channels/[id]/threads` | channel detail | Create thread |
| `GET /api/channels/[id]/threads/[threadId]` | channel detail | Get thread |
| `PATCH /api/channels/[id]/settings` | channel settings | Update settings |
| `POST /api/channels/[id]/members` | channel settings | Add member |
| `DELETE /api/channels/[id]/members/[memberId]` | channel settings | Remove member |
| `POST /api/channels/[id]/pins` | channel detail | Pin message |

---

### 9. Analytics Page - Stub Only

**Location:** `app/(workspace)/[workspaceId]/analytics/page.tsx`

**Issue:** Displays "Analytics coming soon..." placeholder.

**Fix Required:**
- Integrate with `@wundr.io/agent-observability` package
- Create analytics dashboard with real metrics
- Add VP performance charts
- Add task completion rates
- Add usage statistics

---

### 10. Deployments Page - Stub Only

**Location:** `app/(workspace)/[workspaceId]/deployments/page.tsx`

**Issue:** Shows empty state with no real deployment management.

**Fix Required:**
- Create deployment management system
- Integrate with Railway/Netlify MCP servers
- Add deployment status tracking
- Add deployment history

---

### 11. Agents Page - Stub Only

**Location:** `app/(workspace)/[workspaceId]/agents/page.tsx`

**Issue:** Shows empty state with no agent management.

**Fix Required:**
- Create agent CRUD operations
- Display agent status (running, idle, offline)
- Add agent configuration UI
- Integrate with VP daemon

---

## Medium Priority Issues (P2)

### 12. VP Detail Page - Incomplete Features

**Location:** `app/(workspace)/[workspaceId]/vps/[vpId]/page.tsx`

**"Coming Soon" Placeholders:**
- Line 355: "Activity log coming soon"
- Line 371: "Agent management coming soon"

**Fix Required:**
- Implement VP activity log with real data
- Implement agent management UI
- Connect to VP daemon for live status

---

### 13. Settings Pages - Multiple Issues

**Location:** `app/(workspace)/[workspaceId]/settings/*`

**Issues by Page:**

| Page | Issue |
|------|-------|
| `settings/page.tsx` | 404 - doesn't exist |
| `settings/security/page.tsx` | OAuth flows broken, token display hardcoded |
| `settings/notifications/page.tsx` | Preferences don't persist |
| `settings/integrations/page.tsx` | Only shows Slack, no real OAuth |
| `settings/profile/page.tsx` | Avatar upload non-functional |

---

### 14. Channel Creation Dialog - Placeholder

**Location:** `app/(workspace)/[workspaceId]/channels/page.tsx:82-99`

**Issue:** Create channel button shows placeholder dialog.

```typescript
// Current placeholder:
<DialogContent>
  <p>Channel creation form will go here</p>
</DialogContent>
```

**Fix Required:**
- Create proper channel creation form
- Add channel name validation
- Add channel type selection (public/private)
- Add initial member selection

---

### 15. Call Recording - TODOs Not Implemented

**Location:** `app/api/calls/[callId]/recording/route.ts`

**TODOs:**
- Line 277: "TODO: Start recording via LiveKit Egress API"
- Line 433: "TODO: Stop recording via LiveKit Egress API"

**Fix Required:**
- Install `livekit-server-sdk`
- Implement `startRoomCompositeEgress()`
- Implement `stopEgress()`
- Store recordings in S3

---

### 16. File Deletion - S3 Not Implemented

**Location:** `app/api/files/[id]/route.ts:41`

**TODO:** "Implement AWS S3 DeleteObject call"

**Fix Required:**
- Add AWS SDK v3
- Implement `DeleteObjectCommand`
- Add CloudFront cache invalidation

---

### 17. Audit Logging - Not Implemented

**Location:** `app/api/vps/[id]/actions/route.ts:219`

**TODO:** "Log the action to audit log service"

**Fix Required:**
- Create AuditLog Prisma model
- Create audit log service
- Log all VP actions
- Add audit log viewer in admin

---

## Low Priority Issues (P3)

### 18. Console Statements in Production Code

**Scope:** 50+ API route files

**Issue:** Debug `console.log`, `console.error`, `console.warn` statements throughout.

**Fix Required:**
- Create structured logger (pino/winston)
- Replace all console statements
- Add log levels and correlation IDs

---

### 19. Daemon API Key Validation - Not Implemented

**Location:** Multiple files in `app/api/daemon/*`

**TODOs:**
- `register/route.ts:138` - "Validate API key against VP's stored key hash"
- `register/route.ts:147` - "Verify VP exists and belongs to organization"
- `register/route.ts:151` - "Get Redis client and heartbeat service"
- `unregister/route.ts:112` - "Validate API key against VP's stored key hash"
- `unregister/route.ts:120` - "Get Redis client and heartbeat service"

---

### 20. Prisma Type Workarounds

**Location:** `app/api/daemon/messages/route.ts:188`

**Issue:** "Workaround for Prisma type mapping"

---

### 21. Temporary IDs

**Location:** `app/api/tasks/route.ts:326`

**Issue:** "temporary ID for new task" - should use proper UUID generation.

---

### 22. Call Invite Notifications - Not Implemented

**Location:** `app/api/calls/[callId]/invite/route.ts:264`

**TODO:** "Send notifications to invited users"

---

### 23. Huddle Room Closure - Not Implemented

**Location:** `app/api/huddles/[huddleId]/route.ts:463`

**TODO:** "Notify LiveKit to close the room"

---

## Missing API Endpoints

### Critical (Block core functionality)

| Endpoint | Purpose | Priority |
|----------|---------|----------|
| `POST /api/auth/register` | User registration | P0 |
| `POST /api/auth/forgot-password` | Password reset | P1 |
| `POST /api/auth/reset-password` | Password reset | P1 |
| `GET /api/workspaces/[id]/members` | Admin members | P0 |
| `GET /api/workspaces/[id]/roles` | Admin roles | P0 |
| `GET /api/workspaces/[id]/activity` | Admin activity | P1 |
| `GET /api/workspaces/[id]/billing` | Admin billing | P1 |

### High (Enable key features)

| Endpoint | Purpose | Priority |
|----------|---------|----------|
| `GET /api/channels` | List channels | P1 |
| `POST /api/channels` | Create channel | P1 |
| `GET /api/channels/[id]/messages` | Channel messages | P1 |
| `POST /api/channels/[id]/messages` | Send message | P1 |
| `GET /api/vps/[id]/activity` | VP activity log | P1 |
| `GET /api/analytics/dashboard` | Analytics data | P1 |
| `GET /api/deployments` | List deployments | P1 |
| `POST /api/deployments` | Create deployment | P1 |

### Medium (Enhance experience)

| Endpoint | Purpose | Priority |
|----------|---------|----------|
| `POST /api/channels/[id]/messages/[msgId]/reactions` | Message reactions | P2 |
| `DELETE /api/channels/[id]/messages/[msgId]/reactions` | Remove reaction | P2 |
| `POST /api/channels/[id]/threads` | Thread creation | P2 |
| `GET /api/channels/[id]/threads/[threadId]` | Get thread | P2 |
| `POST /api/channels/[id]/pins` | Pin message | P2 |
| `PATCH /api/settings/notifications` | Save preferences | P2 |
| `POST /api/settings/profile/avatar` | Avatar upload | P2 |

---

## Missing Pages

| Page | Route | Priority | Description |
|------|-------|----------|-------------|
| Settings Index | `/settings/page.tsx` | P0 | Returns 404 |
| Forgot Password | `/forgot-password/page.tsx` | P1 | No password reset |
| Reset Password | `/reset-password/page.tsx` | P1 | No password reset |
| Email Verification | `/verify-email/page.tsx` | P2 | No email verification |
| VP Activity | `/vps/[id]/activity/page.tsx` | P2 | Activity subpage |
| VP Agents | `/vps/[id]/agents/page.tsx` | P2 | Agent management subpage |

---

## Package Integration Status

### Not Integrated (Required)

| Package | Purpose | Integration Status |
|---------|---------|-------------------|
| `@wundr.io/vp-daemon` | VP autonomous operation | 0% - Package built but not used |
| `@wundr.io/agent-memory` | VP memory persistence | 0% - Not imported |
| `@wundr.io/agent-observability` | VP analytics | 0% - Not imported |
| `@wundr.io/slack-agent` | Slack integration | 0% - Not imported |

### Partially Integrated

| Package | Purpose | Integration Status |
|---------|---------|-------------------|
| `@wundr.io/org-genesis` | Org generation | 30% - API route exists, dynamic import issues |
| `@neolith/org-integration` | Org migration | 30% - Imported but not fully wired |
| `livekit-server-sdk` | Video calls | 50% - Basic calls work, recording broken |

### Fully Integrated

| Package | Purpose | Integration Status |
|---------|---------|-------------------|
| `next-auth` | Authentication | 90% - OAuth works, credentials missing |
| `@prisma/client` | Database | 100% |
| `@neolith/ui` | UI components | 100% |

---

## Security Concerns

### Critical

1. **No input validation on admin endpoints** - All admin API routes lack Zod validation
2. **Hardcoded organization IDs** - Admin pages use `/api/organizations/1/`
3. **Mock user identity** - Messages sent with fake user ID
4. **Missing CSRF protection** - No CSRF tokens on forms
5. **API key validation not implemented** - Daemon endpoints accept any key

### High

1. **Console statements expose information** - Debug logs in production
2. **No rate limiting** - API endpoints can be abused
3. **Missing audit logging** - Sensitive operations not tracked
4. **Session management gaps** - No session rotation, no concurrent session limits

### Medium

1. **TypeScript any types** - Reduces type safety
2. **Missing error boundaries** - Uncaught errors crash pages
3. **No request signing** - VP operations not authenticated

---

## Work Estimates

### By Priority

| Priority | Issues | Estimated Hours |
|----------|--------|-----------------|
| P0 - Critical | 5 | 40-50 hours |
| P1 - High | 11 | 60-80 hours |
| P2 - Medium | 6 | 30-40 hours |
| P3 - Low | 6 | 20-30 hours |
| **Total** | **28** | **150-200 hours** |

### By Category

| Category | Estimated Hours |
|----------|-----------------|
| Auth System | 20-25 |
| Admin Pages | 25-30 |
| Channel Features | 30-35 |
| VP Features | 25-30 |
| API Endpoints | 25-30 |
| Security Hardening | 15-20 |
| Code Quality | 10-15 |
| Testing | 20-25 |
| **Total** | **170-210 hours** |

### By Sprint (2-week sprints)

| Sprint | Focus | Deliverables |
|--------|-------|--------------|
| Sprint 1 | Critical fixes | Auth registration, Admin API paths, Settings 404 |
| Sprint 2 | Channel completion | All 13 channel endpoints, message CRUD |
| Sprint 3 | VP features | Activity log, agent management, real data |
| Sprint 4 | Admin completion | All admin pages functional, real data |
| Sprint 5 | Polish & security | Logging, validation, testing |

---

## Implementation Priorities

### Must Have (MVP)

1. Fix authentication registration
2. Fix all admin page API paths
3. Create settings page
4. Implement real channel message functionality
5. Replace mock current user with session

### Should Have (Launch)

1. VP activity log
2. VP agent management
3. Workflow execution engine
4. Analytics dashboard
5. Deployment management

### Nice to Have (Post-Launch)

1. Call recording
2. Thread functionality
3. Message reactions
4. OAuth token management
5. Audit logging

---

## Appendix: Files Requiring Changes

### High-Change Files (>20 changes needed)

- `app/(workspace)/[workspaceId]/admin/members/page.tsx`
- `app/(workspace)/[workspaceId]/admin/roles/page.tsx`
- `app/(workspace)/[workspaceId]/channels/[channelId]/page.tsx`
- `app/(workspace)/[workspaceId]/dashboard/page.tsx`

### Medium-Change Files (10-20 changes)

- `app/(workspace)/[workspaceId]/channels/page.tsx`
- `app/(workspace)/[workspaceId]/vps/[vpId]/page.tsx`
- `app/(workspace)/[workspaceId]/workflows/[workflowId]/page.tsx`
- `app/(workspace)/[workspaceId]/settings/security/page.tsx`
- `app/(workspace)/[workspaceId]/settings/integrations/page.tsx`

### Low-Change Files (5-10 changes)

- `app/(auth)/register/page.tsx`
- `app/(auth)/login/page.tsx`
- `app/api/calls/[callId]/recording/route.ts`
- `app/api/files/[id]/route.ts`
- `app/api/daemon/register/route.ts`

---

**Document Version:** 1.0.0
**Last Updated:** November 26, 2025
**Next Review:** After Phase 8 completion
