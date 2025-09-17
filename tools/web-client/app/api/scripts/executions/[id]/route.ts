import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const scriptService = (await import('@/lib/services/script/ScriptRunnerService')).default;
    const { id } = await params;
    const execution = await scriptService.getExecution(id);
    
    if (!execution) {
      return NextResponse.json(
        {
          success: false,
          error: 'Execution not found'
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: execution
    });

  } catch (_error) {
    // Error logged - details available in network tab;
    return NextResponse.json(
      {
        success: false,
        error: _error instanceof Error ? _error.message : 'Failed to fetch execution'
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const scriptService = (await import('@/lib/services/script/ScriptRunnerService')).default;
    const { id } = await params;
    await scriptService.cancelExecution(id);
    
    return NextResponse.json({
      success: true,
      message: 'Execution cancelled successfully'
    });

  } catch (_error) {
    // Error logged - details available in network tab;
    return NextResponse.json(
      {
        success: false,
        error: _error instanceof Error ? _error.message : 'Failed to cancel execution'
      },
      { status: 500 }
    );
  }
}