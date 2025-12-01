# Database Schema Design

## Overview

The Wundr platform uses PostgreSQL as the primary database with Redis for caching and session
management. This document defines the complete database schema, relationships, and optimization
strategies.

## Database Architecture

### Technology Stack

- **PostgreSQL 15+** - Primary relational database
- **Redis 7+** - Caching and session storage
- **Connection Pooling** - PgBouncer for connection management
- **Monitoring** - pg_stat_statements and pgBadger

### Schema Organization

```
wundr_platform
├── public (core tables)
├── analysis (analysis-related tables)
├── setup (setup and configuration tables)
├── audit (audit and logging tables)
└── cache (cache-related views)
```

## Core Schema

### Users and Authentication

#### users

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  role user_role NOT NULL DEFAULT 'developer',
  avatar_url TEXT,
  github_username VARCHAR(255),
  preferences JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  email_verified BOOLEAN DEFAULT FALSE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TYPE user_role AS ENUM (
  'admin',
  'manager',
  'developer',
  'viewer'
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_active ON users(is_active);
```

#### user_sessions

```sql
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  refresh_token_hash VARCHAR(255),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  user_agent TEXT,
  ip_address INET
);

CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_token ON user_sessions(token_hash);
CREATE INDEX idx_user_sessions_expires ON user_sessions(expires_at);
```

### Projects and Workspaces

#### organizations

```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  settings JSONB DEFAULT '{}',
  subscription_plan subscription_plan DEFAULT 'free',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TYPE subscription_plan AS ENUM (
  'free',
  'professional',
  'enterprise'
);

CREATE INDEX idx_organizations_slug ON organizations(slug);
```

#### organization_members

```sql
CREATE TABLE organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role organization_role NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  invited_by UUID REFERENCES users(id),

  UNIQUE(organization_id, user_id)
);

CREATE TYPE organization_role AS ENUM (
  'owner',
  'admin',
  'member',
  'viewer'
);

CREATE INDEX idx_org_members_org_id ON organization_members(organization_id);
CREATE INDEX idx_org_members_user_id ON organization_members(user_id);
```

#### projects

```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  repository_url TEXT,
  repository_provider repository_provider,
  repository_data JSONB,
  configuration JSONB DEFAULT '{}',
  status project_status DEFAULT 'active',
  visibility project_visibility DEFAULT 'private',
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_analyzed_at TIMESTAMPTZ,

  CONSTRAINT valid_repo_url CHECK (repository_url IS NULL OR repository_url ~* '^https?://')
);

CREATE TYPE repository_provider AS ENUM (
  'github',
  'gitlab',
  'bitbucket',
  'azure_devops',
  'local'
);

CREATE TYPE project_status AS ENUM (
  'active',
  'archived',
  'deleted'
);

CREATE TYPE project_visibility AS ENUM (
  'private',
  'internal',
  'public'
);

CREATE INDEX idx_projects_org_id ON projects(organization_id);
CREATE INDEX idx_projects_created_by ON projects(created_by);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_updated_at ON projects(updated_at);
```

#### project_members

```sql
CREATE TABLE project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role project_role NOT NULL,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  added_by UUID REFERENCES users(id),

  UNIQUE(project_id, user_id)
);

CREATE TYPE project_role AS ENUM (
  'owner',
  'maintainer',
  'contributor',
  'viewer'
);

CREATE INDEX idx_project_members_project_id ON project_members(project_id);
CREATE INDEX idx_project_members_user_id ON project_members(user_id);
```

## Analysis Schema

#### analyses

```sql
CREATE TABLE analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type analysis_type NOT NULL,
  status analysis_status DEFAULT 'pending',
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  configuration JSONB DEFAULT '{}',
  results JSONB,
  summary JSONB,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_duration CHECK (
    (completed_at IS NULL AND duration_seconds IS NULL) OR
    (completed_at IS NOT NULL AND started_at IS NOT NULL AND duration_seconds > 0)
  )
);

CREATE TYPE analysis_type AS ENUM (
  'quality',
  'security',
  'dependencies',
  'duplicates',
  'complexity',
  'performance',
  'architecture'
);

