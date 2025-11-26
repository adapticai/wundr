# Analytics Page - Quick Test Checklist

**Quick reference for manual/automated testing of the Analytics Dashboard**

---

## Pre-Test Setup

- [ ] Dev server running: `npm run dev`
- [ ] Port 3000 accessible: `lsof -ti:3000`
- [ ] Browser console open (F12)
- [ ] Test workspace ID ready: `ws-1`
- [ ] Network tab monitoring enabled

---

## Visual Inspection (5 minutes)

### Page Load
- [ ] Page loads within 5 seconds
- [ ] Title "Analytics Dashboard" visible
- [ ] Workspace name displays correctly
- [ ] No blank/missing sections

### Layout
- [ ] Header controls aligned properly
- [ ] Metric cards in even grid (4 columns)
- [ ] Charts displayed side-by-side
- [ ] No overlapping elements
- [ ] Proper spacing and padding

### Colors & Theming
- [ ] Text readable on all backgrounds
- [ ] Icons display correctly
- [ ] Charts use distinct colors
- [ ] Loading states styled properly

---

## Functional Testing (10 minutes)

### Navigation
- [ ] URL correct: `/ws-1/analytics`
- [ ] Browser back button works
- [ ] Page reload preserves state

### Filter Controls
- [ ] "Daily" button clickable
- [ ] "Weekly" button clickable
- [ ] "Monthly" button clickable
- [ ] Active state highlights selected button
- [ ] Data updates after filter change

### Date Range Picker
- [ ] Date picker opens on click
- [ ] Calendar displays correctly
- [ ] Can select start date
- [ ] Can select end date
- [ ] Selected range applies to data
- [ ] Date picker closes after selection

### Export Button
- [ ] Button visible
- [ ] Button enabled (when data exists)
- [ ] Button disabled (when no data)
- [ ] Click triggers loading state
- [ ] File downloads successfully
- [ ] Filename contains workspace ID
- [ ] File format is CSV

---

## Data Display (5 minutes)

### Metric Cards
- [ ] Total Messages shows number
- [ ] Active VPs shows number
- [ ] Completed Tasks shows number
- [ ] Workflow Success Rate shows percentage
- [ ] Trend indicators present (when applicable)
- [ ] Icons render correctly
- [ ] Numbers formatted with commas

### Charts
- [ ] "Messages Over Time" line chart renders
- [ ] "Task Completion" line chart renders
- [ ] X-axis labels visible
- [ ] Y-axis labels visible
- [ ] Data points plotted correctly
- [ ] Chart height appropriate

### Leaderboard & Bar Charts
- [ ] "Top VPs by Messages" list displays
- [ ] VP names and counts visible
- [ ] "Most Active Channels" bars render
- [ ] "Tasks by Status" bars render
- [ ] Bar heights proportional to values
- [ ] Labels readable

### Summary Cards
- [ ] Total Members displays
- [ ] Channels count displays
- [ ] VPs Configured count displays
- [ ] Avg Hours to Complete displays
- [ ] Numbers formatted properly

---

## Error Handling (5 minutes)

### Empty State
- [ ] Navigate to empty workspace
- [ ] "No analytics data yet" message shows
- [ ] Encouragement text displays
- [ ] No console errors
- [ ] Layout not broken

### Error State
- [ ] Simulate API failure (if possible)
- [ ] "Failed to load analytics" message shows
- [ ] Error icon/image displays
- [ ] "Retry" button present
- [ ] Click retry re-attempts fetch
- [ ] Error doesn't crash page

### Loading State
- [ ] Initial load shows loading indicators
- [ ] Filter change shows loading state
- [ ] Export shows "Exporting..." text
- [ ] Loading states don't flicker
- [ ] Smooth transitions

---

## Console Monitoring (Throughout Testing)

### Check for Errors
- [ ] No red console errors
- [ ] No uncaught exceptions
- [ ] No 404 network errors
- [ ] No 500 server errors

### Check for Warnings
- [ ] No React key warnings
- [ ] No deprecation warnings
- [ ] No memory leak warnings

### Network Requests
- [ ] Analytics API call succeeds
- [ ] Trends API calls succeed
- [ ] Export API succeeds
- [ ] Response times < 3 seconds
- [ ] No redundant API calls

---

## Responsive Testing (5 minutes)

### Mobile (375px width)
- [ ] Resize browser to 375px
- [ ] Layout stacks vertically
- [ ] All content visible
- [ ] No horizontal scrolling
- [ ] Buttons tap-friendly
- [ ] Text readable
- [ ] Charts adapt to width

### Tablet (768px width)
- [ ] Resize browser to 768px
- [ ] 2-column layouts work
- [ ] Charts display properly
- [ ] Controls accessible
- [ ] No layout breaks

### Desktop (1440px width)
- [ ] Full desktop layout
- [ ] 4-column metric grid
- [ ] Side-by-side charts
- [ ] 3-column analytics details
- [ ] Proper max-width applied

---

## Interaction Testing (5 minutes)

### Keyboard Navigation
- [ ] Tab through all interactive elements
- [ ] Focus indicators visible
- [ ] Enter key activates buttons
- [ ] Escape closes date picker
- [ ] No keyboard traps

### Mouse Interactions
- [ ] All buttons clickable
- [ ] Hover states on buttons
- [ ] Cursor changes on interactables
- [ ] No double-click required
- [ ] Click outside closes modals

### Touch (if testing on device)
- [ ] Tap buttons work
- [ ] Swipe scrolls page
- [ ] No accidental clicks
- [ ] Touch targets large enough

