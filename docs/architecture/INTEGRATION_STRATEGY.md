# Integration Strategy: Wundr + New-Starter Unification

## Overview

This document outlines the comprehensive strategy for integrating the existing Wundr code analysis
platform with the New-Starter environment setup toolkit into a unified developer experience
platform.

## Current State Analysis

### Wundr Platform (Existing)

**Strengths:**

- Comprehensive code analysis engine with AST parsing
- Rich web dashboard with data visualizations
- Established patterns for quality metrics and governance
- Extensive configuration and plugin system
- Mature CI/CD integration workflows

**Architecture:**

- Monorepo structure with TypeScript
- React-based web client
- Node.js analysis services
- PostgreSQL + Redis data layer
- Comprehensive testing suite

### New-Starter Toolkit (Existing)

**Strengths:**

- Automated environment setup workflows
- Cross-platform compatibility (macOS, Linux, Windows)
- Interactive CLI with guided setup
- Template-based project scaffolding
- Tool validation and verification systems

**Architecture:**

- Node.js CLI application
- Shell script orchestration
- Template-driven configuration
- Logging and progress tracking
- Modular setup components

## Integration Architecture

### Unified Platform Vision

```
┌─────────────────────────────────────────────────────────────┐
│                 Wundr Unified Platform                     │
├─────────────────────────────────────────────────────────────┤
│  Developer Experience Layer                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Web UI    │  │   CLI Tool  │  │   VS Code   │        │
│  │             │  │             │  │  Extension  │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
├─────────────────────────────────────────────────────────────┤
│  Unified API Gateway                                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  Analysis   │  │    Setup    │  │    Hybrid   │        │
│  │   Routes    │  │   Routes    │  │  Workflows  │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
├─────────────────────────────────────────────────────────────┤
│  Core Services                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  Enhanced   │  │  Enhanced   │  │  Workflow   │        │
│  │  Analysis   │  │   Setup     │  │ Orchestrator│        │
│  │   Engine    │  │  Toolkit    │  │             │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

### Integration Points

#### 1. Shared Package Architecture

```typescript
// packages/core - Shared business logic
export interface ProjectContext {
  id: string;
  name: string;
  path: string;
  language: string;
  framework?: string;
  configuration: ProjectConfiguration;
}

export interface WorkflowStep {
  id: string;
  name: string;
  type: 'setup' | 'analysis' | 'validation';
  dependencies: string[];
  configuration: StepConfiguration;
}

// packages/cli - Unified command-line interface
export class WundrCLI {
  async analyze(options: AnalysisOptions): Promise<AnalysisResult> {
    return this.analysisEngine.analyze(options);
  }

  async setup(options: SetupOptions): Promise<SetupResult> {
    return this.setupToolkit.execute(options);
  }

  async workflow(options: WorkflowOptions): Promise<WorkflowResult> {
    return this.workflowOrchestrator.execute(options);
  }
}
```

#### 2. Unified Configuration System

```typescript
// Merged configuration schema
interface WundrConfiguration {
  project: ProjectConfiguration;
  analysis: AnalysisConfiguration;
  setup: SetupConfiguration;
  workflows: WorkflowConfiguration[];
  integrations: IntegrationConfiguration;
}

interface ProjectConfiguration {
  name: string;
  type: 'frontend' | 'backend' | 'fullstack' | 'mobile' | 'library';
  language: string[];
  framework?: string;
  packageManager: 'npm' | 'yarn' | 'pnpm';

  // Analysis settings (from Wundr)
  analysis: {
    rules: string[];
    excludePatterns: string[];
    thresholds: QualityThresholds;
  };

  // Setup settings (from New-Starter)
  setup: {
    tools: ToolConfiguration[];
    templates: TemplateConfiguration[];
    profiles: string[];
  };
}
```

#### 3. Event-Driven Workflow Integration

```typescript
// Unified event system for cross-component communication
interface WorkflowEvent {
  type: 'setup.completed' | 'analysis.started' | 'validation.failed';
  projectId: string;
  workflowId: string;
  stepId: string;
  data: any;
  timestamp: Date;
}

