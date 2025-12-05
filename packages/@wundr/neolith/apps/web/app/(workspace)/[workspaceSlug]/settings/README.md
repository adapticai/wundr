# Settings Navigation and Layout System

A comprehensive, production-ready settings navigation system for the Neolith web application.

## Features

### 1. Settings Sidebar Navigation ✅

- Categorized navigation with sections (Account, Preferences, etc.)
- Collapsible/expandable sections
- Active state highlighting
- Mobile-responsive drawer
- Icon support for all menu items

### 2. Breadcrumb Navigation ✅

- Automatic breadcrumb generation based on current route
- Home → Settings → Current Page hierarchy
- Icons for home and settings levels
- Mobile-friendly responsive design

### 3. Settings Search ✅

- Full-text search across all settings pages
- Keyboard shortcut: `⌘K` or `Ctrl+K`
- Grouped results by category
- Search by keywords and descriptions
- Navigate directly to settings from search

### 4. Quick Settings Modal ✅

- Keyboard shortcut: `⌘,` or `Ctrl+,`
- Quick access to common settings:
  - Theme switcher (Light/Dark/System)
  - Sound effects toggle
  - Reduced motion toggle
- Persists preferences to localStorage

### 5. Mobile-Responsive Layout ✅

- Drawer navigation on mobile devices
- Fixed header with menu trigger
- Touch-optimized targets
- Responsive spacing and typography

### 6. Settings Page Header ✅

- Title and description support
- Breadcrumb integration
- Search button with keyboard hint
- Consistent styling across pages

### 7. Tab-Based Sub-Navigation ✅

- Support for settings pages with multiple sections
- Active tab highlighting
- Responsive horizontal scrolling on mobile
- Clean, minimal design

### 8. Unsaved Changes Warning ✅

- Browser navigation warning (beforeunload)
- Internal navigation confirmation dialog
- Save/Discard options
- Automatic form state tracking
- Custom hook: `useUnsavedChanges`

### 9. Collapsible Settings Sections ✅

- Organize long settings pages
- Expand/collapse functionality
- Icon and badge support
- Remembered collapse state
- Smooth animations

### 10. Keyboard Shortcuts ✅

- `⌘K` / `Ctrl+K` - Open settings search
- `⌘,` / `Ctrl+,` - Quick settings modal
- `⌘S` / `Ctrl+S` - Save changes
- `⌘[` / `Ctrl+[` - Navigate back
- `ESC` - Return to settings home

## File Structure

```
components/settings/
├── settings-breadcrumb.tsx          # Breadcrumb navigation
├── settings-search.tsx              # Search modal with ⌘K
├── settings-header.tsx              # Page header with breadcrumb
├── settings-tabs.tsx                # Tab navigation component
├── collapsible-settings-section.tsx # Collapsible sections
├── quick-settings-modal.tsx         # Quick settings (⌘,)
├── unsaved-changes-dialog.tsx       # Unsaved changes confirmation
├── enhanced-settings-layout.tsx     # Main layout component
├── settings-page-wrapper.tsx        # Page wrapper utility
└── index.ts                         # Barrel exports

hooks/
├── use-unsaved-changes.ts           # Hook for form state tracking
└── use-settings-keyboard.ts         # Global keyboard shortcuts

app/(workspace)/[workspaceSlug]/settings/
├── layout.tsx                       # Settings layout (server)
├── settings-layout-client.tsx       # Client-side layout
├── page.tsx                         # Settings home page
├── example-usage.tsx                # Usage examples
└── README.md                        # This file
```

## Usage Examples

### Basic Settings Page

```tsx
import { SettingsPageWrapper } from '@/components/settings';

export default function NotificationsPage() {
  return (
    <SettingsPageWrapper
      workspaceSlug='my-workspace'
      title='Notifications'
      description='Manage how you receive notifications'
    >
      {/* Your settings content */}
    </SettingsPageWrapper>
  );
}
```

### Settings Page with Tabs

```tsx
import { SettingsPageWrapper, SettingsTabs } from '@/components/settings';

export default function NotificationsPage() {
  const tabs = [
    { label: 'General', href: '/settings/notifications/general', value: 'general' },
    { label: 'Email', href: '/settings/notifications/email', value: 'email' },
    { label: 'Push', href: '/settings/notifications/push', value: 'push' },
  ];

  return (
    <SettingsPageWrapper workspaceSlug='my-workspace' title='Notifications'>
      <SettingsTabs tabs={tabs} />
      {/* Tab content */}
    </SettingsPageWrapper>
  );
}
```

### Collapsible Sections

```tsx
import { CollapsibleSettingsSection } from '@/components/settings';
import { Lock } from 'lucide-react';

<CollapsibleSettingsSection
  title='Privacy Controls'
  description='Manage who can see your information'
  icon={<Lock className='h-5 w-5' />}
  defaultOpen={true}
>
  {/* Section content */}
</CollapsibleSettingsSection>;
```

### Form with Unsaved Changes

