# Theme Toggle - Usage Examples

## Basic Examples

### Example 1: Dropdown in Header
```tsx
'use client';

import { ThemeToggle } from '@/components/layout';

export function AppHeader() {
  return (
    <header className="flex items-center justify-between">
      <h1>My App</h1>
      <ThemeToggle variant="dropdown" />
    </header>
  );
}
```

### Example 2: Compact Button
```tsx
'use client';

import { ThemeToggleButton } from '@/components/layout';

export function MobileHeader() {
  return (
    <header>
      <ThemeToggleButton />
    </header>
  );
}
```

### Example 3: Settings Page
```tsx
'use client';

import { ThemeToggleLarge } from '@/components/layout';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Customize your preferences</p>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold mb-4">Appearance</h2>
        <ThemeToggleLarge />
      </div>
    </div>
  );
}
```

## Advanced Examples

### Example 4: Custom Dropdown with Label
```tsx
'use client';

import { ThemeToggle } from '@/components/layout';

export function HeaderWithThemeLabel() {
  return (
    <div className="flex items-center gap-4">
      <ThemeToggle
        variant="dropdown"
        showLabel={true}
        className="ml-auto"
      />
    </div>
  );
}
```

### Example 5: Multiple Theme Toggles (Different Locations)
```tsx
'use client';

import { ThemeToggle, ThemeToggleButton } from '@/components/layout';

export function LayoutWithThemeToggles() {
  return (
    <>
      {/* Header */}
      <header>
        <ThemeToggle variant="compact" />
      </header>

      {/* Sidebar */}
      <aside>
        {/* Other sidebar content */}
      </aside>

      {/* Settings */}
      <main>
        {/* Settings route includes ThemeToggleLarge */}
      </main>

      {/* Footer */}
      <footer>
        <ThemeToggleButton />
      </footer>
    </>
  );
}
```

### Example 6: Theme Toggle with Custom Styling
```tsx
'use client';

import { ThemeToggle } from '@/components/layout';

export function StyledThemeToggle() {
  return (
    <div className="relative">
      <ThemeToggle
        variant="dropdown"
        className="hover:bg-blue-100 dark:hover:bg-blue-900"
      />
    </div>
  );
}
```

### Example 7: With Theme Information Display
```tsx
'use client';

import { ThemeToggle } from '@/components/layout';
import { useTheme } from 'next-themes';
import { useState, useEffect } from 'react';

export function ThemeToggleWithInfo() {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="flex items-center gap-4">
      <ThemeToggle variant="dropdown" showLabel={true} />
      {mounted && (
        <span className="text-sm text-muted-foreground">
          Current: {theme || 'loading'}
        </span>
      )}
    </div>
  );
}
```

### Example 8: Settings Page with Full Appearance Section
```tsx
'use client';

import { ThemeToggleLarge } from '@/components/layout';

export default function AppearanceSettings() {
  return (
    <div className="space-y-8">
      {/* Theme Settings */}
      <section className="rounded-lg border bg-card p-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold">Theme</h2>
          <p className="text-sm text-muted-foreground">
            Choose how the interface appears to you
          </p>
        </div>
        <ThemeToggleLarge />
      </section>

      {/* Compact Mode */}
      <section className="rounded-lg border bg-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Compact Sidebar</h3>
            <p className="text-sm text-muted-foreground">
              Use less space in the sidebar
            </p>
          </div>
          <input type="checkbox" className="h-4 w-4" />
        </div>
      </section>

      {/* Animations */}
      <section className="rounded-lg border bg-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Enable Animations</h3>
            <p className="text-sm text-muted-foreground">
              Show smooth transitions and effects
            </p>
          </div>
          <input type="checkbox" defaultChecked className="h-4 w-4" />
        </div>
      </section>

      {/* Accessibility */}
      <section className="rounded-lg border bg-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">High Contrast</h3>
            <p className="text-sm text-muted-foreground">
              Improve visibility and readability
            </p>
          </div>
          <input type="checkbox" className="h-4 w-4" />
        </div>
      </section>
    </div>
  );
}
```

### Example 9: Mobile Responsive Theme Toggle
```tsx
'use client';

import { ThemeToggle } from '@/components/layout';

export function ResponsiveThemeToggle() {
  return (
    <div className="flex items-center gap-2">
      {/* Show label only on desktop */}
      <div className="hidden sm:block">
        <ThemeToggle variant="dropdown" showLabel={true} />
      </div>

      {/* Show compact on mobile */}
      <div className="sm:hidden">
        <ThemeToggle variant="compact" />
      </div>
    </div>
  );
}
```

### Example 10: Navbar Integration
```tsx
'use client';

import { ThemeToggle } from '@/components/layout';

export function Navbar() {
  return (
    <nav className="border-b bg-card">
      <div className="flex items-center justify-between px-4 py-3">
        {/* Logo */}
        <a href="/" className="text-xl font-bold">
          MyApp
        </a>

        {/* Navigation Links */}
        <div className="hidden md:flex items-center gap-6">
          <a href="/about" className="text-sm hover:text-accent">
            About
          </a>
          <a href="/docs" className="text-sm hover:text-accent">
            Documentation
          </a>
        </div>

        {/* Right Side Actions */}
        <div className="flex items-center gap-4">
          {/* Search */}
          <button className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-lg bg-muted text-sm">
            <span>Search</span>
          </button>

          {/* Theme Toggle */}
          <ThemeToggle variant="compact" />

          {/* User Menu */}
          <button className="h-8 w-8 rounded-full bg-primary" />
        </div>
      </div>
    </nav>
  );
}
```

## Integration Patterns

