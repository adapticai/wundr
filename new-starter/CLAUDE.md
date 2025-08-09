# Claude AI Development Standards

## Project Context

This repository contains automated setup scripts for new Node.js engineers. The setup ensures consistent development environments with all necessary tools, configurations, and best practices.

## Golden Standards

### Code Quality
- **Type Safety**: Always use TypeScript with strict mode enabled
- **Linting**: ESLint with recommended rules + custom configurations
- **Formatting**: Prettier with consistent style across all files
- **Testing**: Minimum 80% code coverage with unit and integration tests
- **Documentation**: JSDoc comments for all public APIs

### Architecture Principles
- **Modularity**: Single Responsibility Principle for all modules
- **Dependency Injection**: Use DI for better testability
- **Error Handling**: Comprehensive error handling with proper logging
- **Performance**: Optimize for performance from the start
- **Security**: Follow OWASP guidelines and security best practices

### Development Workflow
1. **Branch Strategy**: Git Flow with feature, develop, and main branches
2. **Commit Messages**: Conventional Commits format
3. **Code Review**: All changes require PR review
4. **CI/CD**: Automated testing and deployment pipelines
5. **Documentation**: Keep README and API docs up to date

## Ideal Patterns

### TypeScript Configuration
```typescript
// tsconfig.json ideal settings
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

### Error Handling Pattern
```typescript
class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

// Usage
try {
  // operation
} catch (error) {
  if (error instanceof AppError) {
    logger.error('Operational error:', error);
    // handle operational error
  } else {
    logger.fatal('Unexpected error:', error);
    // handle programming error
  }
}
```

### Async/Await Pattern
```typescript
// Always use async/await over callbacks or raw promises
async function fetchData<T>(url: string): Promise<T> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new AppError(response.status, 'Failed to fetch data');
    }
    return await response.json();
  } catch (error) {
    logger.error('Fetch error:', error);
    throw error;
  }
}
```

## Anti-Patterns to Avoid

### ❌ Never Do This

1. **Any Type**: Never use `any` type in TypeScript
```typescript
// BAD
let data: any = fetchData();

// GOOD
let data: UserData = await fetchData<UserData>();
```

2. **Callback Hell**: Avoid nested callbacks
```typescript
// BAD
getData((err, data) => {
  if (err) handleError(err);
  processData(data, (err, result) => {
    if (err) handleError(err);
    saveResult(result, (err) => {
      if (err) handleError(err);
    });
  });
});

// GOOD
try {
  const data = await getData();
  const result = await processData(data);
  await saveResult(result);
} catch (error) {
  handleError(error);
}
```

3. **Magic Numbers/Strings**: Always use constants
```typescript
// BAD
if (status === 200) { }
setTimeout(fn, 3000);

// GOOD
const HTTP_STATUS = { OK: 200 };
const TIMEOUT_MS = 3000;
if (status === HTTP_STATUS.OK) { }
setTimeout(fn, TIMEOUT_MS);
```

4. **Mutations**: Avoid mutating objects/arrays
```typescript
// BAD
const arr = [1, 2, 3];
arr.push(4);
obj.prop = 'new value';

