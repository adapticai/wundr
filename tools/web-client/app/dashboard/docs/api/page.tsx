import React from 'react';
import { DocsLayout } from '@/components/docs/DocsLayout';
import { MarkdownRenderer } from '@/components/markdown/MarkdownRenderer';
import { SearchableContent } from '@/components/docs/SearchableContent';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Code, Copy, PlayCircle } from 'lucide-react';
import { readDocFile } from '@/lib/docs-utils';
import path from 'path';

interface APIEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  description: string;
  parameters?: Parameter[];
  requestBody?: RequestBody;
  responses: Response[];
  examples: Example[];
}

interface Parameter {
  name: string;
  type: string;
  required: boolean;
  description: string;
  example?: string;
}

interface RequestBody {
  contentType: string;
  schema: string;
  example: string;
}

interface Response {
  status: number;
  description: string;
  schema?: string;
  example: string;
}

interface Example {
  title: string;
  description: string;
  request: string;
  response: string;
}

// This would be generated from OpenAPI spec or similar in a real app
const getAPIContent = async () => {
  try {
    // Try to read from the project's docs directory
    const docsPath = path.join(process.cwd(), '../../docs/integration/INTEGRATION_API.md');
    const docContent = await readDocFile(docsPath);

    if (docContent) {
      return {
        content: docContent.content,
        frontmatter: {
          title: 'API Reference',
          description: 'Complete API documentation for the analysis tools',
          category: 'reference',
          tags: ['api', 'reference', 'integration'],
          ...docContent.frontmatter
        }
      };
    }
  } catch (_error) {
    console.log('Could not read from filesystem, using fallback content');
  }

  // Fallback content
  return {
    content: `# API Reference

Complete API documentation for Wundr Dashboard integration and analysis tools.

## Base URL

\`\`\`
https://api.wundr.io/v1
\`\`\`

## Authentication

All API requests require authentication using an API key:

\`\`\`bash
curl -H "Authorization: Bearer YOUR_API_KEY" \\
  https://api.wundr.io/v1/analysis
\`\`\`

## Rate Limits

- **Free tier**: 100 requests per hour
- **Pro tier**: 1,000 requests per hour
- **Enterprise**: Custom limits

## Core Endpoints

### Analysis

#### Start Analysis
\`POST /analysis\`

Starts a new code analysis on the specified repository or codebase.

**Request Body:**
\`\`\`json
{
  "repository": {
    "url": "https://github.com/user/repo",
    "branch": "main",
    "path": "src/"
  },
  "options": {
    "includeDuplicates": true,
    "includeComplexity": true,
    "includeTests": false
  }
}
\`\`\`

**Response:**
\`\`\`json
{
  "analysisId": "analysis_123456",
  "status": "pending",
  "estimatedDuration": "5-10 minutes",
  "webhookUrl": "https://your-app.com/webhooks/analysis"
}
\`\`\`

#### Get Analysis Status
\`GET /analysis/{analysisId}\`

Retrieves the current status and results of an analysis.

**Response:**
\`\`\`json
{
  "analysisId": "analysis_123456",
  "status": "completed",
  "startedAt": "2024-01-15T10:00:00Z",
  "completedAt": "2024-01-15T10:07:30Z",
  "results": {
    "summary": {
      "totalFiles": 150,
      "duplicateBlocks": 23,
      "complexityScore": 7.2,
      "testCoverage": 85.3
    },
    "duplicates": [...],
    "complexity": [...],
    "recommendations": [...]
  }
}
\`\`\`

### Repositories

#### List Repositories
\`GET /repositories\`

Lists all repositories configured for analysis.

**Query Parameters:**
- \`page\` (optional): Page number (default: 1)
- \`limit\` (optional): Items per page (default: 20, max: 100)
- \`status\` (optional): Filter by status (\`active\`, \`archived\`)

**Response:**
\`\`\`json
{
  "repositories": [
    {
      "id": "repo_123",
      "name": "my-awesome-project",
      "url": "https://github.com/user/my-awesome-project",
      "status": "active",
      "lastAnalyzed": "2024-01-15T10:07:30Z",
      "metrics": {
        "files": 150,
        "duplicates": 23,
        "complexity": 7.2
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "pages": 3
  }
}
\`\`\`

#### Add Repository
\`POST /repositories\`

Adds a new repository for analysis.

**Request Body:**
\`\`\`json
{
  "name": "my-new-project",
  "url": "https://github.com/user/my-new-project",
  "branch": "main",
  "webhookUrl": "https://your-app.com/webhooks",
  "settings": {
    "autoAnalyze": true,
    "excludePaths": ["node_modules", "dist"],
    "includeTests": false
  }
}
\`\`\`

### Duplicates

#### Get Duplicate Code Blocks
\`GET /analysis/{analysisId}/duplicates\`

Retrieves duplicate code blocks found in the analysis.

**Query Parameters:**
- \`minLines\` (optional): Minimum number of lines (default: 5)
- \`similarity\` (optional): Minimum similarity threshold (default: 0.8)

**Response:**
\`\`\`json
{
  "duplicates": [
    {
      "id": "dup_123",
      "similarity": 0.95,
      "blocks": [
        {
          "file": "src/services/UserService.ts",
          "startLine": 45,
          "endLine": 67,
          "content": "..."
        },
        {
          "file": "src/services/OrderService.ts",
          "startLine": 32,
          "endLine": 54,
          "content": "..."
        }
      ],
      "suggestion": {
        "action": "extract_function",
        "description": "Extract common validation logic",
        "confidence": 0.9
      }
    }
  ]
}
\`\`\`

### Recommendations

#### Get Refactoring Recommendations
\`GET /analysis/{analysisId}/recommendations\`

Retrieves AI-generated refactoring recommendations.

**Response:**
\`\`\`json
{
  "recommendations": [
    {
      "id": "rec_123",
      "priority": "high",
      "category": "code_duplication",
      "title": "Consolidate user validation logic",
      "description": "Found 5 similar validation patterns that can be consolidated",
      "impact": {
        "linesReduced": 120,
        "filesAffected": 5,
        "estimatedHours": 2.5
      },
      "steps": [
        "Create shared validation utility",
        "Update UserService.ts",
        "Update OrderService.ts",
        "Add unit tests"
      ]
    }
  ]
}
\`\`\`

## Webhooks

Configure webhooks to receive real-time updates about analysis completion and other events.

### Events

- \`analysis.started\` - Analysis has begun
- \`analysis.completed\` - Analysis finished successfully
- \`analysis.failed\` - Analysis encountered an error
- \`repository.updated\` - Repository settings changed

### Webhook Payload

\`\`\`json
{
  "event": "analysis.completed",
  "timestamp": "2024-01-15T10:07:30Z",
  "data": {
    "analysisId": "analysis_123456",
    "repositoryId": "repo_123",
    "status": "completed",
    "results": {
      "summary": {...},
      "url": "https://api.wundr.io/v1/analysis/analysis_123456"
    }
  }
}
\`\`\`

## Error Handling

All errors follow a consistent format:

\`\`\`json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "The request body is invalid",
    "details": [
      {
        "field": "repository.url",
        "message": "Must be a valid Git URL"
      }
    ]
  }
}
\`\`\`

### Error Codes

- \`INVALID_REQUEST\` (400): Request validation failed
- \`UNAUTHORIZED\` (401): Invalid or missing API key
- \`FORBIDDEN\` (403): Insufficient permissions
- \`NOT_FOUND\` (404): Resource not found
- \`RATE_LIMITED\` (429): Too many requests
- \`INTERNAL_ERROR\` (500): Server error

## SDKs and Libraries

Official SDKs are available for:

- **Node.js**: \`npm install @wundr/sdk\`
- **Python**: \`pip install wundr-sdk\`
- **Go**: \`go get github.com/wundr/go-sdk\`

### Node.js Example

\`\`\`typescript
import { WundrClient } from '@wundr/sdk';

const client = new WundrClient({
  apiKey: process.env.WUNDR_API_KEY
});

// Start analysis
const analysis = await client.analysis.create({
  repository: {
    url: 'https://github.com/user/repo',
    branch: 'main'
  }
});

// Wait for completion
const result = await client.analysis.waitForCompletion(analysis.analysisId);
console.log('Analysis completed:', result.summary);
\`\`\`

## Integration Examples

### GitHub Actions

\`\`\`yaml
name: Code Analysis
on: [push, pull_request]

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Run Wundr Analysis
        uses: wundr/github-action@v1
        with:
          api-key: \${{ secrets.WUNDR_API_KEY }}
          webhook-url: \${{ secrets.WEBHOOK_URL }}
\`\`\`

### CI/CD Pipeline

\`\`\`bash
#!/bin/bash
# Add to your CI/CD pipeline

curl -X POST https://api.wundr.io/v1/analysis \\
  -H "Authorization: Bearer $WUNDR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "repository": {
      "url": "'$GITHUB_REPOSITORY'",
      "branch": "'$GITHUB_REF_NAME'"
    }
  }'
\`\`\`

## Support

- **API Status**: [status.wundr.io](https://status.wundr.io)
- **Documentation**: [docs.wundr.io](https://docs.wundr.io)
- **Support**: [support@wundr.io](mailto:support@wundr.io)
`,
    frontmatter: {
      title: 'API Reference',
      description: 'Complete API documentation for the analysis tools',
      category: 'reference',
      tags: ['api', 'reference', 'integration']
    }
  };
};

