'use client';

import React from 'react';
import type { ApiSchema } from '@/types/mdx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
  in: 'path' | 'query' | 'header';
}

interface RequestBody {
  contentType: string;
  schema: ApiSchema;
  required: boolean;
}

interface Response {
  status: number;
  description: string;
  contentType?: string;
  schema?: ApiSchema;
}

interface Example {
  title: string;
  description?: string;
  request?: {
    method: string;
    path: string;
    headers?: Record<string, string>;
    body?: unknown;
  };
  response?: {
    status: number;
    headers?: Record<string, string>;
    body?: unknown;
  };
}

interface ApiDocEntry {
  title: string;
  description: string;
  version: string;
  baseUrl: string;
  endpoints: APIEndpoint[];
}

// Sample API documentation data
const apiDocumentation: ApiDocEntry[] = [
  {
    title: 'Analysis API',
    description: 'Endpoints for code analysis and metrics',
    version: '1.0.0',
    baseUrl: '/api/analysis',
    endpoints: [
      {
        method: 'POST',
        path: '/analyze',
        description: 'Analyze a codebase for quality metrics and issues',
        parameters: [
          {
            name: 'path',
            type: 'string',
            required: true,
            description: 'Path to the codebase directory',
            in: 'query'
          },
          {
            name: 'depth',
            type: 'string',
            required: false,
            description: 'Analysis depth: shallow, medium, or deep',
            in: 'query'
          }
        ],
        responses: [
          {
            status: 200,
            description: 'Analysis completed successfully',
            contentType: 'application/json'
          },
          {
            status: 400,
            description: 'Invalid request parameters'
          }
        ],
        examples: [
          {
            title: 'Basic Analysis',
            request: {
              method: 'POST',
              path: '/api/analysis/analyze?path=/src&depth=medium',
              headers: {
                'Content-Type': 'application/json'
              }
            },
            response: {
              status: 200,
              body: {
                status: 'success',
                metrics: {
                  totalFiles: 150,
                  issues: 23
                }
              }
            }
          }
        ]
      },
      {
        method: 'GET',
        path: '/duplicates',
        description: 'Get duplicate code analysis results',
        parameters: [
          {
            name: 'threshold',
            type: 'number',
            required: false,
            description: 'Similarity threshold (0-100)',
            in: 'query'
          }
        ],
        responses: [
          {
            status: 200,
            description: 'Duplicate analysis results',
            contentType: 'application/json'
          }
        ],
        examples: []
      }
    ]
  },
  {
    title: 'Reports API',
    description: 'Generate and manage analysis reports',
    version: '1.0.0',
    baseUrl: '/api/reports',
    endpoints: [
      {
        method: 'POST',
        path: '/generate',
        description: 'Generate a new analysis report',
        requestBody: {
          contentType: 'application/json',
          required: true,
          schema: {
            type: 'object',
            properties: {
              templateId: { type: 'string' },
              format: { type: 'string', enum: ['pdf', 'html', 'json'] }
            }
          }
        },
        responses: [
          {
            status: 201,
            description: 'Report generated successfully',
            contentType: 'application/json'
          }
        ],
        examples: []
      }
    ]
  }
];

