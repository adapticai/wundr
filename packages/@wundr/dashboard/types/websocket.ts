// WebSocket-specific types

export interface WebSocketConfig {
  url: string
  protocols?: string[]
  reconnectInterval: number
  maxReconnectAttempts: number
  heartbeatInterval: number
  debug: boolean
}

export interface WebSocketState {
  connected: boolean
  connecting: boolean
  reconnectAttempts: number
  lastError?: Error
  lastHeartbeat?: Date
}

export interface WebSocketSubscription {
  id: string
  topic: string
  callback: (data: any) => void
  active: boolean
}

export interface HeartbeatMessage {
  type: 'ping' | 'pong'
  timestamp: Date
  clientId?: string
}

export interface SubscriptionMessage {
  type: 'subscribe' | 'unsubscribe'
  topics: string[]
  clientId?: string
}

export interface DataMessage {
  type: 'data'
  topic: string
  payload: any
  timestamp: Date
}

export interface ErrorMessage {
  type: 'error'
  code: string
  message: string
  details?: any
}

export type WebSocketMessageType = 
  | HeartbeatMessage 
  | SubscriptionMessage 
  | DataMessage 
  | ErrorMessage