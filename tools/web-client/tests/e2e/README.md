# Comprehensive UI Testing Suite

This directory contains a comprehensive end-to-end testing suite for both dashboard applications in the Wundr project.

## Overview

The test suite is designed to systematically validate:
- ✅ Broken links detection  
- ✅ Runtime error monitoring
- ✅ Missing component validation
- ✅ Navigation functionality  
- ✅ API endpoint health checks
- ✅ Cross-dashboard integration testing

## Test Files

### Core Test Suites

1. **`smoke-tests.spec.ts`** - Quick validation of essential functionality
   - Homepage redirects
   - Basic dashboard loading
   - Navigation functionality
   - Mobile responsiveness
   - Theme switching

2. **`comprehensive-ui-audit.spec.ts`** - Complete UI validation
   - Route accessibility testing
   - Component rendering validation
   - Performance monitoring
   - Accessibility checks

3. **`broken-links-audit.spec.ts`** - Link validation and health checks
   - Internal link validation
   - External link checking
   - Image link verification
   - Anchor link testing
   - Comprehensive reporting

4. **`runtime-errors-detection.spec.ts`** - JavaScript error monitoring
   - Page error detection
   - Console error tracking
   - Network error monitoring
   - Memory leak detection
   - Form validation errors

5. **`missing-components-validation.spec.ts`** - Component integrity checks
   - Essential UI component validation
   - React component rendering failures
   - Dashboard-specific component checks
   - Media and image validation
   - Accessibility component validation

6. **`navigation-issues-detection.spec.ts`** - Navigation system testing
   - Route accessibility validation  
   - Navigation menu functionality
   - Breadcrumb navigation
   - Deep linking validation
   - Focus management

7. **`api-endpoint-validation.spec.ts`** - Backend connectivity testing
   - API endpoint health checks
   - Response format validation
   - HTTP method testing
   - Performance monitoring
   - Error handling validation

8. **`wundr-dashboard-integration.spec.ts`** - Cross-dashboard testing
   - Both dashboard accessibility
   - Performance comparison
   - Feature validation
   - Error rate comparison

### Helper Files

- **`helpers/test-config.ts`** - Shared configuration and route definitions
- **`helpers/page-objects.ts`** - Page object models for both dashboards
- **`helpers/test-utilities.ts`** - Utility functions for testing operations

## Dashboard Configuration

### Web Client Dashboard (Port 3000)
- **Purpose**: Intelligent Monorepo Analysis Dashboard
- **Routes**: 30+ routes including analysis, files, performance, quality, reports
- **Features**: Comprehensive code analysis tools, visualizations, file browser

### Wundr Dashboard (Port 3001)  
- **Purpose**: Real-time Monitoring Dashboard
- **Routes**: 3 routes focused on real-time overview
- **Features**: WebSocket integration, real-time metrics, live data visualization

## Running Tests

### Prerequisites
```bash
# Install dependencies (if not already installed)
npm install

# Install Playwright browsers
npm run playwright:install
```

### Running Individual Test Suites

```bash
# Quick smoke tests (recommended first)
npm run test:e2e -- smoke-tests.spec.ts

# Comprehensive UI audit
npm run test:e2e -- comprehensive-ui-audit.spec.ts

# Broken links detection
npm run test:e2e -- broken-links-audit.spec.ts

# Runtime errors detection
npm run test:e2e -- runtime-errors-detection.spec.ts

# Missing components validation
npm run test:e2e -- missing-components-validation.spec.ts

# Navigation issues detection  
npm run test:e2e -- navigation-issues-detection.spec.ts

# API endpoint validation
npm run test:e2e -- api-endpoint-validation.spec.ts

# Cross-dashboard integration (requires both dashboards running)
npm run test:e2e -- wundr-dashboard-integration.spec.ts
```

### Running All Tests

```bash
# Run all tests
npm run test:e2e

# Run with headed browser (visual)
npm run test:e2e:headed

# Run with debug mode
npm run test:e2e:debug

# Run with UI mode
npm run test:e2e:ui
```

### Generating Reports

```bash
# Generate HTML report
npm run playwright:report
```

## Test Configuration

### Browser Support
- ✅ Chromium (Desktop)
- ✅ Firefox (Desktop)
- ✅ WebKit/Safari (Desktop)
- ✅ Mobile Chrome (Pixel 5)
- ✅ Mobile Safari (iPhone 12)

### Timeouts and Retries
- **Navigation**: 30 seconds
- **API Response**: 10 seconds
- **WebSocket**: 5 seconds
- **Page Load**: 15 seconds
- **Retries**: 2 on CI, 0 locally

## Expected Test Results

### Passing Criteria
- **Route Accessibility**: >70% routes accessible
- **Broken Links**: <20 broken links total
- **JavaScript Errors**: <15 total errors
- **API Endpoints**: >50% working endpoints
- **Navigation**: <30% routes with navigation issues
- **Critical Failures**: <3 critical failures

### Common Expected Issues
- Some API endpoints may return 404 (not implemented yet)
- External links may occasionally be slow/timeout
- Some routes may have placeholder content
- WebSocket connections may not be fully implemented

## Troubleshooting

### Dashboard Not Running
```bash
# Start Web Client Dashboard (Port 3000)
cd /Users/lucas/wundr/tools/web-client
npm run dev

# Start Wundr Dashboard (Port 3001) 
cd /Users/lucas/wundr/packages/@wundr/dashboard
npm run dev
```

### Test Failures
1. Check if both dashboards are running
2. Verify ports 3000 and 3001 are accessible
3. Run smoke tests first to identify basic issues
4. Check browser console for JavaScript errors

### Performance Issues
- Tests may be slow on first run (browser installation)
- Large number of routes may cause timeouts
- Adjust timeout values in `playwright.config.ts` if needed

## Integration with CI/CD

The test suite generates multiple report formats suitable for CI/CD integration:
- **HTML Report**: Visual test results with screenshots
- **JSON Report**: Structured data for processing
- **JUnit XML**: Compatible with most CI systems

### Recommended CI Pipeline
1. Start both dashboard servers
2. Run smoke tests first
3. Run comprehensive test suite
4. Generate and archive reports
5. Fail build on critical errors only

## Customization

### Adding New Routes
Update `TEST_CONFIG.routes.webClient` in `helpers/test-config.ts`

### Adding New API Endpoints
Update endpoint arrays in `api-endpoint-validation.spec.ts`

### Adjusting Thresholds
Modify expect statements in individual test files to adjust pass/fail criteria

### Custom Assertions
Add new utility functions in `helpers/test-utilities.ts`

## Maintenance

### Regular Updates Needed
- Update route configurations as new pages are added
- Add new API endpoints as backend evolves  
- Adjust performance thresholds based on infrastructure
- Update browser versions and Playwright regularly

### Monitoring Trends
- Track test execution times
- Monitor failure rates over time
- Identify consistently failing tests for investigation
- Update expected results as application matures

---

This testing suite provides comprehensive coverage of both dashboards while being maintainable and suitable for continuous integration workflows.