import { NextRequest, NextResponse } from 'next/server';
import {
  ReportTemplate,
} from '@/types/reports';

// Template storage - in a real app, this could be in a database
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
  security: {
    id: 'security',
    name: 'Security Assessment Report',
    description: 'Focused security vulnerability analysis',
    type: 'security-audit' as const,
    category: 'enterprise' as const,
    parameters: [],
    sections: [
      { id: 'overview', title: 'Security Overview', enabled: true, order: 1 },
      { id: 'vulnerabilities', title: 'Vulnerabilities', enabled: true, order: 2 },
      { id: 'dependencies', title: 'Dependency Security', enabled: true, order: 3 },
      { id: 'recommendations', title: 'Security Recommendations', enabled: true, order: 4 },
    ],
    styling: {
      theme: 'security',
      colors: {
        primary: '#dc3545',
        secondary: '#6c757d',
        success: '#28a745',
        warning: '#fd7e14',
        error: '#dc3545',
      },
      fonts: {
        heading: 'Arial, sans-serif',
        body: 'Arial, sans-serif',
        code: 'Consolas, monospace',
      },
    },
  },
  performance: {
    id: 'performance',
    name: 'Performance Analysis Report',
    description: 'Code complexity and performance metrics',
    type: 'performance-analysis' as const,
    category: 'standard' as const,
    parameters: [],
    sections: [
      { id: 'overview', title: 'Performance Overview', enabled: true, order: 1 },
      { id: 'complexity', title: 'Complexity Analysis', enabled: true, order: 2 },
      { id: 'bottlenecks', title: 'Performance Bottlenecks', enabled: true, order: 3 },
      { id: 'optimization', title: 'Optimization Opportunities', enabled: true, order: 4 },
    ],
    styling: {
      theme: 'performance',
      colors: {
        primary: '#17a2b8',
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
  quality: {
    id: 'quality',
    name: 'Code Quality Report',
    description: 'Comprehensive code quality and maintainability analysis',
    type: 'code-quality' as const,
    category: 'standard' as const,
    parameters: [],
    sections: [
      { id: 'overview', title: 'Quality Overview', enabled: true, order: 1 },
      { id: 'metrics', title: 'Quality Metrics', enabled: true, order: 2 },
      { id: 'issues', title: 'Code Issues', enabled: true, order: 3 },
      { id: 'duplicates', title: 'Code Duplication', enabled: true, order: 4 },
      { id: 'maintainability', title: 'Maintainability', enabled: true, order: 5 },
    ],
    styling: {
      theme: 'quality',
      colors: {
        primary: '#6f42c1',
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
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get('id');
    const category = searchParams.get('category');

    // Get specific template
    if (templateId) {
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

    // Filter by category if specified
    let templates = Object.values(DEFAULT_TEMPLATES);
    if (category) {
      templates = templates.filter(template => template.category === category);
    }

    // Get template categories
    const categories = [...new Set(templates.map(t => t.category))].sort();

    return NextResponse.json({
      templates,
      categories,
      totalCount: templates.length,
      success: true,
    });

  } catch (_error) {
    // Error logged - details available in network tab;
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch templates',
        details: _error instanceof Error ? _error.message : 'Unknown error',
        success: false,
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { template } = body;

    // Validate template structure
    if (!template || !template.id || !template.name || !template.description) {
      return NextResponse.json(
        { error: 'Invalid template structure. Required fields: id, name, description' },
        { status: 400 }
      );
    }

    // Check if template already exists
    if (DEFAULT_TEMPLATES[template.id]) {
      return NextResponse.json(
        { error: `Template '${template.id}' already exists` },
        { status: 409 }
      );
    }

    // Add metadata
    const newTemplate: ReportTemplate = {
      ...template,
    };

    // Store template
    DEFAULT_TEMPLATES[newTemplate.id] = newTemplate;

    return NextResponse.json({
      template: newTemplate,
      success: true,
      message: 'Template created successfully'
    });

  } catch (_error) {
    // Error logged - details available in network tab;
    return NextResponse.json(
      { error: 'Failed to create template' },
      { status: 500 }
    );
  }
}
