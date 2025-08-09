# API Reference

Welcome to the Wundr API documentation. This API provides comprehensive access to all Wundr platform features including analysis, reporting, configuration, and batch operations.

## Base URLs

- **Development**: `http://localhost:3000/api`
- **Production**: `https://api.wundr.io`

## Authentication

The Wundr API uses JWT Bearer tokens for authentication:

```http
Authorization: Bearer <your-jwt-token>
```

Alternatively, you can use API key authentication:

```http
X-API-Key: <your-api-key>
```

## Response Format

All API responses follow a consistent format:

```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

Error responses include an additional `error` field:

```json
{
  "success": false,
  "data": null,
  "error": "Error description",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

## Rate Limiting

API requests are rate-limited to:
- **Public endpoints**: 1000 requests per hour
- **Authenticated endpoints**: 5000 requests per hour
- **Analysis endpoints**: 100 requests per hour

Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Request limit per hour
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Time when limit resets

## OpenAPI Specification

Download the complete OpenAPI 3.0 specification:

- [JSON Format](/api/openapi.json)
- [Interactive API Explorer](/api/swagger)

## Available Endpoints

### Analysis
- [`GET, POST /analysis`](./analysis/overview) - Comprehensive analysis operations
- [`GET /analysis/entities`](./analysis/entities) - Code entity analysis
- [`GET /analysis/duplicates`](./analysis/duplicates) - Duplicate code detection
- [`GET /analysis/circular`](./analysis/circular) - Circular dependency analysis
- [`GET /analysis/dependencies`](./analysis/dependencies) - Dependency graph analysis
- [`POST /analysis/scan`](./analysis/scan) - Initiate code scanning

### Batches
- [`GET, POST /batches`](./batches/overview) - Batch job management
- [`GET /batches/{id}`](./batches/details) - Individual batch details

### Config
- [`GET, POST /config`](./config/overview) - Configuration management
- [`GET /config/load`](./config/load) - Load configuration
- [`POST /config/save`](./config/save) - Save configuration

### Files
- [`GET /files`](./files/overview) - File system operations
- [`GET /files/list`](./files/list) - List project files
- [`GET /files/read`](./files/read) - Read file contents
- [`POST /files/write`](./files/write) - Write file contents

### Reports
- [`GET /reports`](./reports/overview) - Report management
- [`POST /reports/generate`](./reports/generate) - Generate new reports
- [`GET /reports/export`](./reports/export) - Export report data
- [`GET /reports/templates`](./reports/templates) - Report templates

### Quality
- [`GET /quality`](./quality/overview) - Code quality metrics

### Performance
- [`GET /performance`](./performance/overview) - Performance analytics

### Git
- [`GET /git`](./git/overview) - Git repository information
- [`GET /git-activity`](./git-activity/overview) - Git activity analysis

### Scripts
- [`GET, POST /scripts`](./scripts/overview) - Script execution management
- [`POST /scripts/{id}/execute`](./scripts/execute) - Execute specific scripts
- [`GET /scripts/executions`](./scripts/executions) - Script execution history

## Quick Start

### TypeScript/Node.js

```typescript
import { WundrAPI } from '@wundr/api-client';

const client = new WundrAPI({
  baseUrl: 'http://localhost:3000/api',
  token: 'your-jwt-token'
});

// Get analysis data
const analysis = await client.analysis.get();
console.log(analysis.summary);

// Start a new scan
const scanResult = await client.analysis.scan({
  path: './src',
  options: {
    includeTests: true,
    depth: 5
  }
});
```

### cURL Examples

```bash
# Get analysis data
curl -X GET "http://localhost:3000/api/analysis" \
  -H "Authorization: Bearer your-jwt-token" \
  -H "Content-Type: application/json"

# Trigger new analysis
curl -X POST "http://localhost:3000/api/analysis" \
  -H "Authorization: Bearer your-jwt-token" \
  -H "Content-Type: application/json" \
  -d '{"action": "trigger_analysis", "data": {"projectId": "my-project"}}'

# Get quality metrics
curl -X GET "http://localhost:3000/api/quality" \
  -H "Authorization: Bearer your-jwt-token"
```

### Python

```python
import requests

class WundrClient:
    def __init__(self, base_url, token):
        self.base_url = base_url
        self.headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }
    
    def get_analysis(self, project_id=None):
        params = {'projectId': project_id} if project_id else {}
        response = requests.get(
            f'{self.base_url}/analysis',
            headers=self.headers,
            params=params
        )
        return response.json()

# Usage
client = WundrClient('http://localhost:3000/api', 'your-jwt-token')
analysis = client.get_analysis()
print(analysis['data']['summary'])
```

## Error Handling

The API uses standard HTTP status codes:

- `200 OK` - Request successful
- `400 Bad Request` - Invalid request parameters
- `401 Unauthorized` - Authentication required
- `403 Forbidden` - Access denied
- `404 Not Found` - Resource not found
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error

All error responses include a descriptive message:

```json
{
  "success": false,
  "error": "Validation failed: projectId is required",
  "timestamp": "2024-01-01T00:00:00Z",
  "details": {
    "code": "VALIDATION_ERROR",
    "field": "projectId"
  }
}
```

## Webhooks

Wundr supports webhooks for real-time notifications:

```json
{
  "event": "analysis.completed",
  "timestamp": "2024-01-01T00:00:00Z",
  "data": {
    "analysisId": "analysis-123",
    "projectId": "project-456",
    "status": "completed",
    "summary": { ... }
  }
}
```

Configure webhooks in your project settings or via the `/webhooks` endpoint.

## SDKs and Libraries

Official SDKs are available for:
- **JavaScript/TypeScript**: `@wundr/api-client`
- **Python**: `wundr-python-client`
- **Go**: `github.com/wundr/go-client`
- **Java**: `io.wundr:wundr-java-client`

## Support

- **Documentation**: [docs.wundr.io](https://docs.wundr.io)
- **GitHub**: [github.com/adapticai/wundr](https://github.com/adapticai/wundr)
- **Issues**: [github.com/adapticai/wundr/issues](https://github.com/adapticai/wundr/issues)
- **Email**: support@wundr.io

---

For more detailed endpoint documentation, explore the sections above or use our interactive API explorer.