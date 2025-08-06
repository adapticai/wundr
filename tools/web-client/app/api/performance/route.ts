import { NextRequest, NextResponse } from 'next/server'
import { PerformanceMetrics, ApiResponse, TimeRange } from '@/types/data'

// Mock data generator for development
function generateMockPerformanceData(timeRange: TimeRange): PerformanceMetrics[] {
  const now = new Date()
  const ranges: Record<TimeRange, number> = {
    '1h': 60,
    '6h': 360,
    '24h': 1440,
    '7d': 10080,
    '30d': 43200
  }
  
  const minutes = ranges[timeRange] || 1440
  const dataPoints = Math.min(Math.floor(minutes / 10), 1000) // Max 1000 points
  const data: PerformanceMetrics[] = []
  
  for (let i = dataPoints - 1; i >= 0; i--) {
    const timestamp = new Date(now.getTime() - (i * 10 * 60 * 1000))
    
    // Generate realistic performance metrics with some trends
    const baseTime = 2000 + Math.sin(i * 0.01) * 500 + (Math.random() - 0.5) * 200
    const baseBundleSize = 1024 * 1024 * (2.5 + Math.sin(i * 0.005) * 0.5 + (Math.random() - 0.5) * 0.2)
    const baseMemory = 512 + Math.sin(i * 0.008) * 100 + (Math.random() - 0.5) * 50
    const baseCpu = 25 + Math.sin(i * 0.012) * 15 + (Math.random() - 0.5) * 10
    const baseLoad = 800 + Math.sin(i * 0.006) * 200 + (Math.random() - 0.5) * 100
    
    data.push({
      timestamp: timestamp.toISOString(),
      buildTime: Math.max(1000, Math.round(baseTime)),
      bundleSize: Math.max(1024 * 1024, Math.round(baseBundleSize)),
      memoryUsage: Math.max(200, Math.round(baseMemory)),
      cpuUsage: Math.max(5, Math.min(100, Math.round(baseCpu))),
      loadTime: Math.max(200, Math.round(baseLoad)),
      testDuration: Math.max(500, Math.round(baseTime * 0.3)),
      cacheHitRate: Math.max(0.5, Math.min(1, 0.85 + (Math.random() - 0.5) * 0.3)),
      errorRate: Math.max(0, Math.min(5, Math.random() * 2))
    })
  }
  
  return data
}

// In production, this would connect to your actual data sources
async function fetchPerformanceData(timeRange: TimeRange): Promise<PerformanceMetrics[]> {
  // For now, return mock data
  // In production, you would:
  // 1. Query your monitoring database (Prometheus, InfluxDB, etc.)
  // 2. Call your CI/CD APIs for build metrics
  // 3. Query your application performance monitoring tools
  
  return generateMockPerformanceData(timeRange)
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const timeRange = (searchParams.get('timeRange') as TimeRange) || '24h'
    
    // Validate time range
    const validRanges: TimeRange[] = ['1h', '6h', '24h', '7d', '30d']
    if (!validRanges.includes(timeRange)) {
      const response: ApiResponse<null> = {
        success: false,
        data: null,
        error: 'Invalid time range. Must be one of: 1h, 6h, 24h, 7d, 30d',
        timestamp: new Date().toISOString()
      }
      return NextResponse.json(response, { status: 400 })
    }
    
    const data = await fetchPerformanceData(timeRange)
    
    const response: ApiResponse<PerformanceMetrics[]> = {
      success: true,
      data,
      timestamp: new Date().toISOString()
    }
    
    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
        'Content-Type': 'application/json'
      }
    })
  } catch (error) {
    console.error('Error fetching performance data:', error)
    
    const response: ApiResponse<null> = {
      success: false,
      data: null,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    }
    
    return NextResponse.json(response, { status: 500 })
  }
}

// Handle CORS for development
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  })
}
