# Orchestrator Components Quick Reference Guide

Quick reference for using Orchestrator interaction components in the Neolith web app.

## Component Import Map

```typescript
import {
  // Existing components
  VPCard,
  VPStatusBadge,
  VPTaskAssignmentDialog,

  // NEW - Wave 2.1.3
  VPPresenceTooltip,      // Rich hover card with task info
  VPMessageIndicator,     // Message type indicators
  VPMessageWrapper,       // Message styling wrapper
  VPMessageBadge,         // Compact Orchestrator badge
  VPWorkSummary,          // Dashboard stats widget
  VPThinkingIndicator,    // Processing animations
  InlineThinkingIndicator,// Inline version
  TypingIndicator,        // Typing states
  ProcessingBanner,       // Full-width banner
  VPEscalationCard,       // Escalation display
  VPEscalationListItem,   // Compact list version
} from '@/components/vp';

import {
  useVP,              // Single Orchestrator data
  useVPs,             // Multiple Orchestrators
  useVPMutations,     // CRUD operations
  useVPPresence,      // NEW - Single Orchestrator presence
  useMultipleVPPresence, // NEW - Multiple Orchestrator presence
} from '@/hooks';
```

---

## Common Use Cases

### 1. Show Orchestrator with Current Status
```tsx
<Orchestrator PresenceTooltip vp={vp} currentTask={presence?.currentTask}>
  <Orchestrator Card vp={vp} workspaceId={workspaceId} />
</VPPresenceTooltip>
```

### 2. Orchestrator Message in Chat
```tsx
<Orchestrator MessageWrapper isVP={message.isFromVP}>
  <div className="flex gap-3">
    <Orchestrator MessageIndicator
      avatarUrl={author.avatarUrl}
      vpName={author.name}
      variant="badge"
    />
    <div>{message.content}</div>
  </div>
</VPMessageWrapper>
```

### 3. Orchestrator Processing Task
```tsx
{isProcessing && (
  <Orchestrator ThinkingIndicator
    vpName={vp.title}
    taskContext="Analyzing data"
    variant="dots"
  />
)}
```

### 4. Orchestrator Dashboard Stats
```tsx
<Orchestrator WorkSummary
  vp={vp}
  stats={stats}
  workspaceId={workspaceId}
/>
```

### 5. Orchestrator Escalation Alert
```tsx
<Orchestrator EscalationCard
  escalation={escalation}
  workspaceId={workspaceId}
  onAssign={handleAssign}
  onResolve={handleResolve}
/>
```

### 6. Real-time Presence
```tsx
const { presence, isLoading } = useVPPresence(vpId, {
  refreshInterval: 5000,
  onPresenceChange: (p) => console.log('Status:', p.status)
});
```

---

## Component Props Quick Reference

### VPPresenceTooltip
| Prop | Type | Required | Description |
|------|------|----------|-------------|
| orchestrator | Orchestrator | Yes | Orchestrator data object |
| currentTask | VPTask \| null | No | Current task info |
| children | ReactNode | Yes | Trigger element |
| workspaceId | string | No | For task links |

### VPMessageIndicator
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| vpName | string | Yes | Orchestrator name |
| avatarUrl | string \| null | No | Avatar URL |
| variant | 'badge' \| 'icon' \| 'label' \| 'subtle' | 'badge' | Display style |
| size | 'sm' \| 'md' \| 'lg' | 'md' | Size variant |
| showLabel | boolean | false | Show "AI" label |

### VPWorkSummary
| Prop | Type | Required | Description |
|------|------|----------|-------------|
| orchestrator | Orchestrator | Yes | Orchestrator data |
| stats | VPWorkStats | Yes | Statistics object |
| workspaceId | string | No | For links |

### VPThinkingIndicator
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| variant | 'dots' \| 'spinner' \| 'pulse' | 'dots' | Animation type |
| size | 'sm' \| 'md' \| 'lg' | 'md' | Size |
| vpName | string | No | Orchestrator name |
| taskContext | string | No | What Orchestrator is doing |
| showText | boolean | true | Show label |

### VPEscalationCard
| Prop | Type | Required | Description |
|------|------|----------|-------------|
| escalation | VPEscalation | Yes | Escalation data |
| workspaceId | string | No | For links |
| onAssign | Function | No | Assign callback |
| onResolve | Function | No | Resolve callback |
| onRespond | Function | No | Respond callback |

---

## Hook Return Types

### useVPPresence
```typescript
{
  presence: VPPresenceData | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
  updatePresence: (updates) => void;
}
```

### VPPresenceData Structure
```typescript
{
  vpId: string;
  status: 'ONLINE' | 'OFFLINE' | 'BUSY' | 'AWAY';
  currentTask: {
    id: string;
    title: string;
    progress: number;      // 0-100
    estimatedMinutes: number;
  } | null;
  lastActive: Date;
  isProcessing: boolean;
  workload: number;        // Active task count
}
```

---

## Color Coding Reference

### Status Colors
- **ONLINE:** Green (`bg-green-500`)
- **BUSY:** Yellow (`bg-yellow-500`)
- **AWAY:** Orange (`bg-orange-500`)
- **OFFLINE:** Gray (`bg-gray-400`)

