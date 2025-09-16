---
sidebar_position: 3
title: Batches API
description: Batch processing API for large-scale operations and parallel execution
keywords: [batches, parallel, queue, bulk-operations, async]
---

# Batches API

The Batches API enables efficient processing of multiple operations in parallel, perfect for large-scale code analysis, bulk refactoring, and automated workflows across multiple projects.

## Base URL

```
https://api.wundr.io/v1/batches
```

## Overview

The Batches API provides:

- **Parallel Processing** - Execute multiple analyses simultaneously
- **Queue Management** - Priority-based job scheduling
- **Progress Tracking** - Real-time status updates for all jobs
- **Result Aggregation** - Consolidated reports across multiple projects
- **Resource Optimization** - Intelligent resource allocation
- **Failure Handling** - Robust error recovery and retry mechanisms

## Endpoints

### Create Batch Job

Create a new batch job with multiple operations.

```http
POST /batches
```

#### Request Body

```json
{
  "name": "Q3 Codebase Analysis",
  "description": "Analyze all frontend projects for Q3 review",
  "type": "analysis",
  "priority": "high",
  "jobs": [
    {
      "id": "job_1",
      "type": "analysis",
      "config": {
        "project": {
          "name": "frontend-app",
          "repository": {
            "url": "https://github.com/company/frontend-app",
            "branch": "main"
          }
        },
        "rules": ["complexity", "duplicates", "security"]
      }
    },
    {
      "id": "job_2",
      "type": "analysis",
      "config": {
        "project": {
          "name": "admin-dashboard",
          "repository": {
            "url": "https://github.com/company/admin-dashboard",
            "branch": "develop"
          }
        },
        "rules": ["performance", "accessibility"]
      }
    }
  ],
  "options": {
    "max_parallel": 5,
    "timeout_minutes": 60,
    "retry_failed": true,
    "notification": {
      "webhook": "https://your-app.com/batch-webhook",
      "email": "team@company.com"
    },
    "output": {
      "format": "json",
      "include_raw": false,
      "aggregate_report": true
    }
  }
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "batch_id": "batch_abc123",
    "name": "Q3 Codebase Analysis",
    "status": "queued",
    "created_at": "2024-09-16T10:30:00Z",
    "estimated_completion": "2024-09-16T11:45:00Z",
    "jobs": {
      "total": 2,
      "queued": 2,
      "running": 0,
      "completed": 0,
      "failed": 0
    },
    "priority": "high",
    "webhook_url": "https://your-app.com/batch-webhook"
  }
}
```

### Get Batch Status

Retrieve current status and progress of a batch job.

```http
GET /batches/{batch_id}
```

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `include_jobs` | boolean | No | Include individual job details |
| `job_status` | string | No | Filter jobs by status |

#### Response

```json
{
  "success": true,
  "data": {
    "batch_id": "batch_abc123",
    "name": "Q3 Codebase Analysis",
    "status": "running",
    "created_at": "2024-09-16T10:30:00Z",
    "started_at": "2024-09-16T10:32:00Z",
    "progress": {
      "percentage": 65,
      "current_jobs": ["job_1"],
      "completed_jobs": ["job_2"],
      "failed_jobs": [],
      "estimated_remaining": "00:25:30"
    },
    "jobs": {
      "total": 2,
      "queued": 0,
      "running": 1,
      "completed": 1,
      "failed": 0
    },
    "resource_usage": {
      "cpu_cores": 4,
      "memory_gb": 8,
      "credits_used": 45,
      "credits_estimated": 70
    },
    "individual_jobs": [
      {
        "id": "job_1",
        "type": "analysis",
        "status": "running",
        "progress": 75,
        "started_at": "2024-09-16T10:32:00Z",
        "project_name": "frontend-app"
      },
      {
        "id": "job_2",
        "type": "analysis",
        "status": "completed",
        "progress": 100,
        "started_at": "2024-09-16T10:32:00Z",
        "completed_at": "2024-09-16T10:48:00Z",
        "project_name": "admin-dashboard",
        "quality_score": 8.2
      }
    ]
  }
}
```

### List Batch Jobs

List all batch jobs for the authenticated user.

```http
GET /batches
```

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `status` | string | No | Filter by status: `queued`, `running`, `completed`, `failed`, `cancelled` |
| `type` | string | No | Filter by type: `analysis`, `refactor`, `report` |
| `priority` | string | No | Filter by priority: `low`, `medium`, `high`, `urgent` |
| `page` | integer | No | Page number |
| `per_page` | integer | No | Items per page (max 100) |
| `sort` | string | No | Sort by: `created_at`, `started_at`, `priority`, `name` |

#### Response

