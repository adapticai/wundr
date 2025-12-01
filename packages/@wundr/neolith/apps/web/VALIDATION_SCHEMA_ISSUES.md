# Channel Validation Schema Issues - Analysis Report

## Overview
Analysis of `/lib/validations/organization.ts` (which contains channel validation schemas) reveals mismatches between Zod validation schemas and Prisma database enums.

## Issues Found

### 1. WorkspaceRole Mismatch (CRITICAL)

**Location**: `lib/validations/organization.ts:125`

**Current Schema**:
```typescript
export const memberRoleEnum = z.enum(['OWNER', 'ADMIN', 'MEMBER', 'GUEST']);
```

**Prisma Schema** (schema.prisma:706-711):
```prisma
enum WorkspaceRole {
  OWNER
  ADMIN
  MEMBER
  GUEST
}
```

**Previous Issue**: Was using `['ADMIN', 'MEMBER', 'VIEWER']` which didn't match Prisma.

**Status**: ✅ **FIXED** - Updated to match Prisma schema exactly.

### 2. ChannelRole Schema (CORRECT)

**Location**: `lib/validations/organization.ts:352`

**Current Schema**:
```typescript
export const channelRoleEnum = z.enum(['OWNER', 'ADMIN', 'MEMBER']);
```

**Prisma Schema** (schema.prisma:602-606):
```prisma
enum ChannelRole {
  OWNER
  ADMIN
  MEMBER
}
```

**Status**: ✅ **CORRECT** - No changes needed.

### 3. OrganizationRole (Not in validation file, but for reference)

**Prisma Schema** (schema.prisma:646-650):
```prisma
enum OrganizationRole {
  OWNER
  ADMIN
  MEMBER
}
```

**Status**: ℹ️ Not used in channel validations.

## Impact on Codebase

### Files Using Old `VIEWER` Role
The following files still reference the deprecated `VIEWER` role and need updates:

1. **Type Definitions**:
   - `/types/next-auth.d.ts:16` - UserRole type
   - `/hooks/use-auth.ts:16, 29` - AuthUser interface

2. **Test Files**:
   - `/app/api/processing/__tests__/processing.test.ts:26`
   - `/app/api/upload/__tests__/upload.test.ts:33`
   - `/app/api/workspaces/[workspaceSlug]/workflows/__tests__/workflows.test.ts:350, 635, 792`

3. **GraphQL**:
   - `/app/api/graphql/context.ts:27`
   - `/app/api/graphql/resolvers/workspace.ts:84`

4. **Documentation**:
   - `/docs/CHANNEL_AUTH_MIGRATION_SUMMARY.md:84, 97`
   - `/auth-analysis-report.json:173`

## Recommended Actions

### Immediate (DONE)
- [x] Update `memberRoleEnum` in `lib/validations/organization.ts` to match Prisma

### High Priority (TODO)
- [ ] Update all TypeScript type definitions to use `GUEST` instead of `VIEWER`
- [ ] Update all test files to use `GUEST` instead of `VIEWER`
- [ ] Update GraphQL context and resolvers

### Medium Priority (TODO)
- [ ] Update documentation to reflect `GUEST` role
- [ ] Search for any runtime role checks that use `VIEWER`
- [ ] Add migration notes if `VIEWER` was previously used

### Low Priority
- [ ] Consider if semantic meaning of `GUEST` vs `VIEWER` is clear to developers
- [ ] Update any user-facing documentation or UI labels

## Schema Validation Coverage

### Currently Validated
- ✅ Channel creation
- ✅ Channel updates
- ✅ Channel member role updates
- ✅ Channel filters
- ✅ Workspace member roles

### Missing Validations
No critical validations appear to be missing for channel operations.

## Error Codes

All necessary error codes are present in `ORG_ERROR_CODES`:
- `CHANNEL_NOT_FOUND`
- `CHANNEL_ARCHIVED`
- `CANNOT_JOIN_PRIVATE`
- `CANNOT_LEAVE_LAST_ADMIN`
- `FORBIDDEN`
- `UNAUTHORIZED`
- `VALIDATION_ERROR`
- etc.

## Conclusion

The primary issue was the `memberRoleEnum` using `VIEWER` instead of `GUEST`. This has been corrected to match the Prisma schema. However, multiple TypeScript files throughout the codebase still reference the old `VIEWER` role and will need to be updated to use `GUEST` for full consistency.

The `channelRoleEnum` was already correct and matches Prisma exactly.

---

**Date**: December 1, 2025
**Analyzer**: Claude Code
**File**: `/Users/granfar/wundr/packages/@wundr/neolith/apps/web/lib/validations/organization.ts`
