# Theme Toggle Implementation Guide

## Overview

The theme toggle system provides users with the ability to switch between Light, Dark, and System themes. The implementation uses `next-themes` for theme management with localStorage persistence, and is fully integrated into the Neolith application.

## Architecture

### Components

#### 1. `ThemeToggle` (Dropdown Variant)
The main theme toggle component with a dropdown menu interface.

**Features:**
- Three theme options: Light, Dark, System
- Dropdown interface with descriptions
- Smooth theme transitions
- localStorage persistence
- System preference detection
- Keyboard navigation support (ArrowDown, Escape)
- Full accessibility (WCAG compliant)

**Usage:**
```tsx
import { ThemeToggle } from '@/components/layout/theme-toggle';

export function Header() {
  return (
    <header>
      <ThemeToggle variant="dropdown" showLabel={true} />
    </header>
  );
}
```

**Props:**
- `variant?: 'dropdown' | 'compact'` - UI variant (default: 'dropdown')
- `showLabel?: boolean` - Show current theme label (default: false)
- `className?: string` - Additional CSS classes

#### 2. `ThemeToggleButton` (Compact Variant)
A compact button that cycles through themes on each click.

**Usage:**
```tsx
import { ThemeToggleButton } from '@/components/layout/theme-toggle';

export function Header() {
  return <ThemeToggleButton />;
}
```

**Behavior:**
- Clicking cycles through: Light → Dark → System → Light
- Shows current theme icon
- Minimal UI footprint

#### 3. `ThemeToggleLarge` (Settings Variant)
A large radio button interface for the settings page.

**Usage:**
```tsx
import { ThemeToggleLarge } from '@/components/layout/theme-toggle';

export function ThemeSettings() {
  return (
    <div>
      <h2>Choose Theme</h2>
      <ThemeToggleLarge />
    </div>
  );
}
```

**Features:**
- Radio button interface
- Detailed descriptions for each theme
- Visual selection indicator
- Best for settings/preferences pages

## Integration Points

### 1. App Header (`components/layout/app-header.tsx`)
The theme toggle is integrated as a compact button in the main application header, positioned between the notifications button and user menu.

```tsx
<div className="flex items-center gap-4">
  {/* Search Button */}
  {/* Notifications Button */}
  <ThemeToggle variant="compact" />
  {/* User Menu */}
</div>
```

### 2. Profile Settings (`app/(workspace)/[workspaceId]/settings/profile/page.tsx`)
The large theme toggle is integrated in the Appearance section of profile settings.

```tsx
<div className="rounded-lg border bg-card p-6">
  <h2 className="text-lg font-semibold">Appearance</h2>
  <label className="block text-sm font-medium mb-3">Theme</label>
  <ThemeToggleLarge />
</div>
```

## Theme Provider Setup

The theme provider is configured in `components/providers/index.tsx`:

```tsx
import { ThemeProvider } from 'next-themes';

export function Providers({ children }) {
  return (
    <SessionProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        {children}
      </ThemeProvider>
    </SessionProvider>
  );
}
```

**Configuration:**
- `attribute="class"` - Theme class is applied to HTML element
- `defaultTheme="system"` - Default to system preference
- `enableSystem={true}` - Respect system color scheme preference

## Theme Options

### Light Theme
- **Icon:** Sun icon
- **Description:** Light theme
- **Use case:** Daytime, bright environments

### Dark Theme
- **Icon:** Moon icon
- **Description:** Dark theme
- **Use case:** Nighttime, reduced eye strain

### System Theme
- **Icon:** Monitor icon
- **Description:** Follow system preference
- **Use case:** Automatic adjustment based on device settings

## Data Persistence

### localStorage
Theme preference is automatically persisted using the browser's localStorage:

```
localStorage.next-themes = 'light' | 'dark' | 'system'
```

### Sync Across Tabs
When users change the theme in one tab, all other tabs are automatically updated through the StorageEvent API (handled by next-themes).

### Server-Side Safety
The component uses `suppressHydrationWarning` to prevent hydration mismatches and renders a skeleton loading state before mounting.

## Styling & Dark Mode Support

### Root Layout
The root layout uses semantic CSS variables that adapt to the theme:

```tsx
<html suppressHydrationWarning>
  <body className="bg-background text-foreground">
    {/* Content */}
  </body>
</html>
```

**CSS Variables (from Tailwind theme):**
- `background` - Page background color
- `foreground` - Text color
- `accent` - Accent color
- `muted` - Muted background
- `muted-foreground` - Muted text

### Component Styling
All components use semantic color classes that respect the current theme:

```tsx
<button className="bg-background text-foreground hover:bg-accent">
  {/* Button */}
</button>
```

## Keyboard Navigation

