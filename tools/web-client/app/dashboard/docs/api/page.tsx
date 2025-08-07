import React, { Suspense } from 'react';
import { DocsLayout } from '@/components/docs/DocsLayout';
import { MarkdownRenderer } from '@/components/markdown/MarkdownRenderer';
import { SearchableContent } from '@/components/docs/SearchableContent';
import { ApiDocsRenderer } from '@/components/docs/ApiDocsRenderer';
import { VersionSwitcher } from '@/components/docs/VersionSwitcher';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Code, Copy, PlayCircle, FileText, Package, Settings } from 'lucide-react';
import { readDocFile, generateApiDocs, getCurrentDocVersion, DOCS_ROOT } from '@/lib/docs-utils';
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

// Load API documentation from multiple sources
const getAPIContent = async () => {
  try {
    // Try multiple potential locations
    const possiblePaths = [
      path.join(DOCS_ROOT, 'integration', 'INTEGRATION_API.md'),
      path.join(DOCS_ROOT, 'api', 'reference.md'),
      path.join(DOCS_ROOT, 'INTEGRATION_API.md')
    ];

    for (const docsPath of possiblePaths) {
      const docContent = await readDocFile(docsPath);
      if (docContent) {
        return {
          content: docContent.content,
          frontmatter: {
            ...docContent.frontmatter,
            title: docContent.frontmatter?.title || 'API Reference',
            description: docContent.frontmatter?.description || 'Complete API documentation for the analysis tools',
            category: docContent.frontmatter?.category || 'api',
            tags: docContent.frontmatter?.tags || ['api', 'reference', 'integration', 'typescript']
          }
        };
      }
    }
  } catch (error) {
    console.log('Could not read API docs from filesystem, using fallback content');
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


async function ApiDocsContent() {
  const [apiDocsResult, contentResult] = await Promise.all([
    generateApiDocs(),
    getAPIContent()
  ]);
  
  const currentVersion = getCurrentDocVersion();
  const { content, frontmatter } = contentResult;
  
  // Group API docs by type for overview
  const docsByType = apiDocsResult.reduce((acc, doc) => {
    if (!acc[doc.type]) acc[doc.type] = [];
    acc[doc.type].push(doc);
    return acc;
  }, {} as Record<string, typeof apiDocsResult>);

  const typeStats = Object.entries(docsByType).map(([type, docs]) => ({
    type,
    count: docs.length,
    icon: getTypeIcon(type)
  }));

  return (
    <>
      {/* API Overview Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">API Reference</h1>
            <p className="text-muted-foreground mt-2">
              Complete TypeScript API documentation with examples and usage patterns.
            </p>
          </div>
          <VersionSwitcher currentVersion={currentVersion.version} />
        </div>

        {/* API Statistics */}
        {typeStats.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {typeStats.map(({ type, count, icon }) => (
              <Card key={type} className="p-4">
                <div className="flex items-center gap-2">
                  {icon}
                  <div>
                    <p className="text-2xl font-bold">{count}</p>
                    <p className="text-sm text-muted-foreground capitalize">{type}s</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Quick Navigation */}
        {Object.keys(docsByType).length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Quick Navigation</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                {Object.entries(docsByType).map(([type, docs]) => (
                  <div key={type}>
                    <h3 className="font-semibold mb-2 flex items-center gap-2 capitalize">
                      {getTypeIcon(type)}
                      {type}s ({docs.length})
                    </h3>
                    <div className="space-y-1">
                      {docs.slice(0, 5).map(doc => (
                        <a
                          key={doc.name}
                          href={`#${doc.name.toLowerCase()}`}
                          className="block text-sm text-muted-foreground hover:text-primary hover:underline"
                        >
                          {doc.name}
                        </a>
                      ))}
                      {docs.length > 5 && (
                        <p className="text-xs text-muted-foreground">
                          +{docs.length - 5} more...
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="typescript">TypeScript API</TabsTrigger>
          <TabsTrigger value="endpoints">HTTP Endpoints</TabsTrigger>
          <TabsTrigger value="examples">Examples</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Main documentation content */}
          <MarkdownRenderer
            content={content}
            frontmatter={frontmatter}
            showMetadata={true}
            showTableOfContents={true}
            enableSyntaxHighlighting={true}
          />
        </TabsContent>

        <TabsContent value="typescript" className="space-y-6">
          {/* TypeScript API Documentation */}
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-4">TypeScript API Reference</h2>
              <p className="text-muted-foreground mb-6">
                Auto-generated documentation from TypeScript interfaces, types, and functions.
              </p>
            </div>
            <ApiDocsRenderer apiDocs={apiDocsResult} />
          </div>
        </TabsContent>

        <TabsContent value="endpoints" className="space-y-6">
          {/* HTTP API Endpoints - existing code */}
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-4">HTTP API Endpoints</h2>
              <p className="text-muted-foreground mb-6">
                REST API endpoints with request/response examples and interactive testing.
              </p>
            </div>

            {/* Existing HTTP endpoints code would go here */}
          </div>
        </TabsContent>

        <TabsContent value="examples" className="space-y-6">
          {/* Code Examples */}
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
                    TypeScript Usage
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Using the TypeScript interfaces and utilities
                  </p>
                </CardHeader>
                <CardContent>
                  <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
                    <code>{`import { DocPage, searchDocs } from '@/lib/docs-utils';

// Load and search documentation
const pages = await loadAllDocPages();
const results = searchDocs(pages, 'typescript patterns');

// Use with components
const docsProps = {
  content: page.content,
  frontmatter: page.frontmatter,
  showMetadata: true,
  enableSyntaxHighlighting: true
};`}</code>
                  </pre>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Code className="h-5 w-5" />
                    Component Integration
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Using documentation components in your app
                  </p>
                </CardHeader>
                <CardContent>
                  <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
                    <code>{`import { MarkdownRenderer } from '@/components/markdown/MarkdownRenderer';
import { ApiDocsRenderer } from '@/components/docs/ApiDocsRenderer';
import { AdvancedSearch } from '@/components/docs/AdvancedSearch';

// Render documentation
<MarkdownRenderer 
  content={content}
  enableSyntaxHighlighting={true}
  showTableOfContents={true}
/>

// Render API docs
<ApiDocsRenderer apiDocs={apiDocs} />`}</code>
                  </pre>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}

function getTypeIcon(type: string) {
  switch (type) {
    case 'interface': return <FileText className="h-4 w-4" />;
    case 'type': return <Code className="h-4 w-4" />;
    case 'function': return <Settings className="h-4 w-4" />;
    case 'class': return <Package className="h-4 w-4" />;
    case 'enum': return <Package className="h-4 w-4" />;
    default: return <Code className="h-4 w-4" />;
  }
}

function ApiDocsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-4">
            <Skeleton className="h-16 w-full" />
          </Card>
        ))}
      </div>
      
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="typescript">TypeScript API</TabsTrigger>
          <TabsTrigger value="endpoints">HTTP Endpoints</TabsTrigger>
          <TabsTrigger value="examples">Examples</TabsTrigger>
        </TabsList>
        <div className="space-y-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </Tabs>
    </div>
  );
}

function getMethodColor(method: string): string {
  const colors: Record<string, string> = {
    GET: 'bg-blue-500 text-white',
    POST: 'bg-green-500 text-white',
    PUT: 'bg-yellow-500 text-white',
    DELETE: 'bg-red-500 text-white',
    PATCH: 'bg-purple-500 text-white',
  };
  return colors[method] || 'bg-gray-500 text-white';
}

export default async function ApiPage() {
  const [apiDocsResult, contentResult] = await Promise.all([
    generateApiDocs(),
    getAPIContent()
  ]);
  
  const { content, frontmatter } = contentResult;
  const apiDocs = apiDocsResult;
  
  // Sample HTTP endpoints for demonstration
  const apiEndpoints = [
    {
      method: 'GET',
      path: '/api/analysis/entities',
      description: 'Get all code entities with analysis data',
      parameters: [
        { name: 'type', type: 'string', required: false, description: 'Filter by entity type' },
        { name: 'minComplexity', type: 'number', required: false, description: 'Minimum complexity threshold' }
      ],
      responses: {
        '200': { description: 'Successful response with entity data' },
        '500': { description: 'Internal server error' }
      }
    },
    {
      method: 'POST',
      path: '/api/reports/generate',
      description: 'Generate a new analysis report',
      parameters: [
        { name: 'templateId', type: 'string', required: true, description: 'Report template identifier' },
        { name: 'name', type: 'string', required: true, description: 'Report name' }
      ],
      responses: {
        '200': { description: 'Report generated successfully' },
        '400': { description: 'Invalid request parameters' }
      }
    }
  ];
  
  const currentPage = {
    title: 'API Reference',
    slug: 'api',
    path: '/dashboard/docs/api',
    category: 'api',
    description: 'Complete TypeScript and HTTP API documentation',
    tags: ['api', 'typescript', 'reference', 'http'],
    order: 1
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
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Responses */}
                    <div>
                      <h4 className="font-medium mb-2">Responses</h4>
                      <div className="space-y-3">
                        {Object.entries(endpoint.responses).map(([code, response], responseIndex) => (
                          <div key={responseIndex} className="border rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge
                                variant={parseInt(code) < 400 ? "default" : "destructive"}
                                className="font-mono"
                              >
                                {code}
                              </Badge>
                              <span className="text-sm">{response.description}</span>
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