### Pattern 1: Layout Component
```tsx
'use client';

import { ThemeToggle } from '@/components/layout';
import { PropsWithChildren } from 'react';

export function Layout({ children }: PropsWithChildren) {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="border-b bg-background">
        <div className="flex items-center justify-between px-4 py-3">
          <h1>App</h1>
          <ThemeToggle variant="compact" />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t bg-muted px-4 py-3">
        <p className="text-sm text-muted-foreground">
          Powered by Next.js & React
        </p>
      </footer>
    </div>
  );
}
```

### Pattern 2: Settings Layout
```tsx
'use client';

import { ThemeToggle } from '@/components/layout';
import { PropsWithChildren } from 'react';

export function SettingsLayout({ children }: PropsWithChildren) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
      {/* Sidebar Navigation */}
      <aside className="md:col-span-1">
        <nav className="space-y-2">
          <a href="/settings/profile" className="block px-3 py-2 rounded-lg hover:bg-accent">
            Profile
          </a>
          <a href="/settings/appearance" className="block px-3 py-2 rounded-lg hover:bg-accent">
            Appearance
          </a>
          <a href="/settings/notifications" className="block px-3 py-2 rounded-lg hover:bg-accent">
            Notifications
          </a>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="md:col-span-3">
        {children}
      </main>
    </div>
  );
}
```

### Pattern 3: Theme Provider with Custom Hook
```tsx
'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

// Custom hook for theme usage
export function useCurrentTheme() {
  const { theme, setTheme, themes } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return {
    theme: mounted ? theme : 'system',
    setTheme,
    themes: mounted ? themes : [],
    mounted,
  };
}

// Usage in component
export function MyComponent() {
  const { theme } = useCurrentTheme();

  return (
    <div>
      <p>Current theme: {theme}</p>
    </div>
  );
}
```

## Testing Examples

### Example Test 1: Render and Interact
```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider } from 'next-themes';
import { ThemeToggle } from '@/components/layout/theme-toggle';

function Wrapper({ children }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      {children}
    </ThemeProvider>
  );
}

test('theme toggle works', async () => {
  render(
    <Wrapper>
      <ThemeToggle variant="dropdown" />
    </Wrapper>
  );

  const button = screen.getByRole('button', { name: /select theme/i });
  fireEvent.click(button);

  await waitFor(() => {
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });
});
```

### Example Test 2: Theme Switching
```tsx
test('switches theme when option clicked', async () => {
  render(
    <Wrapper>
      <ThemeToggle variant="dropdown" />
    </Wrapper>
  );

  const button = screen.getByRole('button', { name: /select theme/i });
  fireEvent.click(button);

  const darkOption = screen.getByText('Dark');
  fireEvent.click(darkOption);

  await waitFor(() => {
    // Verify localStorage was updated
    expect(localStorage.getItem('next-theme')).toBe('dark');
  });
});
```

## CSS Classes Reference

### Semantic Color Classes Used
```css
/* Text Colors */
.text-foreground    /* Main text */
.text-muted-foreground  /* Dimmed text */

/* Background Colors */
.bg-background      /* Main background */
.bg-card           /* Card background */
.bg-muted          /* Muted background */

/* Border Colors */
.border-border     /* Main borders */
.border-input      /* Input borders */

/* Interactive */
.hover:bg-accent   /* Hover state */
.focus:ring-ring   /* Focus state */
```

### Theme Variables (Dark Mode)
```css
@media (prefers-color-scheme: dark) {
  :root {
    --background: 0 0% 100%;
    --foreground: 0 0% 3.6%;
    --card: 0 0% 100%;
    --muted: 0 0% 96.1%;
    --accent: 200 100% 50%;
  }
}
```

## Styling Best Practices

### ✓ DO
```tsx
<button className="bg-background text-foreground hover:bg-accent">
  Theme Toggle
</button>
```

### ✗ DON'T
```tsx
<button className="bg-white dark:bg-slate-950 text-black dark:text-white">
  Theme Toggle
</button>
```

## Performance Tips

1. **Use Compact Variant in Headers**
   ```tsx
   // Good - minimal size
   <ThemeToggle variant="compact" />
   ```

2. **Memoize Custom Components**
   ```tsx
   export const MemoizedThemeToggle = React.memo(() => (
     <ThemeToggle variant="dropdown" />
   ));
   ```

3. **Lazy Load Large Variant**
   ```tsx
   const ThemeToggleLarge = lazy(() =>
     import('@/components/layout/theme-toggle').then(m => ({
       default: m.ThemeToggleLarge
     }))
   );
   ```

4. **Avoid Re-renders**
   ```tsx
   // Keep theme logic outside of frequently-rendering components
   const ThemeButton = () => <ThemeToggle variant="compact" />;
   ```

## Accessibility Tips

1. **Always Provide Labels**
   ```tsx
   <ThemeToggle variant="dropdown" showLabel={true} />
   ```

2. **Test Keyboard Navigation**
   - Tab to button
   - Arrow keys to navigate options
   - Enter to select
   - Escape to close

3. **Screen Reader Testing**
   - Use NVDA, JAWS, or VoiceOver
   - Verify announcements are clear
   - Test with various screen readers

4. **Contrast Checking**
   - Use tools like WebAIM Contrast Checker
   - Ensure 4.5:1 ratio for AA compliance
   - Test with high contrast mode on

## Related Documentation

- [Theme Implementation Guide](./THEME_IMPLEMENTATION.md)
- [next-themes Documentation](https://github.com/pacocoursey/next-themes)
- [Tailwind CSS Dark Mode](https://tailwindcss.com/docs/dark-mode)
- [WCAG Accessibility Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
