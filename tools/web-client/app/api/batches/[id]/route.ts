import { NextRequest, NextResponse } from 'next/server';
import { BatchProcessingService } from '@/lib/services/batch/BatchProcessingService';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const batch = BatchProcessingService.getInstance().getBatch(id);
    
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
        BatchProcessingService.getInstance().updateBatchStatus(id, 'processing');
        break;
      case 'pause':
        BatchProcessingService.getInstance().updateBatchStatus(id, 'pending');
        break;
      case 'resume':
        BatchProcessingService.getInstance().updateBatchStatus(id, 'processing');
        break;
      case 'cancel':
        BatchProcessingService.getInstance().updateBatchStatus(id, 'failed');
        break;
      case 'retry':
        // Retry logic - create a new batch with same items
        const oldBatch = BatchProcessingService.getInstance().getBatch(id);
        if (!oldBatch) {
          return NextResponse.json({ success: false, error: 'Batch not found' }, { status: 404 });
        }
        const newBatch = BatchProcessingService.getInstance().createBatch(oldBatch.items);
        return NextResponse.json({
          success: true,
          data: { newBatchId: newBatch.id }
        });
      case 'rollback':
        // Rollback not implemented - just mark as failed
        BatchProcessingService.getInstance().updateBatchStatus(id, 'failed');
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

    const batch = BatchProcessingService.getInstance().getBatch(id);
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
    const success = BatchProcessingService.getInstance().deleteBatch(id);
    
    if (!success) {
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