```json
{
  "success": true,
  "data": [
    {
      "batch_id": "batch_abc123",
      "name": "Q3 Codebase Analysis",
      "type": "analysis",
      "status": "completed",
      "priority": "high",
      "created_at": "2024-09-16T10:30:00Z",
      "completed_at": "2024-09-16T11:25:00Z",
      "duration_minutes": 55,
      "jobs_summary": {
        "total": 5,
        "completed": 4,
        "failed": 1
      },
      "results_available": true
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total_pages": 3,
    "total_items": 47
  }
}
```

### Get Batch Results

Download aggregated results from a completed batch job.

```http
GET /batches/{batch_id}/results
```

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `format` | string | No | Output format: `json`, `csv`, `xlsx`, `pdf` |
| `include_raw` | boolean | No | Include raw job outputs |
| `jobs` | string | No | Comma-separated job IDs to include |

#### Response

```json
{
  "success": true,
  "data": {
    "batch_id": "batch_abc123",
    "name": "Q3 Codebase Analysis",
    "completed_at": "2024-09-16T11:25:00Z",
    "summary": {
      "projects_analyzed": 5,
      "total_files": 1250,
      "total_lines": 87500,
      "average_quality_score": 7.8,
      "critical_issues": 12,
      "recommendations": 45
    },
    "aggregated_metrics": {
      "complexity": {
        "average": 3.4,
        "distribution": {
          "low": 80,
          "medium": 15,
          "high": 5
        }
      },
      "maintainability": {
        "average_score": 82,
        "projects_by_grade": {
          "A": 2,
          "B": 2,
          "C": 1,
          "D": 0,
          "F": 0
        }
      },
      "security": {
        "vulnerabilities": {
          "critical": 2,
          "high": 8,
          "medium": 15,
          "low": 23
        }
      }
    },
    "project_results": [
      {
        "job_id": "job_1",
        "project_name": "frontend-app",
        "status": "completed",
        "quality_score": 8.5,
        "files_analyzed": 245,
        "issues_found": 18,
        "top_issues": [
          {
            "type": "high_complexity",
            "count": 3,
            "severity": "medium"
          }
        ]
      }
    ],
    "recommendations": [
      {
        "type": "consolidation",
        "description": "Consider consolidating duplicate utility functions across projects",
        "affected_projects": ["frontend-app", "admin-dashboard"],
        "potential_savings": "150 lines"
      }
    ],
    "download_links": {
      "full_report": "https://api.wundr.io/v1/downloads/batch_abc123_report.pdf",
      "raw_data": "https://api.wundr.io/v1/downloads/batch_abc123_data.zip",
      "excel_summary": "https://api.wundr.io/v1/downloads/batch_abc123_summary.xlsx"
    }
  }
}
```

### Cancel Batch Job

Cancel a queued or running batch job.

```http
DELETE /batches/{batch_id}
```

#### Request Body (Optional)

```json
{
  "reason": "Priority changed",
  "cancel_running_jobs": true,
  "refund_unused_credits": true
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "batch_id": "batch_abc123",
    "status": "cancelled",
    "cancelled_at": "2024-09-16T10:45:00Z",
    "jobs_cancelled": 3,
    "jobs_completed": 2,
    "credits_refunded": 25,
    "partial_results_available": true
  }
}
```

### Retry Failed Jobs

Retry failed jobs within a batch.

```http
POST /batches/{batch_id}/retry
```

#### Request Body

```json
{
  "job_ids": ["job_3", "job_5"],
  "max_retries": 2,
  "retry_delay_minutes": 5
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "batch_id": "batch_abc123",
    "jobs_retried": 2,
    "new_batch_id": "batch_def456",
    "estimated_completion": "2024-09-16T12:15:00Z"
  }
}
```

## Batch Templates

### Analysis Batch

```json
{
  "name": "Multi-Project Analysis",
  "type": "analysis",
  "jobs": [
    {
      "id": "proj_{{i}}",
      "type": "analysis",
      "config": {
        "project": {
          "name": "{{project_name}}",
          "repository": {
            "url": "{{repo_url}}",
            "branch": "{{branch}}"
          }
        },
        "rules": ["complexity", "duplicates", "security", "performance"]
      }
    }
  ],
  "options": {
    "max_parallel": 10,
    "timeout_minutes": 90,
    "aggregate_report": true
  }
}
```

### Refactoring Batch

```json
{
  "name": "Code Standardization",
  "type": "refactor",
  "jobs": [
    {
      "id": "refactor_{{i}}",
      "type": "pattern_standardize",
      "config": {
        "project_id": "{{project_id}}",
        "patterns": ["error_handling", "imports", "naming"],
        "auto_apply": false
      }
    }
  ],
  "options": {
    "max_parallel": 3,
    "require_approval": true
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

// Create batch analysis
const batch = await client.batches.create({
  name: 'Monthly Code Review',
  type: 'analysis',
  jobs: repositories.map((repo, i) => ({
    id: `job_${i}`,
    type: 'analysis',
    config: {
      project: {
        name: repo.name,
        repository: { url: repo.url }
      },
      rules: ['complexity', 'security']
    }
  })),
  options: {
    max_parallel: 5,
    aggregate_report: true
  }
});

// Monitor progress
const status = await client.batches.waitForCompletion(batch.batch_id, {
  onProgress: (progress) => {
    console.log(`Progress: ${progress.percentage}%`);
  }
});

// Get results
const results = await client.batches.getResults(batch.batch_id);
console.log(`Average quality score: ${results.summary.average_quality_score}`);
```

