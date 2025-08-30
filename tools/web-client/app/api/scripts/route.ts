import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { ScriptRunnerService, ScriptCategory } = await import('@/lib/services/script/ScriptRunnerService');
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    // Valid script categories
    const validCategories: string[] = [
      'system', 'development', 'testing', 'deployment', 
      'maintenance', 'analysis', 'utility', 'security', 'monitoring'
    ];

    let scripts;
    if (category && category !== 'all' && validCategories.includes(category)) {
      scripts = ScriptRunnerService.getScriptsByCategory(category as any);
    } else {
      scripts = ScriptRunnerService.getScripts();
    }

    return NextResponse.json({
      success: true,
      data: scripts
    });

  } catch (error) {
    console.error('Failed to fetch scripts:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch scripts'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { ScriptRunnerService } = await import('@/lib/services/script/ScriptRunnerService');
    const body = await request.json();

    const script = ScriptRunnerService.registerScript(body);
    
    return NextResponse.json({
      success: true,
      data: script
    });

  } catch (error) {
    console.error('Failed to register script:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to register script'
      },
      { status: 500 }
    );
  }
}