#!/usr/bin/env node

const WebSocket = require('ws')

const WS_URL = 'ws://localhost:8080'
const TEST_DURATION = 5000 // 5 seconds

console.log('🧪 WebSocket Connection Test')
console.log('==============================')

function testWebSocketConnection() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL)
    const results = {
      connected: false,
      messagesReceived: 0,
      messageTypes: new Set(),
      errors: [],
      duration: 0
    }

    const startTime = Date.now()

    ws.on('open', () => {
      console.log('✅ Connected to WebSocket server')
      results.connected = true

      // Test subscription
      ws.send(JSON.stringify({
        type: 'subscribe',
        data: { topics: ['metrics', 'analysis', 'builds'] }
      }))

      // Test ping
      ws.send(JSON.stringify({
        type: 'ping',
        data: { timestamp: new Date() }
      }))

      // Request immediate metrics
      ws.send(JSON.stringify({
        type: 'request_metrics',
        data: {}
      }))
    })

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString())
        results.messagesReceived++
        results.messageTypes.add(message.type)
        
        console.log(`📨 Received: ${message.type}`)
        
        if (message.type === 'metrics' && message.data) {
          console.log(`   📊 Metrics: CPU ${message.data.cpu?.toFixed(1)}%, Memory ${message.data.memory?.toFixed(1)}%`)
        }
        
        if (message.type === 'connection' && message.data) {
          console.log(`   🔗 ${message.data.message}`)
        }
      } catch (error) {
        console.error('❌ Error parsing message:', error)
        results.errors.push(`Parse error: ${error.message}`)
      }
    })

    ws.on('close', (code, reason) => {
      results.duration = Date.now() - startTime
      console.log(`🔌 Connection closed: ${code} ${reason}`)
      resolve(results)
    })

    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error.message)
      results.errors.push(`Connection error: ${error.message}`)
      results.duration = Date.now() - startTime
      resolve(results)
    })

    // Close connection after test duration
    setTimeout(() => {
      ws.close(1000, 'Test completed')
    }, TEST_DURATION)
  })
}

async function runTests() {
  try {
    console.log(`🔍 Testing connection to ${WS_URL}...`)
    console.log(`⏱️  Test duration: ${TEST_DURATION/1000} seconds\n`)

    const results = await testWebSocketConnection()

    console.log('\n📋 Test Results')
    console.log('================')
    console.log(`✅ Connected: ${results.connected}`)
    console.log(`📨 Messages received: ${results.messagesReceived}`)
    console.log(`📝 Message types: ${Array.from(results.messageTypes).join(', ')}`)
    console.log(`⏱️  Duration: ${results.duration}ms`)
    
    if (results.errors.length > 0) {
      console.log(`❌ Errors (${results.errors.length}):`)
      results.errors.forEach(error => console.log(`   - ${error}`))
    }

    const success = results.connected && results.messagesReceived > 0 && results.errors.length === 0
    console.log(`\n🏁 Test ${success ? 'PASSED' : 'FAILED'}`)
    
    process.exit(success ? 0 : 1)

  } catch (error) {
    console.error('❌ Test failed:', error)
    process.exit(1)
  }
}

// Run tests if this is the main module
if (require.main === module) {
  runTests()
}

module.exports = { testWebSocketConnection }