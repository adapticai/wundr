# Enhanced Message Reactions System

## Overview

The enhanced message reactions system provides a complete solution for emoji reactions on messages with the following features:

- **Tooltip-based User Display**: Hover over reactions to see who reacted
- **Popover Emoji Picker**: Quick access to full emoji palette with search
- **Optimistic UI Updates**: Instant feedback with automatic rollback on errors
- **Full API Integration**: Works seamlessly with the existing `/api/messages/[id]/reactions` routes
- **Channel & DM Support**: Works in both channel messages and direct messages

## Components

### 1. ReactionDisplay

Enhanced reaction display component with shadcn/ui Tooltip integration.

```tsx
import { ReactionDisplay } from '@/components/chat/reaction-display';

<ReactionDisplay
  reactions={reactionsWithUsers}
  onToggleReaction={handleToggleReaction}
/>
```

**Features:**
- Shows reaction count and emoji
- Tooltip displays user names on hover
- Smart name formatting (1-5 users: all names, 6+: "Name1, Name2, Name3, and 5 others")
- Visual indication of current user's reactions
- Smooth animations and transitions

### 2. ReactionPickerPopover

Compact emoji picker in a popover for quick reactions.

```tsx
import { ReactionPickerPopover } from '@/components/chat/reaction-picker-popover';

<ReactionPickerPopover
  onSelect={handleEmojiSelect}
  align='end'
  side='top'
>
  <button>Add Reaction</button>
</ReactionPickerPopover>
```

**Features:**
- Quick reactions bar with most common emojis
- Category-based emoji browsing
- Search functionality
- Keyboard navigation
- Auto-focus on search input
- Responsive sizing

### 3. EnhancedMessageReactions

Complete integration component with optimistic updates.

```tsx
import { EnhancedMessageReactions } from '@/components/chat/enhanced-message-reactions';

<EnhancedMessageReactions
  message={message}
  currentUser={currentUser}
  workspaceSlug={workspaceSlug}
/>
```

**Features:**
- Automatic API integration
- Optimistic UI updates with rollback
- Fetches full user data for tooltips
- Quick "Add reaction" button
- Error handling and recovery

### 4. useMessageReactions Hook

React hook for managing reactions with optimistic updates.

```tsx
import { useMessageReactions } from '@/hooks/use-message-reactions';

const { reactions, toggleReaction, isPending } = useMessageReactions({
  messageId: message.id,
  initialReactions: message.reactions,
  currentUserId: currentUser.id,
  onReactionToggle: async (emoji) => {
    // API call
  },
});
```

## API Integration

The system works with the existing API routes:

### GET /api/messages/:id/reactions

Returns reactions grouped by emoji with user details:

```json
{
  "data": [
    {
      "emoji": "👍",
      "count": 3,
      "hasReacted": true,
      "users": [
        {
          "id": "user1",
          "name": "John Doe",
          "displayName": "John",
          "avatarUrl": "..."
        }
      ]
    }
  ]
}
```

### POST /api/messages/:id/reactions

Add a reaction:

```json
{
  "emoji": "👍"
}
```

### DELETE /api/messages/:id/reactions?emoji=👍

Remove a reaction by passing the emoji as a query parameter.

## Usage Examples

### Basic Usage in Message Component

```tsx
import { ReactionDisplay } from '@/components/chat/reaction-display';
import { ReactionPickerPopover } from '@/components/chat/reaction-picker-popover';

function MessageItem({ message, currentUser }) {
  const handleToggleReaction = async (emoji: string) => {
    const hasReacted = message.reactions.find(r =>
      r.emoji === emoji && r.hasReacted
    );

    if (hasReacted) {
      await fetch(`/api/messages/${message.id}/reactions?emoji=${emoji}`, {
        method: 'DELETE'
      });
    } else {
      await fetch(`/api/messages/${message.id}/reactions`, {
        method: 'POST',
        body: JSON.stringify({ emoji })
      });
    }
  };

  const reactionsWithUsers = message.reactions.map(reaction => ({
    ...reaction,
    users: reaction.userIds?.map(id => ({
      id,
      name: id === currentUser.id ? 'You' : 'User',
      displayName: null
    }))
  }));

  return (
    <div>
      {/* Message content */}

      {/* Reactions */}
      {reactionsWithUsers.length > 0 && (
        <ReactionDisplay
          reactions={reactionsWithUsers}
          onToggleReaction={handleToggleReaction}
        />
      )}

      {/* Add reaction button */}
      <ReactionPickerPopover onSelect={handleToggleReaction}>
        <button>Add Reaction</button>
      </ReactionPickerPopover>
    </div>
  );
}
```

