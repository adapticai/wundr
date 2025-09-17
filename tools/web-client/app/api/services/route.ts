import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { serviceOrchestrator } = await import('@/lib/services/orchestrator/ServiceOrchestrator');
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    switch (type) {
      case 'health':
        const health = await serviceOrchestrator.getSystemHealth();
        return NextResponse.json({
          success: true,
          data: health
        });

      case 'metrics':
        const metrics = await serviceOrchestrator.getMetrics();
        return NextResponse.json({
          success: true,
          data: metrics
        });

      case 'instances':
        const instances = await serviceOrchestrator.getAllInstances();
        return NextResponse.json({
          success: true,
          data: instances
        });

      default:
        const services = await serviceOrchestrator.getAllServices();
        return NextResponse.json({
          success: true,
          data: services
        });
    }

  } catch (_error) {
    // Error logged - details available in network tab;
    return NextResponse.json(
      {
        success: false,
        error: _error instanceof Error ? _error.message : 'Failed to fetch services'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { serviceOrchestrator } = await import('@/lib/services/orchestrator/ServiceOrchestrator');
    const body = await request.json();
    const { action, serviceId } = body;

    switch (action) {
      case 'start':
        if (!serviceId) {
          return NextResponse.json(
            { success: false, error: 'Service ID required for start action' },
            { status: 400 }
          );
        }
        const result = await serviceOrchestrator.startService(serviceId);
        const instanceId = result !== undefined ? serviceId : null;
        return NextResponse.json({
          success: true,
          data: { instanceId }
        });

      case 'register':
        const service = await serviceOrchestrator.registerService(body.service);
        return NextResponse.json({
          success: true,
          data: service
        });

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }

  } catch (_error) {
    // Error logged - details available in network tab;
    return NextResponse.json(
      {
        success: false,
        error: _error instanceof Error ? _error.message : 'Failed to process service action'
      },
      { status: 500 }
    );
  }
}