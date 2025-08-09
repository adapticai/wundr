import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { TemplateService } = await import('@/lib/services/template/TemplateService');
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const language = searchParams.get('language');
    const framework = searchParams.get('framework');
    const difficulty = searchParams.get('difficulty');
    const search = searchParams.get('search');
    const tags = searchParams.get('tags')?.split(',').filter(Boolean);

    const filter: any = {
      ...(category && { category }),
      ...(language && { language }),
      ...(framework && { framework }),
      ...(difficulty && { difficulty }),
      ...(search && { search }),
      ...(tags && tags.length > 0 && { tags })
    };

    const templates = await TemplateService.searchTemplates(filter);
    
    return NextResponse.json({
      success: true,
      data: templates,
      count: templates.length
    });

  } catch (error) {
    console.error('Failed to fetch templates:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch templates'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { TemplateService } = await import('@/lib/services/template/TemplateService');
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

    const template = TemplateService.createTemplate(templateData);
    
    return NextResponse.json({
      success: true,
      data: template
    });

  } catch (error) {
    console.error('Failed to create template:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create template'
      },
      { status: 500 }
    );
  }
}