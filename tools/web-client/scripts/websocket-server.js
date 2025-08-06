// Standalone WebSocket server for development
// Run with: node scripts/websocket-server.js

const WebSocket = require('ws')
const http = require('http')

const server = http.createServer()
const wss = new WebSocket.Server({ server, path: '/ws' })

const clients = new Map()
let clientIdCounter = 0

// Generate mock data
function generatePerformanceData() {
  return {
    timestamp: new Date().toISOString(),
    buildTime: 1800 + Math.random() * 800,
    bundleSize: 2.5 * 1024 * 1024 + (Math.random() - 0.5) * 0.5 * 1024 * 1024,
    memoryUsage: 450 + Math.random() * 100,
    cpuUsage: 30 + Math.random() * 20,
    loadTime: 900 + Math.random() * 400,
    testDuration: 2400 + Math.random() * 600,
    cacheHitRate: 0.8 + Math.random() * 0.15,
    errorRate: Math.random() * 1.5
  }
}

function generateQualityData() {
  return {
    timestamp: new Date().toISOString(),
    codeComplexity: 12 + Math.random() * 6,
    testCoverage: 75 + Math.random() * 15,
    duplicateLines: 800 + Math.random() * 400,
    maintainabilityIndex: 70 + Math.random() * 20,
    technicalDebt: 45 + Math.random() * 20,
    codeSmells: 15 + Math.random() * 10,
    bugs: 3 + Math.random() * 5,
    vulnerabilities: Math.random() * 3,
    linesOfCode: 52000 + Math.random() * 3000
  }
}

function generateGitData() {
  const hour = new Date().getHours()
  const activityMultiplier = (hour >= 9 && hour <= 17) ? 1.5 : 0.3
  
  return {
    timestamp: new Date().toISOString(),
    commits: Math.round(Math.random() * 5 * activityMultiplier),
    additions: Math.round(Math.random() * 200 * activityMultiplier),
    deletions: Math.round(Math.random() * 80 * activityMultiplier),
    files: Math.round(Math.random() * 10 * activityMultiplier),
    contributors: 5 + Math.round(Math.random() * 3),
    branches: 12 + Math.round(Math.random() * 2),
    pullRequests: Math.round(Math.random() * 2 * activityMultiplier),
    issues: Math.round(Math.random() * 1.5 * activityMultiplier)
  }
}

function broadcast(channel, data) {
  const message = JSON.stringify({
    type: 'data',
    channel,
    payload: {
      type: channel,
      data,
      timestamp: new Date().toISOString()
    },
    timestamp: new Date().toISOString()
  })

  clients.forEach((client, clientId) => {
    if (client.subscriptions.has(channel) && client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(message)
      } catch (error) {
        console.error(`Error sending to client ${clientId}:`, error)
        clients.delete(clientId)
      }
    }
  })
}

wss.on('connection', (ws, request) => {
  const clientId = ++clientIdCounter
  const client = {
    ws,
    subscriptions: new Set(),
    lastPing: Date.now()
  }
  
  clients.set(clientId, client)
  console.log(`Client ${clientId} connected from ${request.socket.remoteAddress}`)

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString())
      
      switch (message.type) {
        case 'subscribe':
          if (message.channel) {
            client.subscriptions.add(message.channel)
            console.log(`Client ${clientId} subscribed to ${message.channel}`)
          }
          break
          
        case 'unsubscribe':
          if (message.channel) {
            client.subscriptions.delete(message.channel)
            console.log(`Client ${clientId} unsubscribed from ${message.channel}`)
          }
          break
          
        case 'pong':
          client.lastPing = Date.now()
          break
          
        default:
          console.warn(`Unknown message type from client ${clientId}:`, message.type)
      }
    } catch (error) {
      console.error(`Error parsing message from client ${clientId}:`, error)
    }
  })

  ws.on('close', () => {
    clients.delete(clientId)
    console.log(`Client ${clientId} disconnected`)
  })

  ws.on('error', (error) => {
    console.error(`WebSocket error for client ${clientId}:`, error)
    clients.delete(clientId)
  })
})

// Send periodic data updates
setInterval(() => {
  broadcast('performance', generatePerformanceData())
}, 10000) // Every 10 seconds

setInterval(() => {
  broadcast('quality', generateQualityData())
}, 60000) // Every minute

setInterval(() => {
  broadcast('git', generateGitData())
}, 30000) // Every 30 seconds

// Heartbeat to detect dead connections
setInterval(() => {
  const now = Date.now()
  
  clients.forEach((client, clientId) => {
    if (now - client.lastPing > 60000) {
      console.log(`Removing dead client ${clientId}`)
      client.ws.terminate()
      clients.delete(clientId)
      return
    }
    
    if (client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(JSON.stringify({
          type: 'ping',
          timestamp: new Date().toISOString()
        }))
      } catch (error) {
        console.error(`Error pinging client ${clientId}:`, error)
        clients.delete(clientId)
      }
    }
  })
}, 30000) // Every 30 seconds

const PORT = process.env.WS_PORT || 3001
server.listen(PORT, () => {
  console.log(`\n🚀 WebSocket server running on port ${PORT}`)
  console.log(`📡 WebSocket URL: ws://localhost:${PORT}/ws`)
  console.log(`👥 Clients connected: ${clients.size}`)
  console.log('\n📊 Broadcasting channels:')
  console.log('  - performance (every 10s)')
  console.log('  - quality (every 60s)')
  console.log('  - git (every 30s)')
  console.log('\n📝 To connect from your dashboard:')
  console.log('  usePerformanceData({ realtime: true })')
  console.log('  useQualityMetrics({ realtime: true })')
  console.log('  useGitActivity({ realtime: true })')
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down WebSocket server...')
  server.close(() => {
    console.log('✅ WebSocket server closed')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down WebSocket server...')
  server.close(() => {
    console.log('✅ WebSocket server closed')
    process.exit(0)
  })
})
