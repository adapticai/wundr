# Search API Documentation

## Overview

The Search API provides comprehensive full-text search functionality across channels, messages, and
files within a workspace. It includes advanced features like result highlighting, type filtering,
and channel-scoped search.

## Endpoint

```
GET /api/workspaces/{workspaceId}/search
```

## Authentication

Requires authentication via session token. User must be a member of the specified workspace.

## Query Parameters

| Parameter   | Type    | Required | Default | Description                                            |
| ----------- | ------- | -------- | ------- | ------------------------------------------------------ |
| `q`         | string  | Yes      | -       | Search query string                                    |
| `type`      | enum    | No       | `all`   | Search type: `channels`, `messages`, `files`, or `all` |
| `channelId` | string  | No       | -       | Limit search to specific channel                       |
| `limit`     | number  | No       | `20`    | Results per page (max: 100)                            |
| `offset`    | number  | No       | `0`     | Pagination offset                                      |
| `highlight` | boolean | No       | `true`  | Enable result highlighting                             |
| `facets`    | boolean | No       | `false` | Include result facets/aggregations                     |

## Response Format

```typescript
{
  data: SearchResult[];
  pagination: {
    offset: number;
    limit: number;
    totalCount: number;
    hasMore: boolean;
  };
  facets?: {
    types: { type: string; count: number }[];
    channels: { id: string; name: string; count: number }[];
  };
}
```

## Search Result Types

### Channel Result

```typescript
{
  type: 'channel';
  id: string;
  name: string;
  description: string | null;
  topic: string | null;
  type_value: 'PUBLIC' | 'PRIVATE' | 'DM' | 'HUDDLE';
  memberCount: number;
  messageCount: number;
  createdAt: Date;
  highlighted?: {
    name?: string;
    description?: string;
    topic?: string;
  };
}
```

### Message Result

```typescript
{
  type: 'message';
  id: string;
  content: string;
  channelId: string;
  channelName: string;
  authorId: string;
  authorName: string | null;
  authorAvatarUrl: string | null;
  authorIsVP: boolean;
  createdAt: Date;
  isEdited: boolean;
  replyCount: number;
  highlighted?: {
    content?: string;
  };
}
```

### File Result

```typescript
{
  type: 'file';
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: bigint;
  thumbnailUrl: string | null;
  uploadedById: string;
  uploaderName: string | null;
  channelId?: string;
  channelName?: string;
  createdAt: Date;
  highlighted?: {
    filename?: string;
    originalName?: string;
  };
}
```

## Example Requests

### Search all content types

```bash
GET /api/workspaces/ws_abc123/search?q=project+update
```

### Search only messages

```bash
GET /api/workspaces/ws_abc123/search?q=quarterly+report&type=messages
```

### Search within a specific channel

```bash
GET /api/workspaces/ws_abc123/search?q=bug+fix&type=messages&channelId=ch_xyz789
```

### Search with pagination

```bash
GET /api/workspaces/ws_abc123/search?q=design&limit=50&offset=0
```

### Search with facets

```bash
GET /api/workspaces/ws_abc123/search?q=api&facets=true
```

### Search without highlighting

```bash
GET /api/workspaces/ws_abc123/search?q=meeting&highlight=false
```

## Example Response

```json
{
  "data": [
    {
      "type": "message",
      "id": "msg_123",
      "content": "Let's discuss the quarterly report in the meeting.",
      "channelId": "ch_456",
      "channelName": "general",
      "authorId": "user_789",
      "authorName": "John Doe",
      "authorAvatarUrl": "https://example.com/avatar.jpg",
      "authorIsVP": false,
      "createdAt": "2024-11-26T10:30:00Z",
      "isEdited": false,
      "replyCount": 3,
      "highlighted": {
        "content": "Let's discuss the <mark>quarterly</mark> <mark>report</mark> in the meeting."
      }
    },
    {
      "type": "file",
      "id": "file_456",
      "filename": "quarterly-report-q4.pdf",
      "originalName": "Quarterly Report Q4 2024.pdf",
      "mimeType": "application/pdf",
      "size": 2048576,
      "thumbnailUrl": "https://example.com/thumb.jpg",
      "uploadedById": "user_789",
      "uploaderName": "John Doe",
      "channelId": "ch_456",
      "channelName": "general",
      "createdAt": "2024-11-25T15:20:00Z",
      "highlighted": {
        "filename": "<mark>quarterly</mark>-<mark>report</mark>-q4.pdf",
        "originalName": "<mark>Quarterly</mark> <mark>Report</mark> Q4 2024.pdf"
      }
    },
    {
      "type": "channel",
      "id": "ch_789",
      "name": "quarterly-reports",
      "description": "Channel for quarterly business reports",
      "topic": "Q4 2024 Reports",
      "type_value": "PUBLIC",
      "memberCount": 15,
      "messageCount": 47,
      "createdAt": "2024-01-15T09:00:00Z",
      "highlighted": {
        "name": "<mark>quarterly</mark>-<mark>reports</mark>",
        "description": "Channel for <mark>quarterly</mark> business <mark>reports</mark>"
      }
    }
  ],
  "pagination": {
    "offset": 0,
    "limit": 20,
    "totalCount": 3,
    "hasMore": false
  },
  "facets": {
    "types": [
      { "type": "message", "count": 1 },
      { "type": "file", "count": 1 },
      { "type": "channel", "count": 1 }
    ],
    "channels": [{ "id": "ch_456", "name": "general", "count": 2 }]
  }
}
```

