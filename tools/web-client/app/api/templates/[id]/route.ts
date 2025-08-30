import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { templateService } = await import('@/lib/services/template/TemplateService');
    const { id } = await params;
    const template = await templateService.getTemplate(id);
    
    if (!template) {
      return NextResponse.json(
        {
          success: false,
          error: 'Template not found'
        },
        { status: 404 }
      );
    }

    // Record usage
    await templateService.recordUsage(id);
    
    return NextResponse.json({
      success: true,
      data: template
    });

  } catch (error) {
    console.error('Failed to fetch template:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch template'
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { templateService } = await import('@/lib/services/template/TemplateService');
    const { id } = await params;
    const body = await request.json();
    const { parameters } = body;

    const template = await templateService.getTemplate(id);
    if (!template) {
      return NextResponse.json(
        {
          success: false,
          error: 'Template not found'
        },
        { status: 404 }
      );
    }

    // Validate parameters
    const validation = templateService.validateParameters(template, parameters || {});
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Parameter validation failed',
          details: validation.errors
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        template,
        validatedParameters: parameters
      }
    });

  } catch (error) {
    console.error('Failed to validate template parameters:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to validate parameters'
      },
      { status: 500 }
    );
  }
}