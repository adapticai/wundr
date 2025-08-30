import { NextRequest, NextResponse } from 'next/server';
import { BatchProcessingService } from '@/lib/services/batch/BatchProcessingService';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const batch = await BatchProcessingService.getBatch(id);
    
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
        await BatchProcessingService.updateBatch(id, { status: 'running' });
        break;
      case 'pause':
        await BatchProcessingService.updateBatch(id, { status: 'pending' });
        break;
      case 'resume':
        await BatchProcessingService.updateBatch(id, { status: 'running' });
        break;
      case 'cancel':
        await BatchProcessingService.updateBatch(id, { status: 'failed' });
        break;
      case 'retry':
        // Retry logic - create a new batch with same items
        const oldBatch = await BatchProcessingService.getBatch(id);
        if (!oldBatch) {
          return NextResponse.json({ success: false, error: 'Batch not found' }, { status: 404 });
        }
        const newBatch = await BatchProcessingService.createBatch({
          name: `${oldBatch.name} (retry)`,
          type: oldBatch.type,
          data: oldBatch.data
        });
        return NextResponse.json({
          success: true,
          data: { newBatchId: newBatch.id }
        });
      case 'rollback':
        // Rollback not implemented - just mark as failed
        await BatchProcessingService.updateBatch(id, { status: 'failed' });
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

    const batch = await BatchProcessingService.getBatch(id);
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
    const success = await BatchProcessingService.deleteBatch(id);
    
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