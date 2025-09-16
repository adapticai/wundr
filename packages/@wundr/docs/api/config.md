---
sidebar_position: 4
title: Configuration API
description: Project settings, rules management, and configuration templates API
keywords: [configuration, settings, rules, templates, project-management]
---

# Configuration API

The Configuration API provides comprehensive management of project settings, analysis rules, coding standards, and configuration templates for consistent governance across your development workflow.

## Base URL

```
https://api.wundr.io/v1/config
```

## Overview

The Configuration API enables:

- **Project Configuration** - Centralized project settings management
- **Rule Management** - Custom analysis rules and coding standards
- **Template Library** - Reusable configuration templates
- **Team Standards** - Organization-wide coding conventions
- **Environment Configs** - Environment-specific settings
- **Validation** - Configuration validation and testing

## Endpoints

### Get Project Configuration

Retrieve the complete configuration for a specific project.

```http
GET /config/projects/{project_id}
```

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `project_id` | string | Yes | Project identifier |

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `environment` | string | No | Environment: `development`, `staging`, `production` |
| `include_inherited` | boolean | No | Include inherited organization settings |
| `format` | string | No | Response format: `json`, `yaml`, `toml` |

#### Response

```json
{
  "success": true,
  "data": {
    "project_id": "proj_abc123",
    "name": "frontend-app",
    "version": "2.1.0",
    "created_at": "2024-09-16T10:00:00Z",
    "updated_at": "2024-09-16T15:30:00Z",
    "environment": "production",
    "analysis": {
      "enabled": true,
      "rules": {
        "complexity": {
          "enabled": true,
          "threshold": 10,
          "severity": "warning",
          "exclude_patterns": ["*.test.ts", "*.spec.ts"]
        },
        "duplicates": {
          "enabled": true,
          "similarity_threshold": 0.8,
          "min_lines": 5,
          "ignore_comments": true
        },
        "security": {
          "enabled": true,
          "scan_dependencies": true,
          "fail_on_high": true,
          "whitelist": ["lodash", "react"]
        },
        "performance": {
          "enabled": false,
          "bundle_size_limit": "500kb",
          "runtime_checks": true
        }
      },
      "languages": {
        "typescript": {
          "enabled": true,
          "strict_mode": true,
          "no_any": "error",
          "prefer_const": "warning"
        },
        "javascript": {
          "enabled": true,
          "ecma_version": "es2022",
          "source_type": "module"
        }
      },
      "file_patterns": {
        "include": ["src/**/*.{ts,tsx,js,jsx}"],
        "exclude": [
          "node_modules/**",
          "dist/**",
          "build/**",
          "*.test.*",
          "*.spec.*"
        ]
      }
    },
    "refactoring": {
      "enabled": true,
      "auto_apply": false,
      "patterns": {
        "error_handling": {
          "enabled": true,
          "strategy": "try_catch_wrapper",
          "async_error_boundary": true
        },
        "imports": {
          "enabled": true,
          "organize": true,
          "remove_unused": true,
          "group_external": true
        },
        "naming_conventions": {
          "enabled": true,
          "variables": "camelCase",
          "functions": "camelCase",
          "classes": "PascalCase",
          "constants": "UPPER_SNAKE_CASE"
        }
      }
    },
    "quality_gates": {
      "enabled": true,
      "gates": {
        "quality_score": {
          "minimum": 7.5,
          "blocking": true
        },
        "test_coverage": {
          "minimum": 80,
          "blocking": false
        },
        "complexity": {
          "maximum": 15,
          "blocking": true
        },
        "duplicates": {
          "maximum_percentage": 5,
          "blocking": false
        }
      }
    },
    "notifications": {
      "webhook": "https://your-app.com/wundr-webhook",
      "email": {
        "enabled": true,
        "recipients": ["team@company.com"],
        "events": ["analysis_completed", "quality_gate_failed"]
      },
      "slack": {
        "enabled": true,
        "webhook_url": "https://hooks.slack.com/...",
        "channel": "#dev-quality"
      }
    },
    "inheritance": {
      "organization_id": "org_xyz789",
      "template_id": "tpl_react_standard",
      "overrides": ["analysis.rules.complexity.threshold"]
    }
  }
}
```

