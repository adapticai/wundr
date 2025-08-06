# Wundr Logo System

A complete logo lockup system with proper tagline, attribution, and theme support.

## Components

### WundrLogo
The main logo symbol component with a broken circle design.

```tsx
import { WundrLogo } from '@/components/logos';

<WundrLogo 
  size={32} 
  theme="auto" 
  className="my-custom-class" 
/>
```

**Props:**
- `size?: number` - Size in pixels (default: 32)
- `theme?: 'light' | 'dark' | 'auto'` - Color theme (default: 'auto')
- `className?: string` - Additional CSS classes

### WundrWordmark
The wordmark using Space Grotesk font.

```tsx
import { WundrWordmark } from '@/components/logos';

<WundrWordmark 
  theme="auto" 
  className="my-custom-class" 
/>
```

**Props:**
- `theme?: 'light' | 'dark' | 'auto'` - Color theme (default: 'auto')
- `className?: string` - Additional CSS classes

### WundrLogoFull
Complete logo lockup with tagline and attribution.

```tsx
import { WundrLogoFull } from '@/components/logos';

<WundrLogoFull 
  orientation="horizontal"
  size="md"
  showTagline={true}
  showAttribution={true}
  theme="auto"
  className="my-custom-class"
/>
```

**Props:**
- `orientation?: 'horizontal' | 'vertical'` - Layout direction (default: 'horizontal')
- `size?: 'sm' | 'md' | 'lg' | 'xl'` - Pre-defined size variants (default: 'md')
- `showTagline?: boolean` - Show tagline text (default: true)
- `showAttribution?: boolean` - Show attribution text (default: true)
- `theme?: 'light' | 'dark' | 'auto'` - Color theme (default: 'auto')
- `className?: string` - Additional CSS classes

## Brand Guidelines

### Tagline
"Transform your monorepo with intelligent code analysis and refactoring"

### Attribution
"A product by Lumic.ai"

### Typography
- **Primary Font**: Space Grotesk
- **Fallback**: System fonts (-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif)
- **Letter Spacing**: -0.01em to -0.02em for optimal readability

### Colors
- **Primary**: #0E1A24 (dark text/logo)
- **Primary Light**: #FFFFFF (light text/logo)
- **Tagline Opacity**: 70% of primary color
- **Attribution Opacity**: 50% of primary color

## Size Specifications

### Small (sm)
- Logo: 24px
- Wordmark: 0.8x scale
- Best for: Navigation, compact spaces

### Medium (md) - Default
- Logo: 32px  
- Wordmark: 1x scale
- Best for: General usage, cards, headers

### Large (lg)
- Logo: 48px
- Wordmark: 1.2x scale  
- Best for: Hero sections, prominent placements

### Extra Large (xl)
- Logo: 64px
- Wordmark: 1.5x scale
- Best for: Landing pages, splash screens

## Layout Guidelines

### Horizontal Layout
- Logo and text are arranged side-by-side
- Logo is left-aligned with content
- Appropriate for headers, navigation, and wide spaces
- Tagline appears below wordmark in single line (md and below) or wrapped appropriately

### Vertical Layout
- Logo is centered above wordmark
- All text is center-aligned
- Tagline is split into two balanced lines
- Appropriate for footers, cards, and vertical spaces

## Theme Support

### Auto Theme (Recommended)
- Automatically adapts to system/user theme preference
- Uses CSS classes with dark mode variants
- Seamlessly switches between light and dark appearances

### Light Theme
- Uses dark colors (#0E1A24) on light backgrounds
- Explicit light theme enforcement

### Dark Theme  
- Uses light colors (#FFFFFF) on dark backgrounds
- Explicit dark theme enforcement

## Usage Examples

### Navigation Header
```tsx
<WundrLogoFull 
  orientation="horizontal"
  size="sm"
  showTagline={false}
  showAttribution={false}
/>
```

### Hero Section
```tsx
<WundrLogoFull 
  orientation="vertical"
  size="xl"
  showTagline={true}
  showAttribution={true}
/>
```

### Footer
```tsx
<WundrLogoFull 
  orientation="vertical"
  size="md"
  showTagline={true}
  showAttribution={true}
/>
```

### Card/Panel
```tsx
<WundrLogoFull 
  orientation="horizontal"
  size="md"
  showTagline={true}
  showAttribution={false}
/>
```

## Accessibility

- All text uses semantic font-family stacks with proper fallbacks
- Color contrast meets WCAG guidelines in both light and dark themes
- SVG elements include proper semantic structure
- Text scaling respects user preferences

## Implementation Notes

- All components are built with React and TypeScript
- Tailwind CSS classes used for responsive design
- Consistent spacing system using Tailwind's spacing scale
- Optimized SVG rendering for crisp display at all sizes
- Font loading handled through Next.js font optimization when available

## Browser Support

- Modern browsers (Chrome 88+, Firefox 85+, Safari 14+, Edge 88+)
- SVG rendering supported in all target browsers
- Space Grotesk font with proper fallbacks
- CSS custom properties for theme switching