---
sidebar_position: 6
title: Reports API
description: Generate comprehensive analysis reports, dashboards, and automated reporting
keywords: [reports, analytics, dashboards, pdf, export, automation]
---

# Reports API

The Reports API enables generation of comprehensive analysis reports, executive dashboards, automated reporting workflows, and data export capabilities for stakeholder communication and compliance requirements.

## Base URL

```
https://api.wundr.io/v1/reports
```

## Overview

The Reports API provides:

- **Report Generation** - Create detailed analysis reports in multiple formats
- **Dashboard Analytics** - Interactive dashboards and visualizations
- **Scheduled Reports** - Automated report generation and delivery
- **Custom Templates** - Reusable report templates and branding
- **Data Export** - Export analysis data in various formats
- **Compliance Reports** - Industry-standard compliance reporting

## Endpoints

### Generate Report

Create a new report based on analysis data.

```http
POST /reports/generate
```

#### Request Body

```json
{
  "name": "Q3 Code Quality Assessment",
  "description": "Comprehensive code quality report for Q3 review",
  "type": "analysis_summary",
  "template_id": "tpl_executive_summary",
  "data_sources": {
    "projects": ["proj_abc123", "proj_def456", "proj_ghi789"],
    "analyses": ["analysis_xyz789", "analysis_uvw456"],
    "batches": ["batch_abc123"],
    "date_range": {
      "from": "2024-07-01T00:00:00Z",
      "to": "2024-09-30T23:59:59Z"
    }
  },
  "configuration": {
    "format": "pdf",
    "include_raw_data": false,
    "include_recommendations": true,
    "include_trends": true,
    "sections": [
      "executive_summary",
      "quality_metrics",
      "security_findings",
      "performance_analysis",
      "recommendations",
      "appendix"
    ],
    "aggregation": {
      "group_by": "project",
      "time_period": "weekly",
      "metrics": ["quality_score", "complexity", "test_coverage", "security_issues"]
    }
  },
  "customization": {
    "branding": {
      "logo_url": "https://company.com/logo.png",
      "company_name": "Acme Corporation",
      "color_scheme": "corporate"
    },
    "recipients": [
      {
        "name": "John Director",
        "email": "john.director@company.com",
        "role": "CTO"
      }
    ],
    "custom_sections": [
      {
        "title": "Technical Debt Analysis",
        "content": "custom_debt_analysis",
        "position": "after_quality_metrics"
      }
    ]
  },
  "delivery": {
    "email": {
      "enabled": true,
      "subject": "Q3 Code Quality Assessment Report",
      "message": "Please find attached the Q3 code quality assessment.",
      "recipients": ["john.director@company.com", "team-leads@company.com"]
    },
    "webhook": "https://your-app.com/reports-webhook",
    "download_expiry": "30d"
  }
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "report_id": "report_abc123",
    "name": "Q3 Code Quality Assessment",
    "status": "generating",
    "created_at": "2024-09-16T10:30:00Z",
    "estimated_completion": "2024-09-16T10:45:00Z",
    "template_used": "tpl_executive_summary",
    "format": "pdf",
    "generation_progress": {
      "percentage": 0,
      "current_stage": "data_collection",
      "stages": [
        "data_collection",
        "analysis_aggregation",
        "chart_generation",
        "template_rendering",
        "pdf_generation",
        "delivery"
      ]
    },
    "preview_available": false,
    "webhook_url": "https://your-app.com/reports-webhook"
  }
}
```

### Get Report Status

Check the generation status of a report.

```http
GET /reports/{report_id}/status
```

#### Response

```json
{
  "success": true,
  "data": {
    "report_id": "report_abc123",
    "name": "Q3 Code Quality Assessment",
    "status": "completed",
    "created_at": "2024-09-16T10:30:00Z",
    "completed_at": "2024-09-16T10:42:00Z",
    "generation_time_seconds": 720,
    "format": "pdf",
    "file_size": 2457600,
    "pages": 24,
    "sections_generated": [
      "executive_summary",
      "quality_metrics",
      "security_findings",
      "performance_analysis",
      "recommendations",
      "appendix"
    ],
    "data_summary": {
      "projects_analyzed": 3,
      "total_files": 1250,
      "total_lines": 125000,
      "issues_found": 342,
      "recommendations_generated": 15
    },
    "download_urls": {
      "pdf": "https://api.wundr.io/v1/downloads/report_abc123.pdf",
      "excel": "https://api.wundr.io/v1/downloads/report_abc123.xlsx",
      "json": "https://api.wundr.io/v1/downloads/report_abc123.json"
    },
    "delivered": {
      "email": true,
      "webhook": true,
      "download": true
    },
    "expires_at": "2024-10-16T10:42:00Z"
  }
}
```

