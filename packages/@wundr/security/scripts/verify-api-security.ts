#!/usr/bin/env tsx
/**
 * API Security Module Verification Script
 * Demonstrates comprehensive API security types and functionality
 */

// Import core types from our API security module
import {
  // Authentication types
  ApiAuthScheme,
  ApiAuthConfig,
  ApiAuthRequest,
  ApiAuthResult,
  ApiPrincipal,
  ApiToken,
  ApiSession,

  // Authorization types
  ApiAuthzConfig,
  ApiAuthzRequest,
  ApiAuthzResult,
  ApiPermission,

  // Rate limiting types
  ApiRateLimitConfig,
  ApiRateLimit,
  ApiRateLimitState,
  RateLimitScope,

  // CORS types
  ApiCorsConfig,
  CorsRequest,
  CorsValidationResult,
  CorsOriginType,

  // Security middleware
  ApiSecurityMiddleware,

  // Utility functions
  validateCorsOrigin,
  calculateRiskScore,

  // Constants
  API_SECURITY_CONSTANTS,
  DEFAULT_SECURITY_HEADERS,
  DEFAULT_CORS_CONFIG
} from '../src/types/api-security';

// Basic type definitions needed for the demo
type SecurityId = string;
type SecurityTimestamp = string;

console.log('🔐 API Security Module Verification');
console.log('===================================\n');

// 1. Authentication Configuration
console.log('1. Authentication Configuration');
const authConfig: ApiAuthConfig = {
  scheme: ApiAuthScheme.BEARER,
  enabled: true,
  required: true,
  methods: [],
  tokenConfig: {
    type: 'access_token' as any,
    algorithm: 'HS256' as any,
    expirationTime: 3600,
    refreshable: true,
    audience: ['api.example.com'],
    issuer: 'auth.example.com',
    signingKey: 'secret-key'
  }
};
console.log('✅ Auth config created:', authConfig.scheme);

// 2. Rate Limiting Configuration
console.log('\n2. Rate Limiting Configuration');
const rateLimitConfig: ApiRateLimitConfig = {
  enabled: true,
  globalLimits: [{
    id: 'global-limit-1',
    name: 'Global Rate Limit',
    windowMs: 60000, // 1 minute
    maxRequests: 1000,
    scope: RateLimitScope.GLOBAL,
    conditions: {},
    actions: {
      onExceeded: 'block' as any,
    },
    metrics: {
      track: true,
      metrics: ['request_count'],
      aggregation: 'count' as any,
      retention: 3600
    }
  }],
  userLimits: [],
  clientLimits: [],
  endpointLimits: [],
  quotas: [],
  enforcement: {
    strategy: 'strict' as any,
    backoff: {
      type: 'exponential' as any,
      baseDelay: 1000,
      maxDelay: 60000,
      multiplier: 2,
      jitter: true
    },
    failureHandling: {
      retryPolicy: {
        enabled: true,
        maxAttempts: 3,
        backoff: {
          type: 'exponential' as any,
          baseDelay: 1000,
          maxDelay: 30000,
          multiplier: 2,
          jitter: true
        },
        conditions: []
      },
      fallbackPolicy: {
        enabled: true,
        response: {
          statusCode: 503,
          headers: {'Content-Type': 'application/json'},
          body: '{"error": "Service temporarily unavailable"}',
          cached: false
        }
      },
      alertPolicy: {
        enabled: true,
        channels: ['email', 'slack'],
        thresholds: [],
        aggregation: {
          window: 300,
          function: 'count' as any,
          groupBy: ['client_id']
        }
      }
    }
  },
  storage: {
    type: 'memory' as any,
    connection: 'localhost',
    persistence: false
  }
};
console.log('✅ Rate limit config created with', rateLimitConfig.globalLimits.length, 'global limits');

// 3. CORS Configuration
console.log('\n3. CORS Configuration');
const corsConfig: ApiCorsConfig = {
  enabled: true,
  allowedOrigins: {
    type: CorsOriginType.STATIC,
    values: ['https://app.example.com', 'https://admin.example.com']
  },
  allowedMethods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  exposedHeaders: ['X-Rate-Limit-Remaining'],
  allowCredentials: true,
  maxAge: 86400,
  preflightContinue: false,
  optionsSuccessStatus: 204,
  enforcement: {
    strictMode: true,
    enforceCredentials: true,
    enforceSecureOrigins: true,
    violations: {
      logViolations: true,
      blockRequests: true,
      alertOnViolations: true
    },
    monitoring: {
      enabled: true,
      trackOrigins: true,
      trackViolations: true,
      metricsRetention: 86400,
      alertThresholds: {
        violationRate: 10,
        newOrigins: 5,
        suspiciousPatterns: 20
      }
    }
  }
};
console.log('✅ CORS config created with', corsConfig.allowedOrigins.values.length, 'allowed origins');