// GOOD
const arr = [1, 2, 3];
const newArr = [...arr, 4];
const newObj = { ...obj, prop: 'new value' };
```

## Custom ESLint Rules

```javascript
module.exports = {
  rules: {
    // Enforce naming conventions
    '@typescript-eslint/naming-convention': [
      'error',
      {
        selector: 'interface',
        format: ['PascalCase'],
        prefix: ['I']
      },
      {
        selector: 'typeAlias',
        format: ['PascalCase']
      },
      {
        selector: 'enum',
        format: ['PascalCase']
      },
      {
        selector: 'variable',
        format: ['camelCase', 'UPPER_CASE'],
        leadingUnderscore: 'allow'
      }
    ],
    
    // Enforce consistent imports
    'import/order': [
      'error',
      {
        groups: [
          'builtin',
          'external',
          'internal',
          'parent',
          'sibling',
          'index'
        ],
        'newlines-between': 'always',
        alphabetize: {
          order: 'asc'
        }
      }
    ],
    
    // Enforce error handling
    'no-throw-literal': 'error',
    'prefer-promise-reject-errors': 'error',
    
    // Enforce code quality
    'no-console': ['error', { allow: ['warn', 'error'] }],
    'no-debugger': 'error',
    'no-alert': 'error',
    'no-var': 'error',
    'prefer-const': 'error',
    'prefer-template': 'error',
    'prefer-arrow-callback': 'error',
    'arrow-body-style': ['error', 'as-needed'],
    
    // TypeScript specific
    '@typescript-eslint/explicit-function-return-type': 'error',
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-non-null-assertion': 'error',
    '@typescript-eslint/no-unused-vars': 'error'
  }
};
```

## Testing Standards

### Unit Testing
```typescript
describe('UserService', () => {
  let service: UserService;
  let mockRepository: jest.Mocked<UserRepository>;
  
  beforeEach(() => {
    mockRepository = createMockRepository();
    service = new UserService(mockRepository);
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  describe('getUser', () => {
    it('should return user when found', async () => {
      // Arrange
      const userId = '123';
      const expectedUser = { id: userId, name: 'John' };
      mockRepository.findById.mockResolvedValue(expectedUser);
      
      // Act
      const result = await service.getUser(userId);
      
      // Assert
      expect(result).toEqual(expectedUser);
      expect(mockRepository.findById).toHaveBeenCalledWith(userId);
      expect(mockRepository.findById).toHaveBeenCalledTimes(1);
    });
    
    it('should throw error when user not found', async () => {
      // Arrange
      mockRepository.findById.mockResolvedValue(null);
      
      // Act & Assert
      await expect(service.getUser('999')).rejects.toThrow('User not found');
    });
  });
});
```

## Performance Guidelines

1. **Lazy Loading**: Implement lazy loading for heavy modules
2. **Memoization**: Cache expensive computations
3. **Debouncing/Throttling**: Control event handler frequency
4. **Virtual Scrolling**: For large lists
5. **Code Splitting**: Split bundles for faster initial load

## Security Best Practices

1. **Input Validation**: Always validate and sanitize user input
2. **Authentication**: Use JWT with proper expiration
3. **Authorization**: Implement role-based access control
4. **Encryption**: Encrypt sensitive data at rest and in transit
5. **Dependencies**: Regular security audits with `npm audit`
6. **Environment Variables**: Never commit secrets to repository
7. **CORS**: Configure CORS properly for production
8. **Rate Limiting**: Implement rate limiting for APIs
9. **SQL Injection**: Use parameterized queries
10. **XSS Prevention**: Sanitize HTML output

## Git Workflow

### Branch Naming
- Feature: `feature/ticket-number-description`
- Bugfix: `bugfix/ticket-number-description`
- Hotfix: `hotfix/ticket-number-description`
- Release: `release/version-number`

### Commit Message Format
```
type(scope): subject

body

footer
```

Types: feat, fix, docs, style, refactor, test, chore

### PR Guidelines
1. Keep PRs small and focused
2. Include tests for new features
3. Update documentation
4. Ensure CI passes
5. Request review from at least one team member

## Development Tools Configuration

### Prettier
```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "bracketSpacing": true,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

### VSCode Settings
```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true,
    "source.organizeImports": true
  },
  "typescript.preferences.importModuleSpecifier": "relative",
  "typescript.updateImportsOnFileMove.enabled": "always"
}
```

## Monitoring and Logging

### Logging Levels
- **Fatal**: Application crash
- **Error**: Error events
- **Warn**: Warning events
- **Info**: Informational messages
- **Debug**: Debug information
- **Trace**: Detailed trace information

### Metrics to Track
1. Response time
2. Error rate
3. Throughput
4. CPU usage
5. Memory usage
6. Database query time

## Continuous Improvement

1. **Code Reviews**: Regular peer reviews
2. **Refactoring**: Continuous refactoring
3. **Learning**: Stay updated with latest technologies
4. **Documentation**: Keep documentation current
5. **Automation**: Automate repetitive tasks
6. **Feedback**: Act on user and team feedback

## Resources

- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [ESLint Rules](https://eslint.org/docs/rules/)
- [Prettier Options](https://prettier.io/docs/en/options.html)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
