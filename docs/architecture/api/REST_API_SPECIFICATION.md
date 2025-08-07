# REST API Specification

## Overview

The Wundr platform REST API provides comprehensive access to analysis, setup, and configuration functionality. This document defines the complete API specification following OpenAPI 3.0 standards.

## Base Configuration

```yaml
openapi: 3.0.3
info:
  title: Wundr Platform API
  description: Unified developer platform for code analysis and environment setup
  version: 1.0.0
  contact:
    name: Wundr Platform Team
    email: api@wundr.io
  license:
    name: MIT
    url: https://opensource.org/licenses/MIT

servers:
  - url: https://api.wundr.io/v1
    description: Production server
  - url: https://api-staging.wundr.io/v1
    description: Staging server
  - url: http://localhost:8080/v1
    description: Development server
```

## Authentication

### Bearer Token Authentication
```yaml
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
    apiKey:
      type: apiKey
      in: header
      name: X-API-Key
```

## Core Endpoints

### Projects API

#### List Projects
```yaml
/projects:
  get:
    summary: List all projects
    tags: [Projects]
    security:
      - bearerAuth: []
    parameters:
      - name: limit
        in: query
        schema:
          type: integer
          minimum: 1
          maximum: 100
          default: 20
      - name: offset
        in: query
        schema:
          type: integer
          minimum: 0
          default: 0
      - name: search
        in: query
        schema:
          type: string
    responses:
      '200':
        description: List of projects
        content:
          application/json:
            schema:
              type: object
              properties:
                data:
                  type: array
                  items:
                    $ref: '#/components/schemas/Project'
                pagination:
                  $ref: '#/components/schemas/Pagination'
```

#### Create Project
```yaml
  post:
    summary: Create a new project
    tags: [Projects]
    security:
      - bearerAuth: []
    requestBody:
      required: true
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/CreateProjectRequest'
    responses:
      '201':
        description: Project created successfully
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/Project'
      '400':
        $ref: '#/components/responses/BadRequest'
      '401':
        $ref: '#/components/responses/Unauthorized'
```

#### Get Project
```yaml
/projects/{projectId}:
  get:
    summary: Get project by ID
    tags: [Projects]
    security:
      - bearerAuth: []
    parameters:
      - name: projectId
        in: path
        required: true
        schema:
          type: string
          format: uuid
    responses:
      '200':
        description: Project details
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/Project'
      '404':
        $ref: '#/components/responses/NotFound'
```

### Analysis API

#### List Analyses
```yaml
/projects/{projectId}/analyses:
  get:
    summary: List project analyses
    tags: [Analysis]
    security:
      - bearerAuth: []
    parameters:
      - name: projectId
        in: path
        required: true
        schema:
          type: string
          format: uuid
      - name: type
        in: query
        schema:
          type: string
          enum: [quality, security, dependencies, duplicates, complexity]
      - name: status
        in: query
        schema:
          type: string
          enum: [pending, running, completed, failed]
    responses:
      '200':
        description: List of analyses
        content:
          application/json:
            schema:
              type: array
              items:
                $ref: '#/components/schemas/Analysis'
```

#### Create Analysis
```yaml
  post:
    summary: Create new analysis
    tags: [Analysis]
    security:
      - bearerAuth: []
    parameters:
      - name: projectId
        in: path
        required: true
        schema:
          type: string
          format: uuid
    requestBody:
      required: true
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/CreateAnalysisRequest'
    responses:
      '202':
        description: Analysis started
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/Analysis'
```

#### Get Analysis Results
```yaml
/analyses/{analysisId}:
  get:
    summary: Get analysis results
    tags: [Analysis]
    security:
      - bearerAuth: []
    parameters:
      - name: analysisId
        in: path
        required: true
        schema:
          type: string
          format: uuid
    responses:
      '200':
        description: Analysis results
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/AnalysisResult'
```

### Setup API