class WorkflowOrchestrator {
  async executeHybridWorkflow(config: WorkflowConfiguration): Promise<WorkflowResult> {
    const workflow = await this.buildWorkflow(config);

    for (const step of workflow.steps) {
      switch (step.type) {
        case 'setup':
          await this.setupToolkit.executeStep(step);
          break;
        case 'analysis':
          await this.analysisEngine.executeStep(step);
          break;
        case 'validation':
          await this.validationService.executeStep(step);
          break;
      }
    }

    return workflow.result;
  }
}
```

## Migration Strategy

### Phase 1: Foundation (Weeks 1-4)

**Objective:** Establish unified monorepo and shared infrastructure

**Activities:**

1. **Monorepo Setup**
   - Migrate both codebases into Turborepo structure
   - Establish shared package dependencies
   - Configure unified build and test pipelines

2. **Shared Core Package**
   - Extract common interfaces and types
   - Create unified configuration system
   - Establish shared event system

3. **Infrastructure Alignment**
   - Merge CI/CD pipelines
   - Unified Docker configurations
   - Shared development environment setup

**Deliverables:**

- Functional monorepo with both systems
- Shared @wundr/core package
- Unified development documentation

### Phase 2: API Unification (Weeks 5-8)

**Objective:** Create unified API gateway and service layer

**Activities:**

1. **API Gateway Development**
   - Create unified REST API endpoints
   - Implement GraphQL schema with both domains
   - Establish WebSocket connections for real-time updates

2. **Service Integration**
   - Refactor analysis engine as microservice
   - Refactor setup toolkit as microservice
   - Create workflow orchestration service

3. **Database Integration**
   - Merge data models for projects and workflows
   - Implement shared authentication and authorization
   - Create audit logging for all operations

**Deliverables:**

- Unified API gateway service
- Integrated authentication system
- Consolidated database schema

### Phase 3: CLI Integration (Weeks 9-12)

**Objective:** Merge CLI tools into unified command-line experience

**Activities:**

1. **Command Structure Design**

   ```bash
   # Unified CLI commands
   wundr init <project-name>          # Initialize new project
   wundr setup [profile]              # Environment setup
   wundr analyze [options]            # Code analysis
   wundr workflow <workflow-name>     # Execute custom workflow
   wundr dashboard                    # Launch web dashboard
   ```

2. **Feature Integration**
   - Merge setup profiles with analysis configurations
   - Create hybrid workflows combining setup + analysis
   - Implement interactive guided workflows

3. **User Experience Enhancement**
   - Unified progress reporting
   - Consistent error handling and recovery
   - Cross-platform compatibility verification

**Deliverables:**

- Single unified CLI tool
- Integrated workflow system
- Enhanced user documentation

### Phase 4: Web Dashboard Enhancement (Weeks 13-16)

**Objective:** Enhanced web dashboard with setup capabilities

**Activities:**

1. **Dashboard Integration**
   - Add setup management interface
   - Create workflow designer and executor
   - Implement real-time progress tracking

2. **New Features**
   - Project lifecycle management
   - Environment health monitoring
   - Team collaboration features

3. **Performance Optimization**
   - Frontend bundle optimization
   - API response time improvements
   - Real-time update efficiency

**Deliverables:**

- Enhanced web dashboard
- Real-time workflow monitoring
- Team collaboration features

## Technical Integration Details

### Package Dependencies

```json
{
  "packages/core": {
    "dependencies": {
      "zod": "^3.25.76",
      "eventemitter3": "^5.0.1",
      "uuid": "^11.0.3"
    }
  },
  "packages/cli": {
    "dependencies": {
      "@wundr/core": "workspace:*",
      "@wundr/analysis-engine": "workspace:*",
      "@wundr/setup-toolkit": "workspace:*",
      "commander": "^11.1.0",
      "inquirer": "^9.2.0"
    }
  },
  "packages/analysis-engine": {
    "dependencies": {
      "@wundr/core": "workspace:*",
      "ts-morph": "^21.0.1",
      "glob": "^10.3.10"
    }
  },
  "packages/setup-toolkit": {
    "dependencies": {
      "@wundr/core": "workspace:*",
      "execa": "^8.0.1",
      "listr2": "^8.2.5"
    }
  }
}
```

### Data Model Integration

```sql
-- Extended project table with setup information
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  type project_type NOT NULL,
  language VARCHAR(100)[] NOT NULL,
  framework VARCHAR(100),
  package_manager package_manager DEFAULT 'npm',

  -- Analysis configuration (existing)
  analysis_config JSONB DEFAULT '{}',

  -- Setup configuration (new)
  setup_config JSONB DEFAULT '{}',
  environment_health JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- New workflow execution tracking
