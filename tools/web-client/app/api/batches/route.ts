import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { BatchProcessingService } = await import('@/lib/services/batch/BatchProcessingService');
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all';

    let batches: any[];
    switch (type) {
      case 'active':
        batches = (await BatchProcessingService.getAllBatches()).filter((b: any) => b.status === 'running');
        break;
      case 'history':
        batches = (await BatchProcessingService.getAllBatches()).filter((b: any) => b.status === 'completed' || b.status === 'failed');
        break;
      default:
        batches = await BatchProcessingService.getAllBatches();
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
    const { BatchProcessingService } = await import('@/lib/services/batch/BatchProcessingService');
    const body = await request.json();

    const batch = await BatchProcessingService.createBatch({
      name: body.name || 'New Batch',
      type: body.type || 'default',
      data: body.items || []
    });
    
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