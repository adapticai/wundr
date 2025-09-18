/**
 * @jest-environment node
 */

import { describe, it, expect } from '@jest/globals';

// Basic test to ensure the types can be imported
describe('Core Types', () => {
  it('should be importable', () => {
    expect(() => {
      require('../src/types/index');
    }).not.toThrow();
  });

  it('should have type exports', () => {
    const typeExports = require('../src/types/index');
    expect(typeExports).toBeDefined();
  });
});