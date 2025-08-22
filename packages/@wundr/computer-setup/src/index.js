"use strict";
/**
 * @wundr/computer-setup
 *
 * Engineering team computer provisioning tool
 * Sets up new developer machines with all required tools, configurations, and environments
 * Based on the new-starter repository functionality
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SetupOrchestrator = exports.ComputerSetupManager = exports.RealSetupOrchestrator = void 0;
const tslib_1 = require("tslib");
// Core types
tslib_1.__exportStar(require("./types"), exports);
// Profiles management
tslib_1.__exportStar(require("./profiles"), exports);
// All installers and orchestrator
tslib_1.__exportStar(require("./installers"), exports);
var real_setup_orchestrator_1 = require("./installers/real-setup-orchestrator");
Object.defineProperty(exports, "RealSetupOrchestrator", { enumerable: true, get: function () { return tslib_1.__importDefault(real_setup_orchestrator_1).default; } });
// Configuration management
tslib_1.__exportStar(require("./configurators"), exports);
// Profile personalization
tslib_1.__exportStar(require("./personalizers"), exports);
// Validation utilities
tslib_1.__exportStar(require("./validators"), exports);
// Template management
tslib_1.__exportStar(require("./templates"), exports);
// Legacy exports for compatibility
var manager_1 = require("./manager");
Object.defineProperty(exports, "ComputerSetupManager", { enumerable: true, get: function () { return manager_1.ComputerSetupManager; } });
var orchestrator_1 = require("./orchestrator");
Object.defineProperty(exports, "SetupOrchestrator", { enumerable: true, get: function () { return orchestrator_1.SetupOrchestrator; } });
//# sourceMappingURL=index.js.map