import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { ServiceOrchestrator } = await import('@/lib/services/orchestrator/ServiceOrchestrator');
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    switch (type) {
      case 'health':
        const health = ServiceOrchestrator.getSystemHealth();
        return NextResponse.json({
          success: true,
          data: health
        });

      case 'metrics':
        const metrics = ServiceOrchestrator.getMetrics();
        return NextResponse.json({
          success: true,
          data: metrics
        });

      case 'instances':
        const instances = ServiceOrchestrator.getAllInstances();
        return NextResponse.json({
          success: true,
          data: instances
        });

      default:
        const services = ServiceOrchestrator.getAllServices();
        return NextResponse.json({
          success: true,
          data: services
        });
    }

  } catch (error) {
    console.error('Failed to fetch services:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch services'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { ServiceOrchestrator } = await import('@/lib/services/orchestrator/ServiceOrchestrator');
    const body = await request.json();
    const { action, serviceId, config } = body;

    switch (action) {
      case 'start':
        if (!serviceId) {
          return NextResponse.json(
            { success: false, error: 'Service ID required for start action' },
            { status: 400 }
          );
        }
        const result = ServiceOrchestrator.startService(serviceId);
        const instanceId = result ? serviceId : null;
        return NextResponse.json({
          success: true,
          data: { instanceId }
        });

      case 'register':
        const service = ServiceOrchestrator.registerService(body.service);
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

  } catch (error) {
    console.error('Failed to process service action:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process service action'
      },
      { status: 500 }
    );
  }
}