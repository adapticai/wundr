#!/usr/bin/env ts-node

/**
 * API Documentation Generator
 *
 * This script automatically generates OpenAPI documentation from the existing
 * API routes in the web client and creates Docusaurus-compatible markdown files.
 */

import fs from 'fs-extra';
import path from 'path';
import { glob } from 'glob';

interface APIRoute {
  path: string;
  methods: string[];
  description: string;
  parameters?: Parameter[];
  responses?: Response[];
  examples?: Example[];
}

interface Parameter {
  name: string;
  type: string;
  required: boolean;
  description: string;
  location: 'query' | 'path' | 'body' | 'header';
}

interface Response {
  status: number;
  description: string;
  schema?: any;
  example?: any;
}

interface Example {
  title: string;
  request?: any;
  response?: any;
}

class APIDocGenerator {
  private webClientPath: string;
  private outputPath: string;
  private routes: APIRoute[] = [];

  constructor() {
    this.webClientPath = path.resolve(__dirname, '../../../tools/web-client');
    this.outputPath = path.resolve(__dirname, '../api');
  }

  async generate(): Promise<void> {
    console.log('🔍 Scanning API routes...');
    await this.scanAPIRoutes();

    console.log('📄 Generating OpenAPI spec...');
    await this.generateOpenAPISpec();

    console.log('📝 Creating documentation pages...');
    await this.generateDocPages();

    console.log('✅ API documentation generated successfully!');
  }

  private async scanAPIRoutes(): Promise<void> {
    const routeFiles = await glob(`${this.webClientPath}/app/api/**/route.ts`);

    for (const routeFile of routeFiles) {
      const route = await this.parseRouteFile(routeFile);
      if (route) {
        this.routes.push(route);
      }
    }

    console.log(`Found ${this.routes.length} API routes`);
  }