// API endpoint card component
function ApiEndpointCard({ endpoint }: { endpoint: APIEndpoint }) {
  const methodColors = {
    GET: 'bg-green-500',
    POST: 'bg-blue-500',
    PUT: 'bg-yellow-500',
    DELETE: 'bg-red-500',
    PATCH: 'bg-purple-500'
  };

  return (
    <Card className="mb-4">
      <CardHeader>
        <div className="flex items-center gap-3">
          <Badge className={`${methodColors[endpoint.method]} text-white`}>
            {endpoint.method}
          </Badge>
          <code className="text-sm font-mono">{endpoint.path}</code>
        </div>
        <p className="text-sm text-muted-foreground mt-2">{endpoint.description}</p>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="parameters" className="w-full">
          <TabsList>
            <TabsTrigger value="parameters">Parameters</TabsTrigger>
            {endpoint.requestBody && <TabsTrigger value="request">Request Body</TabsTrigger>}
            <TabsTrigger value="responses">Responses</TabsTrigger>
            {endpoint.examples.length > 0 && <TabsTrigger value="examples">Examples</TabsTrigger>}
          </TabsList>

          <TabsContent value="parameters" className="mt-4">
            {endpoint.parameters && endpoint.parameters.length > 0 ? (
              <div className="space-y-2">
                {endpoint.parameters.map((param, index) => (
                  <div key={index} className="border-l-2 pl-4 py-2">
                    <div className="flex items-center gap-2">
                      <code className="font-mono text-sm">{param.name}</code>
                      <Badge variant="outline" className="text-xs">
                        {param.type}
                      </Badge>
                      {param.required && (
                        <Badge variant="destructive" className="text-xs">
                          Required
                        </Badge>
                      )}
                      <Badge variant="secondary" className="text-xs">
                        {param.in}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {param.description}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No parameters</p>
            )}
          </TabsContent>

          {endpoint.requestBody && (
            <TabsContent value="request" className="mt-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{endpoint.requestBody.contentType}</Badge>
                  {endpoint.requestBody.required && (
                    <Badge variant="destructive" className="text-xs">
                      Required
                    </Badge>
                  )}
                </div>
                {endpoint.requestBody.schema && (
                  <pre className="bg-muted p-3 rounded-md overflow-x-auto">
                    <code className="text-xs">
                      {JSON.stringify(endpoint.requestBody.schema, null, 2)}
                    </code>
                  </pre>
                )}
              </div>
            </TabsContent>
          )}

          <TabsContent value="responses" className="mt-4">
            <div className="space-y-3">
              {endpoint.responses.map((response, index) => (
                <div key={index} className="border rounded-md p-3">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={response.status < 300 ? 'default' : 'destructive'}
                    >
                      {response.status}
                    </Badge>
                    <span className="text-sm">{response.description}</span>
                  </div>
                  {response.contentType && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Content-Type: {response.contentType}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </TabsContent>

          {endpoint.examples.length > 0 && (
            <TabsContent value="examples" className="mt-4">
              <div className="space-y-4">
                {endpoint.examples.map((example, index) => (
                  <div key={index} className="space-y-2">
                    <h4 className="font-medium">{example.title}</h4>
                    {example.description && (
                      <p className="text-sm text-muted-foreground">{example.description}</p>
                    )}
                    {example.request && (
                      <div>
                        <p className="text-xs font-medium mb-1">Request:</p>
                        <pre className="bg-muted p-3 rounded-md overflow-x-auto">
                          <code className="text-xs">
                            {`${example.request.method} ${example.request.path}
${example.request.headers ? Object.entries(example.request.headers).map(([k, v]) => `${k}: ${v}`).join('\n') : ''}
${example.request.body ? '\n' + JSON.stringify(example.request.body, null, 2) : ''}`}
                          </code>
                        </pre>
                      </div>
                    )}
                    {example.response && (
                      <div>
                        <p className="text-xs font-medium mb-1">Response:</p>
                        <pre className="bg-muted p-3 rounded-md overflow-x-auto">
                          <code className="text-xs">
                            {`Status: ${example.response.status}
${example.response.body ? JSON.stringify(example.response.body, null, 2) : ''}`}
                          </code>
                        </pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </TabsContent>
          )}
        </Tabs>
      </CardContent>
    </Card>
  );
}

// Client component for interactive API documentation
export function ApiDocsContent() {
  const [selectedApi, setSelectedApi] = React.useState(0);

  return (
    <div className="max-w-5xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">API Documentation</h1>
        <p className="text-muted-foreground">
          Complete reference for the Wundr Analysis API endpoints
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-1">
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle className="text-sm">API Sections</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <nav className="space-y-1">
                {apiDocumentation.map((api, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedApi(index)}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-muted transition-colors ${
                      selectedApi === index ? 'bg-muted font-medium' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{api.title}</span>
                      <Badge variant="outline" className="text-xs">
                        {api.endpoints.length}
                      </Badge>
                    </div>
                  </button>
                ))}
              </nav>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-3">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold mb-2">
              {apiDocumentation[selectedApi].title}
            </h2>
            <p className="text-muted-foreground">
              {apiDocumentation[selectedApi].description}
            </p>
            <div className="flex items-center gap-4 mt-4">
              <Badge variant="secondary">
                Version {apiDocumentation[selectedApi].version}
              </Badge>
              <code className="text-sm bg-muted px-2 py-1 rounded">
                {apiDocumentation[selectedApi].baseUrl}
              </code>
            </div>
          </div>

          <div className="space-y-4">
            {apiDocumentation[selectedApi].endpoints.map((endpoint, index) => (
              <ApiEndpointCard key={index} endpoint={endpoint} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}