CREATE TYPE analysis_status AS ENUM (
  'pending',
  'running',
  'completed',
  'failed',
  'cancelled'
);

CREATE INDEX idx_analyses_project_id ON analyses(project_id);
CREATE INDEX idx_analyses_type ON analyses(type);
CREATE INDEX idx_analyses_status ON analyses(status);
CREATE INDEX idx_analyses_created_at ON analyses(created_at);
CREATE INDEX idx_analyses_completed_at ON analyses(completed_at);
```

#### analysis_results

```sql
CREATE TABLE analysis_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_hash VARCHAR(64),
  metrics JSONB DEFAULT '{}',
  issues JSONB DEFAULT '[]',
  dependencies JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_analysis_results_analysis_id ON analysis_results(analysis_id);
CREATE INDEX idx_analysis_results_file_path ON analysis_results(file_path);
CREATE INDEX idx_analysis_results_file_hash ON analysis_results(file_hash);
```

#### analysis_issues

```sql
CREATE TABLE analysis_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  type issue_type NOT NULL,
  severity issue_severity NOT NULL,
  rule_id VARCHAR(255),
  title VARCHAR(500) NOT NULL,
  description TEXT,
  file_path TEXT NOT NULL,
  line_number INTEGER,
  column_number INTEGER,
  end_line_number INTEGER,
  end_column_number INTEGER,
  code_snippet TEXT,
  fix_suggestion TEXT,
  estimated_fix_time INTEGER, -- minutes
  status issue_status DEFAULT 'open',
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TYPE issue_type AS ENUM (
  'code_quality',
  'security',
  'performance',
  'maintainability',
  'accessibility',
  'best_practice',
  'duplicate_code',
  'dependency'
);

CREATE TYPE issue_severity AS ENUM (
  'critical',
  'high',
  'medium',
  'low',
  'info'
);

CREATE TYPE issue_status AS ENUM (
  'open',
  'resolved',
  'ignored',
  'false_positive'
);

CREATE INDEX idx_analysis_issues_analysis_id ON analysis_issues(analysis_id);
CREATE INDEX idx_analysis_issues_severity ON analysis_issues(severity);
CREATE INDEX idx_analysis_issues_type ON analysis_issues(type);
CREATE INDEX idx_analysis_issues_status ON analysis_issues(status);
CREATE INDEX idx_analysis_issues_file_path ON analysis_issues(file_path);
```

#### analysis_metrics

```sql
CREATE TABLE analysis_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  metric_name VARCHAR(255) NOT NULL,
  metric_value DECIMAL(12,4),
  metric_unit VARCHAR(50),
  category metric_category NOT NULL,
  description TEXT,
  trend_direction trend_direction,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TYPE metric_category AS ENUM (
  'quality',
  'performance',
  'security',
  'maintainability',
  'complexity',
  'coverage'
);

CREATE TYPE trend_direction AS ENUM (
  'improving',
  'declining',
  'stable'
);

CREATE INDEX idx_analysis_metrics_analysis_id ON analysis_metrics(analysis_id);
CREATE INDEX idx_analysis_metrics_name ON analysis_metrics(metric_name);
CREATE INDEX idx_analysis_metrics_category ON analysis_metrics(category);
```

#### dependency_graphs

```sql
CREATE TABLE dependency_graphs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  analysis_id UUID REFERENCES analyses(id) ON DELETE SET NULL,
  graph_data JSONB NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dependency_graphs_project_id ON dependency_graphs(project_id);
