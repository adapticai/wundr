# Analytics Page - Playwright MCP Execution Guide

This guide provides step-by-step instructions for executing UI tests on the Analytics page using Playwright MCP tools.

---

## Prerequisites

1. **Dev server running**: `npm run dev` on port 3000
2. **Playwright MCP connected**: Verify with `claude mcp list | grep playwright`
3. **Test workspace available**: Use workspace ID `ws-1` or similar
4. **Database seeded**: Ensure test data exists

---

## Test Execution Sequence

### Phase 1: Page Load & Initial State

#### Test 1.1: Navigate to Analytics Page
```bash
mcp__playwright__playwright_navigate {
  "url": "http://localhost:3000/ws-1/analytics"
}
```

**Expected**: Successfully navigates to page

#### Test 1.2: Capture Initial Screenshot
```bash
mcp__playwright__playwright_screenshot {
  "name": "analytics-page-initial-load",
  "fullPage": true
}
```

**Expected**: Full-page screenshot saved

#### Test 1.3: Verify Page Title
```bash
mcp__playwright__playwright_get_visible_text {
  "selector": "h2"
}
```

**Expected**: Returns "Analytics Dashboard"

#### Test 1.4: Check Console for Errors
```bash
mcp__playwright__playwright_console_logs {}
```

**Expected**: No error-level logs

---

### Phase 2: Header Controls Testing

#### Test 2.1: Verify Granularity Buttons
```bash
mcp__playwright__playwright_get_visible_text {
  "selector": "button:has-text('Daily')"
}
```

**Expected**: Returns "Daily"

#### Test 2.2: Click Weekly Button
```bash
mcp__playwright__playwright_click {
  "selector": "button:has-text('Weekly')"
}
```

**Expected**: Button click succeeds

#### Test 2.3: Screenshot After Filter Change
```bash
mcp__playwright__playwright_screenshot {
  "name": "analytics-weekly-filter"
}
```

**Expected**: Captures filtered state

#### Test 2.4: Click Monthly Button
```bash
mcp__playwright__playwright_click {
  "selector": "button:has-text('Monthly')"
}
```

**Expected**: Button click succeeds

#### Test 2.5: Verify Export Button Exists
```bash
mcp__playwright__playwright_get_visible_text {
  "selector": "button:has-text('Export')"
}
```

**Expected**: Returns "Export"

---

### Phase 3: Metric Cards Verification

#### Test 3.1: Check Total Messages Card
```bash
mcp__playwright__playwright_get_visible_text {
  "selector": "text=Total Messages"
}
```

**Expected**: Returns "Total Messages"

#### Test 3.2: Check Active VPs Card
```bash
mcp__playwright__playwright_get_visible_text {
  "selector": "text=Active VPs"
}
```

**Expected**: Returns "Active VPs"

#### Test 3.3: Check Completed Tasks Card
```bash
mcp__playwright__playwright_get_visible_text {
  "selector": "text=Completed Tasks"
}
```

**Expected**: Returns "Completed Tasks"

#### Test 3.4: Check Workflow Success Rate Card
```bash
mcp__playwright__playwright_get_visible_text {
  "selector": "text=Workflow Success Rate"
}
```

**Expected**: Returns "Workflow Success Rate"

#### Test 3.5: Screenshot Metric Cards Section
```bash
mcp__playwright__playwright_screenshot {
  "name": "analytics-metric-cards",
  "selector": "div.grid.grid-cols-1.sm\\:grid-cols-2.lg\\:grid-cols-4"
}
```

**Expected**: Captures metric cards grid

---

### Phase 4: Charts Testing

#### Test 4.1: Verify Messages Chart Title
```bash
mcp__playwright__playwright_get_visible_text {
  "selector": "text=Messages Over Time"
}
```

**Expected**: Returns "Messages Over Time"

#### Test 4.2: Verify Task Completion Chart
```bash
mcp__playwright__playwright_get_visible_text {
  "selector": "text=Task Completion"
}
```

