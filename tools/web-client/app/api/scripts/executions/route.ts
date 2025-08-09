import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { ScriptRunnerService } = await import('@/lib/services/script/ScriptRunnerService');
    const { searchParams } = new URL(request.url);
    const scriptId = searchParams.get('scriptId');

    let executions;
    if (scriptId) {
      executions = ScriptRunnerService.getExecutionsByScript(scriptId);
    } else {
      executions = ScriptRunnerService.getAllExecutions();
    }

    return NextResponse.json({
      success: true,
      data: executions
    });

  } catch (error) {
    console.error('Failed to fetch executions:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch executions'
      },
      { status: 500 }
    );
  }
}