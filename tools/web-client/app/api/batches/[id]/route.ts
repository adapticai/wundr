import { NextRequest, NextResponse } from 'next/server';
import { BatchProcessingService } from '@/lib/services/batch/BatchProcessingService';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const batch = BatchProcessingService.getBatch(id);
    
    if (!batch) {
      return NextResponse.json(
        {
          success: false,
          error: 'Batch not found'
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: batch
    });

  } catch (error) {
    console.error('Failed to fetch batch:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch batch'
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'start':
        await BatchProcessingService.startBatch(id);
        break;
      case 'pause':
        await BatchProcessingService.pauseBatch(id);
        break;
      case 'resume':
        await BatchProcessingService.resumeBatch(id);
        break;
      case 'cancel':
        await BatchProcessingService.cancelBatch(id);
        break;
      case 'retry':
        const newBatchId = await BatchProcessingService.retryBatch(id);
        return NextResponse.json({
          success: true,
          data: { newBatchId }
        });
      case 'rollback':
        await BatchProcessingService.rollbackBatch(id);
        break;
      default:
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid action'
          },
          { status: 400 }
        );
    }

    const batch = BatchProcessingService.getBatch(id);
    return NextResponse.json({
      success: true,
      data: batch
    });

  } catch (error) {
    console.error('Failed to update batch:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update batch'
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
    const { id } = await params;
    const { BatchProcessingService } = await import('@/lib/services/batch/BatchProcessingService');
    await BatchProcessingService.cancelBatch(id);
    
    return NextResponse.json({
      success: true,
      message: 'Batch deleted successfully'
    });

  } catch (error) {
    console.error('Failed to delete batch:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete batch'
      },
      { status: 500 }
    );
  }
}