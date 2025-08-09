# Internationalization (i18n) Workflow

This document describes the internationalization workflow for the Wundr documentation platform, including how to maintain translations and manage multi-language content.

## Overview

The Wundr documentation supports 4 languages:
- **English (en)** - Default locale
- **Spanish (es)** - Español
- **French (fr)** - Français
- **German (de)** - Deutsch

## Architecture

### Translation Structure

```
i18n/
├── es/                                    # Spanish translations
│   ├── code.json                         # UI translations
│   ├── docusaurus-plugin-content-docs/   # Main docs
│   ├── docusaurus-plugin-content-docs-api/  # API docs
│   ├── docusaurus-plugin-content-docs-guides/ # Guides
│   ├── docusaurus-plugin-content-blog/   # Blog translations
│   └── docusaurus-theme-classic/         # Theme translations
├── fr/                                    # French translations
├── de/                                    # German translations
└── reports/                               # Translation maintenance reports
```

### Search Integration

The documentation uses `@easyops-cn/docusaurus-search-local` with multi-language support:

```javascript
{
  language: ['en', 'es', 'fr', 'de'],
  indexDocs: true,
  indexBlog: true,
  indexPages: true,
  highlightSearchTermsOnTargetPage: true,
}
```

## Maintenance Workflow

### 1. Generate Translation Infrastructure

```bash
# Generate base translation files for all locales
npm run generate-translations
```

This creates:
- Translation directory structure
- Base UI translations
- Sidebar translations
- I18n utilities

### 2. Check Translation Status

```bash
# Generate maintenance report
npm run i18n-maintenance report

# Validate translation files
npm run i18n-maintenance validate
```

### 3. Add New Content

#### For New Documentation Files

1. Create the English version first in `docs/`
2. Generate translations:

```bash
# Create translated versions manually or use translation tools
mkdir -p i18n/es/docusaurus-plugin-content-docs/current/concepts
mkdir -p i18n/fr/docusaurus-plugin-content-docs/current/concepts
mkdir -p i18n/de/docusaurus-plugin-content-docs/current/concepts

# Copy and translate files
cp docs/concepts/new-concept.md i18n/es/docusaurus-plugin-content-docs/current/concepts/
# Edit and translate content...
```

#### For UI Strings

Add translations to `i18n/{locale}/code.json`:

```json
{
  "theme.common.skipToMainContent": "Saltar al contenido principal",
  "theme.SearchBar.label": "Buscar"
}
```

### 4. Update Sidebars

For translated sidebars, edit `i18n/{locale}/docusaurus-plugin-content-docs/current.json`:

```json
{
  "sidebar.tutorialSidebar.category.Getting Started": "Comenzar",
  "sidebar.tutorialSidebar.category.Core Concepts": "Conceptos Básicos"
}
```

## Translation Guidelines

### Content Translation

1. **Maintain Structure**: Keep the same heading structure and file organization
2. **Preserve Links**: Update internal links to point to translated versions
3. **Code Examples**: Translate comments but keep code unchanged
4. **Technical Terms**: Use consistent technical terminology

### Example Translation Pattern

English:
```markdown
# Getting Started

Welcome to Wundr! This guide will help you get started.

## Prerequisites

- Node.js 18+
- Git

## Installation

Install Wundr globally:

```bash
npm install -g @wundr/cli
```
```

Spanish:
```markdown
# Comenzar

¡Bienvenido a Wundr! Esta guía te ayudará a comenzar.

## Requisitos Previos

- Node.js 18+
- Git

## Instalación

Instala Wundr globalmente:

```bash
npm install -g @wundr/cli
```
```

## Search Functionality

### Local Search Setup

The documentation uses local search with these features:
- Full-text search across all languages
- Search result highlighting
- Context-aware results
- Mobile-responsive interface

### Search Analytics

Custom search analytics track:
- Popular queries by language
- Queries with no results
- Search volume metrics
- User engagement patterns

Access analytics via the search analytics component in the bottom-right corner.

### Search Optimization

1. **Keywords**: Include relevant keywords in headings
2. **Meta Tags**: Use descriptive titles and descriptions
3. **Content Structure**: Use proper heading hierarchy
4. **Cross-references**: Link related content

## Build and Deployment

### Development Build

```bash
# Start development server with all languages
npm start

# Start with specific locale
npm start -- --locale es
```

### Production Build

```bash
# Build all languages
npm run build

# Build specific locale
npm run build -- --locale es
```

### Deployment Considerations

1. **URL Structure**: 
   - Default: `/docs/intro`
   - Spanish: `/es/docs/intro`
   - French: `/fr/docs/intro`
   - German: `/de/docs/intro`

2. **SEO Optimization**:
   - Proper hreflang tags
   - Localized meta descriptions
   - Language-specific sitemaps

3. **CDN Configuration**:
   - Cache translated content separately
   - Set appropriate cache headers
   - Use geo-location for default language

## Automation

### Translation Workflow Automation

Future enhancements may include:
- Automatic translation using AI services
- Translation memory integration
- Automated translation quality checks
- Content synchronization between languages

### Quality Assurance

```bash
# Run translation validation
npm run i18n-maintenance validate

# Generate translation report
npm run i18n-maintenance report

# Check for missing translations
npm run i18n-maintenance report | grep "missing"
```

## Best Practices

### Content Management

1. **Source of Truth**: English content is the authoritative version
2. **Version Control**: Track translation changes with meaningful commit messages
3. **Review Process**: Have native speakers review translations
4. **Consistency**: Use translation glossaries for technical terms

### Performance

1. **Lazy Loading**: Only load language resources as needed
2. **Bundle Splitting**: Separate language bundles
3. **Caching**: Cache translated content aggressively
4. **Search Index**: Optimize search indices per language

### Maintenance

1. **Regular Audits**: Review translation completeness monthly
2. **Content Updates**: Update translations when source content changes
3. **User Feedback**: Collect feedback on translation quality
4. **Metrics Tracking**: Monitor usage by language

## Troubleshooting

### Common Issues

1. **Missing Translations**:
   ```bash
   npm run i18n-maintenance report
   # Check for specific missing keys
   ```

2. **Build Failures**:
   ```bash
   npm run i18n-maintenance validate
   # Fix JSON syntax errors
   ```

3. **Search Not Working**:
   - Verify search plugin configuration
   - Check language settings
   - Rebuild search indices

### Support

- Check the [Docusaurus i18n documentation](https://docusaurus.io/docs/i18n/introduction)
- Review translation maintenance reports
- Use the search analytics for insights

## Contributing

To contribute translations:

1. Fork the repository
2. Create a feature branch for your language
3. Add/update translation files
4. Test the build locally
5. Submit a pull request with translation updates

Remember to follow the translation guidelines and test your changes thoroughly before submitting.