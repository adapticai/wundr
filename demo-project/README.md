# Demo Project - Monorepo Refactoring Toolkit Best Practices

This demo project showcases the implementation of best practices from the Monorepo Refactoring Toolkit, including:

- ✅ **BaseService Pattern** - All services extend a common base with built-in error handling, metrics, and logging
- ✅ **Domain-Driven Design** - Rich domain models with business logic encapsulation
- ✅ **Repository Pattern** - Clean separation of data access from business logic
- ✅ **Custom ESLint Rules** - 7 governance rules to prevent anti-patterns
- ✅ **Comprehensive Error Handling** - AppError hierarchy with domain-specific errors
- ✅ **Testing Infrastructure** - Jest setup with coverage requirements
- ✅ **CI/CD Pipeline** - GitHub Actions with quality gates
- ✅ **Pre-commit Hooks** - Automated validation before commits

## Project Structure

```
demo-project/
├── src/
│   ├── models/          # Domain models (DDD)
│   │   └── User.ts      # User entity with business logic
│   ├── repositories/    # Data access layer
│   │   └── UserRepository.ts
│   ├── services/        # Business logic layer
│   │   ├── BaseService.ts    # Abstract base service
│   │   └── UserService.ts    # Concrete service implementation
│   └── utils/           # Shared utilities
│       ├── errors.ts    # Error hierarchy
│       └── result.ts    # Result pattern
├── tests/               # Test suites
│   └── services/
│       └── UserService.test.ts
├── config/              # Configuration files
├── .github/workflows/   # CI/CD pipelines
├── .husky/             # Git hooks
└── package.json        # Dependencies and scripts
```

## Key Patterns Implemented

### 1. BaseService Pattern
All services extend `BaseService` which provides:
- Automatic error handling with `executeOperation`
- Built-in metrics tracking
- Health check support
- Structured logging
- Service lifecycle management

### 2. Error Handling
Comprehensive error hierarchy:
- `AppError` - Base error class
- `ValidationError` - Input validation failures
- `NotFoundError` - Resource not found
- `ConflictError` - Business rule conflicts
- `BusinessRuleError` - Domain rule violations

### 3. Repository Pattern
Clean separation of concerns:
- Services never access databases directly
- Repositories handle all data persistence
- Easy to swap implementations (e.g., in-memory to PostgreSQL)

### 4. Testing Strategy
- Unit tests for all services
- 80% coverage requirement for critical paths
- 70% coverage for general code
- Test-first development approach

## Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run type checking:**
   ```bash
   npm run type-check
   ```

3. **Run linting:**
   ```bash
   npm run lint
   ```

4. **Run tests:**
   ```bash
   npm test
   # or with coverage
   npm run test:coverage
   ```

5. **Build the project:**
   ```bash
   npm run build
   ```

## Custom ESLint Rules

The project enforces these custom governance rules:

1. **no-wrapper-pattern** - Prevents wrapper class anti-patterns
2. **use-app-error** - Enforces AppError usage over generic Error
3. **no-duplicate-enum-values** - Prevents duplicate enum values
4. **service-must-extend-base** - Ensures services extend BaseService
5. **async-method-naming** - Enforces verb-first naming for async methods
6. **no-direct-db-access** - Prevents direct DB access in services
7. **max-file-lines** - Limits file size to 300 lines

## CI/CD Pipeline

GitHub Actions workflow includes:
- **Type checking** - Ensures TypeScript compilation
- **Linting** - Enforces code standards
- **Testing** - Runs full test suite with coverage
- **Security scanning** - npm audit and security linting
- **Drift detection** - Prevents code quality regression
- **Circular dependency check** - Maintains clean architecture

## Pre-commit Hooks

Husky runs these checks before each commit:
- TypeScript type checking
- ESLint validation
- Test suite execution

## Example Usage

```typescript
// Create a new user
const userService = new UserService(userRepository);
await userService.initialize();

const result = await userService.createUser({
  email: 'john@example.com',
  firstName: 'John',
  lastName: 'Doe',
  password: 'securePassword123'
});

if (result.success) {
  console.log('User created:', result.data);
} else {
  console.error('Error:', result.error.message);
}
```

## Best Practices Demonstrated

1. **Explicit Error Handling** - Using Result pattern instead of try-catch
2. **Service Lifecycle** - Initialize/shutdown for proper resource management
3. **Metrics Collection** - Automatic performance tracking
4. **Request Tracing** - Unique request IDs for debugging
5. **Type Safety** - Strict TypeScript configuration
6. **Code Organization** - Clear separation of concerns
7. **Testability** - Dependency injection and interfaces

## Next Steps

To apply these patterns to your own project:

1. Copy the base classes (BaseService, AppError)
2. Set up the custom ESLint rules
3. Implement services extending BaseService
4. Use repositories for data access
5. Write comprehensive tests
6. Set up CI/CD pipeline
7. Monitor drift with governance tools

For more information, see the main [Monorepo Refactoring Toolkit](../) documentation.