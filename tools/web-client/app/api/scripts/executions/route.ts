import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const scriptService = (await import('@/lib/services/script/ScriptRunnerService')).default;
    const { searchParams } = new URL(request.url);
    const scriptId = searchParams.get('scriptId');

    let executions;
    if (scriptId) {
      executions = scriptService.getExecutionsByScript(scriptId);
    } else {
      executions = scriptService.getAllExecutions();
    }

    return NextResponse.json({
      success: true,
      data: executions
    });

  } catch (_error) {
    // Error logged - details available in network tab;
    return NextResponse.json(
      {
        success: false,
        error: _error instanceof Error ? _error.message : 'Failed to fetch executions'
      },
      { status: 500 }
    );
  }
}