#### List Setup Profiles
```yaml
/setup/profiles:
  get:
    summary: List setup profiles
    tags: [Setup]
    security:
      - bearerAuth: []
    responses:
      '200':
        description: List of setup profiles
        content:
          application/json:
            schema:
              type: array
              items:
                $ref: '#/components/schemas/SetupProfile'
```

#### Create Setup Session
```yaml
/setup/sessions:
  post:
    summary: Create setup session
    tags: [Setup]
    security:
      - bearerAuth: []
    requestBody:
      required: true
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/CreateSetupSessionRequest'
    responses:
      '201':
        description: Setup session created
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/SetupSession'
```

### Configuration API

#### Get Configuration
```yaml
/config:
  get:
    summary: Get system configuration
    tags: [Configuration]
    security:
      - bearerAuth: []
    responses:
      '200':
        description: System configuration
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/Configuration'
```

#### Update Configuration
```yaml
  put:
    summary: Update configuration
    tags: [Configuration]
    security:
      - bearerAuth: []
    requestBody:
      required: true
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/UpdateConfigurationRequest'
    responses:
      '200':
        description: Configuration updated
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/Configuration'
```

## Data Schemas

### Core Models

#### Project Schema
```yaml
components:
  schemas:
    Project:
      type: object
      required:
        - id
        - name
        - createdAt
        - updatedAt
      properties:
        id:
          type: string
          format: uuid
        name:
          type: string
          minLength: 1
          maxLength: 255
        description:
          type: string
          maxLength: 1000
        repositoryUrl:
          type: string
          format: uri
        configuration:
          $ref: '#/components/schemas/ProjectConfiguration'
        createdAt:
          type: string
          format: date-time
        updatedAt:
          type: string
          format: date-time
```

#### Analysis Schema
```yaml
    Analysis:
      type: object
      required:
        - id
        - projectId
        - type
        - status
        - createdAt
      properties:
        id:
          type: string
          format: uuid
        projectId:
          type: string
          format: uuid
        type:
          type: string
          enum: [quality, security, dependencies, duplicates, complexity]
        status:
          type: string
          enum: [pending, running, completed, failed]
        progress:
          type: integer
          minimum: 0
          maximum: 100
        results:
          $ref: '#/components/schemas/AnalysisResults'
        createdAt:
          type: string
          format: date-time
        completedAt:
          type: string
          format: date-time
```

#### Setup Profile Schema
```yaml
    SetupProfile:
      type: object
      required:
        - id
        - name
        - tools
      properties:
        id:
          type: string
          format: uuid
        name:
          type: string
        description:
          type: string
        tools:
          type: array
          items:
            $ref: '#/components/schemas/Tool'
        configuration:
          type: object
          additionalProperties: true
        templates:
          type: array
          items:
            $ref: '#/components/schemas/Template'
```

### Request Schemas

#### Create Project Request
```yaml
    CreateProjectRequest:
      type: object
      required:
        - name
      properties:
        name:
          type: string
          minLength: 1
          maxLength: 255
        description:
          type: string
          maxLength: 1000
        repositoryUrl:
          type: string
          format: uri
        configuration:
          $ref: '#/components/schemas/ProjectConfiguration'
```

#### Create Analysis Request
```yaml
    CreateAnalysisRequest:
      type: object
      required:
        - type
      properties:
        type:
          type: string
          enum: [quality, security, dependencies, duplicates, complexity]
        options:
          type: object
          properties:
            includePaths:
              type: array
              items:
                type: string
            excludePaths:
              type: array
              items:
                type: string
            depth:
              type: integer
              minimum: 1
              maximum: 10
```

### Response Schemas

#### Analysis Results
```yaml
    AnalysisResults:
      type: object
      properties:
        summary:
          $ref: '#/components/schemas/AnalysisSummary'
        metrics:
          type: array
          items:
            $ref: '#/components/schemas/Metric'
        issues:
          type: array
          items:
            $ref: '#/components/schemas/Issue'
        recommendations:
          type: array
          items:
            $ref: '#/components/schemas/Recommendation'
```

