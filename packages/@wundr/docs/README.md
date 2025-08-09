# Wundr Documentation

Comprehensive documentation site for the Wundr platform - the Intelligent CLI-Based Coding Agents Orchestrator.

## Features

- 🌐 **Multi-language Support**: Available in English, Spanish, French, and German
- 🔍 **Advanced Search**: Local search with analytics and cross-language support
- 📱 **Mobile Responsive**: Optimized for all device sizes
- 🎨 **Modern UI**: Built with Docusaurus 3.x and custom components
- 📊 **Search Analytics**: Track popular queries and user engagement
- 🔄 **Translation Management**: Automated i18n workflow and maintenance

## Quick Start

### Prerequisites

- Node.js 18+
- npm or pnpm

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm start

# Build for production
npm run build
```

### Available Scripts

```bash
# Development
npm start                    # Start dev server (all languages)
npm start -- --locale es    # Start with specific locale

# Build
npm run build               # Build all languages
npm run serve              # Serve built site locally

# Documentation Generation
npm run generate-api-docs      # Generate API documentation
npm run generate-translations  # Create translation infrastructure
npm run generate-playground    # Generate interactive playground

# I18n Management
npm run i18n-maintenance report    # Generate translation report
npm run i18n-maintenance validate  # Validate translation files
npm run write-translations         # Extract translatable strings

# Utilities
npm run clear              # Clear cache
npm run typecheck         # Run TypeScript checks
```

## Architecture

### Structure

```
packages/@wundr/docs/
├── docs/                  # Main documentation content
├── blog/                  # Blog posts
├── api/                   # API documentation
├── guides/                # User guides
├── src/
│   ├── components/        # Custom React components
│   ├── utils/             # Utility functions
│   └── css/              # Custom styles
├── i18n/                  # Translations
│   ├── es/               # Spanish translations
│   ├── fr/               # French translations
│   ├── de/               # German translations
│   └── reports/          # Translation reports
├── scripts/              # Build and maintenance scripts
├── static/               # Static assets
└── sidebars*.ts          # Sidebar configurations
```

### Key Components

- **SearchAnalytics**: Tracks search metrics and popular queries
- **LanguageSwitcher**: Enhanced language switching with visual indicators
- **TranslationGenerator**: Automated translation infrastructure creation
- **I18nMaintenance**: Translation status and quality management

## Configuration

### Supported Languages

- **English (en)**: Default locale
- **Spanish (es)**: Español  
- **French (fr)**: Français
- **German (de)**: Deutsch

### Search Configuration

Uses `@easyops-cn/docusaurus-search-local` for offline search:

```typescript
{
  hashed: true,
  language: ['en', 'es', 'fr', 'de'],
  indexDocs: true,
  indexBlog: true,
  indexPages: true,
  highlightSearchTermsOnTargetPage: true,
  searchResultLimits: 8,
}
```

## Translation Workflow

### Adding New Content

1. Create English content first in `docs/`
2. Generate translation files:
   ```bash
   npm run generate-translations
   ```
3. Translate content in `i18n/{locale}/docusaurus-plugin-content-docs/current/`
4. Update sidebar translations in `i18n/{locale}/docusaurus-plugin-content-docs/current.json`

### Maintaining Translations

```bash
# Check translation status
npm run i18n-maintenance report

# Validate all translation files
npm run i18n-maintenance validate

# View detailed translation report
cat i18n/reports/maintenance-$(date +%Y-%m-%d).md
```

### Translation Status

Current translation completeness:
- 🇺🇸 English: 100% (source)
- 🇪🇸 Spanish: ~60% (core content translated)
- 🇫🇷 French: ~60% (core content translated)
- 🇩🇪 German: ~60% (core content translated)

## Development

### Custom Components

#### SearchAnalytics
Provides search metrics and analytics:
- Popular queries tracking
- No-result queries identification
- Language-specific search volume
- Real-time analytics display

#### LanguageSwitcher
Enhanced language switching:
- Visual language indicators
- Proper URL transformation
- Mobile-responsive design
- Current language highlighting

### Theme Customization

Custom CSS variables for consistent theming:
```css
:root {
  --wundr-primary: #0066cc;
  --wundr-secondary: #666;
  --wundr-accent: #ff6b35;
}
```

## Deployment

### Build Process

```bash
# Production build
npm run build

# Test production build locally
npm run serve
```

### SEO Optimization

- Multi-language sitemap generation
- Proper hreflang tags
- Localized meta descriptions
- Open Graph tags per locale

### Performance

- Code splitting by language
- Optimized search indices
- Image optimization with `@docusaurus/plugin-ideal-image`
- Lazy loading for non-critical content

## API Documentation

Auto-generated from existing API routes:

```bash
# Generate API documentation
npm run generate-api-docs

# Output: api/ directory with OpenAPI specs and Markdown files
```

## Contributing

### Documentation

1. Follow the existing structure and style
2. Use proper heading hierarchy (H1 -> H2 -> H3)
3. Include code examples where applicable
4. Add translations for new content

### Translations

1. Maintain consistency with existing translations
2. Use the translation glossary for technical terms
3. Test builds before submitting
4. Follow the [i18n workflow](./docs/i18n-workflow.md)

### Code

1. Use TypeScript for all new components
2. Follow React best practices
3. Add proper JSDoc comments
4. Test responsive behavior

## Troubleshooting

### Build Issues

```bash
# Clear cache and rebuild
npm run clear && npm run build

# Check for missing files referenced in sidebars
npm run i18n-maintenance validate
```

### Search Problems

- Verify search plugin configuration in `docusaurus.config.ts`
- Rebuild search indices by clearing cache
- Check browser console for JavaScript errors

### Translation Issues

```bash
# Generate translation report
npm run i18n-maintenance report

# Fix common issues
# - Missing translation keys
# - Invalid JSON syntax
# - Broken internal links
```

## Resources

- [Docusaurus Documentation](https://docusaurus.io/)
- [I18n Workflow Guide](./docs/i18n-workflow.md)
- [API Documentation](./api/overview.md)
- [Component Library](./src/components/README.md)

## License

MIT License - see the [LICENSE](./LICENSE) file for details.

## Support

For documentation issues:
- [GitHub Issues](https://github.com/adapticai/wundr/issues)
- [Discussion Forum](https://github.com/adapticai/wundr/discussions)
- [Discord Server](https://discord.gg/wundr)