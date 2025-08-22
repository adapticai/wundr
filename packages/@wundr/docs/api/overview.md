---
title: API Overview
sidebar_label: Overview
---

# Wundr API Documentation

Welcome to the Wundr API documentation. This comprehensive guide covers all API endpoints and capabilities of the Wundr platform.

## Core APIs

### Analysis API
Comprehensive code analysis including quality metrics, dependency scanning, and security checks.

### Batch Processing API
Efficient batch operations for processing multiple tasks in parallel.

### Configuration API
Dynamic configuration management with environment-specific settings.

### Files API
Complete file management with versioning and metadata support.

### Reports API
Generate detailed reports in multiple formats with custom templates.

## Getting Started

To use the Wundr APIs, first install the core package:

```bash
npm install @wundr.io/core
```

Then import and use the APIs:

```typescript
import { 
  AnalysisEngine,
  BatchProcessor,
  ConfigManager,
  FileManager,
  ReportGenerator 
} from '@wundr.io/core';
```

## Authentication

All API endpoints require authentication. Include your API key in the request headers:

```typescript
headers: {
  'Authorization': `Bearer ${API_KEY}`,
  'Content-Type': 'application/json'
}
```

## Rate Limiting

API requests are rate-limited to ensure fair usage:
- 1000 requests per hour for standard accounts
- 10,000 requests per hour for enterprise accounts

## Support

For API support and questions:
- GitHub Issues: https://github.com/adapticai/wundr/issues
- Documentation: https://docs.wundr.io
- Email: support@wundr.io
