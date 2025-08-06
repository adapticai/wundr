"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import { PerformanceMetrics, DataFetchOptions, ApiResponse, LoadingState, ErrorState } from '@/types/data'
import { useWebSocket } from './use-websocket'
import { useDataCache } from './use-data-cache'

interface UsePerformanceDataOptions extends DataFetchOptions {
  autoRefresh?: boolean
  onError?: (error: ErrorState) => void
  onUpdate?: (data: PerformanceMetrics[]) => void
}

interface UsePerformanceDataReturn {
  data: PerformanceMetrics[]
  loading: LoadingState
  error: ErrorState | null
  refresh: () => Promise<void>
  subscribe: () => void
  unsubscribe: () => void
  latest: PerformanceMetrics | null
}

export function usePerformanceData(options: UsePerformanceDataOptions = {}): UsePerformanceDataReturn {
  const {
    timeRange = '24h',
    realtime = false,
    refreshInterval = 30000,
    autoRefresh = true,
    onError,
    onUpdate
  } = options

  const [data, setData] = useState<PerformanceMetrics[]>([])
  const [loading, setLoading] = useState<LoadingState>({ isLoading: true, isRefreshing: false })
  const [error, setError] = useState<ErrorState | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const mountedRef = useRef(true)
  
  const { cache, setCache, clearCache } = useDataCache<PerformanceMetrics[]>('performance')
  const { isConnected, subscribe: wsSubscribe, unsubscribe: wsUnsubscribe, lastMessage } = useWebSocket({
    enabled: realtime,
    onMessage: handleRealtimeUpdate
  })

  function handleRealtimeUpdate(message: any) {
    if (message.type === 'performance' && message.data) {
      setData(prev => {
        const newData = [...prev, message.data].slice(-1000) // Keep last 1000 entries
        if (onUpdate) onUpdate(newData)
        return newData
      })
    }
  }

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

      const response = await fetch(`/api/performance?timeRange=${timeRange}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result: ApiResponse<PerformanceMetrics[]> = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch performance data')
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
      wsSubscribe('performance')
    }
  }, [realtime, wsSubscribe])

  const unsubscribe = useCallback(() => {
    if (realtime) {
      wsUnsubscribe('performance')
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

  return {
    data,
    loading,
    error,
    refresh,
    subscribe,
    unsubscribe,
    latest
  }
}
