"use strict";
/**
 * @wundr/core - Core utilities and shared functionality for the Wundr platform
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseWundrError = exports.isFailure = exports.isSuccess = exports.failure = exports.success = exports.getEventBus = exports.log = exports.getLogger = exports.name = exports.version = exports.CORE_EVENTS = void 0;
var index_js_1 = require("./types/index.js");
Object.defineProperty(exports, "CORE_EVENTS", { enumerable: true, get: function () { return index_js_1.CORE_EVENTS; } });
// Error handling
__exportStar(require("./errors/index.js"), exports);
// Logging
__exportStar(require("./logger/index.js"), exports);
// Event system
__exportStar(require("./events/index.js"), exports);
// Utilities
__exportStar(require("./utils/index.js"), exports);
// Package info
exports.version = '1.0.0';
exports.name = '@wundr/core';
// Default exports for convenience
var index_js_2 = require("./logger/index.js");
Object.defineProperty(exports, "getLogger", { enumerable: true, get: function () { return index_js_2.getLogger; } });
Object.defineProperty(exports, "log", { enumerable: true, get: function () { return index_js_2.log; } });
var index_js_3 = require("./events/index.js");
Object.defineProperty(exports, "getEventBus", { enumerable: true, get: function () { return index_js_3.getEventBus; } });
var index_js_4 = require("./errors/index.js");
Object.defineProperty(exports, "success", { enumerable: true, get: function () { return index_js_4.success; } });
Object.defineProperty(exports, "failure", { enumerable: true, get: function () { return index_js_4.failure; } });
Object.defineProperty(exports, "isSuccess", { enumerable: true, get: function () { return index_js_4.isSuccess; } });
Object.defineProperty(exports, "isFailure", { enumerable: true, get: function () { return index_js_4.isFailure; } });
Object.defineProperty(exports, "BaseWundrError", { enumerable: true, get: function () { return index_js_4.BaseWundrError; } });
//# sourceMappingURL=index.js.map