const apiEndpoints: APIEndpoint[] = [
  {
    method: 'POST',
    path: '/analysis',
    description: 'Start a new code analysis',
    requestBody: {
      contentType: 'application/json',
      schema: 'AnalysisRequest',
      example: `{
  "repository": {
    "url": "https://github.com/user/repo",
    "branch": "main"
  },
  "options": {
    "includeDuplicates": true,
    "includeComplexity": true
  }
}`
    },
    responses: [
      {
        status: 201,
        description: 'Analysis started successfully',
        example: `{
  "analysisId": "analysis_123456",
  "status": "pending",
  "estimatedDuration": "5-10 minutes"
}`
      }
    ],
    examples: [
      {
        title: 'Basic Analysis',
        description: 'Start analysis with default options',
        request: 'POST /analysis',
        response: '201 Created'
      }
    ]
  },
  {
    method: 'GET',
    path: '/analysis/{analysisId}',
    description: 'Get analysis status and results',
    parameters: [
      {
        name: 'analysisId',
        type: 'string',
        required: true,
        description: 'Unique analysis identifier',
        example: 'analysis_123456'
      }
    ],
    responses: [
      {
        status: 200,
        description: 'Analysis details retrieved successfully',
        example: `{
  "analysisId": "analysis_123456",
  "status": "completed",
  "results": {...}
}`
      }
    ],
    examples: [
      {
        title: 'Get Analysis Results',
        description: 'Retrieve completed analysis',
        request: 'GET /analysis/analysis_123456',
        response: '200 OK'
      }
    ]
  }
];

