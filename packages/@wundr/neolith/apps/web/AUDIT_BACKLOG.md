# Neolith Web App - Comprehensive UX/UI Audit Backlog

## Executive Summary

**Total Views Audited:** 65+ pages
**Total Components:** 150+ components
**Critical Issues Found:** 47
**Major Issues Found:** 89
**Minor Issues Found:** 156
**Stubs/Placeholders Found:** 394 occurrences

---

## PHASE 2: Critical Bug Fixes & Stub Removal (PRIORITY: CRITICAL)

### 2.1 Navigation & Routing Bugs
- [ ] **CRITICAL** `workspaces/page.tsx:223` - Fix workspace navigation using `id` instead of `slug`
- [ ] **CRITICAL** `video-room.tsx:451-452` - Fix swapped device selection callbacks

### 2.2 Hardcoded/Mock Data Removal
- [ ] `settings/page.tsx:77` - Remove hardcoded `isEmailVerified = true`
- [ ] `security/page.tsx:45-81` - Replace mock session and connected accounts data
- [ ] `billing/page.tsx:50-116` - Move hardcoded plan data to API
- [ ] `admin-dashboard-section.tsx:62` - Implement admin stats API
- [ ] `member-dashboard-section.tsx:84` - Implement member info API

### 2.3 TODO Stub Implementations
- [ ] `tasks/page.tsx:336` - Implement Create Task modal
- [ ] `org-genesis-wizard.tsx:145-148` - Implement handleCustomize or remove button
- [ ] `dm/[dmId]/page.tsx:633-634` - Implement search in conversation
- [ ] `dm/[dmId]/page.tsx:741-742` - Implement AI summarization or remove
- [ ] `call-controls.tsx:297-335` - Implement Chat and View participants buttons
- [ ] `video-room.tsx:265-266` - Implement host mute/kick controls

---

## PHASE 3: Auth & Onboarding Enhancements

### 3.1 Login Page
- [ ] Add proper `<label>` elements for accessibility (WCAG 2.1 AA)
- [ ] Add `aria-live="polite"` and `role="alert"` to error messages
- [ ] Add password visibility toggle
- [ ] Add loading spinner to OAuth buttons
- [ ] Improve error message specificity

### 3.2 Register Page
- [ ] Fix password requirements mismatch (UI vs backend validation)
- [ ] Add password strength indicator
- [ ] Add field-specific error messages
- [ ] Add show/hide password toggle

### 3.3 Password Reset Flow
- [ ] **CRITICAL** Implement actual email service (Resend/SendGrid)
- [ ] Add token expiration messaging
- [ ] Add "resend reset link" option
- [ ] Show password requirements upfront

### 3.4 Onboarding
- [ ] Implement or remove "Customize" button stub
- [ ] Replace free-text org type with Select dropdown using schema enum
- [ ] Add localStorage persistence for wizard state
- [ ] Add organization templates for quick start

---

## PHASE 4: Dashboard & Activity Views

### 4.1 Workspace Dashboard
- [ ] Implement `/api/workspaces/:id/dashboard/admin-stats`
- [ ] Implement `/api/workspaces/:id/dashboard/member-info`
- [ ] Implement `/api/workspaces/:id/threads`
- [ ] Implement `/api/workspaces/:id/status` endpoints
- [ ] Integrate unused dashboard widgets (7 components built but not used)
- [ ] Add real-time updates (WebSocket/polling)
- [ ] Wire up activity filter buttons

### 4.2 Tasks View
- [ ] Implement Create Task modal/dialog
- [ ] Add task editing capabilities (status, priority, assignment)
- [ ] Add task deletion with confirmation
- [ ] Add sorting controls
- [ ] Add pagination
- [ ] Consider Table view option

### 4.3 Activity View
- [ ] Implement Timeline component for better chronological UX
- [ ] Add real-time activity streaming

---

## PHASE 5: Messaging System

### 5.1 Channels List
- [ ] Add real-time updates (WebSocket/Pusher)
- [ ] Add search/filter functionality
- [ ] Add sorting options
- [ ] Fix loading skeleton layout mismatch

### 5.2 Channel Detail
- [ ] **CRITICAL** Implement permissions system (replace hardcoded permissions)
- [ ] Add AI integration using shadcn/ai components
- [ ] Implement channel summarization
- [ ] Implement templates feature
- [ ] Implement workflows feature
- [ ] Implement huddle/call features

### 5.3 Direct Messages
- [ ] Implement search in conversation
- [ ] Implement AI summarization
- [ ] Complete Canvas tab
- [ ] Complete Lists/Workflows/Bookmarks tabs
- [ ] Implement voice/video recording or remove buttons

