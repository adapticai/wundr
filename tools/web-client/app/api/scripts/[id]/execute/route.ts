import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { ScriptRunnerService } = await import('@/lib/services/script/ScriptRunnerService');
    const { id } = await params;
    const body = await request.json();
    const { parameters, options } = body;

    const combinedParams = { ...(parameters || {}), ...(options || {}) };
    const executionId = await ScriptRunnerService.executeScript(id, combinedParams);
    
    return NextResponse.json({
      success: true,
      data: { executionId }
    });

  } catch (error) {
    console.error('Failed to execute script:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to execute script'
      },
      { status: 500 }
    );
  }
}