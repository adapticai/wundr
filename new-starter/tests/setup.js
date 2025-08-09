"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
// Increase timeout for integration tests
globals_1.jest.setTimeout(30000);
// Mock console methods in tests
global.console = {
    ...console,
    log: globals_1.jest.fn(),
    error: globals_1.jest.fn(),
    warn: globals_1.jest.fn(),
    info: globals_1.jest.fn(),
    debug: globals_1.jest.fn(),
};
// Setup test environment variables
process.env.NODE_ENV = 'test';
process.env.CI = 'true';
// Clean up after tests
afterAll(() => {
    globals_1.jest.clearAllMocks();
    globals_1.jest.restoreAllMocks();
});
//# sourceMappingURL=setup.js.map