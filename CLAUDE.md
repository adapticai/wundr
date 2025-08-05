# Claude Knowledge Base - Wundr.io by Lumic.ai

## Project Overview
Wundr.io is an intelligent CLI-based coding agents orchestrator that transforms how teams refactor and modernize large codebases. Built by Lumic.ai, it combines advanced AST analysis, intelligent pattern recognition, and AI-assisted code transformation to turn months of manual refactoring into days of automated precision.

## Key Commands
- `npm run lint` - Run ESLint with auto-fix
- `npm run lint:check` - Check linting without fix
- `npm run type-check` - Run TypeScript type checking
- `npm test` - Run tests
- `npm run test:coverage` - Run tests with coverage
- `npm run governance:check` - Run drift detection
- `npm run governance:report` - Generate weekly governance report
- `npm run analyze` - Run all analysis tools
- `npm run analyze:dependencies` - Run dependency mapper
- `npm run analyze:similarity` - Run similarity detector

## Architecture Patterns

### BaseService Pattern
All services must extend BaseService and follow this pattern:
```typescript
export class UserService extends BaseService {
  constructor(private userRepo: UserRepository) {
    super('UserService');
  }
  // Implementation
}
```

### Error Handling
Always use AppError or domain-specific error classes:
```typescript
throw new ValidationError('Invalid email', ['email']);
throw new NotFoundError('User', userId);
```

### Repository Pattern
Services should never access databases directly. Use repositories:
```typescript
// ✅ Good
const user = await this.userRepo.findById(id);

// ❌ Bad
const user = await db.query('SELECT * FROM users WHERE id = ?', [id]);
```

## Custom ESLint Rules
1. `no-wrapper-pattern` - Prevents wrapper class anti-patterns
2. `use-app-error` - Enforces AppError usage over generic Error
3. `no-duplicate-enum-values` - Prevents duplicate enum values
4. `service-must-extend-base` - Ensures services extend BaseService
5. `async-method-naming` - Enforces verb-first naming for async methods
6. `no-direct-db-access` - Prevents direct DB access in services
7. `max-file-lines` - Limits file size to 300 lines

## Testing Guidelines
- Critical path coverage: 80%
- General code coverage: 70%
- All services must have unit tests
- Integration tests for critical workflows

## Governance System
- Drift detection runs on every commit
- Critical drift blocks CI/CD
- Weekly governance reports track quality trends
- Custom ESLint rules prevent anti-patterns

## Implementation Phases
1. **Foundation & Freeze** - Testing baseline, standards, linting
2. **Deep Analysis** - AST analysis, dependency mapping, similarity detection
3. **Tactical Consolidation** - Duplicate elimination, cleanup
4. **Strategic Refactoring** - Architectural improvements
5. **Monorepo Migration** - Package restructuring
6. **Governance & Evolution** - Ongoing quality maintenance

## Golden Standards
- Services use `*Service` suffix
- No `I` prefix for interfaces
- Enums use PascalCase with UPPER_SNAKE_CASE values
- Async methods start with verbs
- Boolean methods start with is/has/can
- Error handling uses AppError hierarchy
- No string throws allowed
- Direct DB access forbidden in services