### Download Report

Download a generated report.

```http
GET /reports/{report_id}/download
```

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `format` | string | No | Download format: `pdf`, `excel`, `json`, `csv` |
| `section` | string | No | Specific section to download |
| `attachment` | boolean | No | Force download as attachment |

#### Response

Binary file download with appropriate Content-Type headers.

### List Reports

Retrieve all reports for the authenticated user.

```http
GET /reports
```

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `status` | string | No | Filter by status: `generating`, `completed`, `failed`, `expired` |
| `type` | string | No | Filter by type: `analysis_summary`, `security_audit`, `performance_review` |
| `project_id` | string | No | Filter by project |
| `created_after` | string | No | Reports created after date |
| `created_before` | string | No | Reports created before date |
| `page` | integer | No | Page number |
| `per_page` | integer | No | Items per page (max 100) |
| `sort` | string | No | Sort by: `created_at`, `name`, `size`, `status` |

#### Response

```json
{
  "success": true,
  "data": [
    {
      "report_id": "report_abc123",
      "name": "Q3 Code Quality Assessment",
      "type": "analysis_summary",
      "status": "completed",
      "format": "pdf",
      "created_at": "2024-09-16T10:30:00Z",
      "completed_at": "2024-09-16T10:42:00Z",
      "file_size": 2457600,
      "pages": 24,
      "projects_covered": 3,
      "download_count": 5,
      "expires_at": "2024-10-16T10:42:00Z"
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

### Get Report Templates

List available report templates.

```http
GET /reports/templates
```

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `category` | string | No | Template category: `executive`, `technical`, `compliance` |
| `type` | string | No | Report type compatibility |
| `organization` | boolean | No | Include organization templates |

#### Response

```json
{
  "success": true,
  "data": [
    {
      "template_id": "tpl_executive_summary",
      "name": "Executive Summary",
      "description": "High-level overview for stakeholders and decision makers",
      "category": "executive",
      "compatible_types": ["analysis_summary", "security_audit"],
      "version": "2.1.0",
      "created_at": "2024-09-01T00:00:00Z",
      "author": {
        "type": "official",
        "name": "Wundr Team"
      },
      "features": [
        "Executive dashboard",
        "Key metrics visualization",
        "Risk assessment matrix",
        "Actionable recommendations",
        "Trend analysis"
      ],
      "sections": [
        "executive_summary",
        "key_metrics",
        "risk_assessment",
        "recommendations",
        "next_steps"
      ],
      "customization_options": [
        "branding",
        "color_schemes",
        "logo_placement",
        "custom_sections"
      ],
      "sample_url": "https://api.wundr.io/v1/templates/tpl_executive_summary/sample.pdf"
    },
    {
      "template_id": "tpl_technical_deep_dive",
      "name": "Technical Deep Dive",
      "description": "Comprehensive technical analysis for development teams",
      "category": "technical",
      "compatible_types": ["analysis_summary", "performance_review"],
      "version": "1.5.2"
    }
  ]
}
```

### Create Custom Template

Create a new report template.

```http
POST /reports/templates
```

#### Request Body

```json
{
  "name": "Custom Security Report",
  "description": "Specialized security assessment template",
  "category": "security",
  "base_template": "tpl_security_audit",
  "sections": [
    {
      "id": "security_overview",
      "title": "Security Overview",
      "type": "dashboard",
      "position": 1,
      "configuration": {
        "charts": ["vulnerability_trends", "risk_matrix"],
        "metrics": ["critical_issues", "remediation_time"]
      }
    },
    {
      "id": "vulnerability_details",
      "title": "Vulnerability Analysis",
      "type": "table",
      "position": 2,
      "configuration": {
        "columns": ["severity", "cwe", "file", "line", "description"],
        "group_by": "severity",
        "sort_by": "severity_desc"
      }
    }
  ],
  "styling": {
    "theme": "security",
    "colors": {
      "primary": "#d32f2f",
      "secondary": "#ff9800",
      "accent": "#4caf50"
    },
    "fonts": {
      "heading": "Arial Bold",
      "body": "Arial"
    }
  }
}
```

### Schedule Report

Create an automated report schedule.

```http
POST /reports/schedule
```

#### Request Body

```json
{
  "name": "Weekly Quality Report",
  "description": "Automated weekly code quality assessment",
  "report_config": {
    "type": "analysis_summary",
    "template_id": "tpl_executive_summary",
    "data_sources": {
      "projects": ["proj_abc123", "proj_def456"],
      "date_range": "last_week"
    },
    "format": "pdf"
  },
  "schedule": {
    "frequency": "weekly",
    "day_of_week": "monday",
    "time": "09:00",
    "timezone": "America/New_York"
  },
  "delivery": {
    "email": {
      "enabled": true,
      "recipients": ["team@company.com"],
      "subject": "Weekly Code Quality Report - {{date}}"
    },
    "webhook": "https://your-app.com/scheduled-reports"
  },
  "active": true,
  "start_date": "2024-09-23T00:00:00Z",
  "end_date": "2024-12-31T23:59:59Z"
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "schedule_id": "schedule_abc123",
    "name": "Weekly Quality Report",
    "status": "active",
    "next_execution": "2024-09-23T13:00:00Z",
    "created_at": "2024-09-16T11:00:00Z",
    "frequency": "weekly",
    "reports_generated": 0,
    "last_report": null
  }
}
```

### Get Report Analytics

Retrieve analytics and metrics about report usage.

```http
GET /reports/analytics
```

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `date_range` | string | No | Time period: `last_week`, `last_month`, `last_quarter` |
| `project_id` | string | No | Specific project analytics |
| `template_id` | string | No | Specific template analytics |

#### Response

```json
{
  "success": true,
  "data": {
    "period": "last_month",
    "summary": {
      "total_reports": 45,
      "reports_generated": 42,
      "reports_failed": 3,
      "total_downloads": 127,
      "unique_viewers": 23,
      "average_generation_time": 180
    },
    "trends": [
      {
        "date": "2024-09-01",
        "reports_generated": 3,
        "downloads": 8
      },
      {
        "date": "2024-09-02",
        "reports_generated": 2,
        "downloads": 5
      }
    ],
    "popular_templates": [
      {
        "template_id": "tpl_executive_summary",
        "usage_count": 15,
        "success_rate": 100
      },
      {
        "template_id": "tpl_technical_deep_dive",
        "usage_count": 12,
        "success_rate": 95
      }
    ],
    "format_distribution": {
      "pdf": 65,
      "excel": 25,
      "json": 10
    }
  }
}
```

## Report Types

### Analysis Summary

Comprehensive overview of code analysis results.

```json
{
  "type": "analysis_summary",
  "sections": [
    "executive_summary",
    "quality_metrics",
    "complexity_analysis",
    "test_coverage",
    "security_findings",
    "performance_metrics",
    "recommendations"
  ]
}
```

### Security Audit

Focused security assessment report.

```json
{
  "type": "security_audit",
  "sections": [
    "security_overview",
    "vulnerability_analysis",
    "dependency_security",
    "compliance_check",
    "remediation_plan"
  ]
}
```

### Performance Review

Performance-focused analysis report.

```json
{
  "type": "performance_review",
  "sections": [
    "performance_overview",
    "bottleneck_analysis",
    "optimization_opportunities",
    "benchmark_comparison"
  ]
}
```

### Compliance Report

Regulatory compliance assessment.

```json
{
  "type": "compliance_report",
  "sections": [
    "compliance_summary",
    "standards_assessment",
    "audit_trail",
    "remediation_requirements"
  ]
}
```

## Code Examples

### Node.js/TypeScript

```typescript
import { WundrClient } from '@wundr/sdk';

