# Settings Navigation Component

Enhanced settings navigation component with grouped sections, badges, collapsible sections, and mobile support.

## Components

### `SettingsNav`

Desktop settings navigation with vertical layout and section grouping.

#### Props

```typescript
interface SettingsNavProps {
  workspaceId: string;        // Workspace identifier for URL generation
  sections?: NavSection[];    // Custom navigation sections
  className?: string;         // Additional CSS classes
}
```

### `MobileSettingsNav`

Mobile-optimized horizontal scrollable navigation.

#### Props

```typescript
interface MobileSettingsNavProps {
  workspaceId: string;        // Workspace identifier for URL generation
  sections?: NavSection[];    // Custom navigation sections
  className?: string;         // Additional CSS classes
}
```

## Type Definitions

### `NavItem`

```typescript
interface NavItem {
  href: string;              // Navigation link URL
  label: string;             // Display label
  icon: LucideIcon;         // Icon from lucide-react
  badge?: string | number;   // Optional badge (e.g., notification count)
  disabled?: boolean;        // Disable the navigation item
}
```

### `NavSection`

```typescript
interface NavSection {
  label: string;                 // Section header label
  items: NavItem[];             // Navigation items in this section
  collapsible?: boolean;        // Allow section to be collapsed
  defaultCollapsed?: boolean;   // Start section in collapsed state
}
```

## Features

### 1. Grouped Navigation

Organize settings into logical sections with headers:

```tsx
const sections: NavSection[] = [
  {
    label: 'Account',
    items: [
      { href: '/settings', label: 'General', icon: Settings },
      { href: '/settings/profile', label: 'Profile', icon: User },
    ],
  },
  {
    label: 'Preferences',
    items: [
      { href: '/settings/appearance', label: 'Appearance', icon: Palette },
      { href: '/settings/notifications', label: 'Notifications', icon: Bell },
    ],
  },
];
```

### 2. Badge Support

Display notification counts or status labels:

```tsx
{
  href: '/settings/notifications',
  label: 'Notifications',
  icon: Bell,
  badge: 5  // Numeric badge
}

{
  href: '/settings/billing',
  label: 'Billing',
  icon: CreditCard,
  badge: 'Pro'  // Text badge
}
```

### 3. Disabled State

Disable navigation items:

```tsx
{
  href: '/settings/billing',
  label: 'Billing',
  icon: CreditCard,
  disabled: true,
  badge: 'Pro'
}
```

### 4. Collapsible Sections

Allow users to collapse/expand sections:

```tsx
{
  label: 'Advanced',
  collapsible: true,
  defaultCollapsed: true,
  items: [
    { href: '/settings/api', label: 'API Keys', icon: Zap },
  ],
}
```

### 5. Active State

Automatically highlights the current page based on pathname.

### 6. Hover States

Interactive hover effects on navigation items.

### 7. Mobile Support

Horizontal scrollable layout optimized for mobile:

```tsx
<MobileSettingsNav workspaceId="my-workspace" sections={sections} />
```

## Usage Examples

### Basic Usage

```tsx
import { SettingsNav } from '@/components/settings/settings-nav';

export function SettingsLayout() {
  return (
    <div>
      <SettingsNav workspaceId="my-workspace" />
    </div>
  );
}
```

### Custom Sections

```tsx
import { SettingsNav } from '@/components/settings/settings-nav';
import { Settings, User, Bell } from 'lucide-react';
import type { NavSection } from '@/components/settings/settings-nav';

const customSections: NavSection[] = [
  {
    label: 'Account',
    items: [
      { href: '/workspace/settings', label: 'General', icon: Settings },
      { href: '/workspace/settings/profile', label: 'Profile', icon: User },
    ],
  },
  {
    label: 'Preferences',
    items: [
      {
        href: '/workspace/settings/notifications',
        label: 'Notifications',
        icon: Bell,
        badge: 3,
      },
    ],
  },
];

export function CustomSettingsNav() {
  return <SettingsNav workspaceId="my-workspace" sections={customSections} />;
}
```

### Responsive Layout

```tsx
import { SettingsNav, MobileSettingsNav } from '@/components/settings/settings-nav';

export function ResponsiveSettings() {
  const sections = [
    // ... your sections
  ];

  return (
    <>
      {/* Desktop */}
      <div className="hidden md:block">
        <SettingsNav workspaceId="my-workspace" sections={sections} />
      </div>

      {/* Mobile */}
      <div className="block md:hidden">
        <MobileSettingsNav workspaceId="my-workspace" sections={sections} />
      </div>
    </>
  );
}
```

### With Collapsible Sections

```tsx
const sectionsWithCollapse: NavSection[] = [
  {
    label: 'Account',
    collapsible: true,
    items: [
      { href: '/settings', label: 'General', icon: Settings },
      { href: '/settings/profile', label: 'Profile', icon: User },
    ],
  },
  {
    label: 'Advanced',
    collapsible: true,
    defaultCollapsed: true,
    items: [
      { href: '/settings/api', label: 'API Keys', icon: Zap },
    ],
  },
];

<SettingsNav workspaceId="my-workspace" sections={sectionsWithCollapse} />
```

## Styling

The component uses Tailwind CSS and follows the design system:

- **Active state**: `bg-primary text-primary-foreground`
- **Hover state**: `hover:bg-accent hover:text-foreground`
- **Disabled state**: `opacity-50 text-muted-foreground/50`
- **Section headers**: `text-xs font-semibold uppercase tracking-wider text-muted-foreground`

## Icons

All icons use [lucide-react](https://lucide.dev/). Import any icon from the library:

```tsx
import {
  Settings,
  User,
  Bell,
  Shield,
  Palette,
  Plug,
  CreditCard,
  Users,
  Lock,
  Zap,
} from 'lucide-react';
```

## Accessibility

- Semantic HTML with `<nav>` element
- Keyboard navigation support via native `<Link>` components
- Clear visual states for active/hover/disabled
- ARIA-compliant structure

## Default Sections

If no sections are provided, the component uses these defaults:

```tsx
[
  {
    label: 'Account',
    items: [
      { href: '/{workspaceId}/settings', label: 'General', icon: Settings },
      { href: '/{workspaceId}/settings/profile', label: 'Profile', icon: User },
    ],
  },
  {
    label: 'Preferences',
    items: [
      { href: '/{workspaceId}/settings/appearance', label: 'Appearance', icon: Palette },
      { href: '/{workspaceId}/settings/notifications', label: 'Notifications', icon: Bell, badge: 3 },
    ],
  },
  {
    label: 'Advanced',
    items: [
      { href: '/{workspaceId}/settings/integrations', label: 'Integrations', icon: Plug },
      { href: '/{workspaceId}/settings/security', label: 'Security', icon: Shield },
    ],
  },
]
```

## Migration from Old Component

Old:
```tsx
<SettingsNav
  workspaceId="my-workspace"
  items={[
    { href: '/settings', label: 'General', icon: SettingsIcon },
    { href: '/settings/profile', label: 'Profile', icon: UserIcon },
  ]}
/>
```

New:
```tsx
<SettingsNav
  workspaceId="my-workspace"
  sections={[
    {
      label: 'Account',
      items: [
        { href: '/settings', label: 'General', icon: Settings },
        { href: '/settings/profile', label: 'Profile', icon: User },
      ],
    },
  ]}
/>
```

Key changes:
- `items` → `sections` (array of sections with items)
- Inline SVG icons → lucide-react icons
- Added badge support
- Added disabled state support
- Added collapsible sections
- Added mobile variant
