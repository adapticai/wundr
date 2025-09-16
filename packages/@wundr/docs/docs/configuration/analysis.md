# Analysis Settings

Configure how Wundr analyzes your codebase for quality and patterns.

## Overview

Analysis settings control the depth and scope of code analysis performed by Wundr.

## Configuration Options

### Basic Analysis

```json
{
  "analysis": {
    "depth": "deep",
    "includeTests": true,
    "parallel": true,
    "timeout": 30000
  }
}
```

### Analysis Types

- **Quality Analysis**: Code quality metrics
- **Pattern Analysis**: Pattern detection and enforcement
- **Dependency Analysis**: Dependency mapping and cycles
- **Security Analysis**: Basic security checks

## Performance Tuning

Optimize analysis performance for large codebases:

```json
{
  "analysis": {
    "workers": 4,
    "chunkSize": 100,
    "cacheEnabled": true
  }
}
```

## Next Steps

- Configure [Pattern Settings](./patterns.md)
- Set up [Reporting Options](./reporting.md)