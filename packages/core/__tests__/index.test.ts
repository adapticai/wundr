/**
 * @jest-environment node
 */

import { describe, it, expect } from '@jest/globals';

// Basic test to ensure the package can be imported
describe('Core Package', () => {
  it('should be importable', () => {
    expect(() => {
      require('../src/index');
    }).not.toThrow();
  });

  it('should have basic exports structure', () => {
    const coreExports = require('../src/index');
    expect(coreExports).toBeDefined();
  });
});