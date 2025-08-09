#!/usr/bin/env node

const WebSocket = require('ws')
const http = require('http')
const fs = require('fs')
const path = require('path')

const PORT = process.env.WS_PORT || 8080
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3001'

// Create HTTP server with CORS support
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN)
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200)
    res.end()
    return
  }
  
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ 
      status: 'healthy', 
      clients: clients.size,
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    }))
    return
  }
  
  res.writeHead(404)
  res.end('Not Found')
})

// Create WebSocket server
const wss = new WebSocket.Server({ server })

// Store connected clients and their subscriptions
const clients = new Set()
const clientSubscriptions = new Map() // client -> Set of subscriptions

// Analysis engine integration
const ANALYSIS_ENGINE_PATH = path.join(__dirname, '../../../analysis-engine')
const METRICS_FILE = path.join(ANALYSIS_ENGINE_PATH, 'metrics.json')
const ANALYSIS_RESULTS_FILE = path.join(ANALYSIS_ENGINE_PATH, 'results.json')

// File watchers for real analysis data
let metricsWatcher = null
let resultsWatcher = null

// Mock data generators for real-time updates
function generateMetrics() {
  // Try to read real metrics first
  try {
    if (fs.existsSync(METRICS_FILE)) {
      const metricsData = JSON.parse(fs.readFileSync(METRICS_FILE, 'utf8'))
      return {
        type: 'metrics',
        data: {
          timestamp: new Date().toISOString(),
          cpu: metricsData.cpu || Math.random() * 100,
          memory: metricsData.memory || Math.random() * 100,
          disk: metricsData.disk || Math.random() * 100,
          network: metricsData.network || Math.random() * 1000,
          buildTime: metricsData.buildTime || (30000 + Math.random() * 20000),
          testCoverage: metricsData.testCoverage || (75 + Math.random() * 20),
          activeConnections: clients.size
        }
      }
    }
  } catch (error) {
    console.warn('Could not read metrics file:', error.message)
  }
  
  // Fallback to mock data
  return {
    type: 'metrics',
    data: {
      timestamp: new Date().toISOString(),
      cpu: Math.random() * 100,
      memory: Math.random() * 100,
      disk: Math.random() * 100,
      network: Math.random() * 1000,
      buildTime: 30000 + Math.random() * 20000,
      testCoverage: 75 + Math.random() * 20,
      activeConnections: clients.size
    }
  }
}

function generateBuildEvent() {
  const events = [
    { status: 'started', message: 'Build process initiated' },
    { status: 'progress', message: 'Installing dependencies...', progress: 25 },
    { status: 'progress', message: 'Compiling TypeScript...', progress: 50 },
    { status: 'progress', message: 'Running tests...', progress: 75 },
    { status: 'completed', message: 'Build completed successfully', progress: 100 },
  ]
  
  const event = events[Math.floor(Math.random() * events.length)]
  
  return {
    type: 'build_event',
    data: {
      id: `build_${Date.now()}`,
      type: 'build',
      timestamp: new Date().toISOString(),
      ...event
    }
  }
}

function generateDependencyUpdate() {
  const packages = ['react', 'next', 'typescript', 'tailwindcss', 'eslint']
  const package = packages[Math.floor(Math.random() * packages.length)]
  
  return {
    type: 'dependency_update',
    data: {
      id: `dep_${Date.now()}`,
      package,
      oldVersion: '1.0.0',
      newVersion: '1.1.0',
      type: 'minor',
      timestamp: new Date().toISOString(),
      breaking: false
    }
  }
}

function generateAnalysisUpdate() {
  return {
    type: 'analysis_update',
    data: {
      id: `analysis_${Date.now()}`,
      timestamp: new Date().toISOString(),
      findings: {
        duplicates: Math.floor(Math.random() * 50),
        circularDependencies: Math.floor(Math.random() * 10),
        securityIssues: Math.floor(Math.random() * 5),
        codeSmells: Math.floor(Math.random() * 100)
      },
      qualityScore: 70 + Math.random() * 30,
      technicalDebt: Math.floor(Math.random() * 200) + ' hours'
    }
  }
}

function generateGitActivity() {
  const authors = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve']
  const actions = ['commit', 'push', 'merge', 'create_branch']
  
  return {
    type: 'git_activity',
    data: {
      id: `git_${Date.now()}`,
      timestamp: new Date().toISOString(),
      author: authors[Math.floor(Math.random() * authors.length)],
      action: actions[Math.floor(Math.random() * actions.length)],
      message: 'Updated dashboard components',
      files: Math.floor(Math.random() * 10) + 1,
      additions: Math.floor(Math.random() * 100),
      deletions: Math.floor(Math.random() * 50)
    }
  }
}

// Broadcast message to all connected clients
function broadcast(message) {
  const data = JSON.stringify(message)
  
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data)
    }
  })
  
  console.log(`[${new Date().toISOString()}] Broadcasted: ${message.type}`)
}