const client = new WundrClient({
  apiKey: process.env.WUNDR_API_KEY
});

// Generate comprehensive report
const report = await client.reports.generate({
  name: 'Monthly Quality Assessment',
  type: 'analysis_summary',
  templateId: 'tpl_executive_summary',
  dataSources: {
    projects: ['proj_abc123', 'proj_def456'],
    dateRange: {
      from: '2024-09-01T00:00:00Z',
      to: '2024-09-30T23:59:59Z'
    }
  },
  configuration: {
    format: 'pdf',
    includeRecommendations: true,
    sections: ['executive_summary', 'quality_metrics', 'recommendations']
  },
  delivery: {
    email: {
      enabled: true,
      recipients: ['team@company.com']
    }
  }
});

// Monitor report generation
const status = await client.reports.waitForCompletion(report.reportId, {
  onProgress: (progress) => {
    console.log(`Report generation: ${progress.percentage}%`);
  }
});

// Download completed report
const downloadUrl = await client.reports.getDownloadUrl(report.reportId, {
  format: 'pdf'
});

// Schedule automated reports
const schedule = await client.reports.schedule({
  name: 'Weekly Quality Report',
  reportConfig: {
    type: 'analysis_summary',
    templateId: 'tpl_executive_summary',
    dataSources: {
      projects: ['proj_abc123'],
      dateRange: 'last_week'
    }
  },
  schedule: {
    frequency: 'weekly',
    dayOfWeek: 'monday',
    time: '09:00'
  },
  delivery: {
    email: {
      recipients: ['management@company.com']
    }
  }
});
```

### Python

```python
from wundr_sdk import WundrClient

