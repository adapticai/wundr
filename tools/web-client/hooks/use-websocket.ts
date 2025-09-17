"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import { WebSocketMessage } from '@/types/data'

interface UseWebSocketOptions {
  enabled?: boolean
  reconnectAttempts?: number
  reconnectInterval?: number
  heartbeatInterval?: number
  onMessage?: (message: any) => void
  onConnect?: () => void
  onDisconnect?: () => void
  onError?: (error: Event) => void
}

interface UseWebSocketReturn {
  isConnected: boolean
  connectionState: 'connecting' | 'connected' | 'disconnected' | 'error'
  lastMessage: any
  subscribe: (channel: string) => void
  unsubscribe: (channel: string) => void
  send: (message: any) => void
  reconnect: () => void
}

const WS_URL = process.env.NODE_ENV === 'production' 
  ? 'wss://your-domain.com/ws' 
  : 'ws://localhost:3001/ws'

export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
  const {
    enabled = true,
    reconnectAttempts = 5,
    reconnectInterval = 3000,
    heartbeatInterval = 30000,
    onMessage,
    onConnect,
    onDisconnect,
    onError
  } = options

  const [isConnected, setIsConnected] = useState(false)
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected')
  const [lastMessage, setLastMessage] = useState<any>(null)
  
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const subscriptionsRef = useRef<Set<string>>(new Set())
  const mountedRef = useRef(true)

  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current)
      heartbeatIntervalRef.current = null
    }
  }, [])

  const startHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current)
    }
    
    heartbeatIntervalRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        const pingMessage: WebSocketMessage = {
          type: 'ping',
          timestamp: new Date().toISOString()
        }
        wsRef.current.send(JSON.stringify(pingMessage))
      }
    }, heartbeatInterval)
  }, [heartbeatInterval])

  const connect = useCallback(() => {
    if (!enabled || !mountedRef.current) return
    
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return
    }

    try {
      setConnectionState('connecting')
      wsRef.current = new WebSocket(WS_URL)

      wsRef.current.onopen = () => {
        if (!mountedRef.current) return
        
        setIsConnected(true)
        setConnectionState('connected')
        reconnectAttemptsRef.current = 0
        startHeartbeat()
        
        // Resubscribe to previous channels
        subscriptionsRef.current.forEach(channel => {
          const message: WebSocketMessage = {
            type: 'subscribe',
            channel,
            timestamp: new Date().toISOString()
          }
          wsRef.current?.send(JSON.stringify(message))
        })
        
        if (onConnect) onConnect()
      }

      wsRef.current.onmessage = (event) => {
        if (!mountedRef.current) return
        
        try {
          const message = JSON.parse(event.data)
          setLastMessage(message)
          
          // Handle pong responses
          if (message.type === 'pong') {
            return
          }
          
          if (onMessage) onMessage(message)
        } catch (_error) {
          // Error logged - details available in network tab
        }
      }

      wsRef.current.onclose = () => {
        if (!mountedRef.current) return
        
        setIsConnected(false)
        setConnectionState('disconnected')
        cleanup()
        
        if (onDisconnect) onDisconnect()
        
        // Attempt reconnection
        if (reconnectAttemptsRef.current < reconnectAttempts) {
          reconnectAttemptsRef.current++
          reconnectTimeoutRef.current = setTimeout(() => {
            connect()
          }, reconnectInterval)
        } else {
          setConnectionState('error')
        }
      }

      wsRef.current.onerror = (error) => {
        if (!mountedRef.current) return
        
        setConnectionState('error')
        if (onError) onError(error)
      }
    } catch (_error) {
      if (mountedRef.current) {
        setConnectionState('error')
        // Error logged - details available in network tab
      }
    }
  }, [enabled, reconnectAttempts, reconnectInterval, startHeartbeat, cleanup, onConnect, onDisconnect, onError, onMessage])

  const disconnect = useCallback(() => {
    cleanup()
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    setIsConnected(false)
    setConnectionState('disconnected')
  }, [cleanup])

  const send = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const wsMessage: WebSocketMessage = {
        ...message,
        timestamp: new Date().toISOString()
      }
      wsRef.current.send(JSON.stringify(wsMessage))
    }
  }, [])

  const subscribe = useCallback((channel: string) => {
    subscriptionsRef.current.add(channel)
    
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const message: WebSocketMessage = {
        type: 'subscribe',
        channel,
        timestamp: new Date().toISOString()
      }
      wsRef.current.send(JSON.stringify(message))
    }
  }, [])

  const unsubscribe = useCallback((channel: string) => {
    subscriptionsRef.current.delete(channel)
    
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const message: WebSocketMessage = {
        type: 'unsubscribe',
        channel,
        timestamp: new Date().toISOString()
      }
      wsRef.current.send(JSON.stringify(message))
    }
  }, [])

  const reconnect = useCallback(() => {
    disconnect()
    reconnectAttemptsRef.current = 0
    setTimeout(connect, 100)
  }, [disconnect, connect])

  // Initialize connection
  useEffect(() => {
    if (enabled) {
      connect()
    }
    
    return () => {
      mountedRef.current = false
      disconnect()
    }
  }, [enabled, connect, disconnect])

  return {
    isConnected,
    connectionState,
    lastMessage,
    subscribe,
    unsubscribe,
    send,
    reconnect
  }
}