CREATE INDEX idx_dependency_graphs_analysis_id ON dependency_graphs(analysis_id);
```

#### duplicate_groups

```sql
CREATE TABLE duplicate_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  hash VARCHAR(64) NOT NULL,
  similarity_percentage DECIMAL(5,2) NOT NULL CHECK (similarity_percentage >= 0 AND similarity_percentage <= 100),
  total_lines INTEGER NOT NULL,
  files JSONB NOT NULL, -- array of file paths and line ranges
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_duplicate_groups_analysis_id ON duplicate_groups(analysis_id);
CREATE INDEX idx_duplicate_groups_hash ON duplicate_groups(hash);
CREATE INDEX idx_duplicate_groups_similarity ON duplicate_groups(similarity_percentage);
```

## Setup Schema

#### setup_profiles

```sql
CREATE TABLE setup_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category setup_category NOT NULL,
  configuration JSONB NOT NULL DEFAULT '{}',
  tools JSONB NOT NULL DEFAULT '[]',
  templates JSONB DEFAULT '[]',
  prerequisites JSONB DEFAULT '[]',
  estimated_duration INTEGER, -- minutes
  visibility profile_visibility DEFAULT 'private',
  is_featured BOOLEAN DEFAULT FALSE,
  created_by UUID NOT NULL REFERENCES users(id),
  organization_id UUID REFERENCES organizations(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TYPE setup_category AS ENUM (
  'frontend',
  'backend',
  'fullstack',
  'mobile',
  'devops',
  'data_science',
  'machine_learning',
  'custom'
);

CREATE TYPE profile_visibility AS ENUM (
  'private',
  'organization',
  'public'
);

CREATE INDEX idx_setup_profiles_category ON setup_profiles(category);
CREATE INDEX idx_setup_profiles_visibility ON setup_profiles(visibility);
CREATE INDEX idx_setup_profiles_created_by ON setup_profiles(created_by);
CREATE INDEX idx_setup_profiles_org_id ON setup_profiles(organization_id);
```

#### setup_sessions

```sql
CREATE TABLE setup_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES setup_profiles(id),
  user_id UUID NOT NULL REFERENCES users(id),
  status session_status DEFAULT 'pending',
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  current_step VARCHAR(255),
  configuration JSONB DEFAULT '{}',
  logs JSONB DEFAULT '[]',
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TYPE session_status AS ENUM (
  'pending',
  'running',
  'completed',
  'failed',
  'cancelled'
);

CREATE INDEX idx_setup_sessions_profile_id ON setup_sessions(profile_id);
CREATE INDEX idx_setup_sessions_user_id ON setup_sessions(user_id);
CREATE INDEX idx_setup_sessions_status ON setup_sessions(status);
CREATE INDEX idx_setup_sessions_created_at ON setup_sessions(created_at);
```

#### setup_steps

```sql
CREATE TABLE setup_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES setup_sessions(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  step_order INTEGER NOT NULL,
  tool_name VARCHAR(255),
  command TEXT,
  status step_status DEFAULT 'pending',
  logs TEXT,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TYPE step_status AS ENUM (
  'pending',
  'running',
  'completed',
  'failed',
  'skipped'
);

CREATE INDEX idx_setup_steps_session_id ON setup_steps(session_id);
CREATE INDEX idx_setup_steps_status ON setup_steps(status);
CREATE INDEX idx_setup_steps_order ON setup_steps(step_order);
```

#### tools

```sql
CREATE TABLE tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  version VARCHAR(100),
  category tool_category NOT NULL,
  description TEXT,
  install_command TEXT,
  verify_command TEXT,
  configuration_schema JSONB,
  supported_platforms platform[] DEFAULT '{}',
  dependencies TEXT[], -- tool names
  metadata JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TYPE tool_category AS ENUM (
  'runtime',
  'package_manager',
  'editor',
  'version_control',
  'build_tool',
  'testing',
  'linting',
  'documentation',
  'deployment',
  'database',
  'monitoring'
);

CREATE TYPE platform AS ENUM (
  'macos',
  'linux',
  'windows',
  'docker'
);

CREATE INDEX idx_tools_name ON tools(name);
CREATE INDEX idx_tools_category ON tools(category);
CREATE INDEX idx_tools_platforms ON tools USING GIN(supported_platforms);
```

## Configuration Schema

#### configurations

```sql
CREATE TABLE configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  scope config_scope NOT NULL,
  category config_category NOT NULL,
  name VARCHAR(255) NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  is_encrypted BOOLEAN DEFAULT FALSE,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT config_scope_check CHECK (
    (scope = 'global' AND organization_id IS NULL AND project_id IS NULL) OR
    (scope = 'organization' AND organization_id IS NOT NULL AND project_id IS NULL) OR
    (scope = 'project' AND project_id IS NOT NULL)
  )
);

CREATE TYPE config_scope AS ENUM (
  'global',
  'organization',
  'project'
);

CREATE TYPE config_category AS ENUM (
  'general',
  'analysis',
  'setup',
  'integrations',
  'security',
  'notifications'
);

CREATE INDEX idx_configurations_scope ON configurations(scope);
CREATE INDEX idx_configurations_category ON configurations(category);
CREATE INDEX idx_configurations_org_id ON configurations(organization_id);
CREATE INDEX idx_configurations_project_id ON configurations(project_id);
```

#### integrations

```sql
CREATE TABLE integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  type integration_type NOT NULL,
  name VARCHAR(255) NOT NULL,
  configuration JSONB NOT NULL DEFAULT '{}',
  credentials JSONB, -- encrypted
  webhook_url TEXT,
  webhook_secret VARCHAR(255),
  is_enabled BOOLEAN DEFAULT TRUE,
  last_sync_at TIMESTAMPTZ,
  sync_status sync_status DEFAULT 'never',
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TYPE integration_type AS ENUM (
  'github',
  'gitlab',
  'bitbucket',
  'jira',
  'slack',
  'microsoft_teams',
  'discord',
  'webhook',
  'email'
);

CREATE TYPE sync_status AS ENUM (
  'never',
  'success',
  'failed',
  'in_progress'
);

CREATE INDEX idx_integrations_org_id ON integrations(organization_id);
CREATE INDEX idx_integrations_project_id ON integrations(project_id);
CREATE INDEX idx_integrations_type ON integrations(type);
CREATE INDEX idx_integrations_enabled ON integrations(is_enabled);
```

## Audit and Logging Schema

#### audit_logs

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  organization_id UUID REFERENCES organizations(id),
  action audit_action NOT NULL,
  resource_type VARCHAR(100) NOT NULL,
  resource_id UUID,
  old_values JSONB,
  new_values JSONB,
  metadata JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TYPE audit_action AS ENUM (
  'create',
  'read',
  'update',
  'delete',
  'login',
  'logout',
  'invite',
  'accept',
  'reject'
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_org_id ON audit_logs(organization_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
```

#### system_logs

```sql
CREATE TABLE system_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level log_level NOT NULL,
  service VARCHAR(100) NOT NULL,
  component VARCHAR(100),
  message TEXT NOT NULL,
  data JSONB,
  correlation_id UUID,
  request_id UUID,
  user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TYPE log_level AS ENUM (
  'debug',
  'info',
  'warn',
  'error',
  'fatal'
);

CREATE INDEX idx_system_logs_level ON system_logs(level);
CREATE INDEX idx_system_logs_service ON system_logs(service);
CREATE INDEX idx_system_logs_correlation_id ON system_logs(correlation_id);
CREATE INDEX idx_system_logs_created_at ON system_logs(created_at);
```

## Views and Functions

### Project Statistics View

```sql
CREATE VIEW project_stats AS
SELECT
  p.id,
  p.name,
  COUNT(DISTINCT a.id) as total_analyses,
  COUNT(DISTINCT CASE WHEN a.status = 'completed' THEN a.id END) as completed_analyses,
  MAX(a.completed_at) as last_analysis_at,
  AVG(CASE WHEN a.status = 'completed' THEN
    CAST((a.summary->>'overallScore')::text AS DECIMAL)
  END) as avg_quality_score,
  COUNT(DISTINCT pm.user_id) as member_count
FROM projects p
LEFT JOIN analyses a ON p.id = a.project_id
LEFT JOIN project_members pm ON p.id = pm.project_id
WHERE p.status = 'active'
GROUP BY p.id, p.name;
```

### Analysis Performance Function

```sql
CREATE OR REPLACE FUNCTION get_analysis_trends(
  project_id_param UUID,
  metric_name_param TEXT,
  days_back INTEGER DEFAULT 30
) RETURNS TABLE(
  date DATE,
  avg_value DECIMAL,
  trend TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH daily_metrics AS (
    SELECT
      DATE(a.completed_at) as analysis_date,
      AVG(CAST(am.metric_value AS DECIMAL)) as avg_value
    FROM analyses a
    JOIN analysis_metrics am ON a.id = am.analysis_id
    WHERE a.project_id = project_id_param
      AND am.metric_name = metric_name_param
      AND a.completed_at >= NOW() - (days_back || ' days')::INTERVAL
      AND a.status = 'completed'
    GROUP BY DATE(a.completed_at)
    ORDER BY analysis_date
  ),
  trends AS (
    SELECT
      analysis_date,
      avg_value,
      CASE
        WHEN LAG(avg_value) OVER (ORDER BY analysis_date) IS NULL THEN 'stable'
        WHEN avg_value > LAG(avg_value) OVER (ORDER BY analysis_date) THEN 'improving'
        WHEN avg_value < LAG(avg_value) OVER (ORDER BY analysis_date) THEN 'declining'
        ELSE 'stable'
      END as trend
    FROM daily_metrics
  )
  SELECT * FROM trends;
END;
$$ LANGUAGE plpgsql;
```

## Indexes and Constraints

### Performance Indexes

```sql
-- Composite indexes for common queries
CREATE INDEX idx_analyses_project_status_created ON analyses(project_id, status, created_at DESC);
CREATE INDEX idx_analysis_issues_analysis_severity ON analysis_issues(analysis_id, severity);
CREATE INDEX idx_project_members_user_project ON project_members(user_id, project_id);

-- Partial indexes for active records
CREATE INDEX idx_users_active_email ON users(email) WHERE is_active = TRUE;
CREATE INDEX idx_projects_active_updated ON projects(updated_at DESC) WHERE status = 'active';

-- GIN indexes for JSONB columns
CREATE INDEX idx_projects_configuration ON projects USING GIN(configuration);
CREATE INDEX idx_analyses_results ON analyses USING GIN(results);
CREATE INDEX idx_analysis_results_metrics ON analysis_results USING GIN(metrics);
```

### Data Integrity Constraints

```sql
-- Analysis constraints
ALTER TABLE analyses ADD CONSTRAINT check_progress_status
  CHECK ((status = 'completed' AND progress = 100) OR status != 'completed');

-- Session duration constraints
ALTER TABLE setup_sessions ADD CONSTRAINT check_session_duration
  CHECK ((completed_at IS NULL AND duration_seconds IS NULL) OR
         (completed_at IS NOT NULL AND started_at IS NOT NULL));

-- Configuration scope constraints
ALTER TABLE configurations ADD CONSTRAINT unique_config_scope
  UNIQUE (organization_id, project_id, category, name);
```

## Partitioning Strategy

### Time-based Partitioning for Logs

```sql
-- Partition audit logs by month
CREATE TABLE audit_logs_template () INHERITS (audit_logs);

-- Create monthly partitions
CREATE TABLE audit_logs_2024_01 (
  CHECK (created_at >= '2024-01-01' AND created_at < '2024-02-01')
) INHERITS (audit_logs);

-- Automated partition creation function
CREATE OR REPLACE FUNCTION create_monthly_partition(table_name TEXT, start_date DATE)
RETURNS VOID AS $$
DECLARE
  partition_name TEXT;
  end_date DATE;
BEGIN
  partition_name := table_name || '_' || TO_CHAR(start_date, 'YYYY_MM');
  end_date := start_date + INTERVAL '1 month';

  EXECUTE format('CREATE TABLE %I (CHECK (created_at >= %L AND created_at < %L)) INHERITS (%I)',
                partition_name, start_date, end_date, table_name);

  EXECUTE format('CREATE INDEX %I ON %I (created_at)',
                'idx_' || partition_name || '_created_at', partition_name);
END;
$$ LANGUAGE plpgsql;
```

## Backup and Recovery

### Backup Strategy

```sql
-- Full backup script
pg_dump --verbose --clean --no-acl --no-owner --format=custom wundr_platform > wundr_backup.dump

-- Incremental backup using WAL archiving
archive_mode = on
archive_command = 'cp %p /backup/archive/%f'
```

### Recovery Procedures

```sql
-- Point-in-time recovery
pg_restore --verbose --clean --no-acl --no-owner --dbname=wundr_platform wundr_backup.dump

-- WAL replay for incremental recovery
SELECT pg_start_backup('backup_label');
-- Copy data directory
SELECT pg_stop_backup();
```

This database schema provides a robust foundation for the Wundr platform with proper normalization,
indexing, and constraints to ensure data integrity and optimal performance.
