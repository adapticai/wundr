import { NextRequest, NextResponse } from 'next/server';
// import { ReportService, reportService } from '@/lib/services/report-service';
import { ReportTemplateRenderer } from '@/lib/templates/report-template-renderer';
import { ReportTemplate as TemplateEngineTemplate } from '@/lib/report-templates';
import {
  // CompleteAnalysisData,
  ReportTemplate,
  GenerateReportRequest,
  Report,
} from '@/types/reports';

// Default templates
const DEFAULT_TEMPLATES: Record<string, ReportTemplate> = {
  comprehensive: {
    id: 'comprehensive',
    name: 'Comprehensive Analysis Report',
    description: 'Complete analysis including all metrics, issues, and recommendations',
    type: 'custom' as const,
    category: 'custom' as const,
    parameters: [],
    sections: [
      { id: 'overview', title: 'Project Overview', enabled: true, order: 1 },
      { id: 'quality', title: 'Code Quality', enabled: true, order: 2 },
      { id: 'dependencies', title: 'Dependencies', enabled: true, order: 3 },
      { id: 'security', title: 'Security Analysis', enabled: true, order: 4 },
      { id: 'recommendations', title: 'Recommendations', enabled: true, order: 5 },
    ],
    styling: {
      theme: 'professional',
      colors: {
        primary: '#0066cc',
        secondary: '#6c757d',
        success: '#28a745',
        warning: '#ffc107',
        error: '#dc3545',
      },
      fonts: {
        heading: 'Arial, sans-serif',
        body: 'Arial, sans-serif',
        code: 'Consolas, monospace',
      },
    },
  },
  executive: {
    id: 'executive',
    name: 'Executive Summary Report',
    description: 'High-level overview for stakeholders',
    type: 'custom' as const,
    category: 'enterprise' as const,
    parameters: [],
    sections: [
      { id: 'overview', title: 'Executive Overview', enabled: true, order: 1 },
      { id: 'metrics', title: 'Key Metrics', enabled: true, order: 2 },
      { id: 'recommendations', title: 'Priority Actions', enabled: true, order: 3 },
    ],
    styling: {
      theme: 'executive',
      colors: {
        primary: '#2c3e50',
        secondary: '#34495e',
        success: '#27ae60',
        warning: '#f39c12',
        error: '#e74c3c',
      },
      fonts: {
        heading: 'Georgia, serif',
        body: 'Arial, sans-serif',
        code: 'Consolas, monospace',
      },
    },
  },
  technical: {
    id: 'technical',
    name: 'Technical Deep Dive Report',
    description: 'Detailed technical analysis for developers',
    type: 'custom' as const,
    category: 'custom' as const,
    parameters: [],
    sections: [
      { id: 'architecture', title: 'Architecture Analysis', enabled: true, order: 1 },
      { id: 'complexity', title: 'Complexity Metrics', enabled: true, order: 2 },
      { id: 'dependencies', title: 'Dependency Analysis', enabled: true, order: 3 },
      { id: 'duplicates', title: 'Code Duplication', enabled: true, order: 4 },
      { id: 'security', title: 'Security Issues', enabled: true, order: 5 },
      { id: 'technical-debt', title: 'Technical Debt', enabled: true, order: 6 },
    ],
    styling: {
      theme: 'technical',
      colors: {
        primary: '#007acc',
        secondary: '#5a6c7d',
        success: '#00d2aa',
        warning: '#ffb700',
        error: '#ff6b6b',
      },
      fonts: {
        heading: 'Consolas, monospace',
        body: 'Segoe UI, sans-serif',
        code: 'Courier New, monospace',
      },
    },
  },
};

export async function POST(request: NextRequest) {
  try {
    const body: GenerateReportRequest = await request.json();
    
    // Validate required fields
    if (!body.templateId || !body.name) {
      return NextResponse.json(
        { error: 'Template ID and name are required' },
        { status: 400 }
      );
    }

    // Get template
    const template = DEFAULT_TEMPLATES[body.templateId];
    if (!template) {
      return NextResponse.json(
        { error: `Template '${body.templateId}' not found` },
        { status: 404 }
      );
    }

    // Normalize analysis data (using parameters as data source)
    const normalizedData = body.parameters || {};
    
    // Convert template to engine format
    const engineTemplate: TemplateEngineTemplate = {
      id: template.id,
      name: template.name,
      description: template.description,
      type: template.type as TemplateEngineTemplate['type'],
      version: '1.0.0',
      category: 'analysis',
      tags: ['generated', 'api'],
      template: '<html><body>{{ content }}</body></html>',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Generate report content using template renderer
    const reportContent = await ReportTemplateRenderer.renderReport(engineTemplate.id, normalizedData);
    
    // Additional sections are now handled by the template system
    // Note: sectionsData is no longer needed as template system handles sections

    // Create report object
    const report: Report = {
      id: `report-${Date.now()}`,
      name: body.name || `${template.name} - ${new Date().toLocaleDateString()}`,
      type: template.type,
      status: 'completed',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'api',
      description: body.description,
      tags: body.tags || [],
      metadata: {
        parameters: body.parameters,
        filters: body.filters,
        outputFormat: body.outputFormats,
        analysisEngine: 'Wundr Analysis Engine',
        version: '1.0.0',
        dataSource: 'analysis-api',
      },
    };

    // Generate markdown if requested
    if ((body as any).format === 'markdown') {
      const markdown = reportContent; // The content is already in markdown format
      
      return NextResponse.json({
        report,
        markdown,
        reportContent,
        success: true,
        message: 'Report generated successfully',
      });
    }

    return NextResponse.json({
      report,
      reportContent,
      success: true,
      message: 'Report generated successfully',
    });

  } catch (_error) {
    // Error logged - details available in network tab;
    
    return NextResponse.json(
      { 
        error: 'Failed to generate report',
        details: _error instanceof Error ? _error.message : 'Unknown error',
        success: false,
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'templates') {
      return NextResponse.json({
        templates: Object.values(DEFAULT_TEMPLATES),
        success: true,
      });
    }

    if (action === 'template' && searchParams.get('id')) {
      const templateId = searchParams.get('id')!;
      const template = DEFAULT_TEMPLATES[templateId];
      
      if (!template) {
        return NextResponse.json(
          { error: `Template '${templateId}' not found` },
          { status: 404 }
        );
      }

      return NextResponse.json({
        template,
        success: true,
      });
    }

    // Default: return available actions
    return NextResponse.json({
      availableActions: [
        'templates - Get all available templates',
        'template?id=<templateId> - Get specific template',
      ],
      templates: Object.keys(DEFAULT_TEMPLATES),
      success: true,
    });

  } catch (_error) {
    // Error logged - details available in network tab;
    
    return NextResponse.json(
      { 
        error: 'Failed to process request',
        details: _error instanceof Error ? _error.message : 'Unknown error',
        success: false,
      },
      { status: 500 }
    );
  }
}