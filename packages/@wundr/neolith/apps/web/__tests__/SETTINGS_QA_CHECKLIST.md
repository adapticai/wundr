# Settings Pages - QA Testing Checklist

**Purpose:** Manual testing checklist for Settings pages
**Last Updated:** 2025-11-27
**Status:** Ready for testing once critical issues are fixed

---

## Pre-Testing Setup

- [ ] Dev server running on `localhost:3000`
- [ ] Valid test user account created
- [ ] Test workspace exists in database
- [ ] Browser DevTools console open
- [ ] Network tab monitoring enabled
- [ ] Screenshots folder ready

---

## 1. Main Settings Page (`/settings`)

### Navigation
- [ ] Can navigate to settings from dashboard
- [ ] Page loads without errors
- [ ] URL is correct: `/{workspaceId}/settings`
- [ ] No redirect loops occur
- [ ] Sidebar navigation visible (desktop)
- [ ] Mobile navigation visible (mobile)
- [ ] Breadcrumb shows "Settings"

### Visual Elements
- [ ] Page header displays "Settings"
- [ ] All cards render correctly:
  - [ ] Profile Settings card
  - [ ] Appearance card
  - [ ] Notification Preferences card
  - [ ] Account Settings card
  - [ ] Danger Zone card
  - [ ] Additional Links card
- [ ] Theme toggle component visible
- [ ] Avatar placeholder visible

