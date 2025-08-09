import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { BatchProcessingService } = await import('@/lib/services/batch/BatchProcessingService');
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all';

    let batches;
    switch (type) {
      case 'active':
        batches = BatchProcessingService.getActiveBatches();
        break;
      case 'history':
        batches = BatchProcessingService.getBatchHistory();
        break;
      default:
        batches = BatchProcessingService.getAllBatches();
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

    const batch = await BatchProcessingService.createBatch(body);
    
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