---

## Performance Check (5 minutes)

### Load Performance
- [ ] Initial load < 5 seconds
- [ ] Time to Interactive < 3 seconds
- [ ] No layout shifts
- [ ] Images load quickly

### Runtime Performance
- [ ] Filter changes < 2 seconds
- [ ] Smooth scrolling
- [ ] No lag on interactions
- [ ] Charts render quickly

### Memory
- [ ] Open DevTools Memory tab
- [ ] Take heap snapshot
- [ ] Change filters 10 times
- [ ] Take another snapshot
- [ ] Check for memory growth < 10MB

---

## Accessibility Quick Check (5 minutes)

### Semantic HTML
- [ ] Headings in logical order
- [ ] Buttons use `<button>` tags
- [ ] Lists use `<ul>`/`<ol>`

### ARIA
- [ ] Loading states announced
- [ ] Error messages announced
- [ ] Icons have aria-hidden or aria-label

### Color Contrast
- [ ] Text readable on backgrounds
- [ ] Links distinguishable
- [ ] Focus indicators visible

### Screen Reader (Optional)
- [ ] Turn on screen reader
- [ ] Navigate through page
- [ ] All content announced
- [ ] Interactive elements described

---

## Edge Cases (5 minutes)

### Data Variations
- [ ] Test with 0 messages
- [ ] Test with 1000+ messages
- [ ] Test with no VPs
- [ ] Test with 50+ VPs
- [ ] Test with old date ranges (1 year ago)

### Browser States
- [ ] Test with slow network (DevTools throttling)
- [ ] Test with cache disabled
- [ ] Test after browser refresh
- [ ] Test after closing/reopening tab

### Concurrent Actions
- [ ] Click multiple filters quickly
- [ ] Change date while data loading
- [ ] Export while filter changing

---

## Final Verification (2 minutes)

### Screenshots
- [ ] Capture full page screenshot
- [ ] Capture metric cards section
- [ ] Capture charts section
- [ ] Capture empty state (if applicable)
- [ ] Capture error state (if applicable)

### Documentation
- [ ] Note any issues found
- [ ] Record browser version
- [ ] Note OS version
- [ ] Log any warnings
- [ ] Document unexpected behavior

---

## Quick Pass/Fail

**PASS if**:
- ✅ All core features work
- ✅ No console errors
- ✅ Data displays correctly
- ✅ Responsive on mobile
- ✅ Loading/error states work

**FAIL if**:
- ❌ Page doesn't load
- ❌ Console errors present
- ❌ Data missing or incorrect
- ❌ Charts don't render
- ❌ Filters don't work
- ❌ Export fails

---

## Time Estimate

| Phase | Time |
|-------|------|
| Visual Inspection | 5 min |
| Functional Testing | 10 min |
| Data Display | 5 min |
| Error Handling | 5 min |
| Responsive Testing | 5 min |
| Interaction Testing | 5 min |
| Performance Check | 5 min |
| Accessibility | 5 min |
| Edge Cases | 5 min |
| Final Verification | 2 min |
| **TOTAL** | **52 min** |

---

## Common Issues & Solutions

### Issue: Page blank
**Fix**: Check console for API errors, verify workspace exists

### Issue: Charts not rendering
**Fix**: Check if data exists, verify chart library loaded

### Issue: Export not working
**Fix**: Check user permissions, verify export API

### Issue: Filters not updating
**Fix**: Check network tab for API calls, clear cache

### Issue: Layout broken on mobile
**Fix**: Check Tailwind classes, verify responsive breakpoints

---

## Report Template

```markdown
## Analytics Page Test Report

**Date**: [DATE]
**Tester**: [NAME]
**Browser**: [Chrome/Firefox/Safari] [VERSION]
**OS**: [macOS/Windows/Linux] [VERSION]
**Workspace ID**: ws-1

### Results Summary
- Total Tests: 80+
- Passed: [X]
- Failed: [X]
- Skipped: [X]

### Issues Found
1. [Issue description]
   - Severity: [Critical/High/Medium/Low]
   - Steps to reproduce: [...]
   - Expected: [...]
   - Actual: [...]
   - Screenshot: [link]

### Screenshots
- [Link to full page]
- [Link to specific sections]

### Console Logs
- [Any errors or warnings]

### Recommendations
- [List any suggestions]

### Overall Status
- [ ] PASS - Ready for production
- [ ] PASS - With minor issues
- [ ] FAIL - Requires fixes
- [ ] BLOCKED - Cannot test
```

---

## Automation Reference

**For automated testing with Playwright MCP**, use these commands:

```bash
# Navigate
mcp__playwright__playwright_navigate {"url": "http://localhost:3000/ws-1/analytics"}

# Screenshot
mcp__playwright__playwright_screenshot {"name": "analytics-test"}

# Get text
mcp__playwright__playwright_get_visible_text {"selector": "h2"}

# Click
mcp__playwright__playwright_click {"selector": "button:has-text('Weekly')"}

# Console logs
mcp__playwright__playwright_console_logs {}
```

---

**Checklist Version**: 1.0
**Last Updated**: 2025-11-27
**Maintainer**: Agent 10 - QA Engineer

**Related Documents**:
- Full Test Report: `/docs/testing/analytics-page-test-report.md`
- Execution Guide: `/docs/testing/analytics-playwright-execution-guide.md`
- Findings Summary: `/docs/testing/analytics-test-findings-summary.md`
