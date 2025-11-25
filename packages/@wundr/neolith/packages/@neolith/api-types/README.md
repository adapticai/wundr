# @genesis/api-types

Shared GraphQL types and TypeScript definitions for the Genesis application.

## Overview

This package provides:

- **Generated TypeScript types** from the GraphQL schema
- **React Apollo hooks** for GraphQL operations
- **Manual utility types** and type guards
- **Schema introspection** for tooling

## Installation

```bash
pnpm add @genesis/api-types
```

## Usage

### Importing Types

```typescript
import {
  // Entity types
  User,
  Workspace,
  WorkspaceMember,

  // Enum types
  UserRole,
  UserStatus,
  WorkspaceVisibility,

  // Input types
  CreateUserInput,
  UpdateUserInput,

  // Utility types
  ApiResponse,
  AsyncData,
  Result,

  // Type guards
  isDefined,
  isSuccess,
  hasErrors,
} from '@genesis/api-types';
```

### Using Generated Hooks (React Apollo)

```typescript
import {
  useGetUserQuery,
  useCreateUserMutation,
  useUserUpdatedSubscription,
} from '@genesis/api-types';

function UserProfile({ userId }: { userId: string }) {
  const { data, loading, error } = useGetUserQuery({
    variables: { id: userId },
  });

  if (loading) return <Loading />;
  if (error) return <Error error={error} />;

  return <Profile user={data.user} />;
}
```

### Using Utility Types

```typescript
import { ApiResponse, AsyncData, Result, PaginationParams } from '@genesis/api-types';

// API response wrapper
const response: ApiResponse<User> = {
  data: user,
  errors: [],
  meta: { requestId: '...', timestamp: '...', duration: 123 },
};

// Result type for operations
function createUser(input: CreateUserInput): Result<User, ApiError> {
  try {
    const user = await api.createUser(input);
    return { success: true, data: user };
  } catch (error) {
    return { success: false, error };
  }
}
```

## Development

### Prerequisites

- Node.js >= 18
- pnpm >= 8

### Code Generation

The TypeScript types are generated from the GraphQL schema using GraphQL Code Generator.

```bash
# Generate types (runs automatically before build)
pnpm codegen

# Watch mode for development
pnpm codegen:watch

# Build the package
pnpm build

# Type check
pnpm typecheck
```

### Schema Location

The GraphQL schema is located at:

```
src/graphql/schema.graphql
```

### Generated Files

After running codegen, the following files are generated:

| File                           | Description                          |
| ------------------------------ | ------------------------------------ |
| `src/generated/types.ts`       | Core TypeScript types from schema    |
| `src/generated/operations.ts`  | Operation types (queries, mutations) |
| `src/generated/hooks.ts`       | React Apollo hooks                   |
| `src/generated/schema.json`    | Schema introspection JSON            |
| `src/generated/schema.graphql` | Compiled SDL file                    |

### Adding New Operations

1. Create a new `.graphql` file in `src/graphql/operations/`:

```graphql
# src/graphql/operations/users.graphql
query GetUser($id: UUID!) {
  user(id: $id) {
    id
    email
    displayName
    role
    status
  }
}

mutation UpdateUser($id: UUID!, $input: UpdateUserInput!) {
  updateUser(id: $id, input: $input) {
    user {
      id
      displayName
    }
    errors {
      code
      message
    }
  }
}
```

2. Run codegen:

```bash
pnpm codegen
```

3. Import and use the generated hooks:

```typescript
import { useGetUserQuery, useUpdateUserMutation } from '@genesis/api-types';
```

### Modifying the Schema

1. Edit `src/graphql/schema.graphql`
2. Run codegen to regenerate types
3. Update any affected operations

## Package Exports

The package exports the following entry points:

```json
{
  ".": "./dist/index.js",
  "./graphql": "./dist/graphql/index.js"
}
```

## Type Categories

### Entity Types

Core domain types representing database entities:

- `User` - User account
- `Workspace` - Workspace/organization
- `WorkspaceMember` - Membership association

### Enum Types

Enumeration types for constrained values:

- `UserRole` - ADMIN, MEMBER, GUEST
- `UserStatus` - ACTIVE, INACTIVE, SUSPENDED, PENDING_VERIFICATION
- `WorkspaceVisibility` - PUBLIC, PRIVATE, INTERNAL
- `WorkspaceMemberRole` - OWNER, ADMIN, EDITOR, VIEWER

### Input Types

Input types for mutations:

- `CreateUserInput` / `UpdateUserInput`
- `CreateWorkspaceInput` / `UpdateWorkspaceInput`
- Filter inputs for queries

### Connection Types

Relay-style pagination types:

- `UserConnection` / `UserEdge`
- `WorkspaceConnection` / `WorkspaceEdge`
- `PageInfo`

### Utility Types

Helper types for common patterns:

- `ApiResponse<T>` - Standard API response wrapper
- `Result<T, E>` - Success/failure result type
- `AsyncData<T>` - Async operation state
- `DeepPartial<T>` - Deeply partial type
- `RequireFields<T, K>` - Make specific fields required

## License

UNLICENSED - Private package