## Error Responses

### 401 Unauthorized

```json
{
  "error": "Authentication required",
  "code": "UNAUTHORIZED"
}
```

### 400 Bad Request

```json
{
  "error": "Search query (q) is required",
  "code": "VALIDATION_ERROR"
}
```

### 403 Forbidden

```json
{
  "error": "Workspace not found or access denied",
  "code": "WORKSPACE_NOT_FOUND"
}
```

### 500 Internal Server Error

```json
{
  "error": "An internal error occurred during search",
  "code": "INTERNAL_ERROR"
}
```

## Features

### Result Highlighting

When `highlight=true` (default), matching terms in results are wrapped with `<mark>` tags:

```html
This is a <mark>search</mark> result with <mark>highlighted</mark> terms.
```

### Multi-word Queries

The search splits queries on whitespace and searches for all terms:

- Query: `"project update"` → Finds content containing both "project" AND "update"
- Case-insensitive matching
- Partial word matching supported

### Access Control

Search respects channel access permissions:

- Public channels: Visible to all workspace members
- Private channels: Only visible to channel members
- Results filtered based on user's channel memberships

### Relevance Ranking

When `type=all`, results are sorted by:

1. Exact name/title matches (channels and files)
2. Most recent creation date

Type-specific searches maintain their native ordering:

- Channels: Alphabetically by name
- Messages: Reverse chronological (newest first)
- Files: Reverse chronological (newest first)

### Faceted Search

When `facets=true`, response includes aggregated counts:

- **Type Facets**: Count of results by type (channel, message, file)
- **Channel Facets**: Top 10 channels with most matching results

## Performance Considerations

- Maximum limit is 100 results per request
- For `type=all`, results are divided equally among types (limit/3 each)
- Database queries use indexes on:
  - Channel: `workspaceId`, `name`, `type`, `isArchived`
  - Message: `channelId`, `content`, `isDeleted`, `createdAt`
  - File: `workspaceId`, `filename`, `originalName`

## Rate Limiting

No explicit rate limits, but consider implementing:

- Minimum query length (e.g., 2-3 characters)
- Debouncing on client-side
- Caching frequently searched terms

## Best Practices

### Client-Side Implementation

```typescript
// Debounced search function
const searchWorkspace = debounce(async (query: string) => {
  if (query.length < 2) return;

  const params = new URLSearchParams({
    q: query,
    type: 'all',
    limit: '20',
    highlight: 'true',
    facets: 'true',
  });

  const response = await fetch(`/api/workspaces/${workspaceId}/search?${params}`, {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const results = await response.json();
  displayResults(results);
}, 300);
```

### Display Highlighted Results

```typescript
// Safely render highlighted HTML
function renderHighlightedText(html: string) {
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}
```

### Pagination

```typescript
// Load more results
async function loadMore(offset: number) {
  const params = new URLSearchParams({
    q: currentQuery,
    offset: offset.toString(),
    limit: '20',
  });

  const response = await fetch(`/api/workspaces/${workspaceId}/search?${params}`);
  const data = await response.json();

  if (data.pagination.hasMore) {
    // Show "Load More" button
  }
}
```

## Future Enhancements

Potential improvements for future versions:

1. **Advanced Filters**
   - Date range filtering
   - Author filtering
   - File type filtering
   - Tag-based filtering

2. **Full-Text Search Optimization**
   - PostgreSQL full-text search indexes
   - Trigram similarity search
   - Weighted ranking by field

3. **Search Analytics**
   - Popular search terms
   - Zero-result queries
   - Click-through tracking

4. **Autocomplete**
   - Suggest channels as you type
   - Suggest users as you type
   - Recent searches

5. **Advanced Syntax**
   - Phrase matching: `"exact phrase"`
   - Exclusion: `-term`
   - Field-specific: `author:john`
   - Boolean operators: `term1 OR term2`

## Related Endpoints

- `GET /api/workspaces/{workspaceId}/search/suggestions` - Get search suggestions
- `GET /api/channels/{channelId}/messages` - List channel messages
- `GET /api/channels?workspaceId={workspaceId}` - List channels

## Support

For issues or questions about the Search API, contact the API team or refer to the main API
documentation.
