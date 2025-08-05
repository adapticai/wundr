# Wundr.io Demo Project

This is a demo project showcasing how Wundr.io analyzes and transforms codebases.

## Demo Structure

```
demo-project/
├── src/
│   ├── services/
│   │   ├── user-service.ts         # Contains duplicate logic
│   │   ├── customer-service.ts     # Similar to user-service
│   │   └── admin-service.ts        # Another variation
│   ├── types/
│   │   ├── user.types.ts           # Duplicate type definitions
│   │   ├── customer.types.ts       # Similar types
│   │   └── admin.types.ts          # More duplicates
│   └── utils/
│       ├── validation.ts           # Common validation logic
│       └── wrappers.ts            # Anti-pattern examples
└── package.json
```

## Running the Demo

```bash
# Navigate to the demo project
cd demo-project

# Run Wundr.io analysis
wundrio analyze

# View the dashboard
wundrio dashboard

# Apply automatic fixes
wundrio fix --auto

# Run AI-assisted consolidation
wundrio consolidate --ai
```

## Expected Results

Wundr.io will identify:
- 3 duplicate service implementations (70% similar)
- 3 sets of duplicate type definitions
- Multiple wrapper anti-patterns
- Opportunities for consolidation

The tool will suggest:
1. Merge all three services into a single BaseEntityService
2. Consolidate duplicate types into shared interfaces
3. Remove wrapper patterns for direct implementations
4. Extract common validation logic

## Before & After

### Before (3 similar services):
```typescript
// user-service.ts
export class UserService {
  async findById(id: string) { /* ... */ }
  async create(data: any) { /* ... */ }
  async update(id: string, data: any) { /* ... */ }
}

// customer-service.ts (90% duplicate)
export class CustomerService {
  async findById(id: string) { /* ... */ }
  async create(data: any) { /* ... */ }
  async update(id: string, data: any) { /* ... */ }
}

// admin-service.ts (85% duplicate)
export class AdminService {
  async findById(id: string) { /* ... */ }
  async create(data: any) { /* ... */ }
  async update(id: string, data: any) { /* ... */ }
}
```

### After (consolidated):
```typescript
// base-entity-service.ts
export abstract class BaseEntityService<T> {
  protected abstract entityName: string;
  
  async findById(id: string): Promise<T> { /* ... */ }
  async create(data: Partial<T>): Promise<T> { /* ... */ }
  async update(id: string, data: Partial<T>): Promise<T> { /* ... */ }
}

// Specific implementations
export class UserService extends BaseEntityService<User> {
  protected entityName = 'user';
}

export class CustomerService extends BaseEntityService<Customer> {
  protected entityName = 'customer';
}

export class AdminService extends BaseEntityService<Admin> {
  protected entityName = 'admin';
}
```

## Metrics

- **Lines of code reduced**: 300 → 100 (66% reduction)
- **Duplicate code eliminated**: 90%
- **Test coverage improved**: 60% → 95%
- **Build time reduced**: 45s → 15s