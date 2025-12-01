# Global Search Bar Component

## Overview

The `GlobalSearchBar` component is a sophisticated command palette-style search interface for the
workspace header. It provides instant search across channels, messages, members, workflows, and
virtual people with an intuitive keyboard-driven interface.

## File Location

```
/Users/iroselli/wundr/packages/@wundr/neolith/apps/web/components/layout/global-search-bar.tsx
```

## Features

### Core Functionality

1. **Command Palette Interface**
   - Modal overlay with centered search dialog
   - Click trigger button or use keyboard shortcut
   - Backdrop overlay with click-to-close

2. **Keyboard Shortcuts**
   - `Cmd+K` (macOS) or `Ctrl+K` (Windows/Linux) to open
   - `Escape` to close
   - Arrow keys to navigate results
   - `Enter` to select result

3. **Intelligent Search**
   - Debounced API calls (300ms delay)
   - Minimum 2 characters to trigger search
   - Real-time loading indicator
   - Search across multiple entity types

4. **Recent Searches**
   - Stores last 5 searches in localStorage
   - Displayed when search input is empty
   - Click to re-run previous search
   - Persisted per workspace

5. **Categorized Results**
   - Results grouped by type (Channels, Messages, Members, Workflows, VPs)
   - Visual separators between categories
   - Type-specific icons (Hash, MessageSquare, User, Workflow, Users)
   - Contextual metadata display

6. **Smart Navigation**
   - Automatic routing based on result type
   - Channel results → `/[workspaceId]/channels/[channelId]`
   - Message results → `/[workspaceId]/channels/[messageId]`
   - Member results → `/[workspaceId]/members/[memberId]`
   - Workflow results → `/[workspaceId]/workflows/[workflowId]`
   - Orchestrator results → `/[workspaceId]/orchestrators/[orchestratorId]`

## Props

```typescript
export interface GlobalSearchBarProps {
  /** The workspace ID to search within */
  workspaceId: string;
  /** Optional CSS class name */
  className?: string;
}
```

## Usage

### Basic Usage

```tsx
import { GlobalSearchBar } from '@/components/layout/global-search-bar';

function WorkspaceHeader() {
  return (
    <header>
      <GlobalSearchBar workspaceId='workspace-123' />
    </header>
  );
}
```

### With Custom Styling

```tsx
<GlobalSearchBar workspaceId='workspace-123' className='w-full max-w-xl' />
```

## API Integration

### Search Endpoint

The component uses the workspace search API:

```
GET /api/workspaces/{workspaceId}/search?q={query}&limit=15&highlight=true
```

**Parameters:**

- `q` (required): Search query string
- `limit` (optional): Maximum results to return (default: 15)
- `highlight` (optional): Enable result highlighting (default: true)

**Response Format:**

```json
{
  "data": [
    {
      "type": "channel",
      "id": "channel-123",
      "name": "general",
      "description": "General discussion",
      "memberCount": 42
    },
    {
      "type": "message",
      "id": "msg-456",
      "content": "Let's discuss the project...",
      "authorName": "John Doe",
      "channelName": "general"
    }
  ],
  "pagination": {
    "offset": 0,
    "limit": 15,
    "totalCount": 2,
    "hasMore": false
  }
}
```

## Component Structure

### State Management

```typescript
const [open, setOpen] = useState(false); // Dialog visibility
const [query, setQuery] = useState(''); // Search input value
const [results, setResults] = useState<SearchResult[]>([]); // Search results
const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
const [isLoading, setIsLoading] = useState(false); // Loading indicator
const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
```

### Search Flow

1. User types in search input
2. `handleQueryChange` is called
3. Debounce timer is set (300ms)
4. After delay, `performSearch` is executed
5. API call is made to `/api/workspaces/{workspaceId}/search`
6. Results are transformed and stored
7. UI updates with categorized results

### Result Selection Flow

1. User clicks result or presses Enter
2. `handleSelect` is called
3. Search query is saved to recent searches
4. Dialog is closed
5. User is navigated to result page

## UI Components

### Trigger Button

```tsx
<button
  type='button'
  onClick={() => setOpen(true)}
  className='flex items-center gap-2 px-3 h-9 rounded-lg border'
>
  <Search className='h-4 w-4' />
  <span>Search...</span>
  <kbd>⌘K</kbd>
</button>
```

### Search Dialog

Uses shadcn Command components:

- `Command` - Container
- `CommandInput` - Search input
- `CommandList` - Results list
- `CommandGroup` - Category grouping
- `CommandItem` - Individual result
- `CommandSeparator` - Category divider
- `CommandEmpty` - No results state

### Result Display