CREATE TABLE workflow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  workflow_type workflow_type NOT NULL,
  status execution_status DEFAULT 'pending',
  steps JSONB NOT NULL,
  results JSONB,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TYPE workflow_type AS ENUM (
  'setup_only',
  'analysis_only',
  'setup_then_analysis',
  'custom'
);
```

### Workflow Configuration Examples

```yaml
# .wundr/workflows/onboarding.yml
name: 'New Developer Onboarding'
description: 'Complete setup and initial analysis for new team members'

trigger:
  event: 'developer.joined'
  conditions:
    - "user.role == 'developer'"

steps:
  - name: 'environment-setup'
    type: 'setup'
    profile: 'fullstack-typescript'
    config:
      skip_optional: true
      install_recommendations: true

  - name: 'project-analysis'
    type: 'analysis'
    depends_on: ['environment-setup']
    config:
      types: ['quality', 'security', 'dependencies']
      generate_report: true

  - name: 'health-check'
    type: 'validation'
    depends_on: ['environment-setup', 'project-analysis']
    config:
      verify_tools: true
      run_tests: true

notifications:
  on_success:
    - type: 'slack'
      message: '🎉 {{user.name}} successfully onboarded to {{project.name}}'
  on_failure:
    - type: 'email'
      template: 'onboarding_failure'
```

### API Integration Examples

```typescript
// Unified API endpoints
app.post('/api/v1/projects/:id/workflows', async (req, res) => {
  const { id } = req.params;
  const { workflowType, configuration } = req.body;

  const workflow = await workflowOrchestrator.create({
    projectId: id,
    type: workflowType,
    configuration
  });

  // Stream progress updates via WebSocket
  workflow.on('progress', (update) => {
    io.to(`project:${id}`).emit('workflow:progress', update);
  });

  const result = await workflow.execute();
  res.json(result);
});

// GraphQL schema integration
type Mutation {
  executeSetupWorkflow(
    projectId: ID!
    profileName: String!
    options: SetupOptionsInput
  ): WorkflowExecution!

  executeAnalysisWorkflow(
    projectId: ID!
    analysisTypes: [AnalysisType!]!
    options: AnalysisOptionsInput
  ): WorkflowExecution!

  executeHybridWorkflow(
    projectId: ID!
    workflowConfig: WorkflowConfigInput!
  ): WorkflowExecution!
}
```

## Success Metrics

### Technical Metrics

- **Build Time**: < 60 seconds for full monorepo
- **API Response Time**: < 200ms for 95th percentile
- **CLI Command Speed**: < 3 seconds for basic operations
- **Test Coverage**: > 90% across all packages

### User Experience Metrics

- **Setup Success Rate**: > 95% for standard profiles
- **Analysis Accuracy**: > 98% issue detection rate
- **User Satisfaction**: > 4.5/5 in quarterly surveys
- **Adoption Rate**: 80% of existing users migrate within 3 months

### Business Metrics

- **Feature Parity**: 100% of existing features available in unified platform
- **Performance Improvement**: 2x faster workflow execution
- **Developer Productivity**: 40% reduction in environment setup time
- **Support Reduction**: 30% decrease in support tickets

## Risk Mitigation

### Technical Risks

1. **Performance Degradation**
   - Mitigation: Comprehensive benchmarking and performance testing
   - Monitoring: Continuous performance metrics in CI/CD

2. **Data Migration Issues**
   - Mitigation: Gradual migration with fallback procedures
   - Testing: Extensive migration testing with production data copies

3. **Feature Regression**
   - Mitigation: Feature flag system for gradual rollout
   - Testing: Comprehensive regression testing suite

### User Experience Risks

1. **Learning Curve for Existing Users**
   - Mitigation: Comprehensive migration guide and video tutorials
   - Support: Dedicated migration support period

2. **Workflow Disruption**
   - Mitigation: Backward compatibility for 6 months
   - Communication: Early access program for power users

## Rollback Strategy

### Automated Rollback Triggers

- API error rate > 5% for 10 minutes
- CLI command failure rate > 10% for 5 minutes
- Database migration failure
- Critical user-reported issues

### Rollback Procedures

1. **Immediate**: Revert to previous Docker images
2. **Database**: Restore from automated backup
3. **Configuration**: Reset to last known good state
4. **Communication**: Notify users via status page

This integration strategy provides a comprehensive roadmap for unifying Wundr and New-Starter into a
cohesive, powerful developer platform while minimizing risks and ensuring a smooth transition for
existing users.
