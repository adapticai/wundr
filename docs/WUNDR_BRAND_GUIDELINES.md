# Wundr Brand Implementation Guidelines

## Overview

This document outlines the brand implementation standards for Wundr, an AI-driven monorepo analysis
and refactoring tool by Wundr, by Adaptic.ai.

## Brand Identity

### Logo Design

- **Primary Mark**: 8-segment circular logo with one segment offset radially by 2px
- **Style**: Flat, minimalist design with no gradients or shadows
- **Stroke Width**: 1pt with sharp miter joins

### Color Palette

#### Primary Colors

```css
/* Light Theme */
--primary: #0e1a24; /* Deep navy */
--background: #ffffff; /* Pure white */

/* Dark Theme */
--primary: #ffffff; /* Pure white */
--background: #0e1a24; /* Deep navy */
```

#### Wundr Brand Scale

```css
wundr: {
  dark: '#0E1A24',    /* Deep navy */
  light: '#FFFFFF',   /* Pure white */
  50: '#E8EEF3',      /* Very light blue-gray */
  100: '#C3D5E2',     /* Light blue-gray */
  200: '#9EBACF',     /* Medium-light blue-gray */
  300: '#7A9FBC',     /* Medium blue-gray */
  400: '#5584A9',     /* Medium blue */
  500: '#3D6A91',     /* Primary blue */
  600: '#2D5078',     /* Dark blue */
  700: '#1F3A5A',     /* Darker blue */
  800: '#162940',     /* Very dark blue */
  900: '#0E1A24',     /* Deep navy */
  950: '#070D12'      /* Almost black */
}
```

### Typography

- **Primary Font**: Space Grotesk (logo, headlines, branding)
- **Secondary Font**: Geist Sans (body text, UI elements)
- **Monospace Font**: Geist Mono (code, technical content)

### Logo Usage

#### Component Imports

```tsx
import { WundrLogo, WundrWordmark, WundrLogoFull } from '@/components/logos';
```

#### Basic Logo

```tsx
<WundrLogo size={32} theme='auto' />
```

#### Full Logo with Tagline

```tsx
<WundrLogoFull size='lg' orientation='horizontal' showTagline={true} showAttribution={true} />
```

## Color Implementation

### Semantic Color Usage

Replace hardcoded colors with semantic tokens:

```tsx
// ❌ Don't use:
className = 'bg-green-100 text-green-800';

// ✅ Do use:
className = 'bg-green-500/10 text-green-700 dark:text-green-400';
```

### Standard Semantic Classes

- **Success**: `bg-green-500/10 text-green-700 dark:text-green-400`
- **Error**: `bg-destructive/10 text-destructive`
- **Warning**: `bg-amber-500/10 text-amber-700 dark:text-amber-400`
- **Info**: `bg-accent/10 text-accent`

### Terminal/Console Styling

```tsx
// Terminal background
className = 'bg-card text-green-600 dark:text-green-400';
```

## Component Standards

### Charts

Use CSS variables for all chart colors:

```typescript
const chartColors = [
  'hsl(var(--primary))',
  'hsl(var(--accent))',
  'hsl(var(--destructive))',
  // ...
];
```

### Alerts and Notifications

```css
.alert-info {
  @apply bg-accent/10 border-accent/20 text-accent;
}
.alert-warning {
  @apply bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400;
}
.alert-danger {
  @apply bg-destructive/10 border-destructive/20 text-destructive;
}
.alert-success {
  @apply bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-400;
}
```

## Theme Configuration

### CSS Variables

The theme system uses CSS custom properties defined in `globals.css`:

- Light theme variables in `:root`
- Dark theme variables in `.dark`

### Tailwind Integration

All colors reference CSS variables through Tailwind config:

```javascript
colors: {
  border: 'hsl(var(--border))',
  foreground: 'hsl(var(--foreground))',
  primary: {
    DEFAULT: 'hsl(var(--primary))',
    foreground: 'hsl(var(--primary-foreground))'
  },
  // ...
}
```

## Best Practices

### 1. Always Use Semantic Tokens

- Use `text-foreground` instead of specific color values
- Use `border-border` for all borders
- Use `bg-background` for backgrounds

### 2. Theme-Aware Development

- Test all components in both light and dark modes
- Use Tailwind's dark: modifier for theme-specific styles
- Avoid hardcoded colors

### 3. Consistency

- Use the design system's spacing scale
- Follow the established component patterns
- Maintain visual hierarchy with proper typography

### 4. Performance

- Use CSS variables for dynamic theming
- Leverage Tailwind's purge for optimal bundle size
- Avoid inline styles

## Migration Checklist

When updating existing components:

1. ✅ Replace hardcoded hex colors
2. ✅ Update to semantic color classes
3. ✅ Test in light and dark modes
4. ✅ Verify accessibility contrast
5. ✅ Update any inline styles
6. ✅ Document any exceptions

## Brand Assets

### Logo Files

- `/components/logos/WundrLogo.tsx` - Base logo component
- `/components/logos/WundrWordmark.tsx` - Text-only version
- `/components/logos/WundrLogoFull.tsx` - Complete lockup

### Brand Messages

- **Tagline**: "Transform your monorepo with intelligent code analysis and refactoring"
- **Attribution**: "A product by Wundr, by Adaptic.ai"

## Support

For questions about brand implementation, refer to the design system documentation or contact the
design team.
