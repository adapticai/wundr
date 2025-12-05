# Settings Navigation - Quick Reference

## Component Imports

```typescript
import {
  CollapsibleSettingsSection,
  EnhancedSettingsLayout,
  QuickSettingsModal,
  SettingsBreadcrumb,
  SettingsHeader,
  SettingsPageWrapper,
  SettingsSearch,
  SettingsTabs,
  UnsavedChangesDialog,
} from '@/components/settings';

import { useSettingsKeyboard } from '@/hooks/use-settings-keyboard';
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';
```

## Basic Page Template

```tsx
'use client';

import { SettingsPageWrapper } from '@/components/settings';

export default function MySettingsPage() {
  return (
    <SettingsPageWrapper
      workspaceSlug="workspace-id"
      title="My Settings"
      description="Manage your settings"
    >
      {/* Your content */}
    </SettingsPageWrapper>
  );
}
```

## With Tabs

```tsx
const tabs = [
  { label: 'Tab 1', href: '/settings/page/tab1', value: 'tab1' },
  { label: 'Tab 2', href: '/settings/page/tab2', value: 'tab2' },
];

<SettingsPageWrapper title="Settings" workspaceSlug="workspace-id">
  <SettingsTabs tabs={tabs} />
  {/* Tab content */}
</SettingsPageWrapper>
```

## Collapsible Section

```tsx
<CollapsibleSettingsSection
  title="Section Title"
  description="Section description"
  icon={<IconComponent className="h-5 w-5" />}
  defaultOpen={true}
  badge={<Badge>New</Badge>}
>
  {/* Section content */}
</CollapsibleSettingsSection>
```

## Unsaved Changes

```tsx
const { hasUnsavedChanges, markAsDirty, markAsClean } = useUnsavedChanges({
  enabled: true,
  onSave: async () => {
    await saveData();
  },
  onDiscard: () => {
    resetForm();
  },
});

// Call markAsDirty() when form changes
// Call markAsClean() after successful save
```

## Keyboard Shortcuts

```tsx
useSettingsKeyboard({
  workspaceSlug: 'workspace-id',
  onOpenSearch: () => setSearchOpen(true),
  onOpenQuickSettings: () => setQuickSettingsOpen(true),
  onSave: async () => await handleSave(),
});
```

## Shortcuts

| Key | Action |
|-----|--------|
| `⌘K` | Open search |
| `⌘,` | Quick settings |
| `⌘S` | Save changes |
| `⌘[` | Go back |
| `ESC` | Settings home |

## Props Reference

### SettingsPageWrapper
```typescript
{
  workspaceSlug: string;
  title: string;
  description?: string;
  children: ReactNode;
  onSave?: () => Promise<void>;
  onReset?: () => void;
  enableUnsavedChangesWarning?: boolean;
}
```

### SettingsTabs
```typescript
{
  tabs: Array<{
    label: string;
    href: string;
    value: string;
  }>;
  baseHref?: string;
}
```

### CollapsibleSettingsSection
```typescript
{
  title: string;
  description?: string;
  icon?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  badge?: ReactNode;
}
```

## File Locations

- Components: `/components/settings/`
- Hooks: `/hooks/use-settings-*.ts`
- Examples: `/app/(workspace)/[workspaceSlug]/settings/example-usage.tsx`
- Docs: `/app/(workspace)/[workspaceSlug]/settings/README.md`

## Tips

1. Always use `SettingsPageWrapper` for consistent layout
2. Enable unsaved changes warning for forms
3. Add new pages to search index in `settings-search.tsx`
4. Use collapsible sections for long pages
5. Implement keyboard shortcuts for better UX
6. Test on mobile devices for responsive layout
7. Check accessibility with screen readers
