/**
 * Documentation Utilities
 * Tools for generating, processing, and managing documentation
 */

import { MarkdownProcessor, MarkdownUtils } from './markdown-utils';

export interface DocSection {
  id: string;
  title: string;
  content: string;
  level: number;
  order: number;
  tags: string[];
  lastUpdated: Date;
  author?: string;
}

export interface DocTemplate {
  id: string;
  name: string;
  description: string;
  sections: DocSection[];
  variables: Record<string, any>;
  metadata: {
    version: string;
    category: string;
    tags: string[];
  };
}

export interface APIDocumentation {
  title: string;
  version: string;
  baseUrl: string;
  description: string;
  endpoints: APIEndpoint[];
  schemas: Record<string, APISchema>;
  authentication?: AuthenticationDoc;
}

export interface APIEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  summary: string;
  description?: string;
  parameters?: APIParameter[];
  requestBody?: {
    required: boolean;
    contentType: string;
    schema: string;
    example?: any;
  };
  responses: Record<string, APIResponse>;
  tags: string[];
  deprecated?: boolean;
}

export interface APIParameter {
  name: string;
  in: 'query' | 'path' | 'header' | 'cookie';
  required: boolean;
  type: string;
  description: string;
  example?: any;
  default?: any;
}

export interface APIResponse {
  description: string;
  contentType?: string;
  schema?: string;
  example?: any;
}

export interface APISchema {
  type: 'object' | 'array' | 'string' | 'number' | 'boolean';
  properties?: Record<string, APISchema>;
  items?: APISchema;
  required?: string[];
  description?: string;
  example?: any;
}

export interface AuthenticationDoc {
  type: 'bearer' | 'apiKey' | 'oauth2' | 'basic';
  description: string;
  location?: 'header' | 'query';
  name?: string;
}

export interface CodeDocumentation {
  functions: FunctionDoc[];
  classes: ClassDoc[];
  interfaces: InterfaceDoc[];
  types: TypeDoc[];
  constants: ConstantDoc[];
  modules: ModuleDoc[];
}

export interface FunctionDoc {
  name: string;
  signature: string;
  description: string;
  parameters: ParameterDoc[];
  returnType: string;
  returnDescription: string;
  examples: string[];
  throws?: string[];
  deprecated?: boolean;
  since?: string;
}

export interface ClassDoc {
  name: string;
  description: string;
  constructor?: FunctionDoc;
  properties: PropertyDoc[];
  methods: FunctionDoc[];
  extends?: string;
  implements?: string[];
  examples: string[];
  deprecated?: boolean;
}

export interface InterfaceDoc {
  name: string;
  description: string;
  properties: PropertyDoc[];
  methods?: FunctionDoc[];
  extends?: string[];
  examples: string[];
}

export interface TypeDoc {
  name: string;
  type: string;
  description: string;
  examples: string[];
}

export interface ConstantDoc {
  name: string;
  type: string;
  value: any;
  description: string;
}

export interface ModuleDoc {
  name: string;
  path: string;
  description: string;
  exports: string[];
  dependencies: string[];
  examples: string[];
}

export interface ParameterDoc {
  name: string;
  type: string;
  description: string;
  optional: boolean;
  default?: any;
}

export interface PropertyDoc {
  name: string;
  type: string;
  description: string;
  optional: boolean;
  readonly?: boolean;
  default?: any;
}

/**
 * Main Documentation Generator
 */
export class DocsGenerator {
  private markdownProcessor: MarkdownProcessor;

  constructor() {
    this.markdownProcessor = new MarkdownProcessor();
  }

  /**
   * Generate API documentation from OpenAPI specification
   */
  generateAPIDocumentation(apiSpec: any): string {
    const doc: APIDocumentation = this.parseOpenAPISpec(apiSpec);
    return this.renderAPIDocumentation(doc);
  }

  /**
   * Generate code documentation from TypeScript/JavaScript source
   */
  generateCodeDocumentation(
    sourceCode: string,
    filePath: string
  ): CodeDocumentation {
    // This is a simplified implementation
    // In production, use a proper AST parser like TypeScript compiler API
    return {
      functions: this.extractFunctions(sourceCode),
      classes: this.extractClasses(sourceCode),
      interfaces: this.extractInterfaces(sourceCode),
      types: this.extractTypes(sourceCode),
      constants: this.extractConstants(sourceCode),
      modules: this.extractModules(sourceCode, filePath),
    };
  }

