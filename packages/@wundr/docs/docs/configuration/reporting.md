# Reporting Options

Configure report generation and output formats.

## Overview

Wundr generates comprehensive reports in multiple formats to help teams track code quality and patterns.

## Report Types

### Quality Reports
- Code quality metrics
- Trend analysis
- Quality scores

### Pattern Reports
- Pattern compliance
- Violations and fixes
- Pattern coverage

## Configuration

```json
{
  "reporting": {
    "formats": ["html", "json", "markdown"],
    "outputDir": "./reports",
    "includeMetrics": true,
    "includeTrends": true
  }
}
```

## Output Formats

- **HTML**: Interactive web reports
- **JSON**: Machine-readable data
- **Markdown**: Documentation-friendly format
- **PDF**: Professional reports (enterprise)

## Customization

Customize report appearance and content:

```json
{
  "reporting": {
    "template": "corporate",
    "branding": {
      "logo": "./assets/logo.png",
      "colors": {
        "primary": "#2196F3",
        "secondary": "#FF9800"
      }
    }
  }
}
```

## Next Steps

- Learn about [Pattern Configuration](./patterns.md)
- Explore [Analysis Settings](./analysis.md)