### Update Project Configuration

Update configuration settings for a project.

```http
PUT /config/projects/{project_id}
```

#### Request Body

```json
{
  "analysis": {
    "rules": {
      "complexity": {
        "threshold": 12,
        "severity": "error"
      },
      "security": {
        "fail_on_high": false
      }
    }
  },
  "quality_gates": {
    "gates": {
      "quality_score": {
        "minimum": 8.0
      }
    }
  },
  "notifications": {
    "email": {
      "recipients": ["team@company.com", "qa@company.com"]
    }
  }
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "project_id": "proj_abc123",
    "updated_at": "2024-09-16T16:00:00Z",
    "changes": [
      {
        "path": "analysis.rules.complexity.threshold",
        "old_value": 10,
        "new_value": 12
      },
      {
        "path": "quality_gates.gates.quality_score.minimum",
        "old_value": 7.5,
        "new_value": 8.0
      }
    ],
    "validation": {
      "valid": true,
      "warnings": [
        "Increased complexity threshold may reduce code quality detection"
      ]
    }
  }
}
```

### List Configuration Templates

Get available configuration templates.

```http
GET /config/templates
```

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `category` | string | No | Template category: `frontend`, `backend`, `mobile`, `data` |
| `language` | string | No | Primary language: `javascript`, `typescript`, `python`, etc. |
| `framework` | string | No | Framework: `react`, `vue`, `angular`, `express`, etc. |
| `level` | string | No | Strictness level: `basic`, `standard`, `strict` |
| `organization` | boolean | No | Include organization templates |

#### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "tpl_react_standard",
      "name": "React TypeScript Standard",
      "description": "Standard configuration for React TypeScript projects",
      "category": "frontend",
      "language": "typescript",
      "framework": "react",
      "level": "standard",
      "version": "1.2.0",
      "created_at": "2024-09-01T00:00:00Z",
      "usage_count": 1250,
      "rating": 4.7,
      "author": {
        "type": "official",
        "name": "Wundr Team"
      },
      "features": [
        "TypeScript strict mode",
        "React best practices",
        "ESLint + Prettier integration",
        "Performance optimizations",
        "Security scanning"
      ],
      "compatible_with": ["react@^18.0.0", "typescript@^5.0.0"]
    },
    {
      "id": "tpl_node_enterprise",
      "name": "Node.js Enterprise",
      "description": "Enterprise-grade configuration for Node.js applications",
      "category": "backend",
      "language": "javascript",
      "framework": "express",
      "level": "strict",
      "version": "2.0.1",
      "created_at": "2024-08-15T00:00:00Z",
      "usage_count": 890,
      "rating": 4.9,
      "author": {
        "type": "community",
        "name": "Enterprise JS Guild"
      }
    }
  ]
}
```

### Get Template Details

Retrieve detailed configuration template.

```http
GET /config/templates/{template_id}
```

#### Response

```json
{
  "success": true,
  "data": {
    "id": "tpl_react_standard",
    "name": "React TypeScript Standard",
    "description": "Standard configuration for React TypeScript projects with modern best practices",
    "metadata": {
      "category": "frontend",
      "language": "typescript",
      "framework": "react",
      "level": "standard",
      "version": "1.2.0",
      "min_wundr_version": "2.0.0"
    },
    "configuration": {
      "analysis": {
        "rules": {
          "complexity": {
            "enabled": true,
            "threshold": 8,
            "severity": "warning"
          },
          "duplicates": {
            "enabled": true,
            "similarity_threshold": 0.85
          },
          "security": {
            "enabled": true,
            "scan_dependencies": true,
            "react_security": true
          },
          "performance": {
            "enabled": true,
            "bundle_analysis": true,
            "render_optimization": true
          },
          "accessibility": {
            "enabled": true,
            "wcag_level": "AA",
            "jsx_a11y": true
          }
        },
        "languages": {
          "typescript": {
            "strict": true,
            "no_any": "error",
            "prefer_const": "error",
            "no_var": "error"
          },
          "jsx": {
            "react_version": "detect",
            "pragma": "React"
          }
        }
      },
      "quality_gates": {
        "quality_score": { "minimum": 8.0 },
        "test_coverage": { "minimum": 85 },
        "bundle_size": { "maximum": "300kb" }
      }
    },
    "documentation": {
      "readme": "# React TypeScript Standard Configuration\n\nThis template provides...",
      "changelog": "## v1.2.0\n- Added accessibility rules\n- Updated TypeScript strict mode",
      "migration_guide": "## Upgrading from v1.1.x\n..."
    }
  }
}
```

### Apply Template

Apply a configuration template to a project.

```http
POST /config/projects/{project_id}/apply-template
```

#### Request Body

```json
{
  "template_id": "tpl_react_standard",
  "template_version": "1.2.0",
  "merge_strategy": "override",
  "customizations": {
    "analysis.rules.complexity.threshold": 10,
    "quality_gates.gates.test_coverage.minimum": 90
  },
  "dry_run": false
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "project_id": "proj_abc123",
    "template_applied": "tpl_react_standard",
    "version": "1.2.0",
    "applied_at": "2024-09-16T16:30:00Z",
    "changes": {
      "added": [
        "analysis.rules.accessibility",
        "analysis.rules.performance.bundle_analysis"
      ],
      "modified": [
        "analysis.rules.complexity.threshold",
        "quality_gates.gates.quality_score.minimum"
      ],
      "removed": []
    },
    "validation": {
      "valid": true,
      "warnings": [],
      "compatibility_check": "passed"
    },
    "rollback_id": "rb_def456"
  }
}
```

### Validate Configuration

Validate a configuration without applying it.

```http
POST /config/validate
```

#### Request Body

```json
{
  "project_id": "proj_abc123",
  "configuration": {
    "analysis": {
      "rules": {
        "complexity": {
          "threshold": 50,
          "severity": "invalid_level"
        }
      }
    }
  }
}
```

#### Response

```json
{
  "success": false,
  "data": {
    "valid": false,
    "errors": [
      {
        "path": "analysis.rules.complexity.severity",
        "message": "Invalid severity level 'invalid_level'. Must be one of: info, warning, error",
        "code": "INVALID_ENUM_VALUE"
      },
      {
        "path": "analysis.rules.complexity.threshold",
        "message": "Threshold value 50 is unusually high. Consider values between 5-15",
        "code": "VALUE_OUT_OF_RANGE",
        "severity": "warning"
      }
    ],
    "warnings": [
      {
        "path": "analysis.rules.security",
        "message": "Security rules are not enabled. Consider enabling for production projects",
        "code": "RECOMMENDED_SETTING"
      }
    ],
    "suggestions": [
      {
        "path": "analysis.rules.performance",
        "message": "Consider enabling performance analysis for better optimization insights",
        "code": "FEATURE_SUGGESTION"
      }
    ]
  }
}
```

### Export Configuration

Export project configuration in various formats.

```http
GET /config/projects/{project_id}/export
```

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `format` | string | Yes | Export format: `json`, `yaml`, `toml`, `env` |
| `include_comments` | boolean | No | Include explanatory comments |
| `template_format` | boolean | No | Export as reusable template |

#### Response

```yaml
# Wundr Configuration Export
# Project: frontend-app
# Generated: 2024-09-16T16:45:00Z

analysis:
  enabled: true
  rules:
    complexity:
      enabled: true
      threshold: 10  # Maximum cyclomatic complexity
      severity: warning
    duplicates:
      enabled: true
      similarity_threshold: 0.8
      min_lines: 5
    security:
      enabled: true
      scan_dependencies: true
      fail_on_high: true

quality_gates:
  enabled: true
  gates:
    quality_score:
      minimum: 7.5
      blocking: true
```

## Organization Management

### Get Organization Configuration

```http
GET /config/organizations/{org_id}
```

### Update Organization Standards

```http
PUT /config/organizations/{org_id}/standards
```

### Manage Team Templates

```http
GET /config/organizations/{org_id}/templates
POST /config/organizations/{org_id}/templates
```

## Code Examples

### Node.js/TypeScript

```typescript
import { WundrClient } from '@wundr/sdk';

