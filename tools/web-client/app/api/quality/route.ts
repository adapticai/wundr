import { NextRequest, NextResponse } from 'next/server'
import { QualityMetrics, ApiResponse, TimeRange } from '@/types/data'

// Mock data generator for development
function generateMockQualityData(timeRange: TimeRange): QualityMetrics[] {
  const now = new Date()
  const ranges: Record<TimeRange, number> = {
    '1h': 60,
    '6h': 360,
    '24h': 1440,
    '7d': 10080,
    '30d': 43200
  }
  
  const minutes = ranges[timeRange] || 1440
  const dataPoints = Math.min(Math.floor(minutes / 60), 500) // One point per hour, max 500
  const data: QualityMetrics[] = []
  
  for (let i = dataPoints - 1; i >= 0; i--) {
    const timestamp = new Date(now.getTime() - (i * 60 * 60 * 1000))
    
    // Generate realistic quality metrics with gradual improvements
    const trend = Math.max(0, 1 - (i / dataPoints) * 0.3) // Slight improvement over time
    const noise = (Math.random() - 0.5) * 0.1
    
    const baseComplexity = 15 - trend * 3 + noise * 2
    const baseCoverage = 65 + trend * 20 + noise * 5
    const baseDuplicates = 1000 - trend * 300 + noise * 50
    const baseMaintainability = 60 + trend * 25 + noise * 5
    const baseDebt = 80 - trend * 30 + noise * 10
    const baseSmells = 25 - trend * 10 + noise * 3
    const baseBugs = 8 - trend * 4 + noise * 1
    const baseVulns = 3 - trend * 2 + Math.max(0, noise * 0.5)
    const baseLoc = 50000 + trend * 5000 + noise * 1000
    
    data.push({
      timestamp: timestamp.toISOString(),
      codeComplexity: Math.max(5, Math.round(baseComplexity * 10) / 10),
      testCoverage: Math.max(30, Math.min(95, Math.round(baseCoverage * 10) / 10)),
      duplicateLines: Math.max(0, Math.round(baseDuplicates)),
      maintainabilityIndex: Math.max(20, Math.min(100, Math.round(baseMaintainability * 10) / 10)),
      technicalDebt: Math.max(10, Math.round(baseDebt)),
      codeSmells: Math.max(0, Math.round(baseSmells)),
      bugs: Math.max(0, Math.round(baseBugs)),
      vulnerabilities: Math.max(0, Math.round(baseVulns)),
      linesOfCode: Math.max(1000, Math.round(baseLoc))
    })
  }
  
  return data
}

// In production, this would connect to code analysis tools
async function fetchQualityData(timeRange: TimeRange): Promise<QualityMetrics[]> {
  // For now, return mock data
  // In production, you would:
  // 1. Query SonarQube/SonarCloud API
  // 2. Connect to CodeClimate
  // 3. Integrate with ESLint/TSLint reports
  // 4. Pull data from your CI/CD quality gates
  
  return generateMockQualityData(timeRange)
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
    
    const data = await fetchQualityData(timeRange)
    
    const response: ApiResponse<QualityMetrics[]> = {
      success: true,
      data,
      timestamp: new Date().toISOString()
    }
    
    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=600', // 5 min cache
        'Content-Type': 'application/json'
      }
    })
  } catch (error) {
    console.error('Error fetching quality data:', error)
    
    const response: ApiResponse<null> = {
      success: false,
      data: null,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    }
    
    return NextResponse.json(response, { status: 500 })
  }
}

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
