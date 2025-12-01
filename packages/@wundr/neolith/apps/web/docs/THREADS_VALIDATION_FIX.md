# Threads Validation Schema Fix

## Issue

The thread validation schema (`lib/validations/threads.ts`) defined `THREADS_ERROR_CODES` which were
being used with the `createErrorResponse` function from `lib/validations/message.ts`. However,
`createErrorResponse` expected `MessageErrorCode` types, which didn't include the thread-specific
error codes like `THREADS_VALIDATION_ERROR`.

## Files Using Thread Error Codes

The following route files import `THREAD_ERROR_CODES` and use them with `createErrorResponse`:

1. `/app/api/workspaces/[workspaceSlug]/channels/[channelId]/threads/route.ts`
2. `/app/api/workspaces/[workspaceSlug]/channels/[channelId]/messages/[messageId]/thread/route.ts`

### Error Codes Used

- `THREAD_ERROR_CODES.UNAUTHORIZED` → `'THREADS_UNAUTHORIZED'`
- `THREAD_ERROR_CODES.VALIDATION_ERROR` → `'THREADS_VALIDATION_ERROR'`
- `THREAD_ERROR_CODES.FORBIDDEN` → `'THREADS_FORBIDDEN'`
- `THREAD_ERROR_CODES.INTERNAL_ERROR` → `'THREADS_INTERNAL_ERROR'`

## Solution

Added all thread-specific error codes to `MESSAGE_ERROR_CODES` in `lib/validations/message.ts` for
type compatibility.

### Changes Made

#### File: `lib/validations/message.ts`

Added the following error codes to `MESSAGE_ERROR_CODES`:

```typescript
// Thread-specific error codes (for compatibility with thread routes)
THREADS_INVALID: 'THREADS_INVALID',
THREADS_NOT_FOUND: 'THREADS_NOT_FOUND',
THREADS_UNAUTHORIZED: 'THREADS_UNAUTHORIZED',
THREADS_INVALID_PARENT: 'THREADS_INVALID_PARENT',
THREADS_MAX_DEPTH: 'THREADS_MAX_DEPTH',
THREADS_VALIDATION_ERROR: 'THREADS_VALIDATION_ERROR',
THREADS_INTERNAL_ERROR: 'THREADS_INTERNAL_ERROR',
THREADS_FORBIDDEN: 'THREADS_FORBIDDEN',
THREADS_NOT_CHANNEL_MEMBER: 'THREADS_NOT_CHANNEL_MEMBER',
```

## Mapping

| THREADS_ERROR_CODES Key | Value                        | Added to MESSAGE_ERROR_CODES |
| ----------------------- | ---------------------------- | ---------------------------- |
| INVALID_THREAD          | 'THREADS_INVALID'            | ✓ THREADS_INVALID            |
| THREAD_NOT_FOUND        | 'THREADS_NOT_FOUND'          | ✓ THREADS_NOT_FOUND          |
| UNAUTHORIZED            | 'THREADS_UNAUTHORIZED'       | ✓ THREADS_UNAUTHORIZED       |
| INVALID_PARENT          | 'THREADS_INVALID_PARENT'     | ✓ THREADS_INVALID_PARENT     |
| MAX_DEPTH_EXCEEDED      | 'THREADS_MAX_DEPTH'          | ✓ THREADS_MAX_DEPTH          |
| VALIDATION_ERROR        | 'THREADS_VALIDATION_ERROR'   | ✓ THREADS_VALIDATION_ERROR   |
| INTERNAL_ERROR          | 'THREADS_INTERNAL_ERROR'     | ✓ THREADS_INTERNAL_ERROR     |
| FORBIDDEN               | 'THREADS_FORBIDDEN'          | ✓ THREADS_FORBIDDEN          |
| NOT_CHANNEL_MEMBER      | 'THREADS_NOT_CHANNEL_MEMBER' | ✓ THREADS_NOT_CHANNEL_MEMBER |

## Type Safety

With this change:

- `createErrorResponse` accepts thread error codes through the `MessageErrorCode` type
- Type checking now passes for all thread route files
- No breaking changes to existing code

## Alternative Approaches Considered

1. **Change createErrorResponse signature** - Already done (accepts
   `string | MessageErrorCode | number`)
2. **Use MESSAGE_ERROR_CODES in thread routes** - Would require changing all thread routes
3. **Add thread codes to MESSAGE_ERROR_CODES** - ✓ **Implemented** (cleanest solution)

## Benefits

- Maintains backward compatibility
- No changes needed in route files
- Type-safe error handling
- All thread error codes are now part of the MessageErrorCode union type
- Future-proof for additional thread-related features

## Testing

To verify the fix:

```bash
# Build the application
npm run build

# Type check
npx tsc --noEmit
```

## Date

December 1, 2025

## Author

Claude Code (Senior Software Engineer)
