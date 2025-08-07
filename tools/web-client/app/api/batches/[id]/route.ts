import { NextRequest, NextResponse } from 'next/server';
import { batchProcessingService } from '@/lib/services/batch/BatchProcessingService';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const batch = batchProcessingService.getBatch(id);
    
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
        await batchProcessingService.startBatch(id);
        break;
      case 'pause':
        await batchProcessingService.pauseBatch(id);
        break;
      case 'resume':
        await batchProcessingService.resumeBatch(id);
        break;
      case 'cancel':
        await batchProcessingService.cancelBatch(id);
        break;
      case 'retry':
        const newBatchId = await batchProcessingService.retryBatch(id);
        return NextResponse.json({
          success: true,
          data: { newBatchId }
        });
      case 'rollback':
        await batchProcessingService.rollbackBatch(id);
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

    const batch = batchProcessingService.getBatch(id);
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
    const { batchProcessingService } = await import('@/lib/services/batch/BatchProcessingService');
    await batchProcessingService.cancelBatch(id);
    
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