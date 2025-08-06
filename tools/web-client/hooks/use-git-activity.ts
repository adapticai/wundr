"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import { GitActivity, DataFetchOptions, ApiResponse, LoadingState, ErrorState } from '@/types/data'
import { useWebSocket } from './use-websocket'
import { useDataCache } from './use-data-cache'

interface UseGitActivityOptions extends DataFetchOptions {
  autoRefresh?: boolean
  repository?: string
  onError?: (error: ErrorState) => void
  onUpdate?: (data: GitActivity[]) => void
}

interface GitStats {
  totalCommits: number
  totalAdditions: number
  totalDeletions: number
  activeContributors: number
  averageCommitsPerDay: number
  mostActiveHour: number
  commitFrequency: 'high' | 'medium' | 'low'
}

interface UseGitActivityReturn {
  data: GitActivity[]
  loading: LoadingState
  error: ErrorState | null
  refresh: () => Promise<void>
  subscribe: () => void
  unsubscribe: () => void
  latest: GitActivity | null
  stats: GitStats
  heatmapData: Array<{ date: string; count: number }>
}

export function useGitActivity(options: UseGitActivityOptions = {}): UseGitActivityReturn {
  const {
    timeRange = '30d',
    realtime = false,
    refreshInterval = 300000, // 5 minutes for git data
    autoRefresh = true,
    repository,
    onError,
    onUpdate
  } = options

  const [data, setData] = useState<GitActivity[]>([])
  const [loading, setLoading] = useState<LoadingState>({ isLoading: true, isRefreshing: false })
  const [error, setError] = useState<ErrorState | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const mountedRef = useRef(true)
  
  const cacheKey = repository ? `git-${repository}` : 'git'
  const { cache, setCache } = useDataCache<GitActivity[]>(cacheKey)
  const { isConnected, subscribe: wsSubscribe, unsubscribe: wsUnsubscribe } = useWebSocket({
    enabled: realtime,
    onMessage: handleRealtimeUpdate
  })

  function handleRealtimeUpdate(message: any) {
    if (message.type === 'git' && message.data) {
      setData(prev => {
        const newData = [...prev, message.data].slice(-365) // Keep last year of data
        if (onUpdate) onUpdate(newData)
        return newData
      })
    }
  }

  const calculateStats = useCallback((activities: GitActivity[]): GitStats => {
    if (activities.length === 0) {
      return {
        totalCommits: 0,
        totalAdditions: 0,
        totalDeletions: 0,
        activeContributors: 0,
        averageCommitsPerDay: 0,
        mostActiveHour: 0,
        commitFrequency: 'low'
      }
    }

    const totalCommits = activities.reduce((sum, a) => sum + a.commits, 0)
    const totalAdditions = activities.reduce((sum, a) => sum + a.additions, 0)
    const totalDeletions = activities.reduce((sum, a) => sum + a.deletions, 0)
    const activeContributors = Math.max(...activities.map(a => a.contributors))
    
    const daysWithData = activities.length
    const averageCommitsPerDay = daysWithData > 0 ? totalCommits / daysWithData : 0
    
    // Mock most active hour calculation (would be based on actual commit timestamps)
    const mostActiveHour = 14 // 2 PM as a reasonable default
    
    const commitFrequency: 'high' | 'medium' | 'low' = 
      averageCommitsPerDay > 10 ? 'high' :
      averageCommitsPerDay > 3 ? 'medium' : 'low'

    return {
      totalCommits,
      totalAdditions,
      totalDeletions,
      activeContributors,
      averageCommitsPerDay,
      mostActiveHour,
      commitFrequency
    }
  }, [])

  const generateHeatmapData = useCallback((activities: GitActivity[]) => {
    return activities.map(activity => ({
      date: activity.timestamp.split('T')[0], // Extract date part
      count: activity.commits
    }))
  }, [])

  const fetchData = useCallback(async (isRefresh = false) => {
    if (!mountedRef.current) return
    
    try {
      setLoading(prev => ({ ...prev, isLoading: !isRefresh, isRefreshing: isRefresh }))
      setError(null)

      // Check cache first
      const cachedData = cache.get(timeRange)
      if (cachedData && !isRefresh) {
        setData(cachedData)
        setLoading({ isLoading: false, isRefreshing: false })
        return
      }

      const url = new URL('/api/git-activity', window.location.origin)
      url.searchParams.set('timeRange', timeRange)
      if (repository) {
        url.searchParams.set('repository', repository)
      }

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result: ApiResponse<GitActivity[]> = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch git activity data')
      }

      if (mountedRef.current) {
        setData(result.data)
        setCache(timeRange, result.data)
        if (onUpdate) onUpdate(result.data)
      }
    } catch (err) {
      const errorState: ErrorState = {
        message: err instanceof Error ? err.message : 'Unknown error occurred',
        timestamp: new Date().toISOString(),
        retry: () => fetchData(true)
      }
      
      if (mountedRef.current) {
        setError(errorState)
        if (onError) onError(errorState)
      }
    } finally {
      if (mountedRef.current) {
        setLoading({ isLoading: false, isRefreshing: false })
      }
    }
  }, [timeRange, repository, cache, setCache, onError, onUpdate])

  const refresh = useCallback(async () => {
    await fetchData(true)
  }, [fetchData])

  const subscribe = useCallback(() => {
    if (realtime) {
      wsSubscribe('git')
    }
  }, [realtime, wsSubscribe])

  const unsubscribe = useCallback(() => {
    if (realtime) {
      wsUnsubscribe('git')
    }
  }, [realtime, wsUnsubscribe])

  // Initial fetch
  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Auto refresh setup
  useEffect(() => {
    if (autoRefresh && !realtime && refreshInterval > 0) {
      intervalRef.current = setInterval(() => {
        fetchData(true)
      }, refreshInterval)

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
        }
      }
    }
  }, [autoRefresh, realtime, refreshInterval, fetchData])

  // Realtime subscription
  useEffect(() => {
    if (realtime && isConnected) {
      subscribe()
      return () => unsubscribe()
    }
  }, [realtime, isConnected, subscribe, unsubscribe])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      unsubscribe()
    }
  }, [])

  const latest = data.length > 0 ? data[data.length - 1] : null
  const stats = calculateStats(data)
  const heatmapData = generateHeatmapData(data)

  return {
    data,
    loading,
    error,
    refresh,
    subscribe,
    unsubscribe,
    latest,
    stats,
    heatmapData
  }
}
