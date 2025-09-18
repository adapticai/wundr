/**
 * @jest-environment node
 */

import { describe, it, expect } from '@jest/globals';

// Basic test to ensure the services can be imported
describe('Core Services', () => {
  it('should be importable', () => {
    expect(() => {
      require('../src/services/index');
    }).not.toThrow();
  });

  it('should have service exports', () => {
    const serviceExports = require('../src/services/index');
    expect(serviceExports).toBeDefined();
  });
});