### Dropdown Menu
- **Click Button** - Toggle menu open/closed
- **ArrowDown** - Open menu when closed
- **Escape** - Close menu when open
- **Enter/Space** - Select option (when focused)

### Compact Variant
- **Click** - Cycle to next theme

### Large Variant
- **Click/Space** - Toggle radio selection

## Accessibility Features

### ARIA Attributes
- `aria-expanded` - Indicates if dropdown is open
- `aria-haspopup="listbox"` - Indicates trigger button has popup
- `aria-label` - Descriptive labels for screen readers
- `role="option"` - Semantic role for theme options
- `aria-selected` - Indicates which option is selected

### Focus Management
- Focus ring visible on all interactive elements
- Focus trap within dropdown menu
- Keyboard navigation support
- High contrast mode support

### Screen Reader Support
- Descriptive button labels
- Option descriptions for context
- Current theme indication

## Testing

### Running Tests
```bash
npm run test
```

### Test Coverage
- Component rendering
- Theme switching functionality
- Dropdown open/close behavior
- Keyboard navigation
- Accessibility attributes
- localStorage persistence
- Hydration safety

Example test:
```tsx
it('opens and closes the dropdown menu', async () => {
  render(
    <ThemeTestWrapper>
      <ThemeToggle variant="dropdown" />
    </ThemeTestWrapper>
  );

  const button = screen.getByRole('button', { name: /select theme/i });
  fireEvent.click(button);

  await waitFor(() => {
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });
});
```

## Theming Guide for Developers

### Adding New Themes
To add a new theme (e.g., 'high-contrast'):

1. Update `THEME_OPTIONS` in `theme-toggle.tsx`:
```tsx
const THEME_OPTIONS: ThemeConfig[] = [
  // ... existing options
  {
    value: 'high-contrast',
    label: 'High Contrast',
    icon: <HighContrastIcon />,
    description: 'High contrast for accessibility',
  },
];
```

2. Create theme CSS file (e.g., `globals.css`):
```css
html[data-theme="high-contrast"] {
  --background: #000;
  --foreground: #fff;
  /* ... more variables */
}
```

3. Update theme provider if needed

### Ensuring Dark Mode Support
For any new component:

1. Use semantic color classes:
```tsx
<div className="bg-background text-foreground border-border">
  {/* Content */}
</div>
```

2. Test in both light and dark modes
3. Verify sufficient contrast ratios:
   - WCAG AA: 4.5:1 for normal text
   - WCAG AAA: 7:1 for enhanced contrast

## Troubleshooting

### Theme Not Persisting
1. Check if localStorage is enabled in browser
2. Clear localStorage: `localStorage.clear()`
3. Verify `ThemeProvider` is in the component tree

### Flash of Wrong Theme
- This is normal on first load (expected behavior)
- Add `suppressHydrationWarning` to HTML tag
- Use theme skeleton loading state while mounting

### Contrast Issues in Dark Mode
1. Use a contrast checker: https://webaim.org/resources/contrastchecker/
2. Adjust color variables in tailwind config
3. Test with browser accessibility inspector

### Component Not Showing
1. Verify it's wrapped with `ThemeProvider`
2. Check that it's a client component (`'use client'`)
3. Verify no hydration mismatches in console

## Performance Considerations

### Bundle Size
- `next-themes`: ~2KB (gzipped)
- Theme toggle component: ~5KB (minified)
- Total impact: Minimal

### Rendering
- Theme toggle uses React hooks, no external dependencies for rendering
- Leverages CSS variables for instant theme switching
- No layout shifts during theme change

### localStorage Operations
- Single read on app load
- Single write on theme change
- No polling or watchers

## Future Enhancements

Potential improvements for future versions:

1. **Custom Theme Creator**
   - Allow users to customize colors
   - Store custom themes in localStorage

2. **Auto-Schedule Themes**
   - Switch to dark mode at sunset
   - Switch to light mode at sunrise

3. **Theme Sync Across Devices**
   - Store theme preference in user profile
   - Sync via database instead of localStorage

4. **More Theme Options**
   - Add high-contrast themes
   - Add colorblind-friendly themes

5. **Performance**
   - Cache theme preference in session storage
   - Reduce re-renders during theme switching

## References

- [next-themes Documentation](https://github.com/pacocoursey/next-themes)
- [CSS Variables (Custom Properties)](https://developer.mozilla.org/en-US/docs/Web/CSS/--*)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Web Content Accessibility Guidelines - Color Contrast](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)

## Related Files

- `components/layout/theme-toggle.tsx` - Main component
- `components/layout/app-header.tsx` - Header integration
- `app/(workspace)/[workspaceId]/settings/profile/page.tsx` - Settings integration
- `components/providers/index.tsx` - Theme provider setup
- `__tests__/components/theme-toggle.test.tsx` - Unit tests
