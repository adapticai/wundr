import { NextRequest, NextResponse } from 'next/server'
import { GitActivity, ApiResponse, TimeRange } from '@/types/data'

// Mock data generator for development
function generateMockGitData(timeRange: TimeRange, _repository?: string): GitActivity[] {
  const now = new Date()
  const ranges: Record<TimeRange, number> = {
    '1h': 1,
    '6h': 6,
    '24h': 24,
    '7d': 168,
    '30d': 720
  }
  
  const hours = ranges[timeRange] || 24
  const dataPoints = Math.min(hours, 720) // Max 720 data points (30 days)
  const data: GitActivity[] = []
  
  // Simulate different activity patterns based on time of day/week
  for (let i = dataPoints - 1; i >= 0; i--) {
    const timestamp = new Date(now.getTime() - (i * 60 * 60 * 1000))
    const hour = timestamp.getHours()
    const dayOfWeek = timestamp.getDay()
    
    // Higher activity during work hours and weekdays
    const workHourMultiplier = (hour >= 9 && hour <= 17) ? 1.5 : 0.3
    const weekdayMultiplier = (dayOfWeek >= 1 && dayOfWeek <= 5) ? 1.2 : 0.4
    const activityMultiplier = workHourMultiplier * weekdayMultiplier
    
    // Base activity levels with randomness
    const baseCommits = Math.random() * 10 * activityMultiplier
    const commitsCount = Math.round(Math.max(0, baseCommits))
    
    // Lines changed correlates with commits
    const linesMultiplier = 50 + Math.random() * 100
    const additions = Math.round(commitsCount * linesMultiplier * (0.7 + Math.random() * 0.6))
    const deletions = Math.round(additions * (0.2 + Math.random() * 0.4))
    
    // Files changed
    const files = Math.round(commitsCount * (1 + Math.random() * 3))
    
    // Contributors (more stable, changes less frequently)
    const baseContributors = 5 + Math.sin(i * 0.01) * 2 + Math.random() * 2
    const contributors = Math.round(Math.max(1, baseContributors))
    
    // Branches (grows slowly over time)
    const branches = Math.round(10 + (dataPoints - i) * 0.01 + Math.random() * 2)
    
    // PRs and issues
    const pullRequests = Math.round(commitsCount * 0.3 + Math.random() * 2)
    const issues = Math.round(commitsCount * 0.2 + Math.random() * 1.5)
    
    data.push({
      timestamp: timestamp.toISOString(),
      commits: commitsCount,
      additions,
      deletions,
      files: Math.max(0, files),
      contributors: Math.max(1, contributors),
      branches: Math.max(1, branches),
      pullRequests: Math.max(0, pullRequests),
      issues: Math.max(0, issues)
    })
  }
  
  return data
}

// In production, this would connect to Git hosting services
async function fetchGitActivityData(timeRange: TimeRange, _repository?: string): Promise<GitActivity[]> {
  // For now, return mock data
  // In production, you would:
  // 1. Query GitHub API for repository statistics
  // 2. Connect to GitLab API
  // 3. Query Bitbucket API
  // 4. Use git log commands for local repositories
  // 5. Integrate with webhook data from Git hosting
  
  return generateMockGitData(timeRange, repository)
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const timeRange = (searchParams.get('timeRange') as TimeRange) || '7d'
    const repository = searchParams.get('repository') || undefined
    
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
    
    const data = await fetchGitActivityData(timeRange, repository)
    
    const response: ApiResponse<GitActivity[]> = {
      success: true,
      data,
      timestamp: new Date().toISOString()
    }
    
    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, max-age=180, stale-while-revalidate=300', // 3 min cache
        'Content-Type': 'application/json'
      }
    })
  } catch (error) {
    console.error('Error fetching git activity data:', error)
    
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
