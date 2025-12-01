# Search API Quick Reference

## Endpoint

```
GET /api/workspaces/{workspaceId}/search
```

## Required Parameters

- `q` - Search query string

## Optional Parameters

| Parameter | Type    | Default | Max | Options                        |
| --------- | ------- | ------- | --- | ------------------------------ |
| type      | string  | "all"   | -   | channels, messages, files, all |
| channelId | string  | -       | -   | Channel ID to scope search     |
| limit     | number  | 20      | 100 | Results per page               |
| offset    | number  | 0       | -   | Pagination offset              |
| highlight | boolean | true    | -   | Enable result highlighting     |
| facets    | boolean | false   | -   | Include result facets          |

## Response

```typescript
{
  data: SearchResult[];         // Mixed results array
  pagination: {
    offset: number;
    limit: number;
    totalCount: number;
    hasMore: boolean;
  };
  facets?: {                    // Only if facets=true
    types: {type, count}[];
    channels: {id, name, count}[];
  };
}
```

## Result Types

### Channel

```typescript
type: 'channel'
id, name, description, topic, type_value
memberCount, messageCount, createdAt
highlighted?: {name, description, topic}
```

### Message

```typescript
type: 'message'
id, content, channelId, channelName
authorId, authorName, authorAvatarUrl, authorIsVP
createdAt, isEdited, replyCount
highlighted?: {content}
```

### File

```typescript
type: 'file'
id, filename, originalName, mimeType, size
uploadedById, uploaderName, thumbnailUrl
channelId?, channelName?, createdAt
highlighted?: {filename, originalName}
```

## Examples

### Basic Search

```bash
GET /api/workspaces/ws_123/search?q=meeting
```

### Type-Filtered

```bash
# Messages only
GET .../search?q=bug&type=messages

# Channels only
GET .../search?q=general&type=channels

# Files only
GET .../search?q=report&type=files
```

### Channel-Scoped

```bash
GET .../search?q=update&channelId=ch_456
```

### With Pagination

```bash
GET .../search?q=api&limit=50&offset=0
```

### With Facets

```bash
GET .../search?q=project&facets=true
```

### Without Highlighting

```bash
GET .../search?q=code&highlight=false
```

## Error Codes

- `401` - UNAUTHORIZED - Authentication required
- `400` - VALIDATION_ERROR - Invalid parameters
- `404` - WORKSPACE_NOT_FOUND - No access to workspace
- `500` - INTERNAL_ERROR - Server error

## Client Example (React)

```typescript
const searchWorkspace = async (query: string) => {
  const params = new URLSearchParams({
    q: query,
    type: 'all',
    limit: '20',
    highlight: 'true',
  });

  const res = await fetch(`/api/workspaces/${workspaceId}/search?${params}`);

  return await res.json();
};
```

## Highlighted Text Rendering

```tsx
<span dangerouslySetInnerHTML={{ __html: result.highlighted.content }} />
```

## Files

- Route: `/app/api/workspaces/[workspaceId]/search/route.ts`
- Tests: `/app/api/workspaces/[workspaceId]/search/__tests__/route.test.ts`
- Docs: `/docs/api/search-api.md`
- Summary: `/docs/api/SEARCH_API_IMPLEMENTATION.md`
