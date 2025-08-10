'use client';

import React from 'react';
import { DocsLayout } from '@/components/docs/DocsLayout';
import { MarkdownRenderer } from '@/components/markdown/MarkdownRenderer';
import { SearchableContent } from '@/components/docs/SearchableContent';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileCode, Download, Eye, Copy } from 'lucide-react';

interface Template {
  name: string;
  description: string;
  category: string;
  files: string[];
  path: string;
  tags: string[];
}

// This would be dynamically generated in a real app
const getTemplatesContent = async () => {
  try {
    // Import Node.js modules dynamically on server-side only
    const path = await import('path');
    const { promises: fs } = await import('fs');
    
    // Try to read templates from filesystem
    const templatesPath = path.join(process.cwd(), '../../templates');
    const templateCategories = await fs.readdir(templatesPath, { withFileTypes: true });
    
    const templates: Template[] = [];
    
    for (const category of templateCategories) {
      if (category.isDirectory()) {
        const categoryPath = path.join(templatesPath, category.name);
        const files = await fs.readdir(categoryPath, { withFileTypes: true });
        
        // Check if this is a template directory
        const templateFiles = files
          .filter(file => file.isFile())
          .map(file => file.name);
          
        if (templateFiles.length > 0) {
          templates.push({
            name: category.name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            description: getTemplateDescription(category.name),
            category: getCategoryType(category.name),
            files: templateFiles,
            path: `../../templates/${category.name}`,
            tags: getTemplateTags(category.name)
          });
        }
      }
    }
    
    return templates;
  } catch (_error) {
    console.log('Could not read templates from filesystem, using fallback');
    return getFallbackTemplates();
  }
};

const getTemplateDescription = (templateName: string): string => {
  const descriptions: Record<string, string> = {
    'service-template': 'Base service structure with TypeScript interfaces and error handling',
    'package-template': 'Complete package setup with tests, build configuration, and documentation',
    'consolidation-batches': 'JSON templates for managing code consolidation workflows',
    'consumer-integration': 'Integration examples for embedding analysis tools',
    'reports': 'Markdown templates for migration and weekly reports'
  };
  return descriptions[templateName] || 'Template files for common patterns';
};

const getCategoryType = (templateName: string): string => {
  if (templateName.includes('service')) return 'services';
  if (templateName.includes('package')) return 'packages';
  if (templateName.includes('batch')) return 'workflows';
  if (templateName.includes('integration')) return 'integration';
  if (templateName.includes('report')) return 'reports';
  return 'general';
};

const getTemplateTags = (templateName: string): string[] => {
  const tagMap: Record<string, string[]> = {
    'service-template': ['typescript', 'service', 'base-class'],
    'package-template': ['package', 'npm', 'typescript', 'jest'],
    'consolidation-batches': ['workflow', 'json', 'automation'],
    'consumer-integration': ['integration', 'config', 'plugin'],
    'reports': ['markdown', 'documentation', 'reporting']
  };
  return tagMap[templateName] || ['template'];
};

const getFallbackTemplates = (): Template[] => [
  {
    name: 'Service Template',
    description: 'Base service structure with TypeScript interfaces and error handling',
    category: 'services',
    files: ['base-service.ts', 'example-service.ts', 'service.test.ts'],
    path: 'templates/service-template',
    tags: ['typescript', 'service', 'base-class']
  },
  {
    name: 'Package Template',
    description: 'Complete package setup with tests, build configuration, and documentation',
    category: 'packages',
    files: ['package.json', 'tsconfig.json', 'README.md', 'src/index.ts', 'tests/index.test.ts'],
    path: 'templates/package-template',
    tags: ['package', 'npm', 'typescript', 'jest']
  },
  {
    name: 'Consolidation Batches',
    description: 'JSON templates for managing code consolidation workflows',
    category: 'workflows',
    files: ['batch-template.json', 'batch-example.json'],
    path: 'templates/consolidation-batches',
    tags: ['workflow', 'json', 'automation']
  },
  {
    name: 'Consumer Integration',
    description: 'Integration examples for embedding analysis tools',
    category: 'integration',
    files: ['wundr.config.json', 'hooks.config.js', 'plugin-example/'],
    path: 'templates/consumer-integration',
    tags: ['integration', 'config', 'plugin']
  }
];

