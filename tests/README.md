# Wundr Testing Infrastructure

## Overview

This comprehensive testing suite ensures the highest quality standards for the Wundr project. The testing infrastructure follows industry best practices with >90% code coverage requirements and multi-layered testing strategies.

## Test Architecture

### Test Pyramid Structure

```
         /\
        /E2E\      <- End-to-End Tests (Playwright)
       /------\     • Full workflow testing
      /Integr. \   <- Integration Tests (Jest)
     /----------\   • Cross-package features
    /   Unit     \ <- Unit Tests (Jest)
   /--------------\  • Individual module testing
```

### Test Categories

#### 1. Unit Tests (`/tests/unit/`)
- **Coverage Target**: >95% for critical modules, >90% overall
- **Framework**: Jest with TypeScript support
- **Focus**: Individual functions, classes, and modules
- **Location**: `tests/unit/`

#### 2. Integration Tests (`/tests/integration/`)
- **Coverage Target**: All major workflows
- **Framework**: Jest
- **Focus**: Cross-package interactions and data flows
- **Location**: `tests/integration/`

#### 3. End-to-End Tests (`/tests/e2e/`)
- **Framework**: Playwright
- **Focus**: Complete user workflows (CLI and Dashboard)
- **Browsers**: Chrome, Firefox, Safari, Mobile
- **Location**: `tests/e2e/`

#### 4. Performance Tests (`/tests/performance/`)
- **Framework**: Jest with performance hooks
- **Focus**: Benchmarking and performance regression detection
- **Metrics**: Execution time, memory usage, throughput
- **Location**: `tests/performance/`

#### 5. Quality Gates (`/tests/quality-gates/`)
- **Framework**: Jest
- **Focus**: Code quality enforcement and compliance checks
- **Metrics**: Coverage, linting, security, documentation
- **Location**: `tests/quality-gates/`

## Running Tests

### All Tests
```bash
npm test                    # Run all tests
npm run test:ci            # CI optimized test run
```

### Individual Test Suites
```bash
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run test:e2e          # End-to-end tests only
npm run test:performance  # Performance benchmarks only
npm run test:quality-gates # Quality gate checks only
```

### Coverage Reports
```bash
npm run test:coverage      # Generate coverage report
```

### Watch Mode
```bash
npm run test:watch         # Run tests in watch mode
```

## Test Configuration

### Jest Configuration
- **Config File**: `jest.config.js`
- **Setup File**: `tests/utilities/jest.setup.ts`
- **Custom Matchers**: Extended Jest matchers for domain-specific assertions
- **Coverage Thresholds**: 
  - Lines: 90%
  - Functions: 90%
  - Branches: 85%
  - Statements: 90%

### Playwright Configuration
- **Config File**: `tests/playwright.config.ts`
- **Global Setup**: `tests/e2e/global-setup.ts`
- **Global Teardown**: `tests/e2e/global-teardown.ts`
- **Parallel Execution**: Enabled with worker isolation

## Test Utilities and Fixtures

### Custom Jest Matchers
```typescript
expect(code).toBeValidTypeScript();
expect(report).toContainDuplicates();
expect(entity).toHaveComplexity(5);
expect(drift).toHaveDriftSeverity('high');
expect(code).toHaveStandardizationIssues();
expect(batch).toBeValidConsolidationBatch();
expect(imports).toHaveOrderedImports();
```

### Test Fixtures
- **Sample Projects**: Pre-configured TypeScript projects for testing
- **Mock Data**: Comprehensive test data generators
- **Test Helpers**: Utility functions for test setup and teardown

### Project Fixtures
- `SAMPLE_TYPESCRIPT_PROJECT`: Basic TypeScript project structure
- `PROJECT_WITH_DUPLICATES`: Project containing duplicate code patterns
- `PROJECT_WITH_CIRCULAR_DEPS`: Project with circular dependencies
- `PROJECT_WITH_PATTERN_ISSUES`: Project with code pattern violations
- `LARGE_PROJECT_GENERATOR`: Generator for large-scale testing

## Performance Benchmarks

### Benchmark Metrics
- **Small Project Analysis**: < 5 seconds (10 files)
- **Medium Project Analysis**: < 30 seconds (100 files)
- **Large Project Analysis**: < 2 minutes (1000 files)
- **Duplicate Consolidation**: < 15 seconds (50 duplicates)
- **Pattern Standardization**: < 45 seconds (100 files)
- **Memory Usage**: < 100MB increase for 500 files

