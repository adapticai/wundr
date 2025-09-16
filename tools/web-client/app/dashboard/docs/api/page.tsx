import React, { Suspense } from 'react';
import { DocsLayout } from '@/components/docs/DocsLayout';
import { ApiDocsContent } from '@/components/docs/ApiDocsContent';
import { Skeleton } from '@/components/ui/skeleton';

// Loading component for the API docs
function ApiDocsLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export default async function ApiDocsPage() {
  // Create sample API endpoints for demonstration
  const mockApiEndpoints = [
    {
      method: 'POST' as const,
      path: '/api/analysis',
      description: 'Analyze code quality and generate metrics',
      parameters: [
        { name: 'files', type: 'array', required: true, description: 'Array of file paths to analyze' }
      ],
      responses: [
        { status: 200, description: 'Analysis completed successfully' },
        { status: 400, description: 'Invalid request parameters' }
      ]
    },
    {
      method: 'GET' as const,
      path: '/api/reports',
      description: 'Get list of available reports',
      responses: [
        { status: 200, description: 'List of reports' }
      ]
    },
    {
      method: 'POST' as const,
      path: '/api/reports/generate',
      description: 'Generate a new report',
      parameters: [
        { name: 'templateId', type: 'string', required: true, description: 'Report template ID' }
      ],
      responses: [
        { status: 201, description: 'Report generation started' }
      ]
    }
  ];

  // Create API documentation directly without server-side dependencies
  const docs = {
    title: 'Wundr Analysis API',
    version: '1.0.0',
    description: 'API for code analysis and metrics',
    endpoints: mockApiEndpoints,
    sections: [
      {
        title: 'Overview',
        content: 'The Wundr Analysis API provides endpoints for analyzing code quality, generating reports, and managing projects.'
      },
      {
        title: 'Authentication',
        content: 'All API requests require authentication via API key in the Authorization header.'
      }
    ]
  };

  return (
    <DocsLayout>
      <Suspense fallback={<ApiDocsLoading />}>
        <ApiDocsContent />
      </Suspense>
    </DocsLayout>
  );
}