export default async function TemplatesPage() {
  const templates = await getTemplatesContent();

  const currentPage = {
    title: 'Templates',
    slug: 'templates',
    path: '/dashboard/docs/templates',
    category: 'resources',
    description: 'Available templates and examples for common patterns',
    tags: ['templates', 'examples', 'code'],
    order: 2
  };

  const templatesByCategory = templates.reduce((acc, template) => {
    if (!acc[template.category]) {
      acc[template.category] = [];
    }
    acc[template.category].push(template);
    return acc;
  }, {} as Record<string, Template[]>);

  const content = `# Templates and Examples

This section contains ready-to-use templates and examples for common patterns in monorepo refactoring and code organization.

## Available Templates

Below you'll find templates organized by category, each providing a solid foundation for your development needs.

### Using Templates

Templates can be used in several ways:

1. **Copy and modify**: Use as a starting point for your own implementations
2. **Reference**: Study the patterns and apply similar approaches
3. **Integration**: Import directly into your project where applicable

### Template Categories

Our templates are organized into the following categories:

- **Services**: Base classes and service patterns
- **Packages**: Complete package structures with build tools
- **Workflows**: Automation and batch processing templates
- **Integration**: Examples for integrating with external systems
- **Reports**: Documentation and reporting templates

Each template includes comprehensive documentation and usage examples.
`;

  const categoryIcons = {
    services: '🔧',
    packages: '📦',
    workflows: '⚡',
    integration: '🔌',
    reports: '📊',
    general: '📁'
  };

  const categoryColors = {
    services: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    packages: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    workflows: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    integration: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    reports: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
    general: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
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

        {/* Introduction */}
        <MarkdownRenderer
          content={content}
          frontmatter={{
            title: 'Templates and Examples',
            description: 'Ready-to-use templates for common development patterns',
            category: 'resources'
          }}
          showMetadata={true}
          showTableOfContents={false}
        />

        {/* Templates Grid */}
        <div className="space-y-8">
          {Object.entries(templatesByCategory).map(([category, categoryTemplates]) => (
            <div key={category}>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">{categoryIcons[category as keyof typeof categoryIcons] || '📁'}</span>
                <h2 className="text-2xl font-bold capitalize">{category} Templates</h2>
                <Badge 
                  variant="secondary" 
                  className={categoryColors[category as keyof typeof categoryColors]}
                >
                  {categoryTemplates.length} template{categoryTemplates.length !== 1 ? 's' : ''}
                </Badge>
              </div>
              
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {categoryTemplates.map((template) => (
                  <Card key={template.name} className="flex flex-col">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="flex items-center gap-2">
                            <FileCode className="h-5 w-5 text-primary" />
                            {template.name}
                          </CardTitle>
                          <CardDescription className="mt-2">
                            {template.description}
                          </CardDescription>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap gap-1 mt-3">
                        {template.tags.map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </CardHeader>
                    
                    <CardContent className="flex-1 flex flex-col">
                      <div className="flex-1">
                        <h4 className="font-medium text-sm mb-2">Files included:</h4>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          {template.files.slice(0, 5).map((file) => (
                            <li key={file} className="flex items-center gap-2">
                              <div className="w-1 h-1 rounded-full bg-current opacity-50" />
                              <code className="text-xs bg-muted px-1 py-0.5 rounded">
                                {file}
                              </code>
                            </li>
                          ))}
                          {template.files.length > 5 && (
                            <li className="text-xs text-muted-foreground">
                              +{template.files.length - 5} more files...
                            </li>
                          )}
                        </ul>
                      </div>
                      
                      <div className="flex gap-2 mt-4 pt-4 border-t">
                        <Button variant="outline" size="sm" className="flex-1">
                          <Eye className="h-4 w-4 mr-2" />
                          Preview
                        </Button>
                        <Button variant="outline" size="sm" className="flex-1">
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </Button>
                        <Button variant="outline" size="sm" className="px-3">
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Usage Instructions */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Using Templates</CardTitle>
            <CardDescription>
              How to integrate these templates into your project
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h4 className="font-medium mb-2">Command Line</h4>
                <pre className="bg-muted p-3 rounded-lg text-sm overflow-x-auto">
                  <code>{`# Copy a template
npx wundr init --template service-template

# Or download specific files
curl -O <template-url>/base-service.ts`}</code>
                </pre>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Manual Setup</h4>
                <ol className="text-sm space-y-1 list-decimal list-inside text-muted-foreground">
                  <li>Click {'"'}Download{'"'} to get the template files</li>
                  <li>Extract to your project directory</li>
                  <li>Modify to fit your specific needs</li>
                  <li>Run tests to verify integration</li>
                </ol>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DocsLayout>
  );
}