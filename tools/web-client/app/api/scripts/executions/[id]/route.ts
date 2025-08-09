import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { ScriptRunnerService } = await import('@/lib/services/script/ScriptRunnerService');
    const { id } = await params;
    const execution = ScriptRunnerService.getExecution(id);
    
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

  } catch (error) {
    console.error('Failed to fetch execution:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch execution'
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
    const { ScriptRunnerService } = await import('@/lib/services/script/ScriptRunnerService');
    const { id } = await params;
    await ScriptRunnerService.cancelExecution(id);
    
    return NextResponse.json({
      success: true,
      message: 'Execution cancelled successfully'
    });

  } catch (error) {
    console.error('Failed to cancel execution:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cancel execution'
      },
      { status: 500 }
    );
  }
}