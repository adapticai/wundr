/**
 * Jest global setup - runs once before all test suites
 */

const path = require('path')
const fs = require('fs')

module.exports = async () => {
  console.log('🚀 Setting up test environment...')
  
  // Create test directories if they don't exist
  const testDirs = [
    '__tests__/fixtures',
    '__tests__/temp',
    '__tests__/snapshots',
    'coverage'
  ]
  
  for (const dir of testDirs) {
    const fullPath = path.join(process.cwd(), dir)
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true })
      console.log(`📁 Created test directory: ${dir}`)
    }
  }
  
  // Set environment variables for tests
  process.env.NODE_ENV = 'test'
  process.env.NEXT_PUBLIC_TEST_MODE = 'true'
  
  // Mock global objects that might not exist in test environment
  if (typeof global.structuredClone === 'undefined') {
    global.structuredClone = (obj) => JSON.parse(JSON.stringify(obj))
  }
  
  // Performance monitoring setup
  if (typeof global.performance === 'undefined') {
    const { performance } = require('perf_hooks')
    global.performance = performance
  }
  
  // Setup test database or mock services here if needed
  console.log('✅ Test environment setup complete')
}