  /**
   * Generate README.md from project structure
   */
  generateReadme(projectInfo: {
    name: string;
    description: string;
    version: string;
    author?: string;
    license?: string;
    repository?: string;
    scripts?: Record<string, string>;
    dependencies?: string[];
    features?: string[];
    installation?: string[];
    usage?: string[];
    contributing?: string[];
  }): string {
    const sections = [
      `# ${projectInfo.name}`,
      '',
      projectInfo.description,
      '',
      '## Installation',
      '',
      ...(projectInfo.installation || ['```bash', 'npm install', '```']),
      '',
      '## Usage',
      '',
      ...(projectInfo.usage || [
        '```javascript',
        `const ${this.toCamelCase(projectInfo.name)} = require('${projectInfo.name}')`,
        '```',
      ]),
      '',
    ];

    if (projectInfo.features && projectInfo.features.length > 0) {
      sections.push('## Features', '');
      projectInfo.features.forEach(feature => {
        sections.push(`- ${feature}`);
      });
      sections.push('');
    }

    if (projectInfo.scripts && Object.keys(projectInfo.scripts).length > 0) {
      sections.push('## Scripts', '');
      Object.entries(projectInfo.scripts).forEach(([name, command]) => {
        sections.push(`- \`npm run ${name}\` - ${command}`);
      });
      sections.push('');
    }

    if (projectInfo.contributing && projectInfo.contributing.length > 0) {
      sections.push('## Contributing', '');
      sections.push(...projectInfo.contributing, '');
    }

    sections.push('## License', '');
    sections.push(projectInfo.license || 'MIT', '');

    if (projectInfo.author) {
      sections.push('## Author', '');
      sections.push(projectInfo.author, '');
    }

    return sections.join('\n');
  }

  /**
   * Generate changelog from git history or manual entries
   */
  generateChangelog(
    entries: Array<{
      version: string;
      date: Date;
      changes: Array<{
        type:
          | 'added'
          | 'changed'
          | 'deprecated'
          | 'removed'
          | 'fixed'
          | 'security';
        description: string;
      }>;
    }>
  ): string {
    const sections = ['# Changelog', ''];

    sections.push(
      'All notable changes to this project will be documented in this file.',
      ''
    );
    sections.push(
      'The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),'
    );
    sections.push(
      'and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).',
      ''
    );

    for (const entry of entries) {
      sections.push(
        `## [${entry.version}] - ${entry.date.toISOString().split('T')[0]}`,
        ''
      );

      const groupedChanges = this.groupChangesByType(entry.changes);

      for (const [type, changes] of Object.entries(groupedChanges)) {
        if (changes.length > 0) {
          sections.push(`### ${this.capitalizeFirst(type)}`, '');
          changes.forEach(change => {
            sections.push(`- ${change.description}`);
          });
          sections.push('');
        }
      }
    }

    return sections.join('\n');
  }

  /**
   * Generate component documentation for React/Vue components
   */
  generateComponentDocs(componentInfo: {
    name: string;
    description: string;
    props: Array<{
      name: string;
      type: string;
      required: boolean;
      default?: any;
      description: string;
    }>;
    events?: Array<{
      name: string;
      parameters: Array<{ name: string; type: string }>;
      description: string;
    }>;
    slots?: Array<{
      name: string;
      description: string;
    }>;
    examples: string[];
  }): string {
    const sections = [
      `# ${componentInfo.name}`,
      '',
      componentInfo.description,
      '',
    ];

    // Props documentation
    if (componentInfo.props.length > 0) {
      sections.push('## Props', '');
      sections.push('| Name | Type | Required | Default | Description |');
      sections.push('|------|------|----------|---------|-------------|');

      componentInfo.props.forEach(prop => {
        const defaultValue =
          prop.default !== undefined
            ? `\`${JSON.stringify(prop.default)}\``
            : '-';
        sections.push(
          `| \`${prop.name}\` | \`${prop.type}\` | ${prop.required ? '✓' : '✗'} | ${defaultValue} | ${prop.description} |`
        );
      });
      sections.push('');
    }

    // Events documentation
    if (componentInfo.events && componentInfo.events.length > 0) {
      sections.push('## Events', '');
      componentInfo.events.forEach(event => {
        sections.push(`### ${event.name}`, '');
        sections.push(event.description, '');
        if (event.parameters.length > 0) {
          sections.push('**Parameters:**', '');
          event.parameters.forEach(param => {
            sections.push(`- \`${param.name}\` (\`${param.type}\`)`);
          });
          sections.push('');
        }
      });
    }

    // Slots documentation
    if (componentInfo.slots && componentInfo.slots.length > 0) {
      sections.push('## Slots', '');
      componentInfo.slots.forEach(slot => {
        sections.push(`### ${slot.name}`, '');
        sections.push(slot.description, '');
      });
    }

    // Examples
    if (componentInfo.examples.length > 0) {
      sections.push('## Examples', '');
      componentInfo.examples.forEach((example, index) => {
        sections.push(`### Example ${index + 1}`, '');
        sections.push('```jsx');
        sections.push(example);
        sections.push('```', '');
      });
    }

    return sections.join('\n');
  }

