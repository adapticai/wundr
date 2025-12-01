# Dynamic Page Header Component

## Overview

The `DynamicPageHeader` component provides a flexible, context-driven page header system that allows
pages to dynamically update the header content including title, subtitle, and breadcrumb navigation.

## Architecture

### Components

1. **PageHeaderContext** (`/contexts/page-header-context.tsx`)
   - React Context providing page header state management
   - Exports `usePageHeader` hook for consuming components
   - Provides `PageHeaderProvider` wrapper component

2. **DynamicPageHeader** (`/components/layout/dynamic-page-header.tsx`)
   - Client component that renders the actual header UI
   - Consumes `PageHeaderContext` via `usePageHeader` hook
   - Handles breadcrumbs and title/subtitle display

3. **WorkspaceLayoutClient** (`/components/layout/workspace-layout-client.tsx`)
   - Client wrapper for the workspace layout
   - Wraps content with `PageHeaderProvider`
   - Integrates `DynamicPageHeader` into the header

## File Locations

```
/Users/iroselli/wundr/packages/@wundr/neolith/apps/web/
├── contexts/
│   └── page-header-context.tsx          # Context and provider
├── components/
│   └── layout/
│       ├── dynamic-page-header.tsx       # Header component
│       ├── workspace-layout-client.tsx   # Layout wrapper
│       └── dynamic-page-header-example.tsx # Usage examples
└── app/
    └── (workspace)/
        └── layout.tsx                     # Updated to use provider
```

## Usage

### Basic Example

```tsx
'use client';

import { useEffect } from 'react';
import { usePageHeader } from '@/contexts/page-header-context';

export function MyPage() {
  const { setPageHeader } = usePageHeader();

  useEffect(() => {
    setPageHeader('My Page Title', 'Optional subtitle here');
  }, [setPageHeader]);

  return <div>Page content</div>;
}
```

### With Breadcrumbs

```tsx
'use client';

import { useEffect } from 'react';
import { usePageHeader } from '@/contexts/page-header-context';

export function SettingsPage() {
  const { setPageHeader, setBreadcrumbs } = usePageHeader();

  useEffect(() => {
    setPageHeader('Account Settings', 'Manage your account preferences');
    setBreadcrumbs([
      { label: 'Home', href: '/' },
      { label: 'Settings', href: '/settings' },
      { label: 'Account' },
    ]);

    // Optional: Reset on unmount
    return () => {
      setPageHeader('Dashboard');
      setBreadcrumbs([]);
    };
  }, [setPageHeader, setBreadcrumbs]);

  return <div>Settings content</div>;
}
```

### With Dynamic Data

```tsx
'use client';

import { useEffect } from 'react';
import { usePageHeader } from '@/contexts/page-header-context';

export function WorkflowDetailPage({ workflowId }: { workflowId: string }) {
  const { setPageHeader, setBreadcrumbs } = usePageHeader();
  const [workflow, setWorkflow] = useState(null);

  useEffect(() => {
    // Fetch workflow data
    fetch(`/api/workflows/${workflowId}`)
      .then(res => res.json())
      .then(data => {
        setWorkflow(data);
        setPageHeader(data.name, `Last updated: ${data.updatedAt}`);
        setBreadcrumbs([{ label: 'Workflows', href: '/workflows' }, { label: data.name }]);
      });
  }, [workflowId, setPageHeader, setBreadcrumbs]);

  return <div>Workflow content</div>;
}
```

## API Reference

### usePageHeader Hook

```typescript
interface PageHeaderContextValue {
  title: string;
  subtitle?: string;
  breadcrumbs?: Breadcrumb[];
  setPageHeader: (title: string, subtitle?: string) => void;
  setBreadcrumbs: (breadcrumbs: Breadcrumb[]) => void;
}

interface Breadcrumb {
  label: string;
  href?: string;
}
```

#### Methods

- **setPageHeader(title, subtitle?)**: Updates the page title and optional subtitle
- **setBreadcrumbs(breadcrumbs)**: Sets the breadcrumb navigation trail

#### State

- **title**: Current page title (defaults to "Dashboard")
- **subtitle**: Optional subtitle text
- **breadcrumbs**: Array of breadcrumb items for navigation

## Features

1. **Dynamic Updates**: Title and breadcrumbs update automatically when context changes
2. **Smooth Transitions**: CSS transitions for opacity changes
3. **Default Fallback**: Defaults to "Dashboard" if no title is set
4. **Breadcrumb Navigation**: Supports clickable breadcrumb trails with separators
5. **Type Safety**: Full TypeScript support with proper types
6. **SSR Compatible**: Client components properly marked with 'use client'

## Implementation Details

### Layout Integration

The workspace layout (`/app/(workspace)/layout.tsx`) has been updated to:

1. Import `PageHeaderProvider` and `DynamicPageHeader`
2. Wrap the `SidebarInset` content with `PageHeaderProvider`
3. Replace static breadcrumb with `DynamicPageHeader` component

### Component Behavior

- **No Breadcrumbs**: Displays title in a simple breadcrumb format
- **With Breadcrumbs**: Displays full breadcrumb trail with separators
- **Last Breadcrumb**: Always rendered as `BreadcrumbPage` (non-clickable)
- **Middle Breadcrumbs**: Rendered as links if `href` is provided
- **Subtitle**: Displayed below breadcrumbs when provided

## Best Practices

1. **Use in Client Components**: The hook must be used in client components (with 'use client')
2. **Set in useEffect**: Update header in useEffect to avoid render conflicts
3. **Clean Up**: Consider resetting to default on component unmount
4. **Dependency Arrays**: Include hook functions in useEffect dependencies
5. **Dynamic Content**: Update header when data changes (e.g., after API calls)

## Troubleshooting

### Error: "usePageHeader must be used within a PageHeaderProvider"

**Cause**: Component is not wrapped in PageHeaderProvider **Solution**: Ensure the component is
rendered within the workspace layout or manually wrap with PageHeaderProvider

### Header Not Updating

**Cause**: Hook not being called or context not triggering re-render **Solution**:

- Verify setPageHeader is called in useEffect
- Check that component is client-side ('use client')
- Ensure PageHeaderProvider is present in parent tree

### Build Errors

**Cause**: Server/client component mismatch **Solution**:

- Ensure all components using usePageHeader have 'use client' directive
- Verify PageHeaderProvider is in a client component wrapper

## Testing

```tsx
// Example test
import { render, screen } from '@testing-library/react';
import { PageHeaderProvider } from '@/contexts/page-header-context';
import { DynamicPageHeader } from '@/components/layout/dynamic-page-header';

test('renders default title', () => {
  render(
    <PageHeaderProvider>
      <DynamicPageHeader />
    </PageHeaderProvider>
  );
  expect(screen.getByText('Dashboard')).toBeInTheDocument();
});
```

## Future Enhancements

- [ ] Add page actions (buttons) to header
- [ ] Support for custom header components
- [ ] Animated transitions between title changes
- [ ] Persist header state in URL/localStorage
- [ ] Support for header icons/avatars
- [ ] Mobile-responsive breadcrumb truncation
