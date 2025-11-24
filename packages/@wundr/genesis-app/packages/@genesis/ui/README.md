# @genesis/ui

Genesis UI component library built with Radix UI primitives and Tailwind CSS.

## Installation

```bash
npm install @genesis/ui
```

## Peer Dependencies

This package requires the following peer dependencies:

```bash
npm install react react-dom
```

## Usage

### Button Component

A versatile button component with multiple variants and sizes.

```tsx
import { Button } from '@genesis/ui';

// Primary button (default)
<Button>Click me</Button>

// Different variants
<Button variant="primary">Primary</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="destructive">Delete</Button>
<Button variant="outline">Outline</Button>
<Button variant="link">Link</Button>

// Different sizes
<Button size="sm">Small</Button>
<Button size="md">Medium</Button>
<Button size="lg">Large</Button>
<Button size="icon"><IconComponent /></Button>

// Disabled state
<Button disabled>Disabled</Button>
```

#### Button Variants

| Variant       | Description                           |
| ------------- | ------------------------------------- |
| `primary`     | Main action button with solid bg      |
| `secondary`   | Alternative action with muted styling |
| `ghost`       | Transparent, visible on hover         |
| `destructive` | Warning/danger actions (red theme)    |
| `outline`     | Border-only style                     |
| `link`        | Text-only with underline on hover     |

#### Button Sizes

| Size   | Description                    |
| ------ | ------------------------------ |
| `sm`   | Compact (h-8, px-3, text-xs)   |
| `md`   | Default (h-10, px-4)           |
| `lg`   | Larger (h-12, px-8, text-base) |
| `icon` | Square (h-10, w-10)            |

### Avatar Component

Avatar component for displaying user profile images with fallback support.

```tsx
import { Avatar } from '@genesis/ui';

// Avatar with image
<Avatar
  src="/user-photo.jpg"
  alt="John Doe"
  fallback="JD"
/>

// Avatar with status indicator
<Avatar
  src="/user-photo.jpg"
  alt="Jane Smith"
  fallback="JS"
  status="online"
  showStatus
/>

// Different sizes
<Avatar size="xs" fallback="XS" />
<Avatar size="sm" fallback="SM" />
<Avatar size="md" fallback="MD" />
<Avatar size="lg" fallback="LG" />
<Avatar size="xl" fallback="XL" />

// Auto-generate initials from name
<Avatar fallback="John Doe" /> // Displays "JD"
```

#### Avatar Sizes

| Size | Dimensions |
| ---- | ---------- |
| `xs` | 24x24px    |
| `sm` | 32x32px    |
| `md` | 40x40px    |
| `lg` | 48x48px    |
| `xl` | 64x64px    |

#### Status Indicators

| Status    | Color  |
| --------- | ------ |
| `online`  | Green  |
| `offline` | Gray   |
| `busy`    | Red    |
| `away`    | Yellow |

### Utility Functions

#### `cn()` - Class Name Merger

Combines class names using clsx and tailwind-merge for intelligent Tailwind class merging.

```tsx
import { cn } from '@genesis/ui';

// Basic usage
cn('px-4 py-2', 'px-6'); // => 'py-2 px-6'

// With conditionals
cn('base-class', isActive && 'active-class');

// With objects
cn('base', { conditional: condition });
```

#### `getInitials()` - Extract Initials

Extracts initials from a name string.

```tsx
import { getInitials } from '@genesis/ui';

getInitials('John Doe'); // => 'JD'
getInitials('Alice'); // => 'A'
getInitials('Mary Jane Watson'); // => 'MW'
```

## Styling

This library uses Tailwind CSS semantic color tokens. Ensure your Tailwind config includes:

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        ring: 'hsl(var(--ring))',
      },
    },
  },
};
```

## TypeScript

Full TypeScript support with exported types:

```tsx
import type { ButtonProps, AvatarProps } from '@genesis/ui';
```

## License

MIT