### Priority Colors
- **low:** Gray (`bg-gray-100`)
- **medium:** Blue (`bg-blue-100`)
- **high:** Orange (`bg-orange-100`)
- **urgent:** Red (`bg-red-100`)

### Escalation Types
- **blocked:** Red
- **unclear:** Orange
- **permission:** Yellow
- **complexity:** Purple
- **other:** Gray

---

## Size Classes

| Size | Avatar | Icon | Text | Padding |
|------|--------|------|------|---------|
| sm | 6x6 | 3x3 | xs | 1.5/2 |
| md | 8x8 | 4x4 | sm | 2/3 |
| lg | 10x10 | 5x5 | base | 2.5/4 |

---

## Animation Variants

### VPThinkingIndicator
- **dots:** Three bouncing dots (staggered)
- **spinner:** Rotating circle
- **pulse:** Expanding/fading ring

### Timing
- Bounce: 1000ms
- Spin: 1000ms
- Ping: 1000ms
- Pulse: 2000ms

---

## Accessibility

All components include:
- ARIA labels
- role="status" for live regions
- Keyboard navigation
- Focus management
- Screen reader text
- Sufficient color contrast

---

## Performance Tips

1. **Presence Updates:** Use 5-10s intervals, not 1s
2. **Large Lists:** Wrap in `React.memo`
3. **Activity Lists:** Limit to 5-10 items, paginate rest
4. **Optimistic Updates:** Use `updatePresence()` for instant feedback
5. **Debounce:** Status changes should debounce 500ms

---

## Common Patterns

### Pattern: Orchestrator Status Indicator
```tsx
const { presence } = useVPPresence(vpId);

<Orchestrator StatusBadge
  status={presence?.status || 'OFFLINE'}
  showPulse={presence?.isProcessing}
/>
```

### Pattern: Task Progress Display
```tsx
{presence?.currentTask && (
  <div>
    <p>{presence.currentTask.title}</p>
    <Progress value={presence.currentTask.progress} />
    <span>{presence.currentTask.estimatedMinutes}m remaining</span>
  </div>
)}
```

### Pattern: Multiple Orchestrator Monitoring
```tsx
const { presenceMap } = useMultipleVPPresence(vpIds);

return vpIds.map(vpId => {
  const presence = presenceMap.get(vpId);
  return (
    <Orchestrator Card
      key={vpId}
      vp={vps.find(v => v.id === vpId)}
      status={presence?.status}
      currentTask={presence?.currentTask}
    />
  );
});
```

### Pattern: Conditional Processing State
```tsx
{presence?.isProcessing ? (
  <Orchestrator ThinkingIndicator
    vpName={vp.title}
    variant="dots"
  />
) : (
  <Orchestrator StatusBadge status={presence?.status} />
)}
```

---

## Troubleshooting

### Issue: Presence not updating
- Check `refreshInterval` is set
- Verify `enabled` prop is true
- Check API endpoint returns correct data
- Ensure Orchestrator ID is valid

### Issue: Components not styling correctly
- Verify Tailwind classes are included
- Check theme provider is wrapping app
- Ensure `cn()` utility is working
- Check for CSS conflicts

### Issue: TypeScript errors
- Verify all types are imported
- Check Orchestrator type matches database schema
- Ensure hooks are properly typed
- Update to latest type definitions

### Issue: Animations not working
- Check Tailwind config includes animations
- Verify keyframes are defined
- Ensure `animate-*` classes are present
- Check browser supports animations

---

## Best Practices

1. **Always wrap status badges** in `VPPresenceTooltip` for rich context
2. **Use message wrappers** for Orchestrator messages to maintain visual consistency
3. **Show thinking indicators** whenever Orchestrator is processing
4. **Display escalations prominently** - they need immediate attention
5. **Update presence optimistically** for better UX
6. **Debounce rapid updates** to avoid flashing
7. **Handle errors gracefully** with fallback states
8. **Test with all status types** to ensure proper styling
9. **Provide keyboard shortcuts** for common actions
10. **Add analytics** to track Orchestrator interaction patterns

---

## Testing Checklist

- [ ] All status colors render correctly
- [ ] Animations work smoothly
- [ ] Hover states function properly
- [ ] Click handlers fire correctly
- [ ] Loading states display
- [ ] Error states show messages
- [ ] Empty states render
- [ ] Keyboard navigation works
- [ ] Screen readers announce changes
- [ ] Mobile responsive
- [ ] Dark mode compatible
- [ ] Presence updates on interval
- [ ] Multiple Orchestrators don't conflict

---

## Related Files

- **Components:** `/components/vp/`
- **Hooks:** `/hooks/use-vp*.ts`
- **Types:** `/types/vp.ts`
- **API Routes:** `/app/api/orchestrators/`
- **Documentation:** `/docs/WAVE_2.1.3_VP_UI_COMPONENTS_SUMMARY.md`

---

**Last Updated:** 2025-11-27
**Version:** 1.0.0