**Expected**: Returns "Task Completion"

#### Test 4.3: Screenshot Charts Section
```bash
mcp__playwright__playwright_screenshot {
  "name": "analytics-charts",
  "selector": "div.grid.grid-cols-1.lg\\:grid-cols-2 >> nth=0"
}
```

**Expected**: Captures both line charts

---

### Phase 5: Leaderboard & Bar Charts

#### Test 5.1: Check VP Leaderboard
```bash
mcp__playwright__playwright_get_visible_text {
  "selector": "text=Top VPs by Messages"
}
```

**Expected**: Returns "Top VPs by Messages"

#### Test 5.2: Check Active Channels Chart
```bash
mcp__playwright__playwright_get_visible_text {
  "selector": "text=Most Active Channels"
}
```

**Expected**: Returns "Most Active Channels"

#### Test 5.3: Check Tasks by Status Chart
```bash
mcp__playwright__playwright_get_visible_text {
  "selector": "text=Tasks by Status"
}
```

**Expected**: Returns "Tasks by Status"

#### Test 5.4: Screenshot Analytics Details
```bash
mcp__playwright__playwright_screenshot {
  "name": "analytics-details-section",
  "selector": "div.grid.grid-cols-1.lg\\:grid-cols-3"
}
```

**Expected**: Captures all three analytics components

---

### Phase 6: Summary Cards

#### Test 6.1: Verify Total Members Card
```bash
mcp__playwright__playwright_get_visible_text {
  "selector": "text=Total Members"
}
```

**Expected**: Returns "Total Members"

#### Test 6.2: Verify Channels Card
```bash
mcp__playwright__playwright_get_visible_text {
  "selector": "text=Channels >> nth=1"
}
```

**Expected**: Returns "Channels"

#### Test 6.3: Screenshot Summary Section
```bash
mcp__playwright__playwright_screenshot {
  "name": "analytics-summary-cards",
  "selector": "div.grid.grid-cols-2.md\\:grid-cols-4"
}
```

**Expected**: Captures bottom summary grid

---

### Phase 7: Empty State Testing (if applicable)

#### Test 7.1: Navigate to Empty Workspace
```bash
mcp__playwright__playwright_navigate {
  "url": "http://localhost:3000/empty-workspace-123/analytics"
}
```

**Expected**: Navigates to empty workspace

#### Test 7.2: Check for Empty State Message
```bash
mcp__playwright__playwright_get_visible_text {
  "selector": "text=No analytics data yet"
}
```

**Expected**: Returns empty state message

#### Test 7.3: Screenshot Empty State
```bash
mcp__playwright__playwright_screenshot {
  "name": "analytics-empty-state"
}
```

**Expected**: Captures empty state UI

---

### Phase 8: Error State Testing

#### Test 8.1: Navigate Back to Valid Workspace
```bash
mcp__playwright__playwright_navigate {
  "url": "http://localhost:3000/ws-1/analytics"
}
```

#### Test 8.2: Check Console After Full Journey
```bash
mcp__playwright__playwright_console_logs {}
```

**Expected**: Collect all console messages

---

### Phase 9: Responsive Testing

#### Test 9.1: Test Mobile View
```bash
# Note: Playwright MCP may not support viewport changes directly
# This would need to be tested in Playwright test code
```

#### Test 9.2: Final Full Page Screenshot
```bash
mcp__playwright__playwright_screenshot {
  "name": "analytics-final-state",
  "fullPage": true
}
```

**Expected**: Complete page capture

---

## Expected Artifacts

After running all tests, you should have:

1. **Screenshots**:
   - `analytics-page-initial-load.png` - Initial page state
   - `analytics-weekly-filter.png` - After weekly filter applied
   - `analytics-metric-cards.png` - Metric cards section
   - `analytics-charts.png` - Line charts
   - `analytics-details-section.png` - Leaderboard and bar charts
   - `analytics-summary-cards.png` - Bottom summary
   - `analytics-empty-state.png` - Empty state (if tested)
   - `analytics-final-state.png` - Final full page