### Python

```python
from wundr_sdk import WundrClient

client = WundrClient(api_key=os.getenv('WUNDR_API_KEY'))

# Create batch job
batch = client.batches.create(
    name='Team Analysis Batch',
    type='analysis',
    jobs=[
        {
            'id': f'job_{i}',
            'type': 'analysis',
            'config': {
                'project': {
                    'name': repo['name'],
                    'repository': {'url': repo['url']}
                },
                'rules': ['complexity', 'duplicates']
            }
        }
        for i, repo in enumerate(repositories)
    ],
    options={
        'max_parallel': 3,
        'timeout_minutes': 120
    }
)

# Check status
status = client.batches.get_status(batch['batch_id'])
print(f"Status: {status['status']}, Progress: {status['progress']['percentage']}%")
```

### CLI

```bash
# Create batch from file
wundr batch create --config batch-config.json

# Monitor batch
wundr batch status batch_abc123 --watch

# Get results
wundr batch results batch_abc123 --format xlsx --output ./reports/

# Cancel batch
wundr batch cancel batch_abc123 --reason "Emergency deployment"
```

## Webhook Events

The Batches API sends webhooks for key events:

### Events

- `batch.created` - New batch job created
- `batch.started` - Batch processing began
- `batch.progress` - Progress update (every 25%)
- `batch.job_completed` - Individual job finished
- `batch.completed` - All jobs finished
- `batch.failed` - Batch failed
- `batch.cancelled` - Batch was cancelled

### Payload Example

```json
{
  "event": "batch.progress",
  "batch_id": "batch_abc123",
  "timestamp": "2024-09-16T10:45:00Z",
  "data": {
    "progress": {
      "percentage": 75,
      "jobs_completed": 3,
      "jobs_running": 1,
      "jobs_remaining": 1
    },
    "recent_completion": {
      "job_id": "job_3",
      "project_name": "api-service",
      "quality_score": 7.9
    }
  }
}
```

## Error Handling

### Common Error Codes

| Code | Description | Resolution |
|------|-------------|------------|
| `BATCH_SIZE_EXCEEDED` | Too many jobs in batch | Split into smaller batches |
| `INSUFFICIENT_RESOURCES` | Not enough compute resources | Reduce max_parallel or upgrade plan |
| `INVALID_JOB_CONFIG` | Job configuration error | Validate individual job configs |
| `TIMEOUT_EXCEEDED` | Batch took too long | Increase timeout or optimize jobs |
| `QUOTA_EXCEEDED` | Monthly batch limit reached | Upgrade plan or wait for reset |

### Retry Strategy

```typescript
const retryConfig = {
  maxRetries: 3,
  backoffStrategy: 'exponential',
  retryableErrors: ['TIMEOUT_EXCEEDED', 'RESOURCE_UNAVAILABLE'],
  onRetry: (attempt, error) => {
    console.log(`Retry attempt ${attempt}: ${error.message}`);
  }
};

const batch = await client.batches.create(config, { retry: retryConfig });
```

## Best Practices

### Performance Optimization

1. **Right-size Batches**: 5-20 jobs per batch for optimal throughput
2. **Parallel Limits**: Set max_parallel based on your plan limits
3. **Job Grouping**: Group similar jobs together for resource efficiency
4. **Timeout Management**: Set realistic timeouts based on project size

### Resource Management

1. **Priority Queuing**: Use priority levels for urgent analyses
2. **Off-peak Scheduling**: Schedule large batches during off-peak hours
3. **Resource Monitoring**: Monitor credit usage and resource consumption
4. **Incremental Processing**: Use incremental analysis for frequently updated projects

### Error Recovery

1. **Automatic Retries**: Enable retry_failed for transient errors
2. **Partial Results**: Configure to save partial results on failure
3. **Monitoring**: Set up webhooks for real-time failure notifications
4. **Graceful Degradation**: Handle individual job failures gracefully

## Rate Limits

| Plan | Concurrent Batches | Max Jobs/Batch | Daily Batches |
|------|-------------------|----------------|---------------|
| **Free** | 1 | 5 | 3 |
| **Pro** | 3 | 20 | 25 |
| **Team** | 10 | 100 | 200 |
| **Enterprise** | 50 | 1000 | Unlimited |

## Next Steps

- **[Analysis API](/api/analysis)** - Individual analysis operations
- **[Reports API](/api/reports)** - Generate batch reports
- **[Queue Management Guide](/guides/batch-processing)** - Advanced batch strategies
- **[CI/CD Integration](/guides/ci-cd)** - Automated batch workflows