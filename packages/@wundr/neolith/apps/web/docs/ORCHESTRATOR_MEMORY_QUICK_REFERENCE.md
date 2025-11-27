# Orchestrator Memory Service - Quick Reference

## Import
```typescript
import {
  saveConversationMemory,
  saveTaskMemory,
  saveLearningMemory,
  retrieveMemory,
  searchMemory,
  pruneOldMemory,
  getMemoryStats,
  updateMemoryImportance,
} from '@/lib/services/orchestrator-memory-service';

import type {
  VPMemoryEntry,
  CreateMemoryInput,
  MemorySearchParams,
  ConversationMessage,
  TaskResult,
} from '@/lib/services/orchestrator-memory-service';
```

## Quick Examples

### Save Conversation
```typescript
await saveConversationMemory(
  'vp_abc123',
  'channel_xyz',
  [
    { role: 'user', content: 'Hello', timestamp: new Date() },
    { role: 'assistant', content: 'Hi!', timestamp: new Date() },
  ],
  { importance: 5, keywords: ['greeting'] }
);
```

### Save Task Result
```typescript
await saveTaskMemory(
  'vp_abc123',
  'task_def456',
  {
    taskId: 'task_def456',
    status: 'COMPLETED',
    result: { success: true },
  },
  { importance: 7 }
);
```

### Retrieve Relevant Memories
```typescript
const memories = await retrieveMemory(
  'vp_abc123',
  'deployment configuration',
  { type: 'TASK', limit: 5, minImportance: 6 }
);
```

### Search with Filters
```typescript
const result = await searchMemory('vp_abc123', {
  type: ['CONVERSATION', 'TASK'],
  channelId: 'channel_xyz',
  minImportance: 5,
  from: new Date('2025-11-01'),
  limit: 20,
  sortBy: 'importance',
  sortOrder: 'desc',
});
```

### Clean Up Old Memories
```typescript
const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
const { deleted, preserved } = await pruneOldMemory(
  'vp_abc123',
  thirtyDaysAgo,
  { preserveImportant: true, minImportanceThreshold: 8 }
);
```

## Memory Types
- `CONVERSATION` - Chat/message history
- `TASK` - Task execution results
- `LEARNING` - Learned patterns/insights
- `CONTEXT` - Contextual information
- `DECISION` - Decision rationale

## Importance Scale
- 1-3: Low importance (can be pruned easily)
- 4-6: Medium importance (standard memories)
- 7-9: High importance (preserve during cleanup)
- 10: Critical importance (never auto-delete)

## Pagination
```typescript
// Page 1
const page1 = await searchMemory('vp_abc123', { limit: 20, offset: 0 });

// Page 2
const page2 = await searchMemory('vp_abc123', { limit: 20, offset: 20 });

console.log(`Total: ${page1.total}, Has more: ${page1.hasMore}`);
```

## Access Tracking
Every `retrieveMemory` call automatically:
- Increments `accessCount`
- Updates `lastAccessedAt`

Use for importance adjustment:
```typescript
const stats = await getMemoryStats('vp_abc123');
// High accessCount = frequently used = important
```

## Best Practices

1. **Set appropriate importance**: Higher for critical learnings (7-9), lower for routine conversations (4-6)
2. **Use keywords**: Help retrieval accuracy and speed
3. **Regular cleanup**: Schedule `pruneOldMemory` to prevent database bloat
4. **Link context**: Always set `channelId` or `taskId` when relevant
5. **Monitor stats**: Use `getMemoryStats` to track memory usage
6. **Expire transient data**: Set `expiresAt` for time-sensitive information

## Performance Tips

- Use `minImportance` to filter noise
- Limit results with `limit` parameter
- Use specific memory types when possible
- Index on keywords for fast search
- Batch similar operations

## Error Handling
```typescript
try {
  const memory = await saveConversationMemory(vpId, channelId, messages);
} catch (error) {
  if (error.message.includes('VP not found')) {
    // Handle missing Orchestrator
  } else if (error.message.includes('No workspace found')) {
    // Handle workspace issue
  }
}
```

## Database Schema
See `/packages/@neolith/database/prisma/schema.prisma`:
- Model: `VPMemory`
- Enum: `MemoryType`
- Relations: `VP.memories[]`, `Workspace.orchestratorMemories[]`
