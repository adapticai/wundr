# Sidebar Settings Component

**Location**: `/components/settings/sidebar-settings.tsx` **Page**:
`/app/(workspace)/[workspaceSlug]/settings/sidebar/page.tsx`

## Overview

A comprehensive sidebar customization settings component with drag-and-drop section ordering,
visibility toggles, sorting preferences, and a live preview of the sidebar configuration.

## Features Implemented

### 1. Section Visibility & Ordering

- **Drag-and-drop reordering**: Users can reorder sidebar sections using @dnd-kit
- **Visibility toggles**: Show/hide individual sections (Starred, Channels, DMs, Favorites, Threads)
- **Visual feedback**: Eye/EyeOff icons indicate section visibility
- **Non-sortable sections**: Some sections (Channels, Direct Messages) are locked in place

### 2. Channel Sorting Preferences

- **Alphabetical**: Sort channels A-Z by name
- **Recent Activity**: Sort by most recently active channels
- **Unread First**: Prioritize channels with unread messages
- **Custom Order**: User-defined manual ordering
- **Show Muted Channels**: Toggle to hide/show muted channels
- **Group by Type**: Separate public and private channels into sub-sections

### 3. Direct Message Sorting

- **Alphabetical**: Sort DMs A-Z by participant name
- **Recent Activity**: Sort by most recent conversation (default)
- **Online First**: Prioritize online users at the top
- **Custom Order**: User-defined manual ordering
- **Show Offline Users**: Toggle to hide/show offline users
- **Show User Presence**: Display online status indicators

### 4. Starred Items Section

- **Enable/Disable**: Toggle starred items section visibility
- **Position**: Choose top or bottom placement
- **Auto-sync**: Starred items automatically appear when starred via context menu

### 5. Quick Access & Favorites

- **Favorites Section**: Dedicated section for frequently accessed channels/DMs
- **Management**: View and manage favorited items
- **Visual Indicators**: Shows item type (channel/DM) and icons

### 6. Visual Display Settings

- **Sidebar Width**: Adjustable from 200-400px via slider
- **Compact Mode**: Reduced spacing and smaller fonts
- **Unread Badges**: Toggle visibility of unread indicators
- **Badge Style**: Choose between count, dot, or both
- **Section Counts**: Show item counts next to section headers

### 7. Collapse Behavior

- **Mobile Auto-collapse**: Automatically collapse on small screens
- **Inactivity Auto-collapse**: Collapse after configurable delay (1-30 minutes)
- **Remember State**: Persist collapse state across sessions
- **Smooth Transitions**: Animated collapse/expand with CSS transforms

### 8. Live Preview Panel

- **Real-time Updates**: Preview changes as you adjust settings
- **Accurate Representation**: Mimics actual sidebar layout and styling
- **Dimensions Display**: Shows current sidebar width
- **Settings Summary**: Lists all active preferences at a glance

## Technical Implementation

### State Management

```typescript
interface SidebarPreferences {
  sections: SidebarSection[];
  channelSorting: 'alphabetical' | 'recent' | 'custom' | 'unread-first';
  showMutedChannels: boolean;
  groupChannelsByType: boolean;
  dmSorting: 'alphabetical' | 'recent' | 'custom' | 'status-first';
  showOfflineUsers: boolean;
  showStarredSection: boolean;
  starredPosition: 'top' | 'bottom';
  favoriteItems: FavoriteItem[];
  showFavoritesSection: boolean;
  sidebarWidth: number;
  showUnreadBadges: boolean;
  unreadBadgeStyle: 'count' | 'dot' | 'both';
  collapseOnMobile: boolean;
  autoCollapseInactive: boolean;
  autoCollapseDelay: number;
  rememberCollapseState: boolean;
  showUserPresence: boolean;
  compactMode: boolean;
  showSectionCounts: boolean;
}
```

### Drag & Drop

Uses `@dnd-kit` for smooth, accessible drag-and-drop:

- **Sensors**: PointerSensor (mouse/touch) + KeyboardSensor (accessibility)
- **Collision Detection**: closestCenter algorithm
- **Strategy**: verticalListSortingStrategy for list reordering
- **Visual Feedback**: Opacity and cursor changes during drag

### Persistence

