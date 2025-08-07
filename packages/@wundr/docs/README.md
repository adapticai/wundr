# Wundr Documentation Site

This is the comprehensive documentation site for Wundr, built with Docusaurus 3.

## Features

- **📚 Complete Documentation** - User guides, API reference, tutorials
- **🎮 Interactive Playground** - Try Wundr features in your browser
- **🌍 Multi-language Support** - English, Spanish, French, German
- **🔍 Full-text Search** - Powered by Algolia
- **📱 Mobile Responsive** - Optimized for all devices
- **🎨 Custom Theming** - Wundr brand integration
- **⚡ Fast Performance** - Static site generation
- **🤖 Auto-generated API Docs** - Synced with web client APIs

## Quick Start

### Development

```bash
# Install dependencies
pnpm install

# Generate API documentation
pnpm run generate-api-docs

# Generate playground examples
pnpm run generate-playground

# Start development server
pnpm start
```

### Build for Production

```bash
# Build static site
pnpm run build

# Serve built site locally
pnpm run serve
```

## Documentation Structure

```
docs/
├── intro.md                 # Getting started
├── getting-started/          # Installation & setup guides
├── concepts/                 # Core concepts & theory
├── cli/                      # CLI command reference
├── dashboard/                # Web dashboard guides
├── integration/              # Tool integrations
├── advanced/                 # Advanced topics
├── migration/                # Migration guides
└── troubleshooting/          # Common issues & FAQ

api/                          # Auto-generated API docs
├── overview.md               # API introduction
├── analysis/                 # Analysis endpoints
├── reports/                  # Reporting endpoints
├── config/                   # Configuration endpoints
└── openapi.json              # OpenAPI 3.0 specification

guides/                       # Step-by-step tutorials
├── quickstart/               # Quick start guides
├── workflow/                 # Daily workflows
├── best-practices/           # Best practices
├── integration/              # Integration guides
├── advanced/                 # Advanced usage
├── videos/                   # Video tutorials
└── examples/                 # Real-world examples
```

## Content Creation

### Writing Documentation

1. **Use clear headings** and consistent formatting
2. **Include code examples** for all concepts
3. **Add cross-references** to related topics
4. **Test all examples** before publishing
5. **Follow the style guide** in `/docs/contributing/`

### Adding New Pages

```bash
# Create a new guide
touch guides/my-new-guide.md

# Update the sidebar
# Edit sidebars-guides.ts

# Add to navigation
# Update docusaurus.config.ts if needed
```

### API Documentation

API docs are auto-generated from the web client routes:

```bash
# Scan routes and generate docs
pnpm run generate-api-docs

# Manual updates
# Edit scripts/generate-api-docs.ts
```

### Playground Examples

Add interactive examples:

```bash
# Generate playground configuration
pnpm run generate-playground

# Add new examples
# Edit scripts/generate-playground.ts
```

## Multi-language Support

### Available Languages

- **English** (en) - Default
- **Spanish** (es) - Español
- **French** (fr) - Français
- **German** (de) - Deutsch

### Adding Translations

```bash
# Extract translatable strings
pnpm run write-translations --locale es

# Edit translation files
# i18n/es/docusaurus-plugin-content-docs/current.json

# Build with translations
pnpm run build
```

### Translation Guidelines

1. **Maintain technical accuracy** - Don't translate technical terms unnecessarily
2. **Keep code examples in English** - Code should remain readable
3. **Translate UI elements** - Buttons, navigation, messages
4. **Consider cultural context** - Adapt examples when needed

## Customization

### Theming

Custom styles are in `src/css/custom.css`:

```css
:root {
  --wundr-primary: #6366f1;
  --wundr-secondary: #8b5cf6;
  /* Add custom variables */
}

/* Custom component styles */
.wundr-feature-card {
  /* Component styling */
}
```

### Components

Custom React components in `src/components/`:

```tsx
// src/components/MyComponent.tsx
import React from 'react';

export const MyComponent: React.FC = () => {
  return <div>Custom component</div>;
};
```

### Plugins and Configuration

Main configuration in `docusaurus.config.ts`:

```typescript
// Add new plugins
plugins: [
  '@docusaurus/plugin-ideal-image',
  // Add custom plugins
],

// Modify theme configuration
themeConfig: {
  // Add custom theme options
}
```

## Deployment

### GitHub Pages (Automatic)

Documentation is automatically deployed on push to main:

1. **GitHub Actions** builds the site
2. **API docs** are regenerated
3. **Site deploys** to GitHub Pages
4. **Accessibility tests** run automatically

### Manual Deployment

```bash
# Build and deploy manually
pnpm run build
pnpm run deploy
```

### Custom Domain

To use a custom domain:

1. Add `CNAME` file to `/static/`
2. Configure DNS records
3. Update `docusaurus.config.ts` URL

## Performance

### Optimization Features

- **Static site generation** for fast loading
- **Image optimization** with `@docusaurus/plugin-ideal-image`
- **Bundle splitting** for efficient caching
- **Search indexing** with Algolia
- **CDN-friendly** assets

### Analytics

Analytics configuration in `docusaurus.config.ts`:

```typescript
themeConfig: {
  gtag: {
    trackingID: 'G-YOUR-TRACKING-ID',
  },
}
```

## Contributing

### Documentation Standards

1. **Write clear, concise content**
2. **Include working code examples**
3. **Test all instructions**
4. **Use consistent terminology**
5. **Add screenshots for UI features**

### Review Process

1. **Create feature branch** from main
2. **Write/update documentation**
3. **Test locally** with `pnpm start`
4. **Submit pull request**
5. **Address review feedback**
6. **Documentation team approves**

### Style Guide

- **Headings**: Use sentence case
- **Code blocks**: Always specify language
- **Links**: Use descriptive text
- **Images**: Include alt text
- **Lists**: Use parallel structure

## Troubleshooting

### Common Issues

**Build fails**:

```bash
# Clear cache and rebuild
pnpm run clear
pnpm run build
```

**Search not working**:

- Check Algolia configuration
- Verify API keys
- Rebuild search index

**Translations missing**:

```bash
# Generate missing translations
pnpm run write-translations --locale [locale]
```

**Playground not loading**:

- Check Monaco Editor configuration
- Verify example syntax
- Check browser console for errors

### Getting Help

- **GitHub Issues** - Bug reports and feature requests
- **Discussions** - Questions and community help
- **Discord** - Real-time community support
- **Documentation Team** - docs@wundr.io

## Scripts Reference

```bash
# Development
pnpm start              # Start dev server
pnpm run build          # Build for production
pnpm run serve          # Serve built site

# Content Generation
pnpm run generate-api-docs     # Generate API documentation
pnpm run generate-playground   # Generate playground examples

# Internationalization
pnpm run write-translations    # Extract translation strings
pnpm run write-heading-ids     # Add heading IDs for translations

# Utilities
pnpm run clear          # Clear build cache
pnpm run typecheck      # Type checking
pnpm run swizzle        # Customize theme components
```

## Resources

- **[Docusaurus Documentation](https://docusaurus.io/)**
- **[MDX Documentation](https://mdxjs.com/)**
- **[React Documentation](https://react.dev/)**
- **[Wundr GitHub Repository](https://github.com/adapticai/wundr)**

## License

This documentation is part of the Wundr project and is licensed under the MIT License. See the
[LICENSE](../../../LICENSE) file for details.