```tsx
<CommandItem onSelect={() => handleSelect(result)}>
  <Icon className='mr-2 h-4 w-4' />
  <div className='flex flex-col flex-1 gap-1'>
    <div className='flex items-center gap-2'>
      <span className='font-medium'>{result.name}</span>
      {result.metadata?.memberCount && (
        <Badge variant='secondary'>{result.metadata.memberCount} members</Badge>
      )}
    </div>
    {result.description && (
      <span className='text-xs text-muted-foreground'>{result.description}</span>
    )}
  </div>
</CommandItem>
```

## Styling

### Theme Integration

The component uses Tailwind CSS with theme variables:

- `bg-background` - Background colors
- `text-foreground` - Text colors
- `border-input` - Border colors
- `bg-accent` - Hover states
- `text-muted-foreground` - Secondary text

### Responsive Design

- Mobile: Icon button only
- Tablet/Desktop: Full search bar with keyboard hint
- Modal: Centered on all screen sizes

### Z-Index Management

- Backdrop: `z-40`
- Search Dialog: `z-50`

## Performance Optimizations

### Debouncing

Search requests are debounced to prevent excessive API calls:

```typescript
debounceTimerRef.current = setTimeout(() => {
  performSearch(value);
}, 300);
```

### Memoization

Callback functions are memoized with `useCallback`:

- `handleQueryChange`
- `handleSelect`
- `handleRecentSearchClick`
- `performSearch`
- `saveRecentSearch`

### Cleanup

Debounce timers are properly cleaned up:

```typescript
useEffect(() => {
  return () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
  };
}, []);
```

## Accessibility

### Keyboard Navigation

- Full keyboard support via Command component
- Arrow keys for result navigation
- Enter to select
- Escape to close

### ARIA Attributes

```tsx
<button aria-label="Search">
  ...
</button>

<div
  role="button"
  tabIndex={0}
  aria-label="Close search"
>
  ...
</div>
```

### Focus Management

- Auto-focus on open
- Trap focus within dialog
- Return focus on close

## LocalStorage Schema

### Recent Searches

**Key:** `recent-searches-{workspaceId}`

**Value:**

```json
[
  {
    "query": "project update",
    "timestamp": 1701234567890
  },
  {
    "query": "team meeting",
    "timestamp": 1701234567890
  }
]
```

**Storage Limits:**

- Maximum 5 recent searches per workspace
- Sorted by timestamp (most recent first)
- Deduplicated by query string

## Dependencies

### UI Components

- `lucide-react` - Icons (Search, Hash, MessageSquare, User, Workflow, Users, Clock, Loader2)
- `@/components/ui/command` - Command palette components
- `@/components/ui/badge` - Badge component
- `@radix-ui/*` - Underlying primitives (via Command)

### Utilities

- `next/navigation` - useRouter for navigation
- `@/lib/utils` - cn() utility for className merging

### React Hooks

- `useState` - State management
- `useCallback` - Memoization
- `useRef` - Debounce timer reference
- `useEffect` - Side effects and cleanup

## Testing Considerations

### Unit Tests

Test scenarios:

1. Trigger button opens dialog
2. Keyboard shortcut opens dialog
3. Search query triggers debounced API call
4. Results are grouped by type
5. Clicking result navigates correctly
6. Recent searches are saved
7. Recent searches are loaded on mount

### Integration Tests

1. Full search flow from input to navigation
2. Keyboard navigation through results
3. Recent search interaction
4. Loading states
5. Error handling

### E2E Tests

1. Search across all entity types
2. Navigate to different result types
3. Use keyboard shortcuts
4. Verify localStorage persistence

## Future Enhancements

### Planned Features

1. **Search Filters**
   - Filter by entity type
   - Date range filters
   - Author filters

2. **Advanced Search**
   - Boolean operators (AND, OR, NOT)
   - Quoted phrases
   - Field-specific search

3. **Search Analytics**
   - Track popular searches
   - Search success rate
   - Time to result selection

4. **Suggestions**
   - Auto-complete suggestions
   - "Did you mean?" corrections
   - Related searches

5. **Performance**
   - Result caching
   - Prefetch on hover
   - Infinite scroll for results

## Troubleshooting

### Common Issues

**Search not triggering:**

- Ensure workspaceId prop is provided
- Check API endpoint is accessible
- Verify user has workspace access

**Keyboard shortcut not working:**

- Check for conflicting shortcuts
- Verify browser allows keyboard events
- Test in different browsers

**Recent searches not persisting:**

- Check localStorage is enabled
- Verify storage quota not exceeded
- Test in incognito mode

**Results not displaying:**

- Check API response format
- Verify result transformation logic
- Inspect console for errors

## Related Components

- `/components/search/search-bar.tsx` - Simple search input
- `/components/ui/command-palette.tsx` - Navigation command palette
- `/components/layout/app-header.tsx` - Workspace header

## Support

For issues or questions about the GlobalSearchBar component:

1. Check this documentation
2. Review the component source code
3. Test with the search API directly
4. Check browser console for errors
