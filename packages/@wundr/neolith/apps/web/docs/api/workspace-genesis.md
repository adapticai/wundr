# Workspace Genesis API

Complete API endpoint for generating organizational structures using @wundr/org-genesis package
integration.

## Endpoint

```
POST /api/workspaces/generate-org
```

## Overview

This endpoint generates a complete organizational structure with workspace, VPs, disciplines, and
channels using the org-genesis engine. It performs the following operations in a single database
transaction:

1. Validates user permissions (ADMIN or OWNER required)
2. Generates org structure using @wundr/org-genesis
3. Creates workspace in database
4. Creates discipline records
5. Creates Orchestrator users for each discipline
6. Creates channels for each discipline
7. Auto-assigns VPs to their discipline channels
8. Creates default #general channel

## Request

### Headers

```
Content-Type: application/json
Authorization: <session-token>
```

### Body

```typescript
{
  // Required fields
  organizationName: string;      // Name of the organization
  organizationId: string;         // Existing organization ID
  workspaceName: string;          // Name for the new workspace
  workspaceSlug: string;          // URL-safe slug (lowercase, hyphens only)

  // Organization configuration
  organizationType: 'technology' | 'finance' | 'healthcare' | 'legal' | 'manufacturing' | 'retail' | 'education' | 'other';
  description: string;            // Min 10 chars, max 500
  strategy: string;               // Min 10 chars, max 500
  targetAssets: string[];         // At least one required
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';
  teamSize: 'small' | 'medium' | 'large' | 'enterprise';

  // Optional fields
  seed?: string;                  // Seed for deterministic generation
  workspaceDescription?: string;  // Max 500 chars
  workspaceIconUrl?: string;      // Valid URL
  includeOptionalDisciplines?: boolean;  // Default: false
  verbose?: boolean;              // Enable verbose logging
  dryRun?: boolean;               // Validate without creating
}
```

### Example Request

```json
{
  "organizationName": "Adaptic AI",
  "organizationId": "org_abc123",
  "workspaceName": "Engineering",
  "workspaceSlug": "engineering",
  "organizationType": "technology",
  "description": "AI-managed hedge fund platform for quantitative trading",
  "strategy": "Quantitative trading using AI agents with risk management",
  "targetAssets": ["Crypto", "Equities", "Fixed Income"],
  "riskTolerance": "moderate",
  "teamSize": "medium",
  "workspaceDescription": "Engineering team workspace",
  "verbose": true
}
```

## Response

### Success (201 Created)

```typescript
{
  data: {
    id: string;
    name: string;
    slug: string;
    organizationId: string;
    description: string;
    avatarUrl: string | null;
    visibility: 'PUBLIC' | 'PRIVATE' | 'INTERNAL';
    settings: object;
    createdAt: Date;
    updatedAt: Date;
    organization: {
      id: string;
      name: string;
      slug: string;
    };
    channels: Channel[];
    members: WorkspaceMember[];
    _count: {
      members: number;
      channels: number;
    };
  };
  genesis: {
    manifestId: string;
    vpCount: number;
    disciplineCount: number;
    agentCount: number;
    generationTimeMs: number;
  };
  migration: {
    status: 'complete' | 'partial' | 'failed';
    vpMappings: number;
    disciplineMappings: number;
    warnings: string[];
  };
  message: string;
  durationMs: number;
}
```

### Error Responses

#### 401 Unauthorized

```json
{
  "error": {
    "message": "Authentication required",
    "code": "GENESIS_UNAUTHORIZED"
  }
}
```

#### 403 Forbidden

```json
{
  "error": {
    "message": "Insufficient permissions. Admin or Owner role required.",
    "code": "GENESIS_FORBIDDEN"
  }
}
```

#### 404 Not Found

```json
{
  "error": {
    "message": "Organization not found or access denied",
    "code": "GENESIS_ORG_NOT_FOUND"
  }
}
```

#### 409 Conflict

```json
{
  "error": {
    "message": "A workspace with this slug already exists in the organization",
    "code": "GENESIS_WORKSPACE_SLUG_EXISTS"
  }
}
```

#### 400 Bad Request

```json
{
  "error": {
    "message": "Validation failed",
    "code": "GENESIS_VALIDATION_ERROR",
    "details": {
      "errors": {
        "workspaceSlug": ["Slug must contain only lowercase letters, numbers, and hyphens"],
        "description": ["Description must be at least 10 characters"]
      }
    }
  }
}
```

#### 500 Internal Server Error

```json
{
  "error": {
    "message": "Failed to generate organization structure",
    "code": "GENESIS_GENERATION_FAILED",
    "details": {
      "error": "Detailed error message"
    }
  }
}
```

## Implementation Details

### Database Transaction

The endpoint uses a Prisma transaction with:

- **Max Wait**: 30 seconds
- **Timeout**: 60 seconds

All operations are atomic - if any step fails, all changes are rolled back.

### Generation Process

