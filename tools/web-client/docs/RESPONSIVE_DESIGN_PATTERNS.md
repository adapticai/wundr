# Responsive Design Patterns Guide

This guide covers responsive design patterns and utilities for building mobile-first, accessible interfaces.

## Table of Contents

1. [Breakpoints](#breakpoints)
2. [Responsive Hooks](#responsive-hooks)
3. [Responsive Modal](#responsive-modal)
4. [Mobile Navigation](#mobile-navigation)
5. [Touch Targets](#touch-targets)
6. [Responsive Utilities](#responsive-utilities)
7. [Testing on Mobile](#testing-on-mobile)
8. [Best Practices](#best-practices)

## Breakpoints

We follow Tailwind CSS breakpoints:

| Breakpoint | Width | Usage |
|-----------|-------|-------|
| `sm` | 640px | Mobile phones |
| `md` | 768px | Tablets |
| `lg` | 1024px | Desktop |
| `xl` | 1280px | Large desktop |

### Import Breakpoints

```typescript
import { BREAKPOINTS, Breakpoint } from '@/hooks/use-media-query';

console.log(BREAKPOINTS.md); // 768
```

## Responsive Hooks

Use these hooks to detect viewport size and device capabilities at runtime.

### useMediaQuery

Detects if a media query matches.

```typescript
import { useMediaQuery } from '@/hooks/use-media-query';

export function MyComponent() {
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  return isDesktop ? <DesktopView /> : <MobileView />;
}
```

### useIsMobile

Check if viewport is mobile (below 640px).

```typescript
import { useIsMobile } from '@/hooks/use-media-query';

export function MyComponent() {
  const isMobile = useIsMobile();

  if (isMobile) {
    return <MobileOptimized />;
  }

  return <DesktopOptimized />;
}
```

### useIsTablet

Check if viewport is tablet (768px to 1023px).

```typescript
import { useIsTablet } from '@/hooks/use-media-query';

export function MyComponent() {
  const isTablet = useIsTablet();

  return <div>{isTablet ? 'Tablet View' : 'Not Tablet'}</div>;
}
```

### useIsDesktop

Check if viewport is desktop or larger (1024px+).

```typescript
import { useIsDesktop } from '@/hooks/use-media-query';

export function MyComponent() {
  const isDesktop = useIsDesktop();

  return isDesktop ? <DesktopLayout /> : <MobileLayout />;
}
```

### useBreakpoint

Get the current breakpoint name.

```typescript
import { useBreakpoint } from '@/hooks/use-media-query';

export function MyComponent() {
  const breakpoint = useBreakpoint();

  return <div>Current breakpoint: {breakpoint}</div>;
}
```

### useTouchDevice

Detect if device supports touch input.

```typescript
import { useTouchDevice } from '@/hooks/use-media-query';

export function MyComponent() {
  const isTouch = useTouchDevice();

  return <button className={isTouch ? 'touch-friendly' : 'mouse-friendly'}>
    Click me
  </button>;
}
```

### useOrientation

Detect device orientation (portrait or landscape).

```typescript
import { useOrientation } from '@/hooks/use-media-query';

export function MyComponent() {
  const orientation = useOrientation();

  return <div>Current orientation: {orientation}</div>;
}
```

## Responsive Modal

The `ResponsiveModal` component automatically switches between a Drawer on mobile and a Dialog on desktop.

### Basic Usage

```typescript
import { ResponsiveModal } from '@/components/ui/responsive-modal';
import { useState } from 'react';

export function MyComponent() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button onClick={() => setOpen(true)}>Open Modal</button>

      <ResponsiveModal
        open={open}
        onOpenChange={setOpen}
        title="Confirm Action"
        description="Are you sure you want to proceed?"
      >
        <div>Modal content goes here</div>
      </ResponsiveModal>
    </>
  );
}
```

### With Footer

```typescript
<ResponsiveModal
  open={open}
  onOpenChange={setOpen}
  title="Delete Item"
  description="This action cannot be undone."
  footer={
    <>
      <Button variant="outline" onClick={() => setOpen(false)}>
        Cancel
      </Button>
      <Button variant="destructive" onClick={handleDelete}>
        Delete
      </Button>
    </>
  }
>
  <p>Are you sure you want to delete this item?</p>
</ResponsiveModal>
```

### Custom Breakpoint

```typescript
<ResponsiveModal
  open={open}
  onOpenChange={setOpen}
  title="Settings"
  breakpoint="lg" // Switch to dialog at 1024px instead of 768px
>
  <div>Settings content</div>
</ResponsiveModal>
```

### Features

- **Automatic Responsive**: Drawer on mobile, Dialog on desktop
- **Swipe to Close**: Swipe down to dismiss on mobile
- **Touch Friendly**: Optimized spacing and button sizes
- **Accessible**: Full keyboard navigation support
- **Configurable**: Breakpoint and styling options

## Mobile Navigation

Use `MobileNavDrawer` for responsive navigation menus.

### MobileNavDrawer

```typescript
import { MobileNavDrawer, MobileNavToggle } from '@/components/ui/mobile-nav-drawer';
import { useState } from 'react';

const navItems = [
  { label: 'Home', href: '/' },
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' },
];

export function Navigation() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <MobileNavToggle
        onClick={() => setDrawerOpen(true)}
        label="Open navigation menu"
      />

      <MobileNavDrawer
        items={navItems}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </>
  );
}
```

### With Icons and Badges

```typescript
import { Home, Settings, Bell } from 'lucide-react';

const navItems = [
  {
    label: 'Home',
    href: '/',
    icon: <Home className="h-5 w-5" />
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: <Settings className="h-5 w-5" />
  },
  {
    label: 'Notifications',
    href: '/notifications',
    icon: <Bell className="h-5 w-5" />,
    badge: 5 // Shows "5" badge
  },
];

<MobileNavDrawer items={navItems} {...props} />
```

### Features

- **Touch Friendly**: Minimum 44x44px touch targets
- **Icons**: Support for icon + label
- **Badges**: Show notification counts
- **Auto-close**: Closes after navigation
- **Accessible**: Full keyboard support

## Touch Targets

All interactive elements must have a minimum touch target size of 44x44px (WCAG 2.5.5).

### Recommended Sizes

```typescript
import { TOUCH_TARGET_SIZE } from '@/lib/responsive-utils';

// Minimum (44x44px)
<button className="h-11 w-11">Small</button>

// Comfortable (48x48px)
<button className="h-12 w-12">Medium</button>

// Large (56x56px)
<button className="h-14 w-14">Large</button>
```

### Using Responsive Sizing

```typescript
// Larger touch targets on mobile, normal on desktop
<button className="h-11 w-11 md:h-10 md:w-10">
  Click me
</button>
```

## Responsive Utilities

### responsiveClasses

Pre-built responsive class combinations:

```typescript
import { responsiveClasses } from '@/lib/responsive-utils';

// Grid that scales with viewport
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* Grid content */}
</div>

// Flex direction that stacks on mobile
<div className="flex flex-col md:flex-row gap-4">
  {/* Flex content */}
</div>

// Responsive padding
<div className="p-4 md:p-6 lg:p-8">
  {/* Padded content */}
</div>

// Show/hide based on breakpoint
<div className="hidden md:block">Desktop only</div>
<div className="md:hidden">Mobile only</div>
```

### Spacing Utilities

```typescript
import {
  getResponsivePadding,
  getResponsiveMargin,
  getResponsiveGap,
} from '@/lib/responsive-utils';

const padding = getResponsivePadding('md'); // "20px"
const margin = getResponsiveMargin('lg'); // "20px"
const gap = getResponsiveGap('sm'); // "12px"
```

### Swipe Detection

```typescript
import { isSignificantSwipe } from '@/lib/responsive-utils';

function handleSwipe(
  startX: number,
  startY: number,
  endX: number,
  endY: number
) {
  const { isSwipe, direction } = isSignificantSwipe(startX, startY, endX, endY);

  if (isSwipe) {
    console.log(`Swiped ${direction}`);
  }
}
```

## Testing on Mobile

### Browser DevTools

1. Open Chrome DevTools (F12 or Cmd+Option+I)
2. Click "Toggle device toolbar" or press Ctrl+Shift+M
3. Select device from dropdown:
   - iPhone 12 (390x844)
   - iPad (768x1024)
   - Desktop (1920x1080)

### Breakpoint Verification

Test these specific widths:

| Device | Width | Breakpoint |
|--------|-------|-----------|
| iPhone SE | 375px | < sm |
| iPhone 12 | 390px | < sm |
| iPad Mini | 768px | md |
| iPad Pro | 1024px | lg |
| Desktop | 1920px | xl |

### Touch Testing

1. Enable touch simulation in DevTools
2. Use "Emulate mobile touch" option
3. Test swipe gestures on modals and drawers

### Performance Testing

```bash
# Lighthouse audit
# - Open DevTools
# - Click Lighthouse tab
# - Generate report
# - Check mobile performance scores
```

## Best Practices

### 1. Mobile-First Approach

Always start with mobile design, then enhance for larger screens:

```typescript
// Good: Mobile first
<div className="text-sm md:text-base lg:text-lg">
  Content scales up
</div>

// Avoid: Desktop first
<div className="text-lg md:hidden sm:text-sm">
  Content scales down (avoid!)
</div>
```

### 2. Use Responsive Hooks for Logic

```typescript
// Good: Use hooks for conditional logic
const isDesktop = useIsDesktop();
if (isDesktop) {
  return <DesktopLayout />;
}

// Avoid: Don't use CSS classes for critical logic
// (CSS media queries don't affect JavaScript)
```

### 3. Touch-Friendly Spacing

```typescript
// Good: Extra padding for touch
<button className="px-4 py-3 md:px-3 md:py-2">
  Touch friendly on mobile
</button>

// Avoid: Too small for touch
<button className="px-2 py-1">
  Too small!
</button>
```

### 4. Flexible Content

```typescript
// Good: Content wraps responsively
<div className="flex flex-col md:flex-row gap-4">
  <div className="flex-1">Flexible content</div>
</div>

// Avoid: Fixed widths
<div className="flex gap-4">
  <div className="w-500px">Not responsive!</div>
</div>
```

### 5. Accessible Touch Targets

```typescript
// Good: 44x44px minimum
<button className="h-11 w-11">Accessible</button>

// Avoid: Too small
<button className="h-8 w-8">Too small!</button>
```

### 6. Safe Areas on Notched Devices

```typescript
// Good: Account for notches (iPhone X+)
<header className="pt-safe">
  Content respects safe area
</header>

// For Tailwind, use regular padding
<header className="pt-4 md:pt-6">
  Safe spacing
</header>
```

### 7. Test on Real Devices

- Always test on actual mobile devices
- Use Chrome DevTools for quick checks
- Test both portrait and landscape
- Check touch interactions work smoothly

### 8. Viewport Meta Tag

Ensure your HTML has the correct viewport meta tag:

```html
<meta
  name="viewport"
  content="width=device-width, initial-scale=1.0"
/>
```

This is typically set in Next.js layout automatically.

## Common Patterns

### Responsive Grid

```typescript
export function ResponsiveGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <Card>Card 1</Card>
      <Card>Card 2</Card>
      <Card>Card 3</Card>
    </div>
  );
}
```

### Responsive Form

```typescript
export function ResponsiveForm() {
  return (
    <form className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input label="First Name" />
        <Input label="Last Name" />
      </div>
      <Textarea label="Message" />
      <Button>Submit</Button>
    </form>
  );
}
```

### Hide/Show by Device

```typescript
export function ConditionalContent() {
  return (
    <>
      {/* Show on mobile only */}
      <div className="md:hidden">
        Mobile Navigation
      </div>

      {/* Show on tablet and up */}
      <div className="hidden md:block">
        Desktop Navigation
      </div>
    </>
  );
}
```

### Responsive Modal/Drawer

```typescript
export function Settings() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>Settings</Button>

      <ResponsiveModal
        open={open}
        onOpenChange={setOpen}
        title="Settings"
      >
        <SettingsForm />
      </ResponsiveModal>
    </>
  );
}
```

## Migration Guide

### Converting Old Dialogs

Before (fixed dialog):
```typescript
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Title</DialogTitle>
    </DialogHeader>
    Content
  </DialogContent>
</Dialog>
```

After (responsive):
```typescript
import { ResponsiveModal } from '@/components/ui/responsive-modal';

<ResponsiveModal
  open={open}
  onOpenChange={setOpen}
  title="Title"
>
  Content
</ResponsiveModal>
```

## Resources

- [MDN: Responsive Design](https://developer.mozilla.org/en-US/docs/Learn/CSS/CSS_layout/Responsive_Design)
- [WCAG 2.5.5: Target Size](https://www.w3.org/WAI/WCAG21/Understanding/target-size.html)
- [Web.dev: Responsive Design](https://web.dev/responsive-web-design-basics/)
- [Tailwind CSS: Responsive Design](https://tailwindcss.com/docs/responsive-design)

## Support

For questions or issues with responsive design patterns:

1. Check this guide first
2. Review the example components
3. Test in browser DevTools
4. File an issue with specific device/breakpoint
