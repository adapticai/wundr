#!/usr/bin/env node

const WebSocket = require('ws')
const http = require('http')

const PORT = process.env.WS_PORT || 8080

// Create HTTP server
const server = http.createServer()

// Create WebSocket server
const wss = new WebSocket.Server({ server })

// Store connected clients
const clients = new Set()

// Mock data generators for real-time updates
function generateMetrics() {
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

// Start server
server.listen(PORT, () => {
  console.log(`🚀 WebSocket server running on ws://localhost:${PORT}`)
  console.log(`📊 Dashboard real-time data streaming enabled`)
  console.log('Press Ctrl+C to stop the server')
})