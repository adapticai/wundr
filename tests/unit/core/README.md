# Core Module Test Suite

This directory contains comprehensive test suites for the core BaseService and error classes.

## Test Coverage

Both test suites achieve **100% code coverage** for their respective modules:

- `BaseService.test.ts` - 61 tests covering all aspects of the BaseService class
- `errors.test.ts` - 84 tests covering all error classes and edge cases

## Coverage Summary

```
File            | % Stmts | % Branch | % Funcs | % Lines
----------------|---------|----------|---------|--------
BaseService.ts  |   100%  |   100%   |   100%  |  100%
errors.ts       |   100%  |   100%   |   100%  |  100%
```

## BaseService Tests (`BaseService.test.ts`)

### Coverage Areas

**Constructor and Configuration**
- Default and custom configuration handling
- Metrics initialization 
- EventEmitter inheritance

**Service Lifecycle**
- Initialization process and idempotency
- Shutdown handling
- Health check functionality
- Event emission

**Operation Execution**
- Success and failure scenarios
- Error handling and conversion
- Metrics tracking and calculation
- Execution timing

**Protected Methods Testing**
- Success and error result creation
- Logging with different levels and contexts
- File output operations

**Integration Scenarios**
- Complete lifecycle management
- Concurrent operation handling
- State consistency across operations

**Edge Cases**
- Long operation names
- Null/undefined return values
- Complex error objects
- Configuration validation

### Mock Implementation

The tests use a concrete `TestService` class that extends `BaseService` to test all protected methods and abstract method implementations. This allows for:

- Complete access to protected methods for testing
- Control over initialization/shutdown behavior for failure scenarios
- Health status manipulation for testing different states

## Error Classes Tests (`errors.test.ts`)

### Coverage Areas

**All Error Types**
- `AppError` (base class)
- `ValidationError`
- `NotFoundError` 
- `FileSystemError`
- `AnalysisError`
- `ConfigurationError`
- `CompilationError`

**Constructor Testing**
- Required and optional parameters
- Default value handling
- Property assignment

**Inheritance Chain**
- Proper prototype chain verification
- instanceof checks
- Error class relationships

**Property Validation**
- Readonly property behavior
- Custom properties per error type
- Property preservation

**Error Handling Patterns**
- Try-catch integration
- Type guards
- Error transformation and wrapping

**Edge Cases**
- Null/undefined parameters
- Extreme values (very long strings)
- Unicode and special characters
- Stack trace handling

## Test Architecture

### Test Organization
- Logical grouping by functionality
- Nested describe blocks for clear structure
- Comprehensive edge case coverage

### Mock Strategy
- fs-extra module mocking for file operations
- Console method spying for log verification
- Event emission testing

### Assertion Patterns
- String containment for log message validation
- Property existence and type checking
- Error throwing verification
- Timing and metric validation

## Running the Tests

```bash
# Run all core tests
npm test -- tests/unit/core/

# Run with coverage
npm test -- tests/unit/core/ --coverage

# Run specific test file
npm test -- tests/unit/core/BaseService.test.ts
npm test -- tests/unit/core/errors.test.ts

# Watch mode
npm test -- tests/unit/core/ --watch
```

## Test Quality Features

### TDD Best Practices
- Comprehensive test coverage (100%)
- Clear test naming and organization
- Proper setup and teardown
- Isolated test cases

### Mock Best Practices
- Minimal mocking (only fs-extra and console)
- Proper mock cleanup between tests
- No actual file system operations during tests

### Assertion Quality
- Specific assertions rather than generic ones
- Error message validation
- Type checking where appropriate
- Timing and metric verification

## Key Testing Patterns

### Service Testing Pattern
```typescript
// Use concrete implementation to test abstract base class
class TestService extends BaseService {
  // Expose protected methods as public for testing
  public testExecuteOperation<T>(...) { return this.executeOperation(...); }
  
  // Implement abstract methods with controllable behavior
  protected async onInitialize(): Promise<void> {
    if (this.shouldFailInitialize) throw new Error('Test failure');
  }
}
```

### Error Testing Pattern
```typescript
// Test constructor variations
expect(new ValidationError('msg', ['field'])).toMatchObject({
  message: 'msg',
  fields: ['field'],
  code: 'VALIDATION_ERROR'
});

// Test inheritance chain
expect(error).toBeInstanceOf(AppError);
expect(error).toBeInstanceOf(Error);
```

### Log Testing Pattern
```typescript
// Use string containment for log message validation
expect(consoleLogSpy).toHaveBeenCalledWith(
  expect.stringContaining('"level":"info"')
);
```

This comprehensive test suite ensures the reliability and maintainability of the core service architecture.