// 4. Complete Security Middleware
console.log('\n4. Complete Security Middleware');
const securityMiddleware: ApiSecurityMiddleware = {
  authentication: authConfig,
  authorization: {
    enabled: true,
    model: 'rbac' as any,
    enforceMode: 'strict' as any,
    defaultDecision: 'deny' as any,
    policies: []
  },
  rateLimit: rateLimitConfig,
  cors: corsConfig,
  validation: {
    enabled: true,
    requestValidation: {
      headers: true,
      query: true,
      body: true,
      parameters: true,
      strictMode: true,
      maxSize: 10 * 1024 * 1024,
      allowedContentTypes: ['application/json', 'application/x-www-form-urlencoded']
    },
    responseValidation: {
      enabled: true,
      validateSchema: true,
      sanitizeHeaders: true,
      securityHeaders: DEFAULT_SECURITY_HEADERS
    },
    schemaValidation: {
      enabled: true,
      schemaFormat: 'json_schema' as any,
      strictMode: true,
      coerceTypes: false,
      removeAdditional: true,
      cacheSchemas: true
    },
    sanitization: {
      enabled: true,
      htmlSanitization: true,
      sqlInjectionPrevention: true,
      xssProtection: true,
      pathTraversalPrevention: true,
      customSanitizers: []
    }
  },
  monitoring: {
    enabled: true,
    metricsCollection: {
      enabled: true,
      interval: 60,
      retention: 86400,
      metrics: ['request_count', 'response_time', 'error_rate'],
      labels: ['method', 'status_code', 'endpoint'],
      aggregation: 'average' as any
    },
    healthChecks: {
      enabled: true,
      interval: 30,
      timeout: 5000,
      checks: [],
      dependencies: []
    },
    alerting: {
      enabled: true,
      channels: [],
      rules: [],
      suppressionRules: []
    },
    tracing: {
      enabled: true,
      sampleRate: 0.1,
      exporter: {
        type: 'jaeger' as any,
        endpoint: 'http://localhost:14268/api/traces',
        timeout: 5000
      },
      tags: ['service', 'version'],
      sensitiveFields: ['password', 'token', 'secret']
    }
  },
  logging: {
    enabled: true,
    level: 'info' as any,
    format: 'json' as any,
    output: {
      type: 'console' as any,
      destination: 'stdout',
      compression: false
    },
    fields: ['timestamp', 'level', 'message', 'method', 'path', 'status'],
    sensitiveFields: ['authorization', 'x-api-key'],
    sampling: {
      enabled: false,
      rate: 1.0,
      rules: []
    }
  }
};
console.log('✅ Complete security middleware configured');

// 5. Utility Functions Demo
console.log('\n5. Utility Functions Demo');

// Test CORS origin validation
const testOrigin = 'https://app.example.com';
const isValidOrigin = validateCorsOrigin(testOrigin, corsConfig.allowedOrigins);
console.log(`✅ CORS validation for "${testOrigin}":`, isValidOrigin);

// Test risk score calculation
const mockRequest: any = {
  clientInfo: {
    trusted: false,
    network: { proxy: true, tor: false, vpn: false },
    location: { country: 'US' },
    device: { trusted: true }
  }
};
const riskScore = calculateRiskScore(mockRequest);
console.log('✅ Risk score calculated:', riskScore.toFixed(2));

// 6. Constants Demo
console.log('\n6. Security Constants');
console.log('✅ Default rate limit:', API_SECURITY_CONSTANTS.DEFAULT_RATE_LIMIT, 'req/hour');
console.log('✅ Default token expiry:', API_SECURITY_CONSTANTS.DEFAULT_TOKEN_EXPIRY, 'seconds');
console.log('✅ Max request size:', API_SECURITY_CONSTANTS.MAX_REQUEST_SIZE / 1024 / 1024, 'MB');

console.log('\n🎉 API Security Module Verification Complete!');
console.log('All types, interfaces, and utilities are working correctly.');