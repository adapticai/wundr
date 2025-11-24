# @genesis/tailwind-config

Shared Tailwind CSS configuration for Genesis-App, providing a cohesive design system with brand
colors, dark mode support, chat UI components, and animation presets.

## Installation

```bash
# Using npm
npm install @genesis/tailwind-config

# Using pnpm
pnpm add @genesis/tailwind-config

# Using yarn
yarn add @genesis/tailwind-config
```

## Setup

### 1. Tailwind Configuration

Extend the Genesis Tailwind config in your `tailwind.config.ts`:

```typescript
import type { Config } from 'tailwindcss';
import genesisConfig from '@genesis/tailwind-config';

const config: Config = {
  // Extend the Genesis config
  presets: [genesisConfig],

  // Add your content paths
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    // Include Genesis packages for their styles
    './node_modules/@genesis/**/*.{js,ts,jsx,tsx}',
  ],

  // Override or extend as needed
  theme: {
    extend: {
      // Your custom extensions
    },
  },
};

export default config;
```

### 2. PostCSS Configuration

Use the Genesis PostCSS config in your `postcss.config.js`:

```javascript
module.exports = require('@genesis/tailwind-config/postcss');
```

Or extend it:

```javascript
const genesisPostcss = require('@genesis/tailwind-config/postcss');

module.exports = {
  plugins: {
    ...genesisPostcss.plugins,
    // Add additional plugins
  },
};
```

## Theme Overview

### Colors

#### Brand Colors

- `genesis-*` - Primary brand color palette (50-950)
- `accent-*` - Secondary accent colors (50-950)

#### Semantic Colors

- `success-*` - Success states (50-950)
- `warning-*` - Warning states (50-950)
- `error-*` - Error states (50-950)

#### Surface Colors

- `surface-*` - Background and surface colors for dark mode (50-950)

#### Chat-Specific Colors

- `chat-user` - User message styling (bg, text, border)
- `chat-assistant` - Assistant message styling (bg, text, border)
- `chat-system` - System message styling (bg, text, border)

### Typography

The configuration includes three font families:

- `font-sans` - Inter as the primary sans-serif font
- `font-mono` - JetBrains Mono for code blocks
- `font-display` - Cal Sans for headings and display text

### Spacing

Custom spacing tokens for chat UI:

- `chat-padding` - Standard padding for chat containers (1rem)
- `chat-gap` - Gap between messages (0.75rem)
- `message-max` - Maximum width for messages (48rem)
- `sidebar` - Sidebar width (16rem)
- `sidebar-collapsed` - Collapsed sidebar width (4rem)
- `header` - Header height (4rem)
- `input-area` - Input area height (6rem)

### Animations

Pre-configured animations for smooth UI interactions:

- `animate-fade-in` / `animate-fade-out`
- `animate-slide-up` / `animate-slide-down`
- `animate-slide-in-right` / `animate-slide-in-left`
- `animate-scale-in` / `animate-scale-out`
- `animate-bounce-in`
- `animate-typing-dot` - For typing indicators
- `animate-pulse-subtle`
- `animate-shimmer` - For skeleton loading states

### Container Queries

The config includes `@tailwindcss/container-queries` for responsive components:

```html
<div class="@container">
  <div class="@lg:flex @lg:gap-4">
    <!-- Responsive to container size, not viewport -->
  </div>
</div>
```

## Usage Examples

### Chat Message Styling

```html
<!-- User message -->
<div
  class="bg-chat-user-bg text-chat-user-text border border-chat-user-border
            rounded-message p-chat-padding max-w-message animate-slide-up"
>
  User message content
</div>

<!-- Assistant message -->
<div
  class="bg-chat-assistant-bg text-chat-assistant-text border border-chat-assistant-border
            rounded-message p-chat-padding max-w-message animate-slide-up"
>
  Assistant message content
</div>
```

### Dark Mode

The config uses `class` strategy for dark mode:

```html
<html class="dark">
  <body class="bg-surface-950 text-surface-50">
    <!-- Dark mode content -->
  </body>
</html>
```

### Loading States

```html
<!-- Shimmer skeleton -->
<div
  class="h-4 w-full rounded bg-gradient-to-r from-surface-200 via-surface-100 to-surface-200
            bg-[length:200%_100%] animate-shimmer"
></div>

<!-- Typing indicator -->
<div class="flex gap-1">
  <span class="w-2 h-2 rounded-full bg-surface-400 animate-typing-dot"></span>
  <span
    class="w-2 h-2 rounded-full bg-surface-400 animate-typing-dot [animation-delay:0.2s]"
  ></span>
  <span
    class="w-2 h-2 rounded-full bg-surface-400 animate-typing-dot [animation-delay:0.4s]"
  ></span>
</div>
```

## Peer Dependencies

- `tailwindcss` ^3.4.0

## Included Plugins

- `@tailwindcss/container-queries` - Container query support
- `@tailwindcss/typography` - Prose styling for markdown content

## License

MIT