### Performance Reports
Performance data is automatically collected and reported in `performance-report.json`:

```json
{
  "timestamp": "2025-08-07T04:00:00Z",
  "benchmarks": {
    "smallProjectAnalysis": 3200,
    "mediumProjectAnalysis": 28500,
    "largeProjectAnalysis": 115000
  }
}
```

## Quality Gates

### Code Quality Enforcement
- **Linting**: ESLint with security rules
- **Type Checking**: TypeScript strict mode
- **Code Formatting**: Prettier with consistent rules
- **Security Audit**: npm audit for vulnerabilities
- **Documentation**: JSDoc coverage for public APIs

### Coverage Requirements
- **Global Coverage**: 90% minimum
- **Critical Modules**: 95% minimum
- **New Code**: 100% coverage required
- **Regression Protection**: Coverage cannot decrease

## Continuous Integration

### GitHub Actions Workflow
- **Multi-Node Testing**: Node.js 18.x, 20.x, 22.x
- **Multi-Platform**: Ubuntu, Windows, macOS
- **Parallel Execution**: Tests run in parallel for speed
- **Artifact Collection**: Coverage reports, performance data, E2E results
- **Quality Reporting**: Automatic PR comments with test results

### CI Pipeline Stages
1. **Lint and Type Check**
2. **Unit and Integration Tests**
3. **Performance Benchmarks**
4. **End-to-End Tests**
5. **Quality Gate Validation**
6. **Security Scanning**
7. **Coverage Reporting**

## Test Data Management

### Test Isolation
- Each test creates isolated temporary directories
- Automatic cleanup after test completion
- No shared state between tests
- Mock external dependencies

### Test Database
- In-memory testing for speed
- Seed data generation
- Transaction rollbacks for isolation
- Fixture-based data setup

## Error Handling and Debugging

### Test Debugging
```bash
DEBUG=true npm test        # Enable verbose logging
npm test -- --verbose     # Verbose test output
npm test -- --bail        # Stop on first failure
```

### Common Issues
1. **Timeout Errors**: Increase timeout for performance tests
2. **File System Errors**: Check permissions and cleanup
3. **Memory Issues**: Use `--max-old-space-size` for large tests
4. **Flaky Tests**: Review async operations and timing

## Contributing to Tests

### Test Writing Guidelines
1. **Descriptive Names**: Test names should explain what and why
2. **Arrange-Act-Assert**: Structure tests clearly
3. **Single Responsibility**: One assertion per test
4. **Mock External Dependencies**: Keep tests isolated
5. **Use Test Fixtures**: Leverage existing test data

### Adding New Tests
1. Identify the appropriate test category
2. Create test file following naming conventions
3. Use existing utilities and fixtures
4. Ensure proper cleanup and isolation
5. Verify coverage impact

### Test Review Checklist
- [ ] Tests are isolated and don't affect each other
- [ ] All async operations are properly awaited
- [ ] Error cases are tested
- [ ] Edge cases and boundary conditions are covered
- [ ] Performance implications are considered
- [ ] Tests are maintainable and readable

## Monitoring and Reporting

### Test Metrics
- **Test Execution Time**: Track test performance over time
- **Coverage Trends**: Monitor coverage changes
- **Failure Rates**: Track test stability
- **Performance Regression**: Detect performance degradation

### Reports and Dashboards
- **Coverage Reports**: HTML and LCOV formats
- **Performance Reports**: JSON with historical data
- **E2E Reports**: Playwright HTML reports with videos
- **Quality Dashboards**: CI/CD integration with badges

## Best Practices

### Test Design
- **Fast Execution**: Unit tests should run in milliseconds
- **Deterministic**: Tests should always produce the same result
- **Independent**: Tests should not depend on each other
- **Comprehensive**: Cover all code paths and edge cases
- **Maintainable**: Easy to understand and modify

### Performance Testing
- **Baseline Measurements**: Establish performance baselines
- **Regression Detection**: Alert on performance degradation
- **Resource Monitoring**: Track memory and CPU usage
- **Scalability Testing**: Test with varying workloads
- **Real-world Scenarios**: Use realistic test data

This testing infrastructure ensures that Wundr maintains the highest quality standards while enabling rapid development and deployment with confidence.