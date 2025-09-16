import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { default: batchService } = await import('../../../lib/services/batch/BatchProcessingService');
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all';

    let batches: any[];
    switch (type) {
      case 'active':
        batches = (await batchService.getAllBatches()).filter((b: any) => b.status === 'running');
        break;
      case 'history':
        batches = (await batchService.getAllBatches()).filter((b: any) => b.status === 'completed' || b.status === 'failed');
        break;
      default:
        batches = await batchService.getAllBatches();
    }

    return NextResponse.json({
      success: true,
      data: batches
    });

  } catch (error) {
    console.error('Failed to fetch batches:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch batches'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { default: batchService } = await import('../../../lib/services/batch/BatchProcessingService');
    const body = await request.json();

    const batch = await batchService.createBatch(
      body.name || 'New Batch',
      (body.items || []).map((item: any) => ({
        name: item.name || 'Job',
        type: item.type || 'default',
        data: item.data || item,
        priority: item.priority || 5,
        retryCount: 0,
        maxRetries: 3
      }))
    );
    
    return NextResponse.json({
      success: true,
      data: batch
    });

  } catch (error) {
    console.error('Failed to create batch:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create batch'
      },
      { status: 500 }
    );
  }
}