### Form Inputs - Profile Section
- [ ] Name input field present (#name)
- [ ] Name input accepts text
- [ ] Email input field present (#email)
- [ ] Email input accepts email format
- [ ] Avatar upload button visible
- [ ] File input accepts image files
- [ ] Save Changes button present
- [ ] Save Changes button clickable

### Form Inputs - Notifications
- [ ] Email Notifications switch present (#email-notifications)
- [ ] Email Notifications switch toggles
- [ ] Push Notifications switch present (#push-notifications)
- [ ] Push Notifications switch toggles
- [ ] Weekly Digest switch present (#weekly-digest)
- [ ] Weekly Digest switch toggles
- [ ] Mention Alerts switch present (#mention-alerts)
- [ ] Mention Alerts switch toggles
- [ ] Orchestrator Updates switch present (#orchestrator-updates)
- [ ] Orchestrator Updates switch toggles

### Form Inputs - Account Settings
- [ ] Two-Factor Auth switch present (#two-factor)
- [ ] Two-Factor Auth switch toggles
- [ ] Show Online Status switch present (#online-status)
- [ ] Show Online Status switch toggles
- [ ] Session Timeout input present (#session-timeout)
- [ ] Session Timeout accepts numeric values (5-120)

### Danger Zone
- [ ] Delete Account button visible
- [ ] Delete Account button is red/destructive style
- [ ] ⚠️ KNOWN ISSUE: No confirmation dialog (needs fix)

### Additional Links
- [ ] Advanced Profile Settings link visible
- [ ] Integration Settings link visible
- [ ] Detailed Notification Settings link visible
- [ ] ⚠️ KNOWN ISSUE: Links use relative paths (needs fix)

### Interactions
- [ ] Fill name input, verify value updates
- [ ] Fill email input, verify value updates
- [ ] Click theme toggle, verify theme changes
- [ ] Toggle notification switches, verify state changes
- [ ] Toggle account switches, verify state changes
- [ ] Click Save Changes, verify loading state
- [ ] ⚠️ KNOWN ISSUE: Data not persisted (needs API integration)

### Console & Network
- [ ] No console errors
- [ ] No console warnings (except expected)
- [ ] No failed network requests
- [ ] No hydration errors

---

## 2. Profile Settings Page (`/settings/profile`)

### Navigation
- [ ] Navigate from main settings
- [ ] URL is correct: `/{workspaceId}/settings/profile`
- [ ] Page loads without errors
- [ ] Can navigate back to main settings

### Visual Elements
- [ ] Page header displays "Profile Settings"
- [ ] Personal Information card visible
- [ ] Appearance card visible
- [ ] Preferences card visible
- [ ] Theme toggle visible
- [ ] Theme preview cards visible (Light/Dark)

### Form Inputs
- [ ] Display Name input present (#name)
- [ ] Display Name accepts text
- [ ] Email input present (#email)
- [ ] Email accepts email format
- [ ] Save Changes button present
- [ ] ⚠️ KNOWN ISSUE: Inputs are uncontrolled (needs state management)

### Preferences
- [ ] "Enable animations" checkbox present
- [ ] "Enable animations" checkbox toggles
- [ ] "Compact sidebar" checkbox present
- [ ] "Compact sidebar" checkbox toggles
- [ ] "Show helpful hints" checkbox present
- [ ] "Show helpful hints" checkbox toggles
- [ ] ⚠️ KNOWN ISSUE: Should use Switch component (needs update)

### Theme Section
- [ ] Theme toggle component works
- [ ] Light theme preview displays correctly
- [ ] Dark theme preview displays correctly
- [ ] Theme preference message visible

### Console & Network
- [ ] No console errors
- [ ] No console warnings
- [ ] No failed network requests

---

## 3. Appearance Settings Page (`/settings/appearance`)

### Navigation
- [ ] Navigate from main settings
- [ ] URL is correct: `/{workspaceId}/settings/appearance`
- [ ] Page loads without errors
- [ ] Can navigate back to main settings

### Visual Elements
- [ ] Page renders AppearanceSettings component
- [ ] Theme controls visible
- [ ] Preview elements visible

### Functionality
- [ ] Theme toggle works
- [ ] Theme persists across page refresh
- [ ] Theme applies to entire app

### Console & Network
- [ ] No console errors
- [ ] No console warnings
- [ ] No failed network requests

---

## 4. Integrations Settings Page (`/settings/integrations`)

### Navigation
- [ ] Navigate from main settings
- [ ] URL is correct: `/{workspaceId}/settings/integrations`
- [ ] Page loads without errors
- [ ] Back button navigates correctly

### Tab Navigation
- [ ] "Integrations" tab visible
- [ ] "Webhooks" tab visible
- [ ] Can switch between tabs
- [ ] Active tab highlighted
- [ ] Tab content changes correctly

### Integrations Tab - Empty State
- [ ] Empty state message displays
- [ ] Empty state icon displays
- [ ] "Connect Integration" button visible
- [ ] Click button opens modal

### Integrations Tab - With Data
- [ ] Integration cards display
- [ ] Provider icons/names show
- [ ] Status badges display correctly
- [ ] Last sync timestamp shows
- [ ] Click card opens details

### Integration Connect Modal
- [ ] Modal opens on button click
- [ ] Provider options display
- [ ] Can select provider
- [ ] Close button works
- [ ] Click outside closes modal
- [ ] ⚠️ OAuth flow requires actual providers

### Integration Detail Modal
- [ ] Modal displays integration info
- [ ] Provider name shows
- [ ] Status badge shows
- [ ] Created date shows
- [ ] Last synced date shows
- [ ] Error message shows (if error)
- [ ] Close button works
- [ ] Disconnect button visible
- [ ] ⚠️ KNOWN ISSUE: No confirmation dialog (needs fix)

### Webhooks Tab - Empty State
- [ ] Empty state message displays
- [ ] Empty state icon displays
- [ ] "Create Webhook" button visible
- [ ] Click button opens modal

### Webhooks Tab - With Data
- [ ] Webhook cards display
- [ ] Status indicator shows (color dot)
- [ ] Webhook name displays
- [ ] URL displays (truncated)
- [ ] Event tags display
- [ ] Failure count shows (if > 0)
- [ ] Last delivery timestamp shows
- [ ] Click card opens details

### Webhook Create Modal
- [ ] Modal opens on button click
- [ ] Name input present (#webhook-name)
- [ ] URL input present (#webhook-url)
- [ ] Description textarea present (#webhook-description)
- [ ] Event checkboxes present
- [ ] Can check/uncheck events
- [ ] Validation works (name, url, events required)
- [ ] Cancel button works
- [ ] Create button works
- [ ] Submit shows loading state
- [ ] Modal closes on success

### Webhook Detail Modal
- [ ] Modal displays webhook info
- [ ] Name shows
- [ ] Status badge shows
- [ ] URL shows (full)
- [ ] Secret shows (masked)
- [ ] Eye icon toggles secret visibility
- [ ] Subscribed events list shows
- [ ] Success count shows
- [ ] Failure count shows
- [ ] Created date shows
- [ ] Close button works
- [ ] Delete button visible
- [ ] ⚠️ KNOWN ISSUE: No confirmation dialog (needs fix)

### Console & Network
- [ ] No console errors
- [ ] No console warnings
- [ ] API calls work correctly
- [ ] Loading states display
- [ ] Error states display

---

## 5. Notifications Settings Page (`/settings/notifications`)

### Expected Behavior
- [ ] ❌ Page currently returns 404 (not implemented)
- [ ] Navigation item exists in sidebar
- [ ] Clicking link shows 404 page
- [ ] ⚠️ CRITICAL: Needs to be created

### After Implementation
- [ ] Page loads without errors
- [ ] Notification preferences display
- [ ] Settings can be saved
- [ ] Changes persist

---

## 6. Security Settings Page (`/settings/security`)

### Expected Behavior
- [ ] ❌ Page currently returns 404 (not implemented)
- [ ] Navigation item exists in sidebar
- [ ] Clicking link shows 404 page
- [ ] ⚠️ CRITICAL: Needs to be created

### After Implementation
- [ ] Page loads without errors
- [ ] Security options display
- [ ] Two-factor auth setup works
- [ ] Password change works
- [ ] Session management works

---

## 7. Settings Layout & Navigation

### Desktop Sidebar
- [ ] Sidebar visible on desktop (lg breakpoint)
- [ ] All navigation items present:
  - [ ] General
  - [ ] Appearance
  - [ ] Profile
  - [ ] Integrations
  - [ ] Notifications (404)
  - [ ] Security (404)
- [ ] Active item highlighted
- [ ] Icons display correctly
- [ ] Breadcrumb shows at top
- [ ] "Changes saved automatically" footer text visible

### Mobile Navigation
- [ ] Bottom nav bar visible on mobile
- [ ] All navigation items present
- [ ] Icons display correctly
- [ ] Text labels visible
- [ ] Active item highlighted
- [ ] Tapping items navigates correctly

### Authentication & Access
- [ ] Unauthenticated users redirected to login
- [ ] Users without workspace access redirected
- [ ] Users redirected to first workspace if needed
- [ ] Users redirected to onboarding if no workspaces
- [ ] ⚠️ Test for redirect loops

---

## 8. Responsive Design

### Desktop (1440px+)
- [ ] Sidebar visible
- [ ] Content max-width applied
- [ ] Cards display in grid where appropriate
- [ ] Modals centered
- [ ] All elements readable

### Tablet (768px - 1439px)
- [ ] Layout adapts correctly
- [ ] Sidebar may be hidden
- [ ] Mobile nav may appear
- [ ] Cards stack vertically
- [ ] All interactive elements accessible

### Mobile (< 768px)
- [ ] Sidebar hidden
- [ ] Mobile bottom nav visible
- [ ] Content full-width
- [ ] Forms stack vertically
- [ ] Buttons full-width where appropriate
- [ ] Modals adapt to screen size
- [ ] Text remains readable

---

## 9. Accessibility

### Keyboard Navigation
- [ ] Can tab through all interactive elements
- [ ] Focus indicators visible
- [ ] Can navigate modals with keyboard
- [ ] Escape key closes modals
- [ ] Enter key submits forms
- [ ] Tab order is logical

### Screen Reader
- [ ] Page title announced
- [ ] Form labels read correctly
- [ ] Button purposes clear
- [ ] Error messages announced
- [ ] Loading states announced
- [ ] Modal open/close announced

### ARIA
- [ ] Buttons have aria-labels where needed
- [ ] Form inputs have proper labels
- [ ] Modals have role="dialog"
- [ ] Live regions used for dynamic content
- [ ] Tab panels have proper ARIA

---

## 10. Performance

### Load Time
- [ ] Initial page load < 3 seconds
- [ ] Navigation between pages instant
- [ ] No layout shift on load
- [ ] Images load progressively
- [ ] Skeleton loaders display during load

### Interactions
- [ ] Button clicks feel instant
- [ ] Form inputs responsive
- [ ] Toggle switches smooth
- [ ] Modal open/close animated smoothly
- [ ] No lag when typing

### Network
- [ ] Minimal API calls on load
- [ ] Data cached appropriately
- [ ] Optimistic updates where appropriate
- [ ] No unnecessary refetches

---

## 11. Error Handling

### Form Validation
- [ ] Required fields validated
- [ ] Email format validated
- [ ] Number ranges validated
- [ ] Error messages display inline
- [ ] Error messages clear and helpful

### API Errors
- [ ] Network errors handled gracefully
- [ ] Error messages user-friendly
- [ ] Retry options provided
- [ ] Loading states end on error
- [ ] Error states clearable

### Edge Cases
- [ ] Empty states handled
- [ ] Long text truncated properly
- [ ] Large file uploads handled
- [ ] Slow network handled
- [ ] Offline state handled

---

## 12. Browser Compatibility

### Chrome/Edge
- [ ] All features work
- [ ] Styling correct
- [ ] Animations smooth

### Firefox
- [ ] All features work
- [ ] Styling correct
- [ ] Animations smooth

### Safari
- [ ] All features work
- [ ] Styling correct
- [ ] Animations smooth
- [ ] Date pickers work

### Mobile Safari (iOS)
- [ ] Touch interactions work
- [ ] Modals scroll correctly
- [ ] Keyboard appears appropriately
- [ ] Bottom nav doesn't conflict with iOS UI

### Mobile Chrome (Android)
- [ ] Touch interactions work
- [ ] Modals scroll correctly
- [ ] Keyboard appears appropriately

---

## Bug Reporting Template

When you find an issue, report it with:

```markdown
**Title:** [Brief description]

**Severity:** Critical / High / Medium / Low

**Steps to Reproduce:**
1. Navigate to...
2. Click on...
3. Fill in...
4. Observe...

**Expected Behavior:**
[What should happen]

**Actual Behavior:**
[What actually happens]

**Screenshot:**
[Attach screenshot]

**Console Errors:**
[Copy any errors from console]

**Environment:**
- Browser: [e.g., Chrome 120]
- OS: [e.g., macOS 14]
- Viewport: [e.g., 1920x1080]
- Workspace ID: [test workspace ID]

**Additional Context:**
[Any other relevant information]
```

---

## Testing Sign-off

### Tester Information
- **Name:** ___________________________
- **Date:** ___________________________
- **Build/Version:** ___________________________

### Results Summary
- **Total Tests:** _____ / _____
- **Passed:** _____
- **Failed:** _____
- **Blocked:** _____

### Sign-off
- [ ] All critical issues documented
- [ ] Screenshots captured
- [ ] Known issues noted
- [ ] Ready for development team review

**Signature:** ___________________________

---

## Quick Reference

### Test Files Location
```
__tests__/settings-pages-test-report.md        (Detailed analysis)
__tests__/settings-pages-e2e-test.ts           (Automated tests)
__tests__/settings-pages-issues-summary.md     (Issues & fixes)
__tests__/SETTINGS_QA_CHECKLIST.md            (This checklist)
```

### Key URLs
```
Main Settings:   http://localhost:3000/{workspaceId}/settings
Profile:         http://localhost:3000/{workspaceId}/settings/profile
Appearance:      http://localhost:3000/{workspaceId}/settings/appearance
Integrations:    http://localhost:3000/{workspaceId}/settings/integrations
```

### Critical Selectors
```
#name                    (Name input)
#email                   (Email input)
#email-notifications     (Email notifications switch)
#two-factor             (Two-factor auth switch)
button:has-text("Save") (Save button)
```

---

**End of Checklist**