  /**
   * Validate documentation completeness
   */
  validateDocumentation(docs: string): {
    score: number;
    issues: Array<{
      type: 'missing' | 'incomplete' | 'outdated';
      section: string;
      description: string;
      severity: 'low' | 'medium' | 'high';
    }>;
    recommendations: string[];
  } {
    const issues: Array<{
      type: 'missing' | 'incomplete' | 'outdated';
      section: string;
      description: string;
      severity: 'low' | 'medium' | 'high';
    }> = [];

    const recommendations: string[] = [];
    let score = 100;

    // Parse the documentation
    const parsed = this.markdownProcessor.parse(docs);

    // Check for missing sections
    const requiredSections = ['installation', 'usage', 'api', 'examples'];
    const headings = parsed.metadata.headings.map(h => h.text.toLowerCase());

    requiredSections.forEach(section => {
      if (!headings.some(h => h.includes(section))) {
        issues.push({
          type: 'missing',
          section,
          description: `Missing ${section} section`,
          severity: 'high',
        });
        score -= 20;
      }
    });

    // Check for short descriptions
    if (parsed.metadata.wordCount < 50) {
      issues.push({
        type: 'incomplete',
        section: 'description',
        description: 'Documentation is too brief',
        severity: 'medium',
      });
      score -= 10;
    }

    // Check for code examples
    const codeBlocks = parsed.ast.filter(node => node.type === 'code').length;
    if (codeBlocks === 0) {
      issues.push({
        type: 'missing',
        section: 'examples',
        description: 'No code examples found',
        severity: 'medium',
      });
      score -= 15;
    }

    // Generate recommendations
    if (issues.length > 0) {
      recommendations.push('Add missing documentation sections');
    }
    if (codeBlocks < 3) {
      recommendations.push('Include more code examples');
    }
    if (parsed.metadata.wordCount < 200) {
      recommendations.push(
        'Expand documentation with more detailed explanations'
      );
    }

    return {
      score: Math.max(0, score),
      issues,
      recommendations,
    };
  }

  // Private helper methods

  private parseOpenAPISpec(spec: any): APIDocumentation {
    return {
      title: spec.info?.title || 'API Documentation',
      version: spec.info?.version || '1.0.0',
      baseUrl: spec.servers?.[0]?.url || '',
      description: spec.info?.description || '',
      endpoints: this.extractEndpoints(spec.paths || {}),
      schemas: spec.components?.schemas || {},
      authentication: spec.components?.securitySchemes
        ? this.extractAuthentication(spec.components.securitySchemes)
        : undefined,
    };
  }

  private extractEndpoints(paths: any): APIEndpoint[] {
    const endpoints: APIEndpoint[] = [];

    for (const [path, methods] of Object.entries(paths)) {
      for (const [method, spec] of Object.entries(methods as any)) {
        if (
          ['get', 'post', 'put', 'delete', 'patch'].includes(
            method.toLowerCase()
          )
        ) {
          endpoints.push({
            method: method.toUpperCase() as any,
            path,
            summary: (spec as any).summary || '',
            description: (spec as any).description,
            parameters: (spec as any).parameters || [],
            requestBody: (spec as any).requestBody,
            responses: (spec as any).responses || {},
            tags: (spec as any).tags || [],
            deprecated: (spec as any).deprecated,
          });
        }
      }
    }

    return endpoints;
  }