client = WundrClient(api_key=os.getenv('WUNDR_API_KEY'))

# Generate report
report = client.reports.generate(
    name='Security Assessment Report',
    type='security_audit',
    template_id='tpl_security_audit',
    data_sources={
        'projects': ['proj_abc123'],
        'date_range': {
            'from': '2024-09-01T00:00:00Z',
            'to': '2024-09-30T23:59:59Z'
        }
    },
    configuration={
        'format': 'pdf',
        'include_raw_data': False,
        'sections': ['security_overview', 'vulnerability_analysis']
    }
)

# Check status
status = client.reports.get_status(report['report_id'])
print(f"Report status: {status['status']}")

# Download when ready
if status['status'] == 'completed':
    download_url = client.reports.get_download_url(
        report['report_id'],
        format='pdf'
    )
    print(f"Download URL: {download_url}")
```

### CLI Commands

```bash
# Generate report
wundr reports generate --name "Q3 Assessment" \
  --type analysis_summary \
  --template tpl_executive_summary \
  --projects proj_abc123,proj_def456 \
  --format pdf \
  --email team@company.com

# Check report status
wundr reports status report_abc123

# Download report
wundr reports download report_abc123 --format pdf --output ./reports/

# List reports
wundr reports list --status completed --format table

# Schedule automated report
wundr reports schedule --name "Weekly Report" \
  --frequency weekly \
  --day monday \
  --time "09:00" \
  --email team@company.com

# Get report templates
wundr reports templates --category executive
```

## Webhook Events

### Report Events

- `report.generation_started` - Report generation began
- `report.generation_progress` - Progress update
- `report.generation_completed` - Report ready for download
- `report.generation_failed` - Generation failed
- `report.downloaded` - Report was downloaded
- `report.expired` - Report download expired

### Schedule Events

- `schedule.report_generated` - Scheduled report completed
- `schedule.report_failed` - Scheduled report failed
- `schedule.activated` - Report schedule activated
- `schedule.deactivated` - Report schedule deactivated

### Payload Example

```json
{
  "event": "report.generation_completed",
  "report_id": "report_abc123",
  "timestamp": "2024-09-16T10:42:00Z",
  "data": {
    "name": "Q3 Code Quality Assessment",
    "type": "analysis_summary",
    "format": "pdf",
    "file_size": 2457600,
    "pages": 24,
    "generation_time_seconds": 720,
    "download_urls": {
      "pdf": "https://api.wundr.io/v1/downloads/report_abc123.pdf"
    },
    "summary": {
      "projects_analyzed": 3,
      "issues_found": 342,
      "recommendations": 15
    }
  }
}
```

## Error Handling

### Common Error Codes

| Code | Description | Resolution |
|------|-------------|------------|
| `TEMPLATE_NOT_FOUND` | Report template doesn't exist | Use valid template ID |
| `INSUFFICIENT_DATA` | Not enough data for report | Ensure analysis data exists |
| `GENERATION_TIMEOUT` | Report generation timed out | Reduce data scope or retry |
| `TEMPLATE_INCOMPATIBLE` | Template not compatible with data | Use compatible template |
| `DELIVERY_FAILED` | Report delivery failed | Check email/webhook settings |

## Rate Limits

| Plan | Reports/Day | Scheduled Reports | Storage Days |
|------|-------------|-------------------|--------------|
| **Free** | 5 | 1 | 7 |
| **Pro** | 50 | 10 | 30 |
| **Team** | 200 | 50 | 90 |
| **Enterprise** | Unlimited | Unlimited | 365 |

## Best Practices

### Report Design

1. **Audience-Focused**: Tailor reports to specific audiences
2. **Clear Visualizations**: Use charts and graphs effectively
3. **Actionable Insights**: Include specific recommendations
4. **Consistent Branding**: Maintain visual consistency

### Performance Optimization

1. **Data Scoping**: Limit data range for faster generation
2. **Template Selection**: Choose appropriate template complexity
3. **Batch Generation**: Generate multiple reports together
4. **Caching**: Cache frequently generated reports

### Automation

1. **Regular Schedules**: Set up consistent reporting cadence
2. **Smart Delivery**: Target reports to relevant stakeholders
3. **Failure Handling**: Implement retry and notification logic
4. **Version Control**: Track template and configuration changes

## Next Steps

- **[Analysis API](/api/analysis)** - Source data for reports
- **[Dashboard Guide](/guides/dashboards)** - Interactive dashboards
- **[Report Templates](/guides/report-templates)** - Custom template creation
- **[Compliance Reporting](/guides/compliance)** - Regulatory compliance