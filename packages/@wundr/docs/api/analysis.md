---
sidebar_position: 2
title: Analysis API
description: Deep code analysis, pattern detection, and quality metrics API
keywords: [analysis, code-quality, metrics, patterns, technical-debt]
---

# Analysis API

The Analysis API provides comprehensive code analysis capabilities including quality metrics, pattern detection, dependency scanning, duplicate code identification, and technical debt assessment.

## Base URL

```
https://api.wundr.io/v1/analysis
```

## Overview

The Analysis API processes codebases to provide insights into:

- **Code Quality** - Complexity, maintainability, and quality scores
- **Pattern Detection** - Anti-patterns, design patterns, and code smells
- **Dependencies** - Dependency graphs, circular dependencies, unused imports
- **Duplicates** - Code duplication analysis and consolidation suggestions
- **Security** - Vulnerability scanning and security best practices
- **Performance** - Performance bottlenecks and optimization opportunities

## Authentication

All endpoints require authentication with a valid API key:

```bash
Authorization: Bearer wundr_ak_1234567890abcdef
```

## Endpoints

### List Projects

List all analyzed projects for the authenticated user.

```http
GET /analysis/projects
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | integer | No | Page number (default: 1) |
| `per_page` | integer | No | Items per page (default: 20, max: 100) |
| `status` | string | No | Filter by status: `pending`, `running`, `completed`, `failed` |
| `language` | string | No | Filter by language: `javascript`, `typescript`, `python`, etc. |
| `sort` | string | No | Sort by: `created_at`, `updated_at`, `name`, `score` |
| `order` | string | No | Sort order: `asc`, `desc` (default: `desc`) |

#### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "proj_abc123",
      "name": "my-awesome-project",
      "description": "A sample Node.js project",
      "language": "typescript",
      "status": "completed",
      "created_at": "2024-09-16T10:00:00Z",
      "updated_at": "2024-09-16T10:30:00Z",
      "metrics": {
        "quality_score": 8.5,
        "maintainability": "high",
        "complexity": "medium",
        "files_analyzed": 245,
        "lines_of_code": 15420
      },
      "repository": {
        "url": "https://github.com/user/my-awesome-project",
        "branch": "main",
        "commit": "abc123def456"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total_pages": 3,
    "total_items": 52,
    "has_next": true,
    "has_prev": false
  }
}
```

### Start Analysis

Initiate a new code analysis for a project.

```http
POST /analysis/run
```

#### Request Body