  private extractAuthentication(securitySchemes: any): AuthenticationDoc {
    const firstScheme = Object.values(securitySchemes)[0] as any;
    return {
      type: firstScheme.type,
      description: firstScheme.description || '',
      location: firstScheme.in,
      name: firstScheme.name,
    };
  }

  private renderAPIDocumentation(doc: APIDocumentation): string {
    const sections = [
      `# ${doc.title}`,
      '',
      doc.description,
      '',
      `**Version:** ${doc.version}`,
      `**Base URL:** ${doc.baseUrl}`,
      '',
    ];

    if (doc.authentication) {
      sections.push('## Authentication', '');
      sections.push(doc.authentication.description, '');
    }

    sections.push('## Endpoints', '');

    const groupedEndpoints = this.groupEndpointsByTag(doc.endpoints);

    for (const [tag, endpoints] of Object.entries(groupedEndpoints)) {
      if (tag !== 'default') {
        sections.push(`### ${this.capitalizeFirst(tag)}`, '');
      }

      endpoints.forEach(endpoint => {
        sections.push(`#### ${endpoint.method} ${endpoint.path}`, '');
        sections.push(endpoint.summary, '');

        if (endpoint.description) {
          sections.push(endpoint.description, '');
        }

        if (endpoint.parameters && endpoint.parameters.length > 0) {
          sections.push('**Parameters:**', '');
          sections.push('| Name | Type | In | Required | Description |');
          sections.push('|------|------|----|----------|-------------|');

          endpoint.parameters.forEach(param => {
            sections.push(
              `| \`${param.name}\` | \`${param.type}\` | ${param.in} | ${param.required ? '✓' : '✗'} | ${param.description} |`
            );
          });
          sections.push('');
        }

        if (endpoint.responses) {
          sections.push('**Responses:**', '');
          Object.entries(endpoint.responses).forEach(([code, response]) => {
            sections.push(`- \`${code}\`: ${response.description}`);
          });
          sections.push('');
        }

        sections.push('---', '');
      });
    }

    return sections.join('\n');
  }

  private groupEndpointsByTag(
    endpoints: APIEndpoint[]
  ): Record<string, APIEndpoint[]> {
    return endpoints.reduce(
      (groups, endpoint) => {
        const tag = endpoint.tags.length > 0 ? endpoint.tags[0] : 'default';
        if (!groups[tag]) {
          groups[tag] = [];
        }
        groups[tag].push(endpoint);
        return groups;
      },
      {} as Record<string, APIEndpoint[]>
    );
  }