- **localStorage**: Client-side preference caching
- **API**: `/api/users/me/preferences` PATCH endpoint for server sync
- **Auto-save**: Updates localStorage on every change
- **Manual Save**: Explicit "Save All Changes" button for API sync

### UI Components

Built with shadcn/ui components:

- Card, CardHeader, CardContent, CardDescription, CardTitle
- Tabs, TabsList, TabsTrigger, TabsContent
- Switch, Select, Slider, Button, Label, Separator
- Custom icons from lucide-react

## Usage

### Accessing the Settings

```
Navigation: Settings > Sidebar
URL: /{workspaceSlug}/settings/sidebar
```

### Integration with Sidebar Component

The preferences can be read from localStorage or API and applied to the main sidebar:

```typescript
// In sidebar component
const preferences = JSON.parse(localStorage.getItem('sidebar-preferences'));

// Apply section visibility
const visibleSections = preferences.sections.filter(s => s.visible);

// Apply channel sorting
const sortedChannels = sortChannels(channels, preferences.channelSorting);

// Apply sidebar width
<aside style={{ width: `${preferences.sidebarWidth}px` }}>
```

## API Integration

### Saving Preferences

```typescript
PATCH /api/users/me/preferences
Body: {
  "sidebar": {
    "sections": [...],
    "channelSorting": "recent",
    ...
  }
}
```

### Loading Preferences

```typescript
GET /api/users/me/preferences
Response: {
  "sidebar": { ... },
  "appearance": { ... },
  ...
}
```

## Accessibility

- **Keyboard Navigation**: Full keyboard support for all controls
- **ARIA Labels**: Proper labels on all interactive elements
- **Focus Management**: Visible focus indicators
- **Screen Reader Support**: Descriptive text for all actions
- **Drag & Drop Keyboard**: Can reorder sections with keyboard (Space to grab, Arrow keys to move,
  Space to drop)

## Performance Considerations

- **Debounced Updates**: Preview updates debounced to prevent excessive re-renders
- **Local-first**: Changes reflected immediately in localStorage
- **Batch Saves**: Single API call to save all preferences
- **Memoization**: Preview component memoized to prevent unnecessary re-renders

## Future Enhancements

1. **Per-workspace Settings**: Different sidebar configs per workspace
2. **Import/Export**: Share sidebar configurations
3. **Presets**: Pre-defined layouts (minimal, productivity, comprehensive)
4. **Smart Ordering**: ML-based auto-sorting based on usage patterns
5. **Pinned Items**: Pin specific channels to top regardless of sorting
6. **Custom Sections**: Create user-defined sections
7. **Section Themes**: Different colors/styles per section

## Testing

### Manual Testing Checklist

- [ ] Drag sections to reorder (except locked sections)
- [ ] Toggle section visibility
- [ ] Adjust sidebar width slider (200-400px)
- [ ] Enable/disable compact mode
- [ ] Change channel sorting methods
- [ ] Change DM sorting methods
- [ ] Toggle unread badges
- [ ] Change badge style (count/dot/both)
- [ ] Enable auto-collapse with custom delay
- [ ] Preview updates in real-time
- [ ] Save preferences to API
- [ ] Reset to defaults
- [ ] Reload page and verify persistence

### Edge Cases

- [ ] All sections hidden (should show warning)
- [ ] Maximum sidebar width (400px)
- [ ] Minimum sidebar width (200px)
- [ ] Auto-collapse with 1 minute delay
- [ ] Auto-collapse with 30 minute delay
- [ ] Empty favorites list
- [ ] Large number of favorited items (>20)

## Related Files

- `/components/settings/sidebar-settings.tsx` - Main component
- `/app/(workspace)/[workspaceSlug]/settings/sidebar/page.tsx` - Settings page
- `/app/(workspace)/components/sidebar.tsx` - Main sidebar component (consumer)
- `/components/channel/channel-list.tsx` - Channel list (affected by sorting)
- `/hooks/use-channel.ts` - Channel data hooks (sorting logic)

## Dependencies

```json
{
  "@dnd-kit/core": "^6.3.1",
  "@dnd-kit/sortable": "^10.0.0",
  "@dnd-kit/utilities": "^3.2.2",
  "lucide-react": "latest",
  "next-themes": "latest"
}
```

All shadcn/ui components are already present in the codebase.
