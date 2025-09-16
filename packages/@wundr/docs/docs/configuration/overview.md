# Configuration Overview

Configure Wundr to match your project needs and team preferences.

## Configuration Files

Wundr supports multiple configuration file formats:

- `wundr.config.json` - JSON configuration
- `wundr.config.js` - JavaScript configuration
- `wundr.config.ts` - TypeScript configuration
- `.wundrrc` - Simple key-value pairs

## Basic Configuration

```json
{
  "patterns": {
    "enabled": true,
    "strictMode": false
  },
  "analysis": {
    "depth": "deep",
    "includeTests": true
  },
  "reporting": {
    "format": "html",
    "output": "./reports"
  }
}
```

## Advanced Configuration

For complex projects, you can configure:

- Custom analysis rules
- Pattern enforcement levels
- Integration settings
- Team-specific workflows

## Next Steps

- [Pattern Configuration](./patterns.md)
- [Analysis Settings](./analysis.md)
- [Reporting Options](./reporting.md)