  private extractFunctions(sourceCode: string): FunctionDoc[] {
    // Simplified extraction - use proper AST parser in production
    const functions: FunctionDoc[] = [];
    const functionRegex =
      /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\([^)]*\)[^{]*{/g;
    let match;

    while ((match = functionRegex.exec(sourceCode)) !== null) {
      functions.push({
        name: match[1],
        signature: match[0].replace('{', '').trim(),
        description: '',
        parameters: [],
        returnType: 'any',
        returnDescription: '',
        examples: [],
      });
    }

    return functions;
  }

  private extractClasses(sourceCode: string): ClassDoc[] {
    const classes: ClassDoc[] = [];
    const classRegex =
      /(?:export\s+)?class\s+(\w+)(?:\s+extends\s+\w+)?(?:\s+implements\s+[\w,\s]+)?\s*{/g;
    let match;

    while ((match = classRegex.exec(sourceCode)) !== null) {
      classes.push({
        name: match[1],
        description: '',
        constructor: undefined,
        properties: [],
        methods: [],
        examples: [],
      });
    }

    return classes;
  }

  private extractInterfaces(sourceCode: string): InterfaceDoc[] {
    const interfaces: InterfaceDoc[] = [];
    const interfaceRegex =
      /(?:export\s+)?interface\s+(\w+)(?:\s+extends\s+[\w,\s]+)?\s*{/g;
    let match;

    while ((match = interfaceRegex.exec(sourceCode)) !== null) {
      interfaces.push({
        name: match[1],
        description: '',
        properties: [],
        examples: [],
      });
    }

    return interfaces;
  }

  private extractTypes(sourceCode: string): TypeDoc[] {
    const types: TypeDoc[] = [];
    const typeRegex = /(?:export\s+)?type\s+(\w+)\s*=\s*([^;\n]+)/g;
    let match;

    while ((match = typeRegex.exec(sourceCode)) !== null) {
      types.push({
        name: match[1],
        type: match[2].trim(),
        description: '',
        examples: [],
      });
    }

    return types;
  }

  private extractConstants(sourceCode: string): ConstantDoc[] {
    const constants: ConstantDoc[] = [];
    const constRegex =
      /(?:export\s+)?const\s+(\w+)\s*:\s*([^=]+)\s*=\s*([^;\n]+)/g;
    let match;

    while ((match = constRegex.exec(sourceCode)) !== null) {
      constants.push({
        name: match[1],
        type: match[2].trim(),
        value: match[3].trim(),
        description: '',
      });
    }

    return constants;
  }

  private extractModules(sourceCode: string, filePath: string): ModuleDoc[] {
    return [
      {
        name:
          filePath.split('/').pop()?.replace('.ts', '').replace('.js', '') ||
          '',
        path: filePath,
        description: '',
        exports: [],
        dependencies: [],
        examples: [],
      },
    ];
  }

  private groupChangesByType(
    changes: Array<{ type: string; description: string }>
  ): Record<string, Array<{ description: string }>> {
    return changes.reduce(
      (groups, change) => {
        if (!groups[change.type]) {
          groups[change.type] = [];
        }
        groups[change.type].push({ description: change.description });
        return groups;
      },
      {} as Record<string, Array<{ description: string }>>
    );
  }

  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  private toCamelCase(str: string): string {
    return str.replace(/[-_\s]+(.)?/g, (_, char) =>
      char ? char.toUpperCase() : ''
    );
  }
}

/**
 * Documentation Utilities
 */
export const DocsUtils = {
  /**
   * Extract TODO comments from source code
   */
  extractTodos(sourceCode: string): Array<{
    line: number;
    text: string;
    type: 'TODO' | 'FIXME' | 'NOTE' | 'HACK';
    priority: 'low' | 'medium' | 'high';
  }> {
    const todos: Array<{
      line: number;
      text: string;
      type: 'TODO' | 'FIXME' | 'NOTE' | 'HACK';
      priority: 'low' | 'medium' | 'high';
    }> = [];

    const lines = sourceCode.split('\n');
    const todoRegex = /(TODO|FIXME|NOTE|HACK):?\s*(.+)/i;

    lines.forEach((line, index) => {
      const match = line.match(todoRegex);
      if (match) {
        const type = match[1].toUpperCase() as any;
        const priority =
          type === 'FIXME' ? 'high' : type === 'TODO' ? 'medium' : 'low';

        todos.push({
          line: index + 1,
          text: match[2].trim(),
          type,
          priority,
        });
      }
    });

    return todos;
  },

  /**
   * Generate documentation statistics
   */
  generateStats(docs: string): {
    wordCount: number;
    characterCount: number;
    readingTime: number;
    sections: number;
    codeBlocks: number;
    links: number;
    images: number;
  } {
    const processor = new MarkdownProcessor();
    const parsed = processor.parse(docs);

    return {
      wordCount: parsed.metadata.wordCount,
      characterCount: docs.length,
      readingTime: parsed.metadata.readingTime,
      sections: parsed.metadata.headings.length,
      codeBlocks: parsed.ast.filter(node => node.type === 'code').length,
      links: MarkdownUtils.extractLinks(docs).filter(
        link => link.type === 'link'
      ).length,
      images: MarkdownUtils.extractLinks(docs).filter(
        link => link.type === 'image'
      ).length,
    };
  },

  /**
   * Create documentation template
   */
  createTemplate(type: 'readme' | 'api' | 'component' | 'changelog'): string {
    const templates = {
      readme: `# Project Name

Brief description of the project.

## Installation

\`\`\`bash
npm install
\`\`\`

## Usage

\`\`\`javascript
// Basic usage example
\`\`\`

## API Reference

### Class: Example

Description of the class.

#### Methods

##### \`method(param)\`

- **param** (string): Description of parameter
- **Returns**: Description of return value

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT`,

      api: `# API Documentation

## Overview

Brief description of the API.

**Base URL:** \`https://api.example.com\`

## Authentication

Description of authentication method.

## Endpoints

### GET /endpoint

Description of endpoint.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| param | string | Yes | Parameter description |

**Response:**

\`\`\`json
{
  "data": "example"
}
\`\`\``,

      component: `# ComponentName

Brief description of the component.

## Props

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| prop | string | No | \`"default"\` | Prop description |

## Events

### event-name

Description of event.

**Parameters:**
- \`value\` (any): Event data

## Examples

\`\`\`jsx
<ComponentName prop="value" @event-name="handler" />
\`\`\``,

      changelog: `# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- New feature descriptions

### Changed
- Changed feature descriptions

### Fixed
- Bug fix descriptions

## [1.0.0] - 2024-01-01

### Added
- Initial release`,
    };

    return templates[type];
  },

  /**
   * Merge multiple documentation files
   */
  mergeDocumentation(docs: Array<{ title: string; content: string }>): string {
    const sections = ['# Combined Documentation', ''];

    docs.forEach(doc => {
      sections.push(`## ${doc.title}`, '');
      sections.push(doc.content, '');
    });

    return sections.join('\n');
  },
};

/**
 * Read documentation file from filesystem
 * @param filePath Path to the documentation file
 * @returns File content as string
 */
export async function readDocFile(filePath: string): Promise<string> {
  try {
    // In a browser environment, this would typically use fetch
    // For server-side, you'd use fs.readFile
    const response = await fetch(filePath);
    if (!response.ok) {
      throw new Error(`Failed to read file: ${response.statusText}`);
    }
    return await response.text();
  } catch (error) {
    console.error('Error reading doc file:', error);
    throw new Error(`Failed to read documentation file: ${filePath}`);
  }
}

/**
 * Generate API documentation from OpenAPI spec
 * @param apiSpec OpenAPI specification object
 * @param options Generation options
 * @returns Generated documentation as markdown string
 */
export function generateApiDocs(
  apiSpec: any,
  options: {
    format?: 'markdown' | 'html' | 'json';
    includeExamples?: boolean;
    includeSchemas?: boolean;
  } = {}
): string {
  const {
    format = 'markdown',
    includeExamples = true,
    includeSchemas = true,
  } = options;
  const generator = new DocsGenerator();

  if (format !== 'markdown') {
    throw new Error('Only markdown format is currently supported');
  }

  let documentation = generator.generateAPIDocumentation(apiSpec);

  // Add schemas section if requested and available
  if (includeSchemas && apiSpec.components?.schemas) {
    documentation += '\n\n## Schemas\n\n';
    for (const [schemaName, schema] of Object.entries(
      apiSpec.components.schemas
    )) {
      documentation += `### ${schemaName}\n\n`;
      documentation += '```json\n';
      documentation += JSON.stringify(schema, null, 2);
      documentation += '\n```\n\n';
    }
  }

  return documentation;
}

/**
 * Get current documentation version
 * @param projectPath Path to project root
 * @returns Current documentation version string
 */
export function getCurrentDocVersion(): string {
  try {
    // Try to get version from package.json
    if (typeof window === 'undefined') {
      // Server-side: would read from package.json
      return '1.0.0'; // Fallback version
    } else {
      // Client-side: try to get from meta tag or config
      const versionMeta = document.querySelector('meta[name="doc-version"]');
      if (versionMeta) {
        return versionMeta.getAttribute('content') || '1.0.0';
      }
    }

    // Default version if nothing else is available
    return '1.0.0';
  } catch (error) {
    console.warn('Could not determine documentation version:', error);
    return '1.0.0';
  }
}

// Additional interfaces for docs components
export interface DocPage {
  id: string;
  title: string;
  description?: string;
  content: string;
  category: string;
  tags?: string[];
  url: string;
  lastModified?: Date;
}

export interface SearchResult {
  page: DocPage;
  matchType: 'title' | 'description' | 'content';
  relevanceScore: number;
  matches?: Array<{
    field: string;
    content: string;
    snippet: string;
  }>;
}

export interface ApiDocEntry {
  id: string;
  name: string;
  type: 'interface' | 'type' | 'function' | 'class' | 'enum';
  description: string;
  signature?: string;
  parameters?: Array<{
    name: string;
    type: string;
    description?: string;
    required?: boolean;
    default?: any;
  }>;
  returns?: {
    type: string;
    description?: string;
  };
  examples?: Array<string | { title: string; code: string }>;
}

export interface DocVersion {
  version: string;
  label: string;
  deprecated?: boolean;
  releaseDate?: Date;
}

// Documentation categories
export const docCategories = [
  { value: 'guide', label: 'Guides' },
  { value: 'api', label: 'API Reference' },
  { value: 'tutorial', label: 'Tutorials' },
  { value: 'example', label: 'Examples' },
  { value: 'reference', label: 'Reference' },
];

// Available documentation versions
export const DOCS_VERSIONS: DocVersion[] = [
  {
    version: '2.0.0',
    label: 'v2.0 (Latest)',
    deprecated: false,
    releaseDate: new Date('2024-01-01'),
  },
  {
    version: '1.9.0',
    label: 'v1.9',
    deprecated: false,
    releaseDate: new Date('2023-11-01'),
  },
  {
    version: '1.8.0',
    label: 'v1.8',
    deprecated: true,
    releaseDate: new Date('2023-08-01'),
  },
];

/**
 * Search through documentation pages
 * @param query Search query
 * @param pages Array of documentation pages
 * @returns Array of search results
 */
export function searchDocs(query: string, pages: DocPage[]): SearchResult[] {
  if (!query.trim()) return [];

  const searchTerms = query
    .toLowerCase()
    .split(' ')
    .filter(term => term.length > 0);
  const results: SearchResult[] = [];

  pages.forEach(page => {
    let relevanceScore = 0;
    let matchType: 'title' | 'description' | 'content' = 'content';
    const matches: Array<{ field: string; content: string; snippet: string }> =
      [];

    // Check title matches (highest priority)
    const titleMatches = searchTerms.filter(term =>
      page.title.toLowerCase().includes(term)
    );
    if (titleMatches.length > 0) {
      relevanceScore += titleMatches.length * 10;
      matchType = 'title';
      matches.push({
        field: 'title',
        content: page.title,
        snippet: page.title,
      });
    }

    // Check description matches (medium priority)
    if (page.description) {
      const descMatches = searchTerms.filter(term =>
        page.description!.toLowerCase().includes(term)
      );
      if (descMatches.length > 0) {
        relevanceScore += descMatches.length * 5;
        if (matchType === 'content') matchType = 'description';
        matches.push({
          field: 'description',
          content: page.description,
          snippet: page.description.substring(0, 150) + '...',
        });
      }
    }

    // Check content matches (lowest priority)
    const contentMatches = searchTerms.filter(term =>
      page.content.toLowerCase().includes(term)
    );
    if (contentMatches.length > 0) {
      relevanceScore += contentMatches.length * 2;

      // Find snippet around first match
      const firstTerm = contentMatches[0];
      const index = page.content.toLowerCase().indexOf(firstTerm);
      if (index !== -1) {
        const start = Math.max(0, index - 50);
        const end = Math.min(page.content.length, index + 100);
        const snippet = page.content.substring(start, end);

        matches.push({
          field: 'content',
          content: page.content,
          snippet: snippet,
        });
      }
    }

    // Check tag matches
    if (page.tags) {
      const tagMatches = searchTerms.filter(term =>
        page.tags!.some(tag => tag.toLowerCase().includes(term))
      );
      if (tagMatches.length > 0) {
        relevanceScore += tagMatches.length * 3;
      }
    }

    // Add to results if any matches found
    if (relevanceScore > 0) {
      results.push({
        page,
        matchType,
        relevanceScore,
        matches,
      });
    }
  });

  // Sort by relevance score (highest first)
  return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
}

export default DocsGenerator;

// Additional interfaces and functions needed by MarkdownRenderer
export interface DocFrontmatter {
  title?: string;
  description?: string;
  author?: string;
  date?: string;
  tags?: string[];
  [key: string]: any;
}

export interface DocHeader {
  level: number;
  title: string;
  id: string;
  line?: number;
}

/**
 * Extract document headers from markdown content
 * @param markdown - The markdown content to parse
 * @returns Array of header objects
 */
export function extractDocHeaders(markdown: string): DocHeader[] {
  const lines = markdown.split('\n');
  const headers: DocHeader[] = [];

  lines.forEach((line, index) => {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const title = match[2].trim();
      const id = title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

      headers.push({
        level,
        title,
        id,
        line: index + 1,
      });
    }
  });

  return headers;
}
