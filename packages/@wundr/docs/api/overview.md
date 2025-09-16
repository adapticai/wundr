---
sidebar_position: 1
title: API Reference Overview
description: Comprehensive REST API documentation for Wundr platform integration
keywords: [wundr, api, rest, integration, documentation]
---

# Wundr API Reference

The Wundr REST API provides comprehensive programmatic access to all platform features including code analysis, batch processing, configuration management, file operations, and reporting. Built for enterprise-scale integration with robust authentication and rate limiting.

## 🚀 Quick Start

```bash
# Install the CLI
npm install -g @lumic/wundr

# Get your API key
wundr auth login
wundr auth token

# Make your first API call
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://api.wundr.io/v1/analysis/projects
```

## 🔐 Authentication

### API Key Authentication
All API requests require a valid API key in the Authorization header:

```bash
Authorization: Bearer wundr_ak_1234567890abcdef
```

### Getting Your API Key

```bash
# Via CLI
wundr auth login
wundr auth token

# Via Dashboard
# Navigate to Settings → API Keys → Generate New Key
```

### Key Types

| Type | Scope | Rate Limit | Use Case |
|------|-------|------------|----------|
| **Personal** | User projects | 1,000/hour | Development |
| **Team** | Organization projects | 5,000/hour | Team workflows |
| **Enterprise** | All resources | 50,000/hour | Production systems |

## 🌐 Base URLs

| Environment | Base URL | Description |
|-------------|----------|-------------|
| **Production** | `https://api.wundr.io/v1` | Production environment |
| **Staging** | `https://staging-api.wundr.io/v1` | Testing environment |
| **Development** | `http://localhost:3001/api/v1` | Local development |

## 📊 Rate Limiting

### Limits by Plan

| Plan | Requests/Hour | Burst | Concurrent |
|------|---------------|-------|------------|
| **Free** | 100 | 20 | 2 |
| **Pro** | 1,000 | 100 | 10 |
| **Team** | 5,000 | 500 | 25 |
| **Enterprise** | 50,000 | 2,000 | 100 |

### Rate Limit Headers

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1640995200
X-RateLimit-Retry-After: 3600
```

### Handling Rate Limits

```javascript
const response = await fetch('/api/v1/analysis', {
  headers: { 'Authorization': 'Bearer ' + apiKey }
});

if (response.status === 429) {
  const retryAfter = response.headers.get('X-RateLimit-Retry-After');
  console.log(`Rate limited. Retry after ${retryAfter} seconds`);
}
```

## 📋 Response Format

### Success Response

```json
{
  "success": true,
  "data": {
    "id": "analysis_123",
    "status": "completed",
    "results": {}
  },
  "meta": {
    "timestamp": "2024-09-16T10:30:00Z",
    "version": "v1",
    "request_id": "req_abc123",
    "processing_time_ms": 150
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid project configuration",
    "details": {
      "field": "config.rules",
      "reason": "Required field missing"
    }
  },
  "meta": {
    "timestamp": "2024-09-16T10:30:00Z",
    "version": "v1",
    "request_id": "req_abc123"
  }
}
```

### Pagination

```json
{
  "success": true,
  "data": [
    { "id": 1, "name": "Project A" },
    { "id": 2, "name": "Project B" }
  ],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total_pages": 5,
    "total_items": 100,
    "has_next": true,
    "has_prev": false
  }
}
```

## 🔍 API Endpoints Overview

### [Analysis API](/api/analysis)
Deep code analysis, pattern detection, and quality metrics

- `GET /analysis/projects` - List analyzed projects
- `POST /analysis/run` - Start new analysis
- `GET /analysis/{id}/results` - Get analysis results
- `GET /analysis/metrics` - Quality metrics dashboard

### [Batches API](/api/batches)
Batch processing for large-scale operations

- `POST /batches` - Create batch job
- `GET /batches/{id}` - Get batch status
- `GET /batches/{id}/results` - Download results
- `DELETE /batches/{id}` - Cancel batch

### [Configuration API](/api/config)
Project settings and rule management

- `GET /config/projects/{id}` - Get project config
- `PUT /config/projects/{id}` - Update configuration
- `GET /config/templates` - List config templates
- `POST /config/validate` - Validate configuration

### [Files API](/api/files)
File operations and repository management

- `GET /files/projects/{id}/tree` - Get file tree
- `GET /files/content` - Read file content
- `POST /files/upload` - Upload files
- `DELETE /files/{id}` - Delete files

### [Reports API](/api/reports)
Generate and manage analysis reports

- `POST /reports/generate` - Create report
- `GET /reports/{id}` - Download report
- `GET /reports/templates` - List templates
- `POST /reports/schedule` - Schedule automated reports

## 🛠️ SDKs and Libraries

### Official SDKs

```bash
# Node.js/TypeScript
npm install @wundr/sdk

# Python
pip install wundr-sdk

# Go
go get github.com/adapticai/wundr-go
```

### Usage Examples

```typescript
// Node.js/TypeScript
import { WundrClient } from '@wundr/sdk';

const client = new WundrClient({
  apiKey: process.env.WUNDR_API_KEY,
  baseUrl: 'https://api.wundr.io/v1'
});

const analysis = await client.analysis.run({
  projectPath: './src',
  rules: ['complexity', 'duplicates']
});
```

```python
# Python
from wundr_sdk import WundrClient

client = WundrClient(
    api_key=os.getenv('WUNDR_API_KEY'),
    base_url='https://api.wundr.io/v1'
)

analysis = client.analysis.run(
    project_path='./src',
    rules=['complexity', 'duplicates']
)
```

## 🔔 Webhooks

### Supported Events

- `analysis.completed` - Analysis finished
- `batch.completed` - Batch job finished
- `report.generated` - Report ready
- `project.updated` - Configuration changed

### Webhook Configuration

```bash
curl -X POST https://api.wundr.io/v1/webhooks \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-app.com/webhooks/wundr",
    "events": ["analysis.completed"],
    "secret": "your-webhook-secret"
  }'
```

## 📚 Interactive Documentation

- **[OpenAPI Specification](./openapi.json)** - Complete API schema
- **[Postman Collection](./postman.json)** - Ready-to-use requests
- **[GraphQL Playground](https://api.wundr.io/graphql)** - Interactive GraphQL explorer

## 🆘 Support & Resources

- **[Status Page](https://status.wundr.io)** - API uptime and incidents
- **[Changelog](./changelog)** - API version history
- **[GitHub Issues](https://github.com/adapticai/wundr/issues)** - Bug reports
- **[Discord Community](https://discord.gg/wundr)** - Developer chat

## 🚀 Next Steps

1. **[Get Started](/guides/quickstart/api-integration)** - Your first integration
2. **[Authentication Guide](/guides/authentication)** - Security best practices
3. **[Rate Limiting Guide](/guides/rate-limiting)** - Optimization strategies
4. **[Webhook Guide](/guides/webhooks)** - Real-time notifications
5. **[Error Handling](/guides/error-handling)** - Robust error management