### With Optimistic Updates

```tsx
import { useMessageReactions } from '@/hooks/use-message-reactions';

function MessageWithOptimisticReactions({ message, currentUser }) {
  const { reactions, toggleReaction, isPending } = useMessageReactions({
    messageId: message.id,
    initialReactions: message.reactions,
    currentUserId: currentUser.id,
    onReactionToggle: async (emoji) => {
      const hasReacted = reactions.find(r =>
        r.emoji === emoji && r.hasReacted
      );

      if (hasReacted) {
        await fetch(`/api/messages/${message.id}/reactions?emoji=${emoji}`, {
          method: 'DELETE'
        });
      } else {
        await fetch(`/api/messages/${message.id}/reactions`, {
          method: 'POST',
          body: JSON.stringify({ emoji })
        });
      }
    }
  });

  return (
    <div>
      <ReactionDisplay
        reactions={reactions}
        onToggleReaction={toggleReaction}
      />
      {isPending && <LoadingSpinner />}
    </div>
  );
}
```

### Using the Complete Integration Component

```tsx
import { EnhancedMessageReactions } from '@/components/chat/enhanced-message-reactions';

function MessageItem({ message, currentUser, workspaceSlug }) {
  return (
    <div>
      {/* Message content */}

      <EnhancedMessageReactions
        message={message}
        currentUser={currentUser}
        workspaceSlug={workspaceSlug}
      />
    </div>
  );
}
```

## Styling & Customization

All components use shadcn/ui and Tailwind CSS for styling:

### Customize Reaction Badge Appearance

```tsx
// Modify the ReactionDisplay component
className='flex flex-wrap gap-2' // Increase gap between reactions
```

### Customize Emoji Picker Size

```tsx
<ReactionPickerPopover>
  <PopoverContent className='w-96 h-[500px]'> {/* Larger picker */}
```

### Custom Quick Reactions

```tsx
import { QUICK_REACTIONS } from '@/types/chat';

// Modify QUICK_REACTIONS array in types/chat.ts
export const QUICK_REACTIONS = ['👍', '❤️', '😂', '🎉', '🚀', '👏'];
```

## Accessibility

The system is fully accessible:

- **ARIA labels** on all interactive elements
- **Keyboard navigation** support
- **Screen reader** friendly tooltips
- **Focus management** in popovers
- **Semantic HTML** structure

## Performance Considerations

- **Optimistic updates** prevent UI lag
- **Memoization** reduces unnecessary re-renders
- **Tooltip lazy loading** with delay duration
- **API batching** for reaction fetches
- **Efficient re-renders** with React.memo

## Browser Support

Works in all modern browsers:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

## Testing

Example test for reaction toggling:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ReactionDisplay } from './reaction-display';

test('toggles reaction on click', async () => {
  const onToggle = jest.fn();
  const reactions = [
    { emoji: '👍', count: 2, hasReacted: false, users: [] }
  ];

  render(
    <ReactionDisplay
      reactions={reactions}
      onToggleReaction={onToggle}
    />
  );

  fireEvent.click(screen.getByText('👍'));

  expect(onToggle).toHaveBeenCalledWith('👍');
});
```

## Migration Guide

### From Old Reaction System

1. **Update imports:**
```tsx
// Old
import { ReactionDisplay } from './reaction-display';

// New
import { ReactionDisplay, type ReactionWithUsers } from './reaction-display';
```

2. **Add user data to reactions:**
```tsx
// Old
<ReactionDisplay reactions={message.reactions} />

// New
const reactionsWithUsers = message.reactions.map(r => ({
  ...r,
  users: getUsersForReaction(r.userIds)
}));
<ReactionDisplay reactions={reactionsWithUsers} />
```

3. **Switch to popover picker:**
```tsx
// Old
<ReactionPickerTrigger />

// New
<ReactionPickerPopover />
```

## Troubleshooting

### Tooltips not showing

Ensure TooltipProvider is in the component tree:
```tsx
<TooltipProvider>
  <ReactionDisplay ... />
</TooltipProvider>
```

### Reactions not updating

Check that the API returns the correct format with user data.

### Optimistic updates reverting

Verify the API call is successful and returns expected data.

## Future Enhancements

- [ ] Custom workspace reactions
- [ ] Reaction analytics
- [ ] Reaction animations
- [ ] Reaction shortcuts (keyboard)
- [ ] Reaction notifications
- [ ] Bulk reaction operations
