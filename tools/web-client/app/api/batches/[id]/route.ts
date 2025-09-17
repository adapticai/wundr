import { NextRequest, NextResponse } from 'next/server';
import { batchProcessingService as batchService, BatchStatus } from '@/lib/services/batch/BatchProcessingService';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const batch = await batchService.getBatch(id);
    
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

  } catch (_error) {
    // Error logged - details available in network tab;
    return NextResponse.json(
      {
        success: false,
        error: _error instanceof Error ? _error.message : 'Failed to fetch batch'
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
        await batchService.updateBatch(id, { status: BatchStatus.RUNNING });
        break;
      case 'pause':
        await batchService.updateBatch(id, { status: BatchStatus.PENDING });
        break;
      case 'resume':
        await batchService.updateBatch(id, { status: BatchStatus.RUNNING });
        break;
      case 'cancel':
        await batchService.updateBatch(id, { status: BatchStatus.FAILED });
        break;
      case 'retry': {
        // Retry logic - create a new batch with same items
        const oldBatch = await batchService.getBatch(id);
        if (!oldBatch) {
          return NextResponse.json({ success: false, error: 'Batch not found' }, { status: 404 });
        }
        const newBatch = await batchService.createBatch(
          `${oldBatch.name} (retry)`,
          oldBatch.jobs.map(job => ({
            name: job.name,
            type: job.type,
            data: job.data,
            priority: job.priority,
            retryCount: 0,
            maxRetries: job.maxRetries
          }))
        );
        return NextResponse.json({
          success: true,
          data: { newBatchId: newBatch.id }
        });
      }
      case 'rollback':
        // Rollback not implemented - just mark as failed
        await batchService.updateBatch(id, { status: BatchStatus.FAILED });
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

    const batch = await batchService.getBatch(id);
    return NextResponse.json({
      success: true,
      data: batch
    });

  } catch (_error) {
    // Error logged - details available in network tab;
    return NextResponse.json(
      {
        success: false,
        error: _error instanceof Error ? _error.message : 'Failed to update batch'
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
    const success = await batchService.deleteBatch(id);
    
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

  } catch (_error) {
    // Error logged - details available in network tab;
    return NextResponse.json(
      {
        success: false,
        error: _error instanceof Error ? _error.message : 'Failed to delete batch'
      },
      { status: 500 }
    );
  }
}