# Template Customization Guide: Adapting Claude Flow for Your Projects

Complete guide to customizing templates, workflows, and configurations for different project types
with Claude Flow.

## Table of Contents

- [Template System Overview](#template-system-overview)
- [Built-in Templates](#built-in-templates)
- [Customizing Templates](#customizing-templates)
- [Creating Custom Templates](#creating-custom-templates)
- [Project-Specific Configurations](#project-specific-configurations)
- [Framework Templates](#framework-templates)
- [Real-World Examples](#real-world-examples)
- [Best Practices](#best-practices)

## Template System Overview

Claude Flow templates provide pre-configured setups for different project types, frameworks, and
workflows.

### Template Structure

```
.claude-flow/
├── templates/
│   ├── base/                  # Base template
│   ├── react/                 # React projects
│   ├── nodejs/                # Node.js backends
│   ├── python/                # Python projects
│   ├── monorepo/              # Monorepo setups
│   └── custom/                # Your custom templates
├── config.json                # Global configuration
├── agents.config.json         # Agent configuration
├── hooks.config.json          # Hook configuration
└── workflows/                 # Workflow definitions
```

### Template Components

1. **Configuration Files**: Project-specific settings
2. **Agent Assignments**: Which agents handle which files
3. **Hook Definitions**: Automated workflows
4. **Workflow Templates**: SPARC and custom workflows
5. **File Generators**: Boilerplate code generators
6. **Scripts**: Automation scripts

## Built-in Templates

### Base Template

The foundation for all other templates.

```bash
# Initialize with base template
npx claude-flow@alpha init --template base
```

**Includes**:

- Basic agent configuration
- Standard hooks (format, lint, test)
- Generic file patterns
- Default workflows

### React Template

Optimized for React applications.

```bash
# Initialize React project
npx claude-flow@alpha init --template react
```

**Features**:

```json
{
  "template": "react",
  "agents": {
    "component-dev": {
      "type": "coder",
      "specialization": "react",
      "files": ["**/*.tsx", "**/*.jsx"],
      "autoImport": true,
      "snippets": "react"
    },
    "style-dev": {
      "type": "coder",
      "files": ["**/*.css", "**/*.scss", "**/*.styled.ts"],
      "formatter": "prettier"
    },
    "tester": {
      "framework": "jest",
      "testRunner": "react-testing-library",
      "files": ["**/*.test.tsx", "**/*.spec.tsx"]
    }
  },
  "hooks": {
    "post-edit": ["format-jsx", "organize-imports", "check-prop-types"]
  },
  "workflows": {
    "component": "create-component-workflow",
    "hook": "create-hook-workflow",
    "page": "create-page-workflow"
  }
}
```

### Node.js Backend Template

For Express, NestJS, and other Node.js backends.

```bash
npx claude-flow@alpha init --template nodejs-backend
```

**Features**:

```json
{
  "template": "nodejs-backend",
  "agents": {
    "api-dev": {
      "type": "backend-dev",
      "specialization": "rest-api",
      "files": ["src/api/**/*.ts", "src/routes/**/*.ts"]
    },
    "db-dev": {
      "type": "backend-dev",
      "specialization": "database",
      "files": ["src/models/**/*.ts", "src/migrations/**/*.ts"]
    },
    "api-docs": {
      "type": "api-docs",
      "files": ["src/api/**/*.ts"],
      "format": "openapi-3.0"
    }
  },
  "hooks": {
    "post-edit-api": ["validate-openapi", "generate-client", "update-docs"],
    "post-edit-model": ["generate-migration", "update-schema"]
  }
}
```

### Python Template

For Python projects (Django, FastAPI, Flask).

```bash
npx claude-flow@alpha init --template python
```

**Features**:

```json
{
  "template": "python",
  "agents": {
    "python-dev": {
      "type": "coder",
      "language": "python",
      "files": ["**/*.py"],
      "linter": "ruff",
      "formatter": "black",
      "typeChecker": "mypy"
    },
    "tester": {
      "framework": "pytest",
      "coverage": { "minimum": 80 }
    }
  },
  "hooks": {
    "post-edit": ["format-black", "lint-ruff", "type-check-mypy", "sort-imports"]
  }
}
```

### Monorepo Template

For multi-package repositories.

```bash
npx claude-flow@alpha init --template monorepo
```

**Features**:

```json
{
  "template": "monorepo",
  "structure": {
    "packages": {
      "frontend": { "template": "react" },
      "backend": { "template": "nodejs-backend" },
      "shared": { "template": "base" }
    }
  },
  "agents": {
    "monorepo-coordinator": {
      "type": "hierarchical-coordinator",
      "manages": ["frontend", "backend", "shared"]
    }
  },
  "hooks": {
    "pre-commit": ["check-cross-package-deps", "validate-versions", "run-affected-tests"]
  }
}
```

### Microservices Template

For microservices architectures.

```bash
npx claude-flow@alpha init --template microservices
```

**Features**:

- Service-specific agents
- API gateway configuration
- Service discovery setup
- Inter-service testing
- Docker/Kubernetes configs

## Customizing Templates

### Modify Existing Template

```bash
# Copy template to customize
npx claude-flow@alpha template copy react my-react-template

# Edit configuration
nano .claude-flow/templates/my-react-template/config.json
```

### Template Configuration

Edit `.claude-flow/templates/my-react-template/config.json`:

```json
{
  "name": "my-react-template",
  "version": "1.0.0",
  "extends": "react",
  "description": "Custom React template with additional features",

  "agents": {
    "component-dev": {
      "type": "coder",
      "specialization": "react-typescript",
      "files": ["**/*.tsx"],
      "preferences": {
        "componentStyle": "functional",
        "stateManagement": "zustand",
        "styling": "tailwind"
      },
      "autoGenerate": {
        "storybook": true,
        "tests": true,
        "types": true
      }
    },
    "state-dev": {
      "type": "coder",
      "specialization": "state-management",
      "files": ["**/stores/**/*.ts"],
      "framework": "zustand"
    }
  },

  "hooks": {
    "post-create-component": ["generate-storybook", "generate-tests", "update-index"],
    "post-edit-component": ["format-code", "check-accessibility", "optimize-imports"]
  },

  "generators": {
    "component": {
      "template": "templates/component.tsx.hbs",
      "test": "templates/component.test.tsx.hbs",
      "story": "templates/component.stories.tsx.hbs"
    }
  },

  "workflows": {
    "feature": {
      "steps": ["create-component", "create-hook", "create-tests", "update-routes"]
    }
  }
}
```

### Agent Customization

Add custom agent configurations:

```json
{
  "agents": {
    "accessibility-checker": {
      "type": "reviewer",
      "specialization": "accessibility",
      "files": ["**/*.tsx"],
      "checks": ["aria-labels", "keyboard-navigation", "color-contrast", "semantic-html"],
      "autoFix": true
    },
    "performance-optimizer": {
      "type": "perf-analyzer",
      "files": ["**/*.tsx"],
      "checks": ["bundle-size", "render-performance", "memory-leaks"],
      "thresholds": {
        "bundleSize": "100kb",
        "renderTime": "16ms"
      }
    }
  }
}
```

### Hook Customization

Add custom hooks:

```json
{
  "hooks": {
    "post-create-component": {
      "enabled": true,
      "hooks": [
        {
          "name": "generate-storybook",
          "script": ".claude-flow/hooks/generate-storybook.js"
        },
        {
          "name": "generate-tests",
          "script": ".claude-flow/hooks/generate-tests.js"
        }
      ]
    },
    "pre-commit": {
      "enabled": true,
      "hooks": ["check-types", "check-accessibility", "check-bundle-size"]
    }
  }
}
```

## Creating Custom Templates

### Step 1: Create Template Structure

```bash
# Create template directory
mkdir -p .claude-flow/templates/my-template

# Create necessary files
touch .claude-flow/templates/my-template/config.json
touch .claude-flow/templates/my-template/agents.json
touch .claude-flow/templates/my-template/hooks.json
touch .claude-flow/templates/my-template/workflows.json
```

### Step 2: Define Template Configuration

`.claude-flow/templates/my-template/config.json`:

```json
{
  "name": "my-template",
  "version": "1.0.0",
  "description": "Custom template for my specific needs",
  "author": "Your Name",

  "requirements": {
    "node": ">=18.0.0",
    "npm": ">=9.0.0"
  },

  "structure": {
    "directories": ["src", "tests", "docs", "config"],
    "files": {
      "src/index.ts": "templates/index.ts.hbs",
      "tests/setup.ts": "templates/test-setup.ts.hbs",
      "README.md": "templates/README.md.hbs"
    }
  },

  "dependencies": {
    "required": ["typescript", "prettier", "eslint"],
    "optional": ["jest", "vitest"]
  },

  "scripts": {
    "build": "tsc",
    "test": "jest",
    "lint": "eslint .",
    "format": "prettier --write ."
  }
}
```

### Step 3: Define Agent Configuration

`.claude-flow/templates/my-template/agents.json`:

```json
{
  "defaults": {
    "timeout": 300000,
    "retries": 3
  },

  "agents": {
    "primary-coder": {
      "type": "coder",
      "files": ["src/**/*.ts"],
      "exclude": ["**/*.test.ts"],
      "config": {
        "autoFormat": true,
        "autoImport": true,
        "strictMode": true
      }
    },
    "test-writer": {
      "type": "tester",
      "files": ["tests/**/*.test.ts"],
      "config": {
        "framework": "jest",
        "coverage": true,
        "watch": false
      }
    },
    "doc-writer": {
      "type": "api-docs",
      "files": ["src/**/*.ts"],
      "config": {
        "format": "markdown",
        "includeExamples": true,
        "generateIndex": true
      }
    }
  },

  "teams": {
    "development": {
      "coordinator": "hierarchical-coordinator",
      "members": ["primary-coder", "test-writer", "doc-writer"]
    }
  }
}
```

### Step 4: Define Hooks

`.claude-flow/templates/my-template/hooks.json`:

```json
{
  "hooks": {
    "pre-task": {
      "enabled": true,
      "scripts": [".claude-flow/hooks/validate-env.js", ".claude-flow/hooks/load-context.js"]
    },
    "post-edit": {
      "enabled": true,
      "scripts": [
        ".claude-flow/hooks/format.js",
        ".claude-flow/hooks/lint.js",
        ".claude-flow/hooks/type-check.js"
      ]
    },
    "pre-commit": {
      "enabled": true,
      "scripts": [".claude-flow/hooks/run-tests.js", ".claude-flow/hooks/check-coverage.js"]
    }
  }
}
```

### Step 5: Define Workflows

`.claude-flow/templates/my-template/workflows.json`:

```json
{
  "workflows": {
    "feature": {
      "description": "Create new feature",
      "steps": [
        {
          "name": "specification",
          "agent": "planner",
          "action": "analyze-requirements"
        },
        {
          "name": "implementation",
          "agent": "primary-coder",
          "action": "implement-feature"
        },
        {
          "name": "testing",
          "agent": "test-writer",
          "action": "write-tests"
        },
        {
          "name": "documentation",
          "agent": "doc-writer",
          "action": "generate-docs"
        }
      ]
    },
    "bugfix": {
      "description": "Fix bug",
      "steps": [
        {
          "name": "reproduce",
          "agent": "test-writer",
          "action": "write-failing-test"
        },
        {
          "name": "fix",
          "agent": "primary-coder",
          "action": "fix-bug"
        },
        {
          "name": "verify",
          "agent": "test-writer",
          "action": "verify-fix"
        }
      ]
    }
  }
}
```

### Step 6: Create File Templates

`.claude-flow/templates/my-template/templates/index.ts.hbs`:

```typescript
/**
 * {{projectName}}
 * {{description}}
 */

export class {{className}} {
  constructor() {
    // TODO: Initialize
  }

  public async init(): Promise<void> {
    // TODO: Implement initialization
  }
}

export default new {{className}}();
```

### Step 7: Register Template

```bash
# Register custom template
npx claude-flow@alpha template register \
  --path .claude-flow/templates/my-template

# Verify registration
npx claude-flow@alpha template list --custom

# Use template
npx claude-flow@alpha init --template my-template
```

## Project-Specific Configurations

### Environment-Based Configuration

```json
{
  "environments": {
    "development": {
      "agents": {
        "coder": {
          "autoFormat": true,
          "autoTest": false
        }
      },
      "hooks": {
        "pre-commit": { "enabled": false }
      }
    },
    "staging": {
      "agents": {
        "coder": {
          "autoFormat": true,
          "autoTest": true
        }
      },
      "hooks": {
        "pre-commit": { "enabled": true }
      }
    },
    "production": {
      "agents": {
        "security-manager": { "required": true },
        "reviewer": { "minApprovals": 2 }
      },
      "hooks": {
        "pre-commit": {
          "enabled": true,
          "strict": true
        }
      }
    }
  }
}
```

### Team-Based Configuration

```json
{
  "teams": {
    "frontend": {
      "template": "react",
      "agents": ["component-dev", "style-dev", "tester"],
      "workingDirectory": "packages/frontend",
      "conventions": {
        "componentNaming": "PascalCase",
        "filePenaming": "kebab-case"
      }
    },
    "backend": {
      "template": "nodejs-backend",
      "agents": ["api-dev", "db-dev", "tester"],
      "workingDirectory": "packages/backend",
      "conventions": {
        "routeNaming": "kebab-case",
        "modelNaming": "PascalCase"
      }
    }
  }
}
```

## Framework Templates

### Next.js Template

```json
{
  "template": "nextjs",
  "extends": "react",

  "agents": {
    "page-dev": {
      "type": "coder",
      "specialization": "nextjs-pages",
      "files": ["app/**/*.tsx", "pages/**/*.tsx"],
      "patterns": ["app-router", "server-components"]
    },
    "api-dev": {
      "type": "backend-dev",
      "files": ["app/api/**/*.ts", "pages/api/**/*.ts"]
    }
  },

  "generators": {
    "page": {
      "template": "templates/page.tsx.hbs",
      "layout": "templates/layout.tsx.hbs",
      "loading": "templates/loading.tsx.hbs",
      "error": "templates/error.tsx.hbs"
    },
    "api-route": {
      "template": "templates/route.ts.hbs"
    }
  },

  "hooks": {
    "post-create-page": ["update-sitemap", "generate-metadata", "create-tests"]
  }
}
```

### NestJS Template

```json
{
  "template": "nestjs",
  "extends": "nodejs-backend",

  "agents": {
    "module-dev": {
      "type": "backend-dev",
      "specialization": "nestjs",
      "patterns": ["dependency-injection", "decorators"]
    },
    "controller-dev": {
      "type": "backend-dev",
      "files": ["**/*.controller.ts"]
    },
    "service-dev": {
      "type": "backend-dev",
      "files": ["**/*.service.ts"]
    }
  },

  "generators": {
    "module": {
      "files": [
        "templates/module.ts.hbs",
        "templates/controller.ts.hbs",
        "templates/service.ts.hbs",
        "templates/dto.ts.hbs",
        "templates/entity.ts.hbs"
      ]
    }
  }
}
```

### Django Template

```json
{
  "template": "django",
  "extends": "python",

  "agents": {
    "model-dev": {
      "type": "coder",
      "files": ["**/models.py"],
      "patterns": ["orm", "migrations"]
    },
    "view-dev": {
      "type": "coder",
      "files": ["**/views.py"]
    },
    "serializer-dev": {
      "type": "coder",
      "files": ["**/serializers.py"]
    }
  },

  "hooks": {
    "post-edit-model": ["make-migrations", "migrate"]
  },

  "generators": {
    "app": {
      "command": "django-admin startapp",
      "postCreate": ["register-app", "create-urls", "create-admin"]
    }
  }
}
```

## Real-World Examples

### Example 1: E-Commerce Platform Template

```json
{
  "name": "ecommerce-platform",
  "extends": "monorepo",

  "packages": {
    "storefront": {
      "template": "nextjs",
      "agents": ["page-dev", "component-dev", "tester"],
      "features": ["product-catalog", "shopping-cart", "checkout"]
    },
    "admin": {
      "template": "react",
      "agents": ["component-dev", "tester"],
      "features": ["product-management", "order-management"]
    },
    "api": {
      "template": "nestjs",
      "agents": ["api-dev", "db-dev", "tester"],
      "features": ["products", "orders", "payments", "users"]
    },
    "shared": {
      "template": "base",
      "agents": ["coder"],
      "features": ["types", "utils", "constants"]
    }
  },

  "workflows": {
    "add-product-feature": {
      "steps": [
        "update-api-schema",
        "generate-types",
        "implement-api",
        "implement-admin-ui",
        "implement-storefront-ui",
        "write-tests"
      ]
    }
  }
}
```

### Example 2: Mobile App Template

```json
{
  "name": "mobile-app",
  "template": "react-native",

  "agents": {
    "screen-dev": {
      "type": "mobile-dev",
      "files": ["src/screens/**/*.tsx"],
      "patterns": ["navigation", "state-management"]
    },
    "component-dev": {
      "type": "mobile-dev",
      "files": ["src/components/**/*.tsx"]
    },
    "native-dev": {
      "type": "mobile-dev",
      "files": ["ios/**/*", "android/**/*"],
      "specialization": "native-modules"
    }
  },

  "platforms": {
    "ios": {
      "hooks": {
        "pre-build": ["pod install"],
        "post-build": ["code-sign"]
      }
    },
    "android": {
      "hooks": {
        "pre-build": ["gradle sync"],
        "post-build": ["sign-apk"]
      }
    }
  }
}
```

### Example 3: ML Pipeline Template

```json
{
  "name": "ml-pipeline",
  "template": "python",

  "agents": {
    "data-engineer": {
      "type": "ml-developer",
      "specialization": "data-engineering",
      "files": ["src/data/**/*.py"]
    },
    "model-dev": {
      "type": "ml-developer",
      "specialization": "model-training",
      "files": ["src/models/**/*.py"]
    },
    "mlops": {
      "type": "cicd-engineer",
      "specialization": "mlops",
      "files": ["deploy/**/*"]
    }
  },

  "workflows": {
    "train-model": {
      "steps": ["prepare-data", "train-model", "evaluate-model", "register-model", "deploy-model"]
    }
  },

  "hooks": {
    "post-train": ["log-metrics", "save-artifacts", "update-registry"]
  }
}
```

## Best Practices

### 1. Template Organization

```
.claude-flow/templates/
├── base/                    # Base template
├── frameworks/
│   ├── react/
│   ├── vue/
│   ├── nestjs/
│   └── django/
├── domains/
│   ├── ecommerce/
│   ├── saas/
│   └── mobile/
└── custom/
    └── my-company/         # Company-specific
```

### 2. Template Inheritance

```json
{
  "template": "my-react-app",
  "extends": "react",
  "overrides": {
    "agents": {
      "component-dev": {
        "styling": "tailwind"
      }
    }
  }
}
```

### 3. Version Management

```json
{
  "template": "my-template",
  "version": "2.0.0",
  "compatibility": {
    "claudeFlow": ">=2.0.0",
    "node": ">=18.0.0"
  },
  "migrations": {
    "1.x": ".claude-flow/migrations/v1-to-v2.js"
  }
}
```

### 4. Documentation

```markdown
# My Custom Template

## Description

Template for React applications with TypeScript and Tailwind.

## Features

- TypeScript strict mode
- Tailwind CSS
- Jest + React Testing Library
- Storybook
- Automated accessibility checks

## Usage

\`\`\`bash npx claude-flow@alpha init --template my-react-template \`\`\`

## Configuration

See [CONFIG.md](./CONFIG.md) for details.
```

### 5. Testing Templates

```bash
# Create test project
npx claude-flow@alpha template test my-template \
  --output /tmp/test-project

# Verify template
npx claude-flow@alpha template verify my-template
```

## Summary

Template customization enables:

- ✅ **Consistency**: Standardized project setups
- ✅ **Efficiency**: Quick project initialization
- ✅ **Best Practices**: Enforced conventions
- ✅ **Flexibility**: Adaptable to any stack
- ✅ **Reusability**: Share across projects
- ✅ **Scalability**: Handle complex architectures

**Next Steps**:

- [Troubleshooting Guide](./TROUBLESHOOTING.md)
- [Migration Guide](./MIGRATION.md)
- [API Reference](../reference/API.md)

---

**Pro Tip**: Start with a built-in template, customize gradually, create custom templates for
repeated project types.
