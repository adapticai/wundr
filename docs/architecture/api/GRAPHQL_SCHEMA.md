# GraphQL Schema Specification

## Overview

The Wundr platform GraphQL API provides a flexible, efficient interface for data querying and mutations. This schema supports real-time subscriptions and follows GraphQL best practices.

## Schema Definition Language (SDL)

### Scalars
```graphql
scalar DateTime
scalar JSON
scalar UUID
scalar Upload
```

### Root Types
```graphql
type Query {
  # Project queries
  project(id: UUID!): Project
  projects(
    limit: Int = 20
    offset: Int = 0
    search: String
    orderBy: ProjectOrderBy
  ): ProjectConnection!
  
  # Analysis queries
  analysis(id: UUID!): Analysis
  analyses(
    projectId: UUID
    type: AnalysisType
    status: AnalysisStatus
    limit: Int = 20
    offset: Int = 0
  ): AnalysisConnection!
  
  # Setup queries
  setupProfile(id: UUID!): SetupProfile
  setupProfiles: [SetupProfile!]!
  setupSession(id: UUID!): SetupSession
  
  # Configuration queries
  configuration: Configuration!
  
  # User queries
  me: User
  
  # System queries
  health: HealthStatus!
  metrics: SystemMetrics!
}

type Mutation {
  # Project mutations
  createProject(input: CreateProjectInput!): CreateProjectPayload!
  updateProject(id: UUID!, input: UpdateProjectInput!): UpdateProjectPayload!
  deleteProject(id: UUID!): DeleteProjectPayload!
  
  # Analysis mutations
  createAnalysis(input: CreateAnalysisInput!): CreateAnalysisPayload!
  cancelAnalysis(id: UUID!): CancelAnalysisPayload!
  
  # Setup mutations
  createSetupProfile(input: CreateSetupProfileInput!): CreateSetupProfilePayload!
  updateSetupProfile(id: UUID!, input: UpdateSetupProfileInput!): UpdateSetupProfilePayload!
  createSetupSession(input: CreateSetupSessionInput!): CreateSetupSessionPayload!
  
  # Configuration mutations
  updateConfiguration(input: UpdateConfigurationInput!): UpdateConfigurationPayload!
  
  # File mutations
  uploadFile(file: Upload!): UploadFilePayload!
}

type Subscription {
  # Analysis subscriptions
  analysisProgress(analysisId: UUID!): AnalysisProgressEvent!
  analysisCompleted(analysisId: UUID!): AnalysisCompletedEvent!
  
  # Setup subscriptions
  setupProgress(sessionId: UUID!): SetupProgressEvent!
  setupCompleted(sessionId: UUID!): SetupCompletedEvent!
  
  # System subscriptions
  systemHealth: HealthStatusEvent!
  notifications(userId: UUID!): NotificationEvent!
}
```

## Core Types

### Project Types
```graphql
type Project {
  id: UUID!
  name: String!
  description: String
  repositoryUrl: String
  configuration: ProjectConfiguration
  analyses(
    type: AnalysisType
    status: AnalysisStatus
    limit: Int = 10
  ): AnalysisConnection!
  metrics: ProjectMetrics
  createdAt: DateTime!
  updatedAt: DateTime!
  createdBy: User!
}

type ProjectConfiguration {
  analysisSettings: AnalysisSettings
  setupSettings: SetupSettings
  integrations: [Integration!]!
  customRules: [CustomRule!]!
}

type ProjectMetrics {
  totalAnalyses: Int!
  lastAnalysisAt: DateTime
  averageQualityScore: Float
  trendDirection: TrendDirection!
  healthScore: Float!
}

type ProjectConnection {
  edges: [ProjectEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type ProjectEdge {
  node: Project!
  cursor: String!
}

input CreateProjectInput {
  name: String!
  description: String
  repositoryUrl: String
  configuration: ProjectConfigurationInput
}

input UpdateProjectInput {
  name: String
  description: String
  repositoryUrl: String
  configuration: ProjectConfigurationInput
}

type CreateProjectPayload {
  project: Project
  errors: [Error!]!
  success: Boolean!
}
```