```tsx
'use client';

import { useState } from 'react';
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';
import { SettingsPageWrapper } from '@/components/settings';

export default function ProfilePage() {
  const [formData, setFormData] = useState({ name: '', email: '' });

  const { hasUnsavedChanges, markAsDirty, handleSave } = useUnsavedChanges({
    enabled: true,
    onSave: async () => {
      await saveToApi(formData);
    },
  });

  return (
    <SettingsPageWrapper
      workspaceSlug='my-workspace'
      title='Profile'
      enableUnsavedChangesWarning={true}
    >
      {/* Form fields that call markAsDirty() on change */}
    </SettingsPageWrapper>
  );
}
```

## Component APIs

### SettingsPageWrapper

Wrapper for individual settings pages with header and keyboard shortcuts.

**Props:**

- `workspaceSlug: string` - Current workspace identifier
- `title: string` - Page title
- `description?: string` - Page description
- `children: ReactNode` - Page content
- `onSave?: () => Promise<void>` - Save handler
- `onReset?: () => void` - Reset handler
- `enableUnsavedChangesWarning?: boolean` - Enable navigation warnings

### SettingsTabs

Tab navigation for settings sub-pages.

**Props:**

- `tabs: SettingsTab[]` - Array of tab configurations
  - `label: string` - Tab label
  - `href: string` - Tab URL
  - `value: string` - Unique value

### CollapsibleSettingsSection

Collapsible section for organizing settings.

**Props:**

- `title: string` - Section title
- `description?: string` - Section description
- `icon?: ReactNode` - Icon component
- `children: ReactNode` - Section content
- `defaultOpen?: boolean` - Initial state (default: true)
- `badge?: ReactNode` - Optional badge

### useUnsavedChanges Hook

Track and manage unsaved form changes.

**Options:**

- `enabled?: boolean` - Enable tracking (default: true)
- `onSave?: () => Promise<void> | void` - Save callback
- `onDiscard?: () => void` - Discard callback

**Returns:**

- `hasUnsavedChanges: boolean` - Current state
- `markAsDirty: () => void` - Mark as changed
- `markAsClean: () => void` - Mark as saved
- `showDialog: boolean` - Dialog visibility
- `setShowDialog: (open: boolean) => void` - Control dialog
- `handleSave: () => Promise<void>` - Save handler
- `handleDiscard: () => void` - Discard handler
- `navigateWithConfirmation: (href: string) => void` - Safe navigation

## Keyboard Shortcuts

All keyboard shortcuts work globally within the settings area:

| Shortcut         | Action                       |
| ---------------- | ---------------------------- |
| `⌘K` or `Ctrl+K` | Open settings search         |
| `⌘,` or `Ctrl+,` | Open quick settings modal    |
| `⌘S` or `Ctrl+S` | Save current form (if dirty) |
| `⌘[` or `Ctrl+[` | Navigate back                |
| `ESC`            | Return to settings home      |

## Mobile Responsiveness

The settings layout automatically adapts to mobile devices:

- **Desktop (≥1024px)**: Fixed sidebar navigation
- **Tablet/Mobile (<1024px)**: Drawer navigation with hamburger menu
- **Touch-friendly**: All interactive elements have appropriate touch targets
- **Responsive typography**: Font sizes scale appropriately
- **Horizontal scrolling**: Tabs scroll horizontally on narrow screens

## Accessibility

All components follow accessibility best practices:

- **Keyboard navigation**: Full keyboard support
- **ARIA labels**: Proper semantic HTML and ARIA attributes
- **Focus management**: Visible focus indicators
- **Screen readers**: Descriptive labels and hints
- **Color contrast**: WCAG AA compliant
- **Reduced motion**: Respects prefers-reduced-motion

## Customization

### Adding New Settings Pages

1. Create a new page file in the settings directory
2. Use `SettingsPageWrapper` for consistent layout
3. Add the route to the navigation in `layout.tsx`
4. Update the search items in `settings-search.tsx`

### Styling

All components use:

- **Tailwind CSS**: Utility-first styling
- **shadcn/ui**: Component primitives
- **CSS variables**: Theme-aware colors
- **cn()**: Conditional class merging

## Best Practices

1. **Always use SettingsPageWrapper** for consistency
2. **Enable unsaved changes warning** for forms with user input
3. **Use collapsible sections** for long settings pages
4. **Add keyboard shortcuts** to the search index
5. **Test mobile responsiveness** on actual devices
6. **Provide clear descriptions** for all settings

## Future Enhancements

Potential improvements for future iterations:

- Settings import/export functionality
- Settings version history
- Bulk settings operations
- Settings templates/presets
- Advanced search filters
- Settings recommendations
- Onboarding tours
- Settings analytics

## Support

For questions or issues:

- Check `example-usage.tsx` for comprehensive examples
- Review component source code for detailed implementations
- Refer to shadcn/ui documentation for component APIs
- Test in different browsers and devices

---

Last updated: 2025-12-05 Version: 1.0.0