#### Metric Schema
```yaml
    Metric:
      type: object
      required:
        - name
        - value
        - category
      properties:
        name:
          type: string
        value:
          oneOf:
            - type: number
            - type: string
        category:
          type: string
          enum: [quality, performance, security, maintainability]
        description:
          type: string
        trend:
          type: string
          enum: [improving, declining, stable]
```

## Error Handling

### Standard Error Response
```yaml
components:
  responses:
    BadRequest:
      description: Bad request
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
    
    Unauthorized:
      description: Unauthorized
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
    
    NotFound:
      description: Resource not found
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
    
    InternalError:
      description: Internal server error
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'

  schemas:
    Error:
      type: object
      required:
        - code
        - message
      properties:
        code:
          type: string
        message:
          type: string
        details:
          type: array
          items:
            type: object
            properties:
              field:
                type: string
              message:
                type: string
        timestamp:
          type: string
          format: date-time
```

## Rate Limiting

### Rate Limit Headers
```yaml
# Response headers for all endpoints
headers:
  X-RateLimit-Limit:
    description: The number of allowed requests in the current period
    schema:
      type: integer
  X-RateLimit-Remaining:
    description: The number of remaining requests in the current period
    schema:
      type: integer
  X-RateLimit-Reset:
    description: The time at which the current rate limit window resets
    schema:
      type: integer
      format: unix-timestamp
```

### Rate Limits by Endpoint Category
- **Authentication**: 10 requests per minute
- **Analysis Operations**: 30 requests per hour
- **Setup Operations**: 60 requests per hour
- **Configuration**: 120 requests per hour
- **Data Retrieval**: 1000 requests per hour

## Pagination

### Standard Pagination
```yaml
components:
  schemas:
    Pagination:
      type: object
      properties:
        limit:
          type: integer
        offset:
          type: integer
        total:
          type: integer
        hasNext:
          type: boolean
        hasPrevious:
          type: boolean
```

## WebSocket Events

### Connection Endpoint
```
WSS wss://api.wundr.io/v1/ws?token={jwt_token}
```

### Event Types
```typescript
// Analysis events
interface AnalysisStartedEvent {
  type: 'analysis.started'
  data: {
    analysisId: string
    projectId: string
    type: string
  }
}

interface AnalysisProgressEvent {
  type: 'analysis.progress'
  data: {
    analysisId: string
    progress: number
    stage: string
  }
}

interface AnalysisCompletedEvent {
  type: 'analysis.completed'
  data: {
    analysisId: string
    results: AnalysisResults
  }
}

// Setup events
interface SetupProgressEvent {
  type: 'setup.progress'
  data: {
    sessionId: string
    progress: number
    currentStep: string
  }
}
```

## SDK Generation

### Supported Languages
- **TypeScript/JavaScript** - Primary SDK with full type support
- **Python** - Community SDK with basic functionality
- **Go** - Enterprise SDK for backend integrations
- **Java** - Enterprise SDK for JVM environments

### Example Usage
```typescript
import { WundrClient } from '@wundr/sdk'

const client = new WundrClient({
  apiKey: process.env.WUNDR_API_KEY,
  baseUrl: 'https://api.wundr.io/v1'
})

// Create analysis
const analysis = await client.analyses.create({
  projectId: 'project-uuid',
  type: 'quality'
})

// Subscribe to progress
client.ws.on('analysis.progress', (event) => {
  console.log(`Progress: ${event.data.progress}%`)
})
```

## Testing

### Test Endpoints
```yaml
/test/health:
  get:
    summary: Health check endpoint
    responses:
      '200':
        description: Service is healthy

/test/echo:
  post:
    summary: Echo request for testing
    requestBody:
      content:
        application/json:
          schema:
            type: object
    responses:
      '200':
        description: Echo response
```

This REST API specification provides a comprehensive foundation for the Wundr platform's HTTP-based communication layer, ensuring consistency, type safety, and excellent developer experience.