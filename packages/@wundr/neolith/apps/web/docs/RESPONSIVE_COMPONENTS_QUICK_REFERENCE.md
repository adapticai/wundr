# Responsive Components - Quick Reference

## Import Statements

```tsx
// Modal
import {
  ResponsiveModal,
  ResponsiveModalTrigger,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
} from '@/components/ui/responsive-modal';

// Navigation Drawer
import { MobileNavDrawer } from '@/components/ui/mobile-nav-drawer';

// Sidebar
import {
  ResponsiveSidebar,
  SidebarNavItem,
  SidebarSection,
} from '@/components/ui/responsive-sidebar';

// Media Query Hook
import { useMediaQuery } from '@/hooks/use-media-query';
```

## Quick Examples

### ResponsiveModal
```tsx
<ResponsiveModal open={open} onOpenChange={setOpen}>
  <ResponsiveModalTrigger>
    <Button>Open</Button>
  </ResponsiveModalTrigger>
  <ResponsiveModalContent>
    <ResponsiveModalHeader>
      <ResponsiveModalTitle>Title</ResponsiveModalTitle>
    </ResponsiveModalHeader>
    <div>Content</div>
    <ResponsiveModalFooter>
      <Button>Action</Button>
    </ResponsiveModalFooter>
  </ResponsiveModalContent>
</ResponsiveModal>
```

### MobileNavDrawer
```tsx
<MobileNavDrawer
  title="Menu"
  items={[
    { href: '/dashboard', label: 'Dashboard', icon: <HomeIcon /> },
    { href: '/settings', label: 'Settings', icon: <SettingsIcon /> },
  ]}
/>
```

### ResponsiveSidebar
```tsx
<ResponsiveSidebar title="Menu" collapsible header={<Logo />}>
  <SidebarNavItem href="/dashboard" label="Dashboard" icon={<HomeIcon />} />
</ResponsiveSidebar>
```

## Breakpoints

- **Mobile**: < 768px (Drawer)
- **Tablet**: 768px - 1023px (Collapsible)
- **Desktop**: ≥ 1024px (Full)

## Files

1. `/components/ui/responsive-modal.tsx`
2. `/components/ui/mobile-nav-drawer.tsx`
3. `/components/ui/responsive-sidebar.tsx`
4. `/components/ui/responsive-components-examples.tsx`
5. `/hooks/use-media-query.ts`

See `responsive-components-examples.tsx` for complete examples.