```json
{
  "project": {
    "name": "my-project",
    "description": "Project description",
    "repository": {
      "url": "https://github.com/user/repo",
      "branch": "main",
      "access_token": "ghp_xxxxxxxxxxxx"
    }
  },
  "config": {
    "rules": [
      "complexity",
      "duplicates",
      "dependencies",
      "security",
      "performance"
    ],
    "languages": ["typescript", "javascript"],
    "exclude_patterns": [
      "node_modules/**",
      "dist/**",
      "*.test.ts"
    ],
    "complexity_threshold": 10,
    "duplicate_threshold": 0.8
  },
  "options": {
    "deep_analysis": true,
    "generate_report": true,
    "notify_webhook": "https://your-app.com/webhook"
  }
}
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `project.name` | string | Yes | Project name |
| `project.repository.url` | string | Yes | Repository URL |
| `project.repository.branch` | string | No | Branch name (default: main) |
| `config.rules` | array | No | Analysis rules to apply |
| `config.languages` | array | No | Languages to analyze |
| `config.exclude_patterns` | array | No | File patterns to exclude |
| `options.deep_analysis` | boolean | No | Enable comprehensive analysis |

#### Response

```json
{
  "success": true,
  "data": {
    "analysis_id": "analysis_xyz789",
    "project_id": "proj_abc123",
    "status": "pending",
    "estimated_completion": "2024-09-16T10:45:00Z",
    "created_at": "2024-09-16T10:30:00Z",
    "webhook_url": "https://your-app.com/webhook"
  }
}
```

### Get Analysis Results

Retrieve detailed results for a completed analysis.

```http
GET /analysis/{analysis_id}/results
```

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `analysis_id` | string | Yes | Analysis ID |

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `format` | string | No | Response format: `json`, `xml`, `csv` |
| `sections` | string | No | Comma-separated sections: `overview,quality,dependencies,duplicates` |
| `include_files` | boolean | No | Include file-level details |

#### Response

```json
{
  "success": true,
  "data": {
    "analysis_id": "analysis_xyz789",
    "project_id": "proj_abc123",
    "status": "completed",
    "started_at": "2024-09-16T10:30:00Z",
    "completed_at": "2024-09-16T10:42:00Z",
    "duration_seconds": 720,
    "overview": {
      "quality_score": 8.5,
      "maintainability_index": 85,
      "technical_debt_ratio": 0.12,
      "test_coverage": 78.5,
      "files_analyzed": 245,
      "lines_of_code": 15420,
      "languages": {
        "typescript": 12850,
        "javascript": 2570
      }
    },
    "quality": {
      "complexity": {
        "average": 3.2,
        "maximum": 15,
        "high_complexity_files": 8,
        "threshold": 10,
        "distribution": {
          "low": 220,
          "medium": 17,
          "high": 8
        }
      },
      "maintainability": {
        "score": 85,
        "grade": "A",
        "issues": [
          {
            "type": "long_method",
            "file": "src/services/UserService.ts",
            "line": 42,
            "severity": "medium",
            "message": "Method 'processUserData' is too long (78 lines)"
          }
        ]
      },
      "code_smells": {
        "total": 23,
        "by_severity": {
          "critical": 2,
          "major": 8,
          "minor": 13
        },
        "top_issues": [
          {
            "type": "duplicate_code",
            "count": 5,
            "files": ["src/utils/validation.ts", "src/utils/helpers.ts"]
          }
        ]
      }
    },
    "dependencies": {
      "total": 156,
      "direct": 42,
      "devDependencies": 35,
      "outdated": 8,
      "vulnerable": 2,
      "circular": [
        {
          "cycle": ["src/auth/index.ts", "src/user/service.ts", "src/auth/middleware.ts"],
          "severity": "high"
        }
      ],
      "unused": [
        "lodash",
        "moment"
      ]
    },
    "duplicates": {
      "total_blocks": 12,
      "similarity_threshold": 0.8,
      "potential_savings": {
        "lines": 340,
        "percentage": 2.2
      },
      "duplicated_files": [
        {
          "files": ["src/components/Button.tsx", "src/components/Link.tsx"],
          "similarity": 0.92,
          "lines": 45,
          "suggestion": "Extract common interface"
        }
      ]
    },
    "security": {
      "vulnerabilities": {
        "critical": 0,
        "high": 1,
        "medium": 3,
        "low": 5
      },
      "issues": [
        {
          "type": "sql_injection",
          "file": "src/database/queries.ts",
          "line": 156,
          "severity": "high",
          "cwe": "CWE-89",
          "description": "Potential SQL injection vulnerability"
        }
      ]
    },
    "performance": {
      "bottlenecks": [
        {
          "type": "n_plus_one",
          "file": "src/resolvers/UserResolver.ts",
          "line": 89,
          "impact": "high",
          "suggestion": "Use DataLoader for batch requests"
        }
      ],
      "optimization_opportunities": 15
    }
  }
}
```

### Get Analysis Status

Check the status of a running analysis.

```http
GET /analysis/{analysis_id}/status
```

#### Response

```json
{
  "success": true,
  "data": {
    "analysis_id": "analysis_xyz789",
    "status": "running",
    "progress": {
      "percentage": 65,
      "current_stage": "dependency_analysis",
      "stages": [
        { "name": "file_discovery", "status": "completed", "duration_ms": 1200 },
        { "name": "parsing", "status": "completed", "duration_ms": 15400 },
        { "name": "quality_analysis", "status": "completed", "duration_ms": 42300 },
        { "name": "dependency_analysis", "status": "running", "started_at": "2024-09-16T10:38:00Z" },
        { "name": "duplicate_detection", "status": "pending" },
        { "name": "security_scan", "status": "pending" },
        { "name": "report_generation", "status": "pending" }
      ]
    },
    "estimated_completion": "2024-09-16T10:45:00Z",
    "files_processed": 160,
    "files_total": 245
  }
}
```

### Cancel Analysis

Cancel a running analysis.

```http
DELETE /analysis/{analysis_id}
```

#### Response

```json
{
  "success": true,
  "data": {
    "analysis_id": "analysis_xyz789",
    "status": "cancelled",
    "cancelled_at": "2024-09-16T10:35:00Z",
    "refund_credits": 15
  }
}
```

### Get Quality Metrics

Retrieve aggregated quality metrics across projects.

```http
GET /analysis/metrics
```

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `project_ids` | string | No | Comma-separated project IDs |
| `date_from` | string | No | Start date (ISO 8601) |
| `date_to` | string | No | End date (ISO 8601) |
| `granularity` | string | No | Time granularity: `day`, `week`, `month` |

#### Response

```json
{
  "success": true,
  "data": {
    "aggregated_metrics": {
      "average_quality_score": 8.2,
      "total_projects": 25,
      "total_lines_analyzed": 2450000,
      "improvement_trend": 0.15
    },
    "trends": [
      {
        "date": "2024-09-01",
        "quality_score": 7.8,
        "maintainability": 82,
        "complexity": 3.5
      },
      {
        "date": "2024-09-15",
        "quality_score": 8.2,
        "maintainability": 85,
        "complexity": 3.2
      }
    ],
    "top_issues": [
      {
        "type": "high_complexity",
        "count": 45,
        "trend": "decreasing"
      },
      {
        "type": "duplicate_code",
        "count": 23,
        "trend": "stable"
      }
    ]
  }
}
```

## Code Examples

### Node.js/TypeScript

```typescript
import { WundrClient } from '@wundr/sdk';