### Analysis Types
```graphql
type Analysis {
  id: UUID!
  project: Project!
  type: AnalysisType!
  status: AnalysisStatus!
  progress: Int!
  results: AnalysisResults
  metrics: [Metric!]!
  issues: [Issue!]!
  recommendations: [Recommendation!]!
  duration: Int
  createdAt: DateTime!
  completedAt: DateTime
  createdBy: User!
}

enum AnalysisType {
  QUALITY
  SECURITY
  DEPENDENCIES
  DUPLICATES
  COMPLEXITY
  PERFORMANCE
  ARCHITECTURE
}

enum AnalysisStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
  CANCELLED
}

type AnalysisResults {
  summary: AnalysisSummary!
  files: [FileAnalysis!]!
  dependencies: DependencyGraph
  duplicates: [DuplicateGroup!]!
  securityIssues: [SecurityIssue!]!
  qualityMetrics: QualityMetrics!
}

type AnalysisSummary {
  totalFiles: Int!
  linesOfCode: Int!
  totalIssues: Int!
  criticalIssues: Int!
  overallScore: Float!
  estimatedFixTime: Int!
}

type FileAnalysis {
  path: String!
  size: Int!
  complexity: Int!
  maintainabilityIndex: Float!
  issues: [Issue!]!
  dependencies: [String!]!
}

type Issue {
  id: UUID!
  type: IssueType!
  severity: IssueSeverity!
  title: String!
  description: String!
  file: String!
  line: Int!
  column: Int!
  rule: String!
  fixSuggestion: String
  estimatedFixTime: Int!
}

enum IssueType {
  CODE_QUALITY
  SECURITY
  PERFORMANCE
  MAINTAINABILITY
  ACCESSIBILITY
  BEST_PRACTICE
}

enum IssueSeverity {
  CRITICAL
  HIGH
  MEDIUM
  LOW
  INFO
}

type Recommendation {
  id: UUID!
  type: RecommendationType!
  priority: RecommendationPriority!
  title: String!
  description: String!
  impact: String!
  effort: String!
  resources: [Resource!]!
}

input CreateAnalysisInput {
  projectId: UUID!
  type: AnalysisType!
  options: AnalysisOptionsInput
}

type CreateAnalysisPayload {
  analysis: Analysis
  errors: [Error!]!
  success: Boolean!
}
```

### Setup Types
```graphql
type SetupProfile {
  id: UUID!
  name: String!
  description: String
  category: SetupCategory!
  tools: [Tool!]!
  configuration: JSON!
  templates: [Template!]!
  prerequisites: [Prerequisite!]!
  estimatedDuration: Int!
  createdAt: DateTime!
  updatedAt: DateTime!
}

enum SetupCategory {
  FRONTEND
  BACKEND
  FULLSTACK
  MOBILE
  DEVOPS
  DATA_SCIENCE
  CUSTOM
}

type Tool {
  id: UUID!
  name: String!
  version: String
  category: ToolCategory!
  installCommand: String!
  verifyCommand: String
  configurationOptions: JSON
  dependencies: [Tool!]!
  platforms: [Platform!]!
}

enum ToolCategory {
  RUNTIME
  PACKAGE_MANAGER
  EDITOR
  VERSION_CONTROL
  BUILD_TOOL
  TESTING
  LINTING
  DOCUMENTATION
  DEPLOYMENT
}

enum Platform {
  MACOS
  LINUX
  WINDOWS
  DOCKER
}

type SetupSession {
  id: UUID!
  profile: SetupProfile!
  status: SetupStatus!
  progress: Int!
  currentStep: String
  completedSteps: [SetupStep!]!
  failedSteps: [SetupStep!]!
  logs: [LogEntry!]!
  startedAt: DateTime!
  completedAt: DateTime
  duration: Int
}

enum SetupStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
  CANCELLED
}

type SetupStep {
  id: UUID!
  name: String!
  description: String!
  tool: Tool
  status: StepStatus!
  duration: Int
  logs: [String!]!
  error: String
}

enum StepStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
  SKIPPED
}

input CreateSetupSessionInput {
  profileId: UUID!
  customizations: JSON
  skipSteps: [String!]
}
```

### Configuration Types
```graphql
type Configuration {
  id: UUID!
  general: GeneralConfiguration!
  analysis: AnalysisConfiguration!
  setup: SetupConfiguration!
  integrations: IntegrationsConfiguration!
  security: SecurityConfiguration!
  notifications: NotificationConfiguration!
  updatedAt: DateTime!
  updatedBy: User!
}

type GeneralConfiguration {
  organizationName: String!
  defaultLanguage: String!
  timezone: String!
  theme: Theme!
}

type AnalysisConfiguration {
  defaultRules: [String!]!
  customRules: [CustomRule!]!
  excludePatterns: [String!]!
  maxFileSize: Int!
  timeoutMinutes: Int!
  parallelJobs: Int!
}

type SetupConfiguration {
  defaultProfiles: [UUID!]!
  allowCustomProfiles: Boolean!
  requireApproval: Boolean!
  maxSessionDuration: Int!
}

type Integration {
  id: UUID!
  type: IntegrationType!
  name: String!
  configuration: JSON!
  enabled: Boolean!
  lastSync: DateTime
}

enum IntegrationType {
  GITHUB
  GITLAB
  BITBUCKET
  JIRA
  SLACK
  TEAMS
  WEBHOOK
}
```