// Handle WebSocket connections
wss.on('connection', (ws, request) => {
  console.log(`[${new Date().toISOString()}] Client connected from ${request.socket.remoteAddress}`)
  
  // Add client to set
  clients.add(ws)
  
  // Send welcome message
  ws.send(JSON.stringify({
    type: 'connection',
    data: {
      message: 'Connected to Wundr Dashboard WebSocket',
      timestamp: new Date().toISOString(),
      clientId: `client_${Date.now()}`
    }
  }))
  
  // Send initial data
  ws.send(JSON.stringify(generateMetrics()))
  
  // Handle messages from client
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString())
      console.log(`[${new Date().toISOString()}] Received from client:`, data)
      
      // Echo the message back or handle specific commands
      switch (data.type) {
        case 'ping':
          ws.send(JSON.stringify({
            type: 'pong',
            data: { timestamp: new Date().toISOString() }
          }))
          break
          
        case 'subscribe':
          // Handle subscription to specific data types
          ws.send(JSON.stringify({
            type: 'subscription_confirmed',
            data: { 
              topics: data.topics || [],
              timestamp: new Date().toISOString()
            }
          }))
          break
          
        case 'request_metrics':
          ws.send(JSON.stringify(generateMetrics()))
          break
          
        default:
          console.log('Unknown message type:', data.type)
      }
    } catch (error) {
      console.error('Error parsing message:', error)
    }
  })
  
  // Handle client disconnect
  ws.on('close', (code, reason) => {
    console.log(`[${new Date().toISOString()}] Client disconnected: ${code} ${reason}`)
    clients.delete(ws)
  })
  
  // Handle errors
  ws.on('error', (error) => {
    console.error(`[${new Date().toISOString()}] WebSocket error:`, error)
    clients.delete(ws)
  })
})

// Start periodic data broadcasting
const intervals = {
  metrics: setInterval(() => broadcast(generateMetrics()), 5000),
  builds: setInterval(() => {
    if (Math.random() < 0.3) { // 30% chance
      broadcast(generateBuildEvent())
    }
  }, 10000),
  dependencies: setInterval(() => {
    if (Math.random() < 0.1) { // 10% chance
      broadcast(generateDependencyUpdate())
    }
  }, 30000),
  analysis: setInterval(() => {
    if (Math.random() < 0.2) { // 20% chance
      broadcast(generateAnalysisUpdate())
    }
  }, 15000),
  git: setInterval(() => {
    if (Math.random() < 0.4) { // 40% chance
      broadcast(generateGitActivity())
    }
  }, 8000)
}

// Handle server shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down WebSocket server...')
  
  // Clear intervals
  Object.values(intervals).forEach(interval => clearInterval(interval))
  
  // Close file watchers
  if (metricsWatcher) {
    metricsWatcher.close()
    console.log('📊 Metrics watcher closed')
  }
  if (resultsWatcher) {
    resultsWatcher.close()
    console.log('🔍 Analysis watcher closed')
  }
  
  // Close all connections
  clients.forEach(client => {
    client.send(JSON.stringify({
      type: 'server_shutdown',
      data: { message: 'Server is shutting down', timestamp: new Date().toISOString() }
    }))
    client.close()
  })
  
  // Close server
  server.close(() => {
    console.log('WebSocket server closed')
    process.exit(0)
  })
})

// Initialize file watchers for analysis engine integration
function initializeAnalysisWatchers() {
  // Watch for metrics updates
  if (fs.existsSync(path.dirname(METRICS_FILE))) {
    try {
      metricsWatcher = fs.watch(path.dirname(METRICS_FILE), (eventType, filename) => {
        if (filename === 'metrics.json' && eventType === 'change') {
          console.log('📊 Metrics file changed, broadcasting update...')
          broadcast(generateMetrics())
        }
      })
      console.log('📊 Watching for metrics updates at:', METRICS_FILE)
    } catch (error) {
      console.warn('Could not set up metrics watcher:', error.message)
    }
  }

  // Watch for analysis results updates
  if (fs.existsSync(path.dirname(ANALYSIS_RESULTS_FILE))) {
    try {
      resultsWatcher = fs.watch(path.dirname(ANALYSIS_RESULTS_FILE), (eventType, filename) => {
        if (filename === 'results.json' && eventType === 'change') {
          console.log('🔍 Analysis results changed, broadcasting update...')
          broadcast(generateAnalysisUpdate())
        }
      })
      console.log('🔍 Watching for analysis updates at:', ANALYSIS_RESULTS_FILE)
    } catch (error) {
      console.warn('Could not set up analysis watcher:', error.message)
    }
  }
}

// Start server
server.listen(PORT, () => {
  console.log(`🚀 WebSocket server running on ws://localhost:${PORT}`)
  console.log(`📊 Dashboard real-time data streaming enabled`)
  console.log(`🔗 CORS enabled for: ${CORS_ORIGIN}`)
  console.log(`🏥 Health check available at: http://localhost:${PORT}/health`)
  console.log('Press Ctrl+C to stop the server')
  
  // Initialize analysis engine integration
  initializeAnalysisWatchers()
})