1. **Genesis Generation** (~5-10s)
   - Creates organizational manifest
   - Generates Orchestrator charters
   - Generates discipline packs
   - Generates agent definitions

2. **Migration Validation** (~1-2s)
   - Dry-run migration to validate structure
   - Checks for conflicts
   - Validates mappings

3. **Database Creation** (~3-5s)
   - Creates workspace
   - Creates disciplines
   - Creates Orchestrator users
   - Creates channels
   - Assigns memberships

### Orchestrator User Creation

Each Orchestrator is created as a user with:

- Email: `{orchestrator-name}@vp.{workspace-slug}.local`
- Display name: Orchestrator title
- Status: ACTIVE
- Type: isVP = true
- Config: Persona, responsibilities, KPIs

### Channel Creation

For each discipline, creates:

- Public channel with discipline name as slug
- Topic and purpose from discipline definition
- Settings with discipline metadata
- Creator as ADMIN
- Orchestrator as MEMBER
- Default #general channel with all VPs

### Discipline Mapping

Disciplines are mapped with:

- Color coding based on name
- Icon assignment based on type
- Parent organization link
- Orchestrator association

## Usage Examples

### cURL

```bash
curl -X POST https://api.example.com/api/workspaces/generate-org \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "organizationName": "Adaptic AI",
    "organizationId": "org_abc123",
    "workspaceName": "Engineering",
    "workspaceSlug": "engineering",
    "organizationType": "technology",
    "description": "AI-managed hedge fund platform for quantitative trading",
    "strategy": "Quantitative trading using AI agents with risk management",
    "targetAssets": ["Crypto", "Equities", "Fixed Income"],
    "riskTolerance": "moderate",
    "teamSize": "medium"
  }'
```

### JavaScript/TypeScript

```typescript
const response = await fetch('/api/workspaces/generate-org', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    organizationName: 'Adaptic AI',
    organizationId: 'org_abc123',
    workspaceName: 'Engineering',
    workspaceSlug: 'engineering',
    organizationType: 'technology',
    description: 'AI-managed hedge fund platform for quantitative trading',
    strategy: 'Quantitative trading using AI agents with risk management',
    targetAssets: ['Crypto', 'Equities', 'Fixed Income'],
    riskTolerance: 'moderate',
    teamSize: 'medium',
  }),
});

const result = await response.json();
console.log(`Created workspace with ${result.genesis.orchestratorCount} VPs`);
```

## Testing

### Unit Tests

Located at:
`/Users/iroselli/wundr/packages/@wundr/neolith/apps/web/app/api/workspaces/generate-org/__tests__/generate-org.test.ts`

Run tests:

```bash
cd packages/@wundr/neolith/apps/web
npm test -- app/api/workspaces/generate-org/__tests__/generate-org.test.ts
```

### Integration Testing

1. Create organization
2. Call endpoint with valid data
3. Verify workspace creation
4. Verify VPs created
5. Verify channels created
6. Verify memberships

## Error Handling

The endpoint implements comprehensive error handling:

1. **Input Validation**: Zod schema validation with detailed error messages
2. **Permission Checks**: Organization membership and role verification
3. **Slug Conflicts**: Checks for existing workspace slugs
4. **Generation Errors**: Catches and reports org-genesis failures
5. **Migration Errors**: Validates migration before database operations
6. **Transaction Rollback**: All database changes rolled back on error

## Performance Considerations

- **Typical Response Time**: 10-20 seconds
- **Database Operations**: 20-50 queries (in transaction)
- **Memory Usage**: ~50MB per request
- **Concurrent Requests**: Limited to prevent database deadlocks

## Security

- **Authentication**: Required (NextAuth session)
- **Authorization**: ADMIN or OWNER role required
- **Input Sanitization**: All inputs validated with Zod
- **SQL Injection**: Protected by Prisma ORM
- **Rate Limiting**: Should be added at reverse proxy level

## Monitoring

Key metrics to monitor:

- Request duration
- Generation success rate
- Transaction failure rate
- Orchestrator creation count
- Channel creation count
- Error rates by type

## Related Files

- Route:
  `/Users/iroselli/wundr/packages/@wundr/neolith/apps/web/app/api/workspaces/generate-org/route.ts`
- Validation:
  `/Users/iroselli/wundr/packages/@wundr/neolith/apps/web/lib/validations/workspace-genesis.ts`
- Tests:
  `/Users/iroselli/wundr/packages/@wundr/neolith/apps/web/app/api/workspaces/generate-org/__tests__/generate-org.test.ts`
- Integration: `/Users/iroselli/wundr/packages/@wundr/neolith/packages/@neolith/org-integration/`
- Generator: `/Users/iroselli/wundr/packages/@wundr/org-genesis/`

## Future Enhancements

1. Add webhook support for completion notifications
2. Implement async processing for large organizations
3. Add progress streaming via Server-Sent Events
4. Support for custom Orchestrator templates
5. Bulk import/export of organizational structures
6. Integration with external org charts
7. Automatic assignment of real users to Orchestrator roles