const client = new WundrClient({
  apiKey: process.env.WUNDR_API_KEY
});

// Get project configuration
const config = await client.config.getProject('proj_abc123');

// Apply template
await client.config.applyTemplate('proj_abc123', {
  templateId: 'tpl_react_standard',
  customizations: {
    'analysis.rules.complexity.threshold': 8
  }
});

// Update specific rules
await client.config.updateProject('proj_abc123', {
  analysis: {
    rules: {
      security: {
        enabled: true,
        failOnHigh: true
      }
    }
  }
});

// Validate before applying
const validation = await client.config.validate({
  projectId: 'proj_abc123',
  configuration: newConfig
});

if (!validation.valid) {
  console.error('Configuration errors:', validation.errors);
}
```

### Python

```python
from wundr_sdk import WundrClient

client = WundrClient(api_key=os.getenv('WUNDR_API_KEY'))

# Get configuration
config = client.config.get_project('proj_abc123')

# Apply template with customizations
client.config.apply_template(
    project_id='proj_abc123',
    template_id='tpl_react_standard',
    customizations={
        'analysis.rules.complexity.threshold': 8,
        'quality_gates.gates.test_coverage.minimum': 90
    }
)

# Update configuration
client.config.update_project('proj_abc123', {
    'analysis': {
        'rules': {
            'performance': {'enabled': True}
        }
    }
})
```

### CLI Commands

```bash
# Get project configuration
wundr config get proj_abc123 --format yaml

# Apply template
wundr config apply-template proj_abc123 tpl_react_standard \
  --customize "analysis.rules.complexity.threshold=8"

# Validate configuration
wundr config validate --project proj_abc123 --file ./wundr.config.yml

# Export configuration
wundr config export proj_abc123 --format yaml --output ./config/

# List available templates
wundr config templates --category frontend --language typescript
```

## Configuration Schema

### Rule Configuration

```typescript
interface RuleConfig {
  enabled: boolean;
  severity: 'info' | 'warning' | 'error';
  threshold?: number;
  excludePatterns?: string[];
  customOptions?: Record<string, any>;
}
```

### Quality Gates

```typescript
interface QualityGate {
  minimum?: number;
  maximum?: number;
  blocking: boolean;
  tolerance?: number;
  trend?: 'improving' | 'stable' | 'declining';
}
```

### Inheritance Model

```typescript
interface ConfigInheritance {
  organizationId?: string;
  templateId?: string;
  parentProjectId?: string;
  overrides: string[];  // Paths that override inherited values
  mergeStrategy: 'merge' | 'override' | 'inherit';
}
```

## Best Practices

### Configuration Management

1. **Start with Templates**: Use official templates as starting points
2. **Gradual Strictness**: Begin with lenient rules and tighten over time
3. **Team Alignment**: Ensure team consensus on coding standards
4. **Documentation**: Document custom rules and their rationale

### Template Creation

1. **Modular Design**: Create focused, composable templates
2. **Version Control**: Version templates and maintain changelogs
3. **Testing**: Test templates on sample projects before deployment
4. **Documentation**: Provide clear usage instructions and examples

### Organization Standards

1. **Consistent Baselines**: Establish organization-wide minimum standards
2. **Project Flexibility**: Allow project-specific customizations
3. **Regular Reviews**: Periodically review and update standards
4. **Training**: Ensure team understanding of configuration options

## Rate Limits

| Plan | Config Updates/Hour | Template Applications/Day | Custom Templates |
|------|-------------------|---------------------------|------------------|
| **Free** | 10 | 5 | 1 |
| **Pro** | 100 | 50 | 10 |
| **Team** | 500 | 200 | 100 |
| **Enterprise** | Unlimited | Unlimited | Unlimited |

## Next Steps

- **[Analysis API](/api/analysis)** - Run analysis with your configuration
- **[Template Library Guide](/guides/templates)** - Creating custom templates
- **[Team Governance](/guides/team-governance)** - Organization-wide standards
- **[Configuration Recipes](/guides/config-recipes)** - Common configuration patterns