---

## PHASE 6: Orchestrator Management

### 6.1 Orchestrators List
- [ ] Replace inline SVG icons with lucide-react
- [ ] Fix OrchestratorStatus type mismatch
- [ ] Improve spec extraction with structured LLM output

### 6.2 Orchestrator Detail
- [ ] **CRITICAL** Implement AI chat integration (useChat, useCompletion)
- [ ] Complete Session Manager detail view
- [ ] Replace metric placeholders with real data

### 6.3 Orchestrator Settings
- [ ] Verify all API endpoints exist

---

## PHASE 7: Workflow Builder

### 7.1 Workflows List
- [ ] Add search functionality
- [ ] Add bulk actions
- [ ] Add sorting options

### 7.2 Workflow Editor
- [ ] Create `/workflows/[workflowId]/edit/page.tsx`
- [ ] Build detailed trigger configuration forms
- [ ] Build detailed action configuration forms
- [ ] Implement workflow variables UI
- [ ] Add drag-and-drop action reordering

### 7.3 Workflow Detail
- [ ] Add execution detail drill-down
- [ ] Add workflow analytics/charts

---

## PHASE 8: User Settings

### 8.1 Profile Settings
- [ ] Verify all API endpoints

### 8.2 Security Settings
- [ ] Implement real session management APIs
- [ ] Replace mock data with API calls
- [ ] Add OAuth provider connection/disconnection

### 8.3 Accessibility Settings
- [ ] Replace DOM manipulation with CSS classes

### 8.4 Integrations Settings
- [ ] Implement missing modal components
- [ ] Implement API token management

---

## PHASE 9: Admin Dashboard & Settings

### 9.1 Admin Dashboard
- [ ] Add RBAC middleware and client-side checks
- [ ] Replace custom SVG icons with lucide-react
- [ ] Replace window.confirm with AlertDialog
- [ ] Create missing roles page

### 9.2 Admin Settings
- [ ] Verify all backend API routes
- [ ] Add react-hook-form + zod validation
- [ ] Add confirmation dialogs for destructive actions

---

## PHASE 10: Analytics & Reporting

### 10.1 Analytics Dashboard
- [ ] Integrate shadcn/ui Chart components
- [ ] Complete tablet dashboard charts (remove placeholders)
- [ ] Replace alert() with toast
- [ ] Add date range presets to desktop

---

## PHASE 11: AI Components Integration

### 11.1 Core Components
- [ ] Create unified ChatInterface wrapper
- [ ] Add AI SDK integration layer (useAIChat hook)
- [ ] Implement StreamingResponse with StreamableValue
- [ ] Add ToolCallRenderer for automatic tool call rendering
- [ ] Create AIProvider context

### 11.2 Component Enhancements
- [ ] Integrate experimental_thinking in Reasoning component
- [ ] Add multimodal support (images, files)
- [ ] Add comprehensive test coverage

---

## PHASE 12: Video Call Components

### 12.1 Design System Compliance
- [ ] Replace all custom buttons with shadcn/ui Button
- [ ] Replace custom dialogs with shadcn/ui Dialog
- [ ] Replace custom inputs with shadcn/ui Input
- [ ] Replace custom selects with shadcn/ui Select
- [ ] Replace custom dropdowns with shadcn/ui DropdownMenu

### 12.2 Bug Fixes
- [ ] Fix device selection callback swap
- [ ] Implement Chat toggle functionality
- [ ] Implement View participants functionality
- [ ] Implement host mute/kick controls

---

## PHASE 13: Final Polish & Validation

### 13.1 Consistency Checks
- [ ] Audit all components for shadcn/ui compliance
- [ ] Replace all window.confirm with AlertDialog
- [ ] Replace all alert() with toast
- [ ] Ensure all forms use react-hook-form + zod

### 13.2 Accessibility Audit
- [ ] WCAG 2.1 AA compliance check
- [ ] Screen reader testing
- [ ] Keyboard navigation testing

### 13.3 Performance Validation
- [ ] Run lighthouse audits
- [ ] Check bundle sizes
- [ ] Verify loading states

### 13.4 Final Build & Deploy
- [ ] Run lint --fix
- [ ] Run typecheck
- [ ] Run build
- [ ] Push to git

---

## Execution Strategy

Each phase will be executed with 20 parallel agents, followed by:
1. `npm run lint`
2. `npm run typecheck`
3. `npm run build`
4. Fix any errors
5. `git push origin master`

**Estimated Total: 13 Phases x 20 agents = 260 agent tasks**