  private async parseRouteFile(filePath: string): Promise<APIRoute | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const relativePath = path.relative(
        `${this.webClientPath}/app/api`,
        filePath
      );
      const apiPath =
        '/' +
        relativePath.replace('/route.ts', '').replace(/\[([^\]]+)\]/g, ':$1');

      const methods: string[] = [];
      if (content.includes('export async function GET')) methods.push('GET');
      if (content.includes('export async function POST')) methods.push('POST');
      if (content.includes('export async function PUT')) methods.push('PUT');
      if (content.includes('export async function DELETE'))
        methods.push('DELETE');
      if (content.includes('export async function PATCH'))
        methods.push('PATCH');

      if (methods.length === 0) return null;

      // Extract description from comments or infer from path
      const description = this.extractDescription(content, apiPath);
      const parameters = this.extractParameters(content, apiPath);
      const responses = this.extractResponses(content);
      const examples = this.extractExamples(content);

      return {
        path: apiPath,
        methods,
        description,
        parameters,
        responses,
        examples,
      };
    } catch (error) {
      console.warn(`Failed to parse ${filePath}:`, error);
      return null;
    }
  }

  private extractDescription(content: string, path: string): string {
    // Look for JSDoc comments
    const jsdocMatch = content.match(/\/\*\*[\s\S]*?\*\//);
    if (jsdocMatch) {
      return jsdocMatch[0]
        .replace(/\/\*\*|\*\/|\s\*\s?/g, '')
        .trim()
        .split('\n')[0];
    }

    // Generate description from path
    const pathSegments = path.split('/').filter(Boolean);
    const resourceName =
      pathSegments[pathSegments.length - 1] ||
      pathSegments[pathSegments.length - 2];
    return `${resourceName} operations`;
  }

  private extractParameters(content: string, path: string): Parameter[] {
    const parameters: Parameter[] = [];

    // Extract path parameters
    const pathParams = path.match(/:([^/]+)/g);
    if (pathParams) {
      pathParams.forEach(param => {
        parameters.push({
          name: param.slice(1),
          type: 'string',
          required: true,
          description: `The ${param.slice(1)} identifier`,
          location: 'path',
        });
      });
    }

    // Extract query parameters from searchParams usage
    const searchParamsMatches = content.match(
      /searchParams\.get\(['"`]([^'"`]+)['"`]\)/g
    );
    if (searchParamsMatches) {
      searchParamsMatches.forEach(match => {
        const paramName = match.match(/['"`]([^'"`]+)['"`]/)?.[1];
        if (paramName) {
          parameters.push({
            name: paramName,
            type: 'string',
            required: false,
            description: `Query parameter: ${paramName}`,
            location: 'query',
          });
        }
      });
    }

    return parameters;
  }

  private extractResponses(content: string): Response[] {
    const responses: Response[] = [];

    // Default success response
    responses.push({
      status: 200,
      description: 'Successful response',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: { type: 'object' },
          timestamp: { type: 'string' },
        },
      },
    });

    // Look for error responses
    if (content.includes('status: 400')) {
      responses.push({
        status: 400,
        description: 'Bad Request',
        schema: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'string' },
            timestamp: { type: 'string' },
          },
        },
      });
    }

    if (content.includes('status: 500')) {
      responses.push({
        status: 500,
        description: 'Internal Server Error',
        schema: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'string' },
            timestamp: { type: 'string' },
          },
        },
      });
    }

    return responses;
  }

  private extractExamples(content: string): Example[] {
    const examples: Example[] = [];

    // This could be enhanced to extract actual examples from the code
    examples.push({
      title: 'Basic Request',
      response: {
        success: true,
        data: {},
        timestamp: new Date().toISOString(),
      },
    });

    return examples;
  }

  private async generateOpenAPISpec(): Promise<void> {
    const spec = {
      openapi: '3.0.0',
      info: {
        title: 'Wundr API',
        version: '2.0.0',
        description: 'Comprehensive API for Wundr platform operations',
        contact: {
          name: 'Wundr Support',
          url: 'https://github.com/adapticai/wundr',
          email: 'support@wundr.io',
        },
        license: {
          name: 'MIT',
          url: 'https://opensource.org/licenses/MIT',
        },
      },
      servers: [
        {
          url: 'http://localhost:3000/api',
          description: 'Development server',
        },
        {
          url: 'https://api.wundr.io',
          description: 'Production server',
        },
      ],
      paths: this.generatePaths(),
      components: this.generateComponents(),
    };

    await fs.ensureDir(this.outputPath);
    await fs.writeJSON(path.join(this.outputPath, 'openapi.json'), spec, {
      spaces: 2,
    });
  }

  private generatePaths(): any {
    const paths: any = {};

    for (const route of this.routes) {
      if (!paths[route.path]) {
        paths[route.path] = {};
      }

      for (const method of route.methods) {
        paths[route.path][method.toLowerCase()] = {
          summary: route.description,
          description: route.description,
          parameters: route.parameters?.map(param => ({
            name: param.name,
            in: param.location,
            required: param.required,
            description: param.description,
            schema: { type: param.type },
          })),
          responses: route.responses?.reduce(
            (acc, response) => ({
              ...acc,
              [response.status]: {
                description: response.description,
                content: response.schema
                  ? {
                      'application/json': {
                        schema: response.schema,
                        example: response.example,
                      },
                    }
                  : undefined,
              },
            }),
            {}
          ),
          tags: [this.getTagFromPath(route.path)],
        };
      }
    }

    return paths;
  }

  private generateComponents(): any {
    return {
      schemas: {
        ApiResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' },
            error: { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' },
          },
          required: ['success', 'timestamp'],
        },
        AnalysisData: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' },
            version: { type: 'string' },
            summary: { $ref: '#/components/schemas/DashboardSummary' },
            entities: {
              type: 'array',
              items: { $ref: '#/components/schemas/AnalysisEntity' },
            },
          },
        },
        DashboardSummary: {
          type: 'object',
          properties: {
            totalFiles: { type: 'number' },
            totalEntities: { type: 'number' },
            totalLines: { type: 'number' },
            duplicateClusters: { type: 'number' },
            circularDependencies: { type: 'number' },
            codeSmells: { type: 'number' },
            bugs: { type: 'number' },
            vulnerabilities: { type: 'number' },
            maintainabilityIndex: { type: 'number' },
            testCoverage: { type: 'number' },
          },
        },
        AnalysisEntity: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            path: { type: 'string' },
            type: { type: 'string' },
            complexity: { type: 'number' },
            size: { type: 'number' },
          },
        },
      },
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    };
  }

  private getTagFromPath(path: string): string {
    const segments = path.split('/').filter(Boolean);
    return segments[0] || 'general';
  }

  private async generateDocPages(): Promise<void> {
    // Generate overview page
    await this.generateOverviewPage();

    // Generate category pages
    const categories = [
      ...new Set(this.routes.map(route => this.getTagFromPath(route.path))),
    ];

    for (const category of categories) {
      await this.generateCategoryPage(category);
    }
  }

  private async generateOverviewPage(): Promise<void> {
    const content = `# API Reference

Welcome to the Wundr API documentation. This API provides comprehensive access to all Wundr platform features including analysis, reporting, configuration, and batch operations.

## Base URLs

- **Development**: \`http://localhost:3000/api\`
- **Production**: \`https://api.wundr.io\`

## Authentication

The Wundr API uses JWT Bearer tokens for authentication:

\`\`\`http
Authorization: Bearer <your-jwt-token>
\`\`\`

## Response Format

All API responses follow a consistent format:

\`\`\`json
{
  "success": true,
  "data": { ... },
  "timestamp": "2024-01-01T00:00:00Z"
}
\`\`\`

Error responses include an additional \`error\` field:

\`\`\`json
{
  "success": false,
  "data": null,
  "error": "Error description",
  "timestamp": "2024-01-01T00:00:00Z"
}
\`\`\`

## Rate Limiting

API requests are rate-limited to:
- **Public endpoints**: 1000 requests per hour
- **Authenticated endpoints**: 5000 requests per hour

## OpenAPI Specification

Download the complete OpenAPI 3.0 specification:

- [JSON Format](/api/openapi.json)
- [Interactive API Explorer](/api/swagger)

## Available Endpoints

${this.generateEndpointsList()}

## Quick Start

\`\`\`typescript
import { WundrAPI } from '@wundr/api-client';

const client = new WundrAPI({
  baseUrl: 'http://localhost:3000/api',
  token: 'your-jwt-token'
});

// Get analysis data
const analysis = await client.analysis.get();
console.log(analysis.summary);
\`\`\`
`;

    await fs.writeFile(path.join(this.outputPath, 'overview.md'), content);
  }

  private generateEndpointsList(): string {
    const categories = [
      ...new Set(this.routes.map(route => this.getTagFromPath(route.path))),
    ];

    return categories
      .map(category => {
        const categoryRoutes = this.routes.filter(
          route => this.getTagFromPath(route.path) === category
        );
        const routeList = categoryRoutes
          .map(
            route =>
              `- [\`${route.methods.join(', ')} ${route.path}\`](./${category}/${route.path.split('/').pop() || 'overview'}) - ${route.description}`
          )
          .join('\n');

        return `### ${category.charAt(0).toUpperCase() + category.slice(1)}\n\n${routeList}`;
      })
      .join('\n\n');
  }

  private async generateCategoryPage(category: string): Promise<void> {
    const categoryRoutes = this.routes.filter(
      route => this.getTagFromPath(route.path) === category
    );

    await fs.ensureDir(path.join(this.outputPath, category));

    const content = `# ${category.charAt(0).toUpperCase() + category.slice(1)} API

## Overview

This section covers all API endpoints related to ${category} operations.

## Endpoints

${categoryRoutes.map(route => this.generateRouteDocumentation(route)).join('\n\n---\n\n')}
`;

    await fs.writeFile(
      path.join(this.outputPath, category, 'overview.md'),
      content
    );

    // Generate individual endpoint pages
    for (const route of categoryRoutes) {
      await this.generateEndpointPage(category, route);
    }
  }

  private async generateEndpointPage(
    category: string,
    route: APIRoute
  ): Promise<void> {
    const filename = route.path.split('/').pop() || 'endpoint';
    const content = `# ${route.methods.join(', ')} ${route.path}

${route.description}

## Methods

${route.methods.map(method => `- \`${method}\``).join('\n')}