### User Types
```graphql
type User {
  id: UUID!
  email: String!
  name: String!
  role: UserRole!
  avatar: String
  preferences: UserPreferences!
  projects: [Project!]!
  createdAt: DateTime!
  lastActiveAt: DateTime
}

enum UserRole {
  ADMIN
  MANAGER
  DEVELOPER
  VIEWER
}

type UserPreferences {
  theme: Theme!
  language: String!
  notifications: NotificationSettings!
  dashboard: DashboardSettings!
}

enum Theme {
  LIGHT
  DARK
  AUTO
}
```

## Connection Types

### Page Info
```graphql
type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}

type AnalysisConnection {
  edges: [AnalysisEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type AnalysisEdge {
  node: Analysis!
  cursor: String!
}
```

## Subscription Events

### Analysis Events
```graphql
type AnalysisProgressEvent {
  analysisId: UUID!
  progress: Int!
  stage: String!
  message: String
  timestamp: DateTime!
}

type AnalysisCompletedEvent {
  analysis: Analysis!
  timestamp: DateTime!
}
```

### Setup Events
```graphql
type SetupProgressEvent {
  sessionId: UUID!
  progress: Int!
  currentStep: String!
  message: String
  timestamp: DateTime!
}

type SetupCompletedEvent {
  session: SetupSession!
  timestamp: DateTime!
}
```

### System Events
```graphql
type HealthStatusEvent {
  status: HealthStatus!
  timestamp: DateTime!
}

type NotificationEvent {
  id: UUID!
  type: NotificationType!
  title: String!
  message: String!
  data: JSON
  timestamp: DateTime!
}
```

## Input Types

### Analysis Options
```graphql
input AnalysisOptionsInput {
  includePaths: [String!]
  excludePaths: [String!]
  rules: [String!]
  depth: Int
  parallelism: Int
  timeout: Int
}
```

### Configuration Inputs
```graphql
input UpdateConfigurationInput {
  general: GeneralConfigurationInput
  analysis: AnalysisConfigurationInput
  setup: SetupConfigurationInput
  integrations: [IntegrationInput!]
  security: SecurityConfigurationInput
  notifications: NotificationConfigurationInput
}

input GeneralConfigurationInput {
  organizationName: String
  defaultLanguage: String
  timezone: String
  theme: Theme
}
```

## Error Handling

### Error Types
```graphql
type Error {
  code: ErrorCode!
  message: String!
  field: String
  details: JSON
}

enum ErrorCode {
  VALIDATION_ERROR
  NOT_FOUND
  UNAUTHORIZED
  FORBIDDEN
  INTERNAL_ERROR
  RATE_LIMITED
  SERVICE_UNAVAILABLE
}

interface Payload {
  errors: [Error!]!
  success: Boolean!
}
```

## Query Examples

### Complex Project Query
```graphql
query GetProjectWithAnalyses($projectId: UUID!) {
  project(id: $projectId) {
    id
    name
    description
    metrics {
      healthScore
      totalAnalyses
      averageQualityScore
    }
    analyses(limit: 5, status: COMPLETED) {
      edges {
        node {
          id
          type
          status
          results {
            summary {
              overallScore
              totalIssues
              criticalIssues
            }
          }
          createdAt
        }
      }
    }
  }
}
```

### Analysis Subscription
```graphql
subscription WatchAnalysis($analysisId: UUID!) {
  analysisProgress(analysisId: $analysisId) {
    analysisId
    progress
    stage
    message
    timestamp
  }
}
```

### Mutation Example
```graphql
mutation CreateAnalysis($input: CreateAnalysisInput!) {
  createAnalysis(input: $input) {
    analysis {
      id
      type
      status
      project {
        name
      }
    }
    errors {
      code
      message
      field
    }
    success
  }
}
```

## Schema Directives

### Custom Directives
```graphql
directive @auth(role: UserRole) on FIELD_DEFINITION
directive @rateLimit(max: Int!, window: Int!) on FIELD_DEFINITION
directive @cache(ttl: Int!) on FIELD_DEFINITION
directive @deprecated(reason: String) on FIELD_DEFINITION | ENUM_VALUE
```

### Usage Examples
```graphql
type Query {
  projects: [Project!]! @auth(role: DEVELOPER) @rateLimit(max: 100, window: 3600)
  adminMetrics: AdminMetrics! @auth(role: ADMIN)
}
```

## Schema Extensions

### Federation Support
```graphql
extend type User @key(fields: "id") {
  id: UUID! @external
  projects: [Project!]!
}
```

This GraphQL schema provides a comprehensive, type-safe API for the Wundr platform with support for real-time features, complex queries, and extensible architecture.