"use strict";
/**
 * Logging utilities for the Wundr platform
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.log = void 0;
exports.getLogger = getLogger;
exports.createLogger = createLogger;
exports.setDefaultLogger = setDefaultLogger;
const winston_1 = __importDefault(require("winston"));
const chalk_1 = __importDefault(require("chalk"));
class WundrLogger {
    constructor(config = {}) {
        const { level = 'info', format = 'detailed', colorize = true, timestamp = true, file, console = true, } = config;
        const formats = [];
        if (timestamp) {
            formats.push(winston_1.default.format.timestamp());
        }
        if (format === 'json') {
            formats.push(winston_1.default.format.json());
        }
        else {
            formats.push(winston_1.default.format.printf(({ level, message, timestamp, ...meta }) => {
                const ts = timestamp ? `[${timestamp}]` : '';
                const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
                if (format === 'simple') {
                    return `${ts} ${level}: ${message}${metaStr}`;
                }
                // detailed format
                const levelStr = colorize ? this.colorizeLevel(level) : level.toUpperCase();
                const messageStr = colorize ? chalk_1.default.white(message) : message;
                const tsStr = colorize && timestamp ? chalk_1.default.gray(ts) : ts;
                return `${tsStr} ${levelStr} ${messageStr}${metaStr}`;
            }));
        }
        const transports = [];
        if (console) {
            transports.push(new winston_1.default.transports.Console({
                format: winston_1.default.format.combine(...formats),
            }));
        }
        if (file) {
            transports.push(new winston_1.default.transports.File({
                filename: file,
                format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.json()),
            }));
        }
        this.winston = winston_1.default.createLogger({
            level,
            transports,
        });
    }
    colorizeLevel(level) {
        switch (level) {
            case 'error':
                return chalk_1.default.red(level.toUpperCase());
            case 'warn':
                return chalk_1.default.yellow(level.toUpperCase());
            case 'info':
                return chalk_1.default.blue(level.toUpperCase());
            case 'debug':
                return chalk_1.default.green(level.toUpperCase());
            default:
                return level.toUpperCase();
        }
    }
    debug(message, meta) {
        this.winston.debug(message, meta);
    }
    info(message, meta) {
        this.winston.info(message, meta);
    }
    warn(message, meta) {
        this.winston.warn(message, meta);
    }
    error(message, meta) {
        if (message instanceof Error) {
            this.winston.error(message.message, {
                stack: message.stack,
                name: message.name,
                ...meta,
            });
        }
        else {
            this.winston.error(message, meta);
        }
    }
    child(defaultMeta) {
        const childWinston = this.winston.child(defaultMeta);
        const childLogger = Object.create(WundrLogger.prototype);
        childLogger.winston = childWinston;
        return childLogger;
    }
    setLevel(level) {
        this.winston.level = level;
    }
}
// Default logger instance
let defaultLogger;
/**
 * Get the default logger instance
 */
function getLogger() {
    if (!defaultLogger) {
        defaultLogger = new WundrLogger();
    }
    return defaultLogger;
}
/**
 * Create a new logger instance with custom configuration
 */
function createLogger(config = {}) {
    return new WundrLogger(config);
}
/**
 * Set the default logger instance
 */
function setDefaultLogger(logger) {
    defaultLogger = logger;
}
/**
 * Quick access to default logger methods
 */
exports.log = {
    debug: (message, meta) => getLogger().debug(message, meta),
    info: (message, meta) => getLogger().info(message, meta),
    warn: (message, meta) => getLogger().warn(message, meta),
    error: (message, meta) => getLogger().error(message, meta),
};
//# sourceMappingURL=index.js.map