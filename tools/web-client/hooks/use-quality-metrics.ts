"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import { QualityMetrics, DataFetchOptions, ApiResponse, LoadingState, ErrorState } from '@/types/data'
import { useWebSocket } from './use-websocket'
import { useDataCache } from './use-data-cache'

interface UseQualityMetricsOptions extends DataFetchOptions {
  autoRefresh?: boolean
  onError?: (error: ErrorState) => void
  onUpdate?: (data: QualityMetrics[]) => void
}

interface UseQualityMetricsReturn {
  data: QualityMetrics[]
  loading: LoadingState
  error: ErrorState | null
  refresh: () => Promise<void>
  subscribe: () => void
  unsubscribe: () => void
  latest: QualityMetrics | null
  trends: {
    complexity: 'improving' | 'declining' | 'stable'
    coverage: 'improving' | 'declining' | 'stable'
    debt: 'improving' | 'declining' | 'stable'
  }
}

export function useQualityMetrics(options: UseQualityMetricsOptions = {}): UseQualityMetricsReturn {
  const {
    timeRange = '24h',
    realtime = false,
    refreshInterval = 60000, // Quality metrics update less frequently
    autoRefresh = true,
    onError,
    onUpdate
  } = options

  const [data, setData] = useState<QualityMetrics[]>([])
  const [loading, setLoading] = useState<LoadingState>({ isLoading: true, isRefreshing: false })
  const [error, setError] = useState<ErrorState | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const mountedRef = useRef(true)
  
  const { cache, setCache } = useDataCache<QualityMetrics[]>('quality')
  const { isConnected, subscribe: wsSubscribe, unsubscribe: wsUnsubscribe } = useWebSocket({
    enabled: realtime,
    onMessage: handleRealtimeUpdate
  })

  function handleRealtimeUpdate(message: any) {
    if (message.type === 'quality' && message.data) {
      setData(prev => {
        const newData = [...prev, message.data].slice(-500) // Keep last 500 entries
        if (onUpdate) onUpdate(newData)
        return newData
      })
    }
  }

  const calculateTrends = useCallback((metrics: QualityMetrics[]) => {
    if (metrics.length < 2) {
      return {
        complexity: 'stable' as const,
        coverage: 'stable' as const,
        debt: 'stable' as const
      }
    }

    const recent = metrics.slice(-10)
    const previous = metrics.slice(-20, -10)

    const getAverage = (arr: QualityMetrics[], key: keyof QualityMetrics) => 
      arr.reduce((sum, item) => sum + (item[key] as number), 0) / arr.length

    const recentComplexity = getAverage(recent, 'codeComplexity')
    const previousComplexity = getAverage(previous, 'codeComplexity')
    const complexityTrend = recentComplexity < previousComplexity ? 'improving' : 
                           recentComplexity > previousComplexity ? 'declining' : 'stable'

    const recentCoverage = getAverage(recent, 'testCoverage')
    const previousCoverage = getAverage(previous, 'testCoverage')
    const coverageTrend = recentCoverage > previousCoverage ? 'improving' : 
                         recentCoverage < previousCoverage ? 'declining' : 'stable'

    const recentDebt = getAverage(recent, 'technicalDebt')
    const previousDebt = getAverage(previous, 'technicalDebt')
    const debtTrend = recentDebt < previousDebt ? 'improving' : 
                     recentDebt > previousDebt ? 'declining' : 'stable'

    return {
      complexity: complexityTrend,
      coverage: coverageTrend,
      debt: debtTrend
    }
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

      const response = await fetch(`/api/quality?timeRange=${timeRange}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result: ApiResponse<QualityMetrics[]> = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch quality metrics')
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
  }, [timeRange, cache, setCache, onError, onUpdate])

  const refresh = useCallback(async () => {
    await fetchData(true)
  }, [fetchData])

  const subscribe = useCallback(() => {
    if (realtime) {
      wsSubscribe('quality')
    }
  }, [realtime, wsSubscribe])

  const unsubscribe = useCallback(() => {
    if (realtime) {
      wsUnsubscribe('quality')
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
  const trends = calculateTrends(data)

  return {
    data,
    loading,
    error,
    refresh,
    subscribe,
    unsubscribe,
    latest,
    trends
  }
}
