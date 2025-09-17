"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import { AnalysisData, ApiResponse, LoadingState, ErrorState } from '@/types/data'
import { useWebSocket } from './use-websocket'
import { useDataCache } from './use-data-cache'

interface UseAnalysisDataOptions {
  projectId?: string
  autoRefresh?: boolean
  refreshInterval?: number
  realtime?: boolean
  onError?: (error: ErrorState) => void
  onUpdate?: (data: AnalysisData) => void
}

interface UseAnalysisDataReturn {
  data: AnalysisData | null
  loading: LoadingState
  error: ErrorState | null
  refresh: () => Promise<void>
  triggerAnalysis: () => Promise<void>
  updateRecommendation: (recommendationId: string, status: string) => Promise<void>
  subscribe: () => void
  unsubscribe: () => void
}

export function useAnalysisData(options: UseAnalysisDataOptions = {}): UseAnalysisDataReturn {
  const {
    projectId,
    autoRefresh = true,
    refreshInterval = 300000, // 5 minutes
    realtime = false,
    onError,
    onUpdate
  } = options

  const [data, setData] = useState<AnalysisData | null>(null)
  const [loading, setLoading] = useState<LoadingState>({ isLoading: true, isRefreshing: false })
  const [error, setError] = useState<ErrorState | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const mountedRef = useRef(true)
  
  const { cache, setCache } = useDataCache<AnalysisData>('analysis')
  const { isConnected, subscribe: wsSubscribe, unsubscribe: wsUnsubscribe } = useWebSocket({
    enabled: realtime,
    onMessage: handleRealtimeUpdate
  })

  function handleRealtimeUpdate(message: { type: string; data?: AnalysisData; timestamp?: string }) {
    if (message.type === 'analysis' && message.data) {
      setData(prev => {
        if (!prev) return message.data
        
        // Merge real-time updates with existing data
        const updatedData = {
          ...prev,
          ...message.data,
          timestamp: message.timestamp || new Date().toISOString()
        }
        
        if (onUpdate) onUpdate(updatedData)
        return updatedData
      })
    }
  }

  const fetchData = useCallback(async (isRefresh = false) => {
    if (!mountedRef.current) return
    
    try {
      setLoading(prev => ({ ...prev, isLoading: !isRefresh, isRefreshing: isRefresh }))
      setError(null)

      // Check cache first
      const cacheKey = projectId || 'default'
      const cachedData = cache.get(cacheKey)
      if (cachedData && !isRefresh) {
        setData(cachedData)
        setLoading({ isLoading: false, isRefreshing: false })
        return
      }

      const url = projectId 
        ? `/api/analysis?projectId=${encodeURIComponent(projectId)}` 
        : '/api/analysis'
        
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result: ApiResponse<AnalysisData> = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch analysis data')
      }

      if (mountedRef.current) {
        setData(result.data)
        setCache(cacheKey, result.data)
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
  }, [projectId, cache, setCache, onError, onUpdate])

  const refresh = useCallback(async () => {
    await fetchData(true)
  }, [fetchData])

  const triggerAnalysis = useCallback(async () => {
    try {
      setLoading(prev => ({ ...prev, isRefreshing: true }))
      
      const response = await fetch('/api/analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'trigger_analysis',
          data: { projectId }
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to trigger analysis: ${response.status}`)
      }

      // Refresh data after triggering analysis
      setTimeout(() => fetchData(true), 2000)
      
    } catch (err) {
      const errorState: ErrorState = {
        message: err instanceof Error ? err.message : 'Failed to trigger analysis',
        timestamp: new Date().toISOString(),
        retry: triggerAnalysis
      }
      
      setError(errorState)
      if (onError) onError(errorState)
    } finally {
      setLoading(prev => ({ ...prev, isRefreshing: false }))
    }
  }, [projectId, fetchData, onError])

  const updateRecommendation = useCallback(async (recommendationId: string, status: string) => {
    try {
      const response = await fetch('/api/analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'update_recommendation',
          data: { recommendationId, status, projectId }
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to update recommendation: ${response.status}`)
      }

      // Optimistically update local data
      setData(prev => {
        if (!prev) return prev
        
        const updatedRecommendations = prev.recommendations.map(rec => 
          rec.id === recommendationId 
            ? { ...rec, status: status as 'pending' | 'in_progress' | 'completed' | 'dismissed' }
            : rec
        )
        
        return {
          ...prev,
          recommendations: updatedRecommendations
        }
      })
      
    } catch (err) {
      console.error('Error updating recommendation:', err)
      // Refresh data to get the latest state
      fetchData(true)
    }
  }, [projectId, fetchData])

  const subscribe = useCallback(() => {
    if (realtime) {
      wsSubscribe('dashboard')
      wsSubscribe('recommendations')
    }
  }, [realtime, wsSubscribe])

  const unsubscribe = useCallback(() => {
    if (realtime) {
      wsUnsubscribe('dashboard')
      wsUnsubscribe('recommendations')
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

  return {
    data,
    loading,
    error,
    refresh,
    triggerAnalysis,
    updateRecommendation,
    subscribe,
    unsubscribe
  }
}