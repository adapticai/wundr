# Quick Start: Enhanced Reactions System

Get the enhanced reactions system working in 5 minutes.

## Option 1: Drop-in Component (Easiest)

Replace your existing reaction code with one component:

```tsx
import { EnhancedMessageReactions } from '@/components/chat/enhanced-message-reactions';

// In your MessageItem component:
<EnhancedMessageReactions
  message={message}
  currentUser={currentUser}
  workspaceSlug={workspaceSlug}
/>;
```

That's it! This handles:

- API integration
- User tooltips
- Emoji picker
- Optimistic updates

## Option 2: Manual Integration (More Control)

### Step 1: Import components

```tsx
import { ReactionDisplay, type ReactionWithUsers } from '@/components/chat/reaction-display';
import { ReactionPickerPopover } from '@/components/chat/reaction-picker-popover';
```

### Step 2: Transform reactions data

```tsx
const reactionsWithUsers: ReactionWithUsers[] = message.reactions.map(r => ({
  ...r,
  users: r.userIds?.map(id => ({
    id,
    name: id === currentUser.id ? 'You' : 'User',
    displayName: null,
  })),
}));
```

### Step 3: Handle reaction toggle

```tsx
const handleToggleReaction = async (emoji: string) => {
  const hasReacted = reactionsWithUsers.find(r => r.emoji === emoji && r.hasReacted);

  if (hasReacted) {
    await fetch(`/api/messages/${message.id}/reactions?emoji=${encodeURIComponent(emoji)}`, {
      method: 'DELETE',
    });
  } else {
    await fetch(`/api/messages/${message.id}/reactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emoji }),
    });
  }
};
```

### Step 4: Render components

```tsx
{
  /* Display existing reactions */
}
{
  reactionsWithUsers.length > 0 && (
    <ReactionDisplay reactions={reactionsWithUsers} onToggleReaction={handleToggleReaction} />
  );
}

{
  /* Add reaction button */
}
<ReactionPickerPopover onSelect={handleToggleReaction}>
  <button>Add Reaction</button>
</ReactionPickerPopover>;
```

## Option 3: With Optimistic Updates

### Step 1: Import hook

```tsx
import { useMessageReactions } from '@/hooks/use-message-reactions';
```

### Step 2: Use the hook

```tsx
const { reactions, toggleReaction, isPending } = useMessageReactions({
  messageId: message.id,
  initialReactions: message.reactions.map(r => ({
    ...r,
    users: r.userIds?.map(id => ({ id, name: 'User', displayName: null })),
  })),
  currentUserId: currentUser.id,
  onReactionToggle: async emoji => {
    const hasReacted = reactions.find(r => r.emoji === emoji && r.hasReacted);

    if (hasReacted) {
      await fetch(`/api/messages/${message.id}/reactions?emoji=${emoji}`, { method: 'DELETE' });
    } else {
      await fetch(`/api/messages/${message.id}/reactions`, {
        method: 'POST',
        body: JSON.stringify({ emoji }),
      });
    }
  },
});
```

### Step 3: Render with optimistic state

```tsx
<ReactionDisplay reactions={reactions} onToggleReaction={toggleReaction} />;
{
  isPending && <span>Updating...</span>;
}
```

## Complete Example

```tsx
'use client';

import { EnhancedMessageReactions } from '@/components/chat/enhanced-message-reactions';
import type { Message, User } from '@/types/chat';

export function MessageItem({
  message,
  currentUser,
  workspaceSlug,
}: {
  message: Message;
  currentUser: User;
  workspaceSlug?: string;
}) {
  return (
    <div className='message-item'>
      {/* Message header */}
      <div className='message-header'>
        <span>{message.author.name}</span>
        <span>{new Date(message.createdAt).toLocaleTimeString()}</span>
      </div>

      {/* Message content */}
      <div className='message-content'>{message.content}</div>

      {/* Enhanced Reactions */}
      <EnhancedMessageReactions
        message={message}
        currentUser={currentUser}
        workspaceSlug={workspaceSlug}
      />
    </div>
  );
}
```

## Styling

All components use Tailwind CSS and are fully styled. No additional CSS needed!

## TypeScript

Full type safety included:

```tsx
import type { ReactionWithUsers, Reaction } from '@/components/chat/reaction-display';

import type { Message, User } from '@/types/chat';
```

## Troubleshooting

### "Tooltip not showing"

Make sure you're using the enhanced `ReactionDisplay` component, not the old one.

### "API calls failing"

Verify the message ID is correct and the user is authenticated.

### "Users not displaying in tooltip"

Check that your API returns user data in the `/api/messages/:id/reactions` endpoint.

## Next Steps

1. Read [Complete Documentation](./enhanced-reactions-system.md)
2. See [Integration Examples](./message-item-integration-example.tsx)
3. Review [Full Summary](./AGENT-14-SUMMARY.md)

## Support

For issues or questions:

1. Check the [Troubleshooting section](./enhanced-reactions-system.md#troubleshooting)
2. Review the [API Integration guide](./enhanced-reactions-system.md#api-integration)
3. See [Example code](./message-item-integration-example.tsx)
