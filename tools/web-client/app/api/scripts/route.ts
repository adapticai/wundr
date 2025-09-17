import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const scriptService = (await import('@/lib/services/script/ScriptRunnerService')).default;
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    // Valid script categories
    const validCategories: string[] = [
      'automation', 'testing', 'deployment', 'monitoring',
      'maintenance', 'analysis', 'utility', 'custom'
    ];

    let scripts;
    if (category && category !== 'all' && validCategories.includes(category)) {
      scripts = scriptService.getScriptsByCategory(category as 'automation' | 'testing' | 'deployment' | 'monitoring' | 'maintenance' | 'analysis' | 'utility' | 'custom');
    } else {
      scripts = await scriptService.getScripts();
    }

    return NextResponse.json({
      success: true,
      data: scripts
    });

  } catch (_error) {
    // Error logged - details available in network tab;
    return NextResponse.json(
      {
        success: false,
        error: _error instanceof Error ? _error.message : 'Failed to fetch scripts'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const scriptService = (await import('@/lib/services/script/ScriptRunnerService')).default;
    const body = await request.json();

    const script = scriptService.registerScript(body);
    
    return NextResponse.json({
      success: true,
      data: script
    });

  } catch (_error) {
    // Error logged - details available in network tab;
    return NextResponse.json(
      {
        success: false,
        error: _error instanceof Error ? _error.message : 'Failed to register script'
      },
      { status: 500 }
    );
  }
}