2. **Console Logs**: All JavaScript console output

3. **Visible Text Captures**: All text verification results

---

## Pass/Fail Criteria

### PASS Criteria
- Page loads without errors
- All text elements visible as expected
- No console errors
- All screenshots capture successfully
- Charts render visually
- Filter buttons respond
- Empty state displays correctly (if applicable)

### FAIL Criteria
- Page fails to load
- JavaScript console errors present
- Missing UI elements
- Charts fail to render
- Buttons unresponsive
- Layout broken in screenshots

---

## Troubleshooting

### Issue: Page doesn't load
**Solution**:
- Verify dev server is running: `lsof -ti:3000`
- Check workspace ID exists in database
- Restart dev server

### Issue: Playwright MCP not responding
**Solution**:
- Verify connection: `claude mcp list`
- Restart MCP server: `claude mcp restart playwright`

### Issue: Screenshots are blank
**Solution**:
- Wait for page load before capturing
- Check selector accuracy
- Verify elements are visible

### Issue: Console errors appear
**Solution**:
- Document the error
- Check if error is from API failure
- Verify database has test data
- Check network tab for failed requests

---

## Test Execution Checklist

### Pre-Execution
- [ ] Dev server running on port 3000
- [ ] Playwright MCP connected
- [ ] Test workspace ID ready (ws-1)
- [ ] Documentation directory created
- [ ] Console ready for monitoring

### During Execution
- [ ] Phase 1: Page Load (5 tests)
- [ ] Phase 2: Header Controls (5 tests)
- [ ] Phase 3: Metric Cards (5 tests)
- [ ] Phase 4: Charts (3 tests)
- [ ] Phase 5: Leaderboard (4 tests)
- [ ] Phase 6: Summary Cards (3 tests)
- [ ] Phase 7: Empty State (3 tests - optional)
- [ ] Phase 8: Error Check (2 tests)
- [ ] Phase 9: Final Screenshots (2 tests)

### Post-Execution
- [ ] All screenshots collected
- [ ] Console logs documented
- [ ] Pass/fail status determined
- [ ] Issues documented
- [ ] Test report updated

---

## Quick Reference: Common Selectors

```css
/* Page Title */
h2:has-text("Analytics Dashboard")

/* Granularity Buttons */
button:has-text("Daily")
button:has-text("Weekly")
button:has-text("Monthly")

/* Export Button */
button:has-text("Export")

/* Metric Cards */
text=Total Messages
text=Active VPs
text=Completed Tasks
text=Workflow Success Rate

/* Charts */
text=Messages Over Time
text=Task Completion

/* Analytics Details */
text=Top VPs by Messages
text=Most Active Channels
text=Tasks by Status

/* Summary Cards */
text=Total Members
text=Channels
text=VPs Configured
text=Avg Hours to Complete

/* Empty State */
text=No analytics data yet
text=Start using your workspace

/* Error State */
text=Failed to load analytics
button:has-text("Retry")
```

---

## Notes for QA Engineer

1. **Data Dependency**: Tests require workspace with analytics data. If testing empty state, use a new/clean workspace.

2. **Timing**: Some elements may load asynchronously. If a test fails, retry after waiting 2-3 seconds.

3. **API Mocking**: For consistent testing, consider mocking API responses to ensure predictable data.

4. **Screenshot Storage**: Playwright MCP stores screenshots in a default location. Verify path before execution.

5. **Console Log Analysis**: Filter out info/debug logs to focus on errors and warnings.

6. **Cross-Browser**: Current tests use default browser. For full coverage, repeat on Chrome, Firefox, Safari.

---

**Document Version**: 1.0
**Last Updated**: 2025-11-27
**Maintainer**: Agent 10 - QA Engineer
**Related Documents**:
- `/docs/testing/analytics-page-test-report.md`
- `/app/(workspace)/[workspaceId]/analytics/page.tsx`
- `/components/analytics/analytics-dashboard.tsx`