export default async function APIPage() {
  const { content, frontmatter } = await getAPIContent();

  const currentPage = {
    title: 'API Reference',
    slug: 'api',
    path: '/dashboard/docs/api',
    category: 'reference',
    description: 'Complete API documentation for integration',
    tags: ['api', 'reference', 'integration'],
    order: 4
  };

  const getMethodColor = (method: string) => {
    const colors = {
      GET: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      POST: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      PUT: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      DELETE: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      PATCH: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
    };
    return colors[method as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  return (
    <DocsLayout currentPage={currentPage}>
      <div className="max-w-6xl space-y-6">
        {/* Search functionality */}
        <SearchableContent
          content={content}
          onNavigate={(sectionId) => {
            const element = document.getElementById(sectionId);
            if (element) {
              element.scrollIntoView({ behavior: 'smooth' });
            }
          }}
        />

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="endpoints">Endpoints</TabsTrigger>
            <TabsTrigger value="examples">Examples</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Main documentation content */}
            <MarkdownRenderer
              content={content}
              frontmatter={frontmatter}
              showMetadata={true}
              showTableOfContents={true}
            />
          </TabsContent>

          <TabsContent value="endpoints" className="space-y-6">
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold mb-4">API Endpoints</h2>
                <p className="text-muted-foreground mb-6">
                  Interactive API reference with request/response examples and try-it functionality.
                </p>
              </div>

              {apiEndpoints.map((endpoint, index) => (
                <Card key={index}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge className={getMethodColor(endpoint.method)}>
                          {endpoint.method}
                        </Badge>
                        <code className="text-lg font-mono">{endpoint.path}</code>
                      </div>
                      <Button variant="outline" size="sm">
                        <PlayCircle className="h-4 w-4 mr-2" />
                        Try it
                      </Button>
                    </div>
                    <p className="text-muted-foreground">{endpoint.description}</p>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Parameters */}
                    {endpoint.parameters && endpoint.parameters.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">Parameters</h4>
                        <div className="space-y-2">
                          {endpoint.parameters.map((param, paramIndex) => (
                            <div key={paramIndex} className="flex items-start gap-4">
                              <code className="text-sm bg-muted px-2 py-1 rounded min-w-0 flex-shrink-0">
                                {param.name}
                              </code>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge variant="outline" className="text-xs">
                                    {param.type}
                                  </Badge>
                                  {param.required && (
                                    <Badge variant="destructive" className="text-xs">
                                      required
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {param.description}
                                </p>
                                {param.example && (
                                  <code className="text-xs text-muted-foreground">
                                    Example: {param.example}
                                  </code>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Request Body */}
                    {endpoint.requestBody && (
                      <div>
                        <h4 className="font-medium mb-2">Request Body</h4>
                        <div className="space-y-2">
                          <Badge variant="outline">{endpoint.requestBody.contentType}</Badge>
                          <div className="relative">
                            <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
                              <code>{endpoint.requestBody.example}</code>
                            </pre>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="absolute top-2 right-2"
                              onClick={() => navigator.clipboard.writeText(endpoint.requestBody!.example)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Responses */}
                    <div>
                      <h4 className="font-medium mb-2">Responses</h4>
                      <div className="space-y-3">
                        {endpoint.responses.map((response, responseIndex) => (
                          <div key={responseIndex} className="border rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge
                                variant={response.status < 400 ? "default" : "destructive"}
                                className="font-mono"
                              >
                                {response.status}
                              </Badge>
                              <span className="text-sm">{response.description}</span>
                            </div>
                            <div className="relative">
                              <pre className="bg-muted p-3 rounded text-sm overflow-x-auto">
                                <code>{response.example}</code>
                              </pre>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="absolute top-1 right-1"
                                onClick={() => navigator.clipboard.writeText(response.example)}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="examples" className="space-y-6">
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold mb-4">Code Examples</h2>
                <p className="text-muted-foreground mb-6">
                  Ready-to-use code examples for common integration scenarios.
                </p>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Code className="h-5 w-5" />
                      Node.js SDK
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Using the official Node.js SDK for easy integration
                    </p>
                  </CardHeader>
                  <CardContent>
                    <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
                      <code>{`import { WundrClient } from '@wundr/sdk';

const client = new WundrClient({
  apiKey: process.env.WUNDR_API_KEY
});

// Start analysis
const analysis = await client.analysis.create({
  repository: {
    url: 'https://github.com/user/repo',
    branch: 'main'
  }
});

// Get results
const result = await client.analysis.get(
  analysis.analysisId
);`}</code>
                    </pre>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Code className="h-5 w-5" />
                      cURL Examples
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Direct HTTP API calls using cURL
                    </p>
                  </CardHeader>
                  <CardContent>
                    <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
                      <code>{`# Start analysis
curl -X POST https://api.wundr.io/v1/analysis \\
  -H "Authorization: Bearer $API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "repository": {
      "url": "https://github.com/user/repo"
    }
  }'

# Get results
curl -H "Authorization: Bearer $API_KEY" \\
  https://api.wundr.io/v1/analysis/123456`}</code>
                    </pre>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>GitHub Actions Integration</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Automatically run analysis on every push or pull request
                  </p>
                </CardHeader>
                <CardContent>
                  <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
                    <code>{`name: Code Analysis
on: [push, pull_request]

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Run Wundr Analysis
        uses: wundr/github-action@v1
        with:
          api-key: \${{ secrets.WUNDR_API_KEY }}
          webhook-url: \${{ secrets.WEBHOOK_URL }}

      - name: Comment PR
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v6
        with:
          script: |
            // Add analysis results to PR comment
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: 'Analysis completed! View results: \${{ steps.analyze.outputs.dashboard-url }}'
            });`}</code>
                  </pre>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DocsLayout>
  );
}
