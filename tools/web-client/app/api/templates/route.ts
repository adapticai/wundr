import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { templateService } = await import('@/lib/services/template/TemplateService');
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    // Unused query parameters
    // const language = searchParams.get('language');
    // const framework = searchParams.get('framework');
    // const difficulty = searchParams.get('difficulty');
    const search = searchParams.get('search');
    // const tags = searchParams.get('tags')?.split(',').filter(Boolean);

    // For now, get all templates and filter manually since searchTemplates doesn't exist
    let templates = await templateService.getTemplates();
    
    // Apply filters
    if (category) {
      templates = templates.filter(t => t.categoryId === category);
    }
    if (search) {
      templates = templateService.searchTemplates(search);
    }
    
    return NextResponse.json({
      success: true,
      data: templates,
      count: templates.length
    });

  } catch (_error) {
    // Error logged - details available in network tab;
    return NextResponse.json(
      {
        success: false,
        error: _error instanceof Error ? _error.message : 'Failed to fetch templates'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { templateService } = await import('@/lib/services/template/TemplateService');
    const body = await request.json();
    const { templateData } = body;

    if (!templateData) {
      return NextResponse.json(
        {
          success: false,
          error: 'Template data is required'
        },
        { status: 400 }
      );
    }

    const template = await templateService.createTemplate(templateData);
    
    return NextResponse.json({
      success: true,
      data: template
    });

  } catch (_error) {
    // Error logged - details available in network tab;
    return NextResponse.json(
      {
        success: false,
        error: _error instanceof Error ? _error.message : 'Failed to create template'
      },
      { status: 500 }
    );
  }
}