const client = new WundrClient({
  apiKey: process.env.WUNDR_API_KEY
});

// Start analysis
const analysis = await client.analysis.run({
  project: {
    name: 'my-project',
    repository: {
      url: 'https://github.com/user/repo',
      branch: 'main'
    }
  },
  config: {
    rules: ['complexity', 'duplicates', 'security']
  }
});

// Poll for completion
const results = await client.analysis.waitForCompletion(analysis.analysis_id);
console.log('Quality Score:', results.overview.quality_score);
```

### Python

```python
from wundr_sdk import WundrClient

client = WundrClient(api_key=os.getenv('WUNDR_API_KEY'))

# Start analysis
analysis = client.analysis.run(
    project={
        'name': 'my-project',
        'repository': {
            'url': 'https://github.com/user/repo',
            'branch': 'main'
        }
    },
    config={
        'rules': ['complexity', 'duplicates', 'security']
    }
)

# Get results
results = client.analysis.get_results(analysis['analysis_id'])
print(f"Quality Score: {results['overview']['quality_score']}")
```

### cURL

```bash
# Start analysis
curl -X POST https://api.wundr.io/v1/analysis/run \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "project": {
      "name": "my-project",
      "repository": {
        "url": "https://github.com/user/repo"
      }
    },
    "config": {
      "rules": ["complexity", "duplicates"]
    }
  }'

# Check status
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://api.wundr.io/v1/analysis/analysis_xyz789/status

# Get results
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://api.wundr.io/v1/analysis/analysis_xyz789/results
```

## Error Codes

| Code | Description | Resolution |
|------|-------------|------------|
| `INVALID_REPOSITORY` | Repository URL is invalid or inaccessible | Check repository URL and access permissions |
| `ANALYSIS_FAILED` | Analysis failed due to parsing errors | Review excluded patterns and file structure |
| `RATE_LIMITED` | Too many concurrent analyses | Wait and retry or upgrade plan |
| `INSUFFICIENT_CREDITS` | Not enough analysis credits | Purchase additional credits |
| `UNSUPPORTED_LANGUAGE` | Language not supported | Check supported languages list |

## Webhooks

The Analysis API supports webhooks for real-time notifications:

### Events

- `analysis.started` - Analysis has begun
- `analysis.progress` - Progress update (every 25%)
- `analysis.completed` - Analysis finished successfully
- `analysis.failed` - Analysis failed with errors
- `analysis.cancelled` - Analysis was cancelled

### Payload Example

```json
{
  "event": "analysis.completed",
  "analysis_id": "analysis_xyz789",
  "project_id": "proj_abc123",
  "timestamp": "2024-09-16T10:42:00Z",
  "data": {
    "quality_score": 8.5,
    "duration_seconds": 720,
    "files_analyzed": 245,
    "issues_found": 23
  }
}
```

## Best Practices

### Performance Optimization

1. **Use Selective Rules**: Only enable rules you need
2. **Exclude Unnecessary Files**: Use exclude_patterns effectively
3. **Batch Multiple Projects**: Use batch API for multiple analyses
4. **Cache Results**: Store results for incremental analyses

### Configuration Tips

1. **Set Appropriate Thresholds**: Adjust complexity and duplicate thresholds for your team
2. **Language-Specific Rules**: Enable rules relevant to your tech stack
3. **Incremental Analysis**: Analyze only changed files for faster feedback
4. **Webhook Integration**: Use webhooks for real-time notifications

## Rate Limits

| Plan | Concurrent Analyses | Daily Analyses | File Size Limit |
|------|-------------------|----------------|-----------------|
| **Free** | 1 | 10 | 100MB |
| **Pro** | 3 | 100 | 500MB |
| **Team** | 10 | 1,000 | 2GB |
| **Enterprise** | 50 | Unlimited | 10GB |

## Next Steps

- **[Batch Processing API](/api/batches)** - Process multiple analyses
- **[Reports API](/api/reports)** - Generate analysis reports
- **[Webhooks Guide](/guides/webhooks)** - Real-time notifications
- **[Integration Guide](/guides/ci-cd)** - CI/CD pipeline integration