## Parameters

${
  route.parameters && route.parameters.length > 0
    ? route.parameters
        .map(
          param =>
            `- **${param.name}** (${param.type}${param.required ? ', required' : ', optional'}) - ${param.description}`
        )
        .join('\n')
    : 'No parameters required.'
}

## Response Examples

${
  route.examples && route.examples.length > 0
    ? route.examples
        .map(
          example => `
### ${example.title}

${
  example.response
    ? `
\`\`\`json
${JSON.stringify(example.response, null, 2)}
\`\`\`
`
    : ''
}
  `
        )
        .join('\n')
    : `
\`\`\`json
{
  "success": true,
  "data": {},
  "timestamp": "2024-01-01T00:00:00Z"
}
\`\`\`
`
}

## Error Responses

${
  route.responses
    ? route.responses
        .filter(r => r.status >= 400)
        .map(
          response => `
### ${response.status} - ${response.description}

${
  response.schema
    ? `
\`\`\`json
${JSON.stringify(response.schema, null, 2)}
\`\`\`
`
    : ''
}
  `
        )
        .join('\n')
    : 'Standard error responses apply.'
}
`;

    await fs.writeFile(
      path.join(this.outputPath, category, `${filename}.md`),
      content
    );
  }

  private generateRouteDocumentation(route: APIRoute): string {
    return `## ${route.methods.join(', ')} ${route.path}

${route.description}

**Parameters:**
${
  route.parameters && route.parameters.length > 0
    ? route.parameters
        .map(
          param =>
            `- \`${param.name}\` (${param.type}${param.required ? ', required' : ', optional'}) - ${param.description}`
        )
        .join('\n')
    : 'None'
}

**Example Response:**
\`\`\`json
${JSON.stringify(route.examples?.[0]?.response || { success: true, data: {}, timestamp: new Date().toISOString() }, null, 2)}
\`\`\``;
  }
}

// Run the generator
if (require.main === module) {
  const generator = new APIDocGenerator();
  generator.generate().catch(console.error);
}

export { APIDocGenerator };
