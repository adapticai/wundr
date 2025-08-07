/**
 * Simple test to verify the test environment is working
 */

describe('Test Environment', () => {
  it('should have access to testing utilities', () => {
    expect(expect).toBeDefined()
    expect(jest).toBeDefined()
  })

  it('should have performance available', () => {
    expect(performance).toBeDefined()
    expect(performance.now).toBeDefined()
  })

  it('should handle basic operations', () => {
    const sum = (a, b) => a + b
    expect(sum